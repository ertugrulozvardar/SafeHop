import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';
import MapView, { type MapPressEvent, Marker, Polygon, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryChips } from '../../components/CategoryChips';
import { formatDuration, ROUTE_STYLE, RouteCard, type RouteKind } from '../../components/RouteCard';
import { CITY_LIST } from '../../config';
import { loadCity, loadServices, type ServiceConfig } from '../../data/api';
import { CATEGORY_META, FILTERS } from '../../data/categories';
import { type Place, searchPlaces } from '../../data/geocode';
import { isAbort, type PlannedRoute, planRoutes, RoutingError, type TravelMode } from '../../data/routing';
import type { AreaCollection, CategoryFilter, CityData } from '../../data/types';
import { AreaLocator, distanceKm, type LatLng } from '../../lib/geo';
import { appleMapsUrl, googleMapsUrl, pickWaypoints } from '../../lib/navigation';
import { chooseRoutes, routeLevel, scoreRoute } from '../../lib/routeScore';
import { regionForBbox, toShapes } from '../../lib/shapes';
import { computeMetrics } from '../../lib/stats';
import { colors, levelColors, radius } from '../../theme';

type Field = 'from' | 'to';
interface Endpoint {
  coord: LatLng;
  label: string;
}

type Base =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: CityData; areas: AreaCollection; services: ServiceConfig };

/** A "Find the safest route" press. `key` ties it to the chosen points + travel mode. */
interface Request {
  key: string;
  run: number;
  from: Endpoint;
  to: Endpoint;
  mode: TravelMode;
}

interface Plan {
  key: string; // `${request.key}#${request.run}`
  routes: PlannedRoute[];
  refining: boolean;
  error: string | null;
}
const NO_ROUTES: PlannedRoute[] = [];

interface SearchResult {
  query: string;
  places: Place[];
  error: string | null;
}

const OSM_COPYRIGHT = 'https://www.openstreetmap.org/copyright';
const CITY_ALIASES: Record<string, string[]> = {
  nyc: ['new york', 'nyc', 'manhattan', 'brooklyn'],
  la: ['los angeles', 'hollywood'],
  chicago: ['chicago'],
  miami: ['miami'],
  seattle: ['seattle'],
};
const OSM_FIX = 'https://www.openstreetmap.org/fixthemap';

const faded = (rgba: string) => rgba.replace(/[\d.]+\)$/, '0.16)');
const isFilter = (v: unknown): v is CategoryFilter => typeof v === 'string' && (FILTERS as string[]).includes(v);
const tripKey = (from: Endpoint | null, to: Endpoint | null, mode: TravelMode) =>
  from && to ? `${from.coord.latitude},${from.coord.longitude}>${to.coord.latitude},${to.coord.longitude}|${mode}` : null;

export default function RouteScreen() {
  const params = useLocalSearchParams<{ id: string; filter?: string }>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const inputs = { from: useRef<TextInputInstance>(null), to: useRef<TextInputInstance>(null) };

  const [base, setBase] = useState<Base>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<CategoryFilter>(isFilter(params.filter) ? params.filter : 'all');
  const [mode, setMode] = useState<TravelMode>('walk');
  const [ends, setEnds] = useState<Record<Field, Endpoint | null>>({ from: null, to: null });
  const [text, setText] = useState<Record<Field, string>>({ from: '', to: '' });
  const [focus, setFocus] = useState<Field | null>(null);
  const [search, setSearch] = useState<SearchResult | null>(null);
  const [request, setRequest] = useState<Request | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selected, setSelected] = useState<{ key: string; id: string } | null>(null);
  const [topHeight, setTopHeight] = useState(120);
  const [sheetHeight, setSheetHeight] = useState(240);
  // On iOS a tap on a route line or pin also reaches the map's onPress right after; skip that one.
  const skipNextMapTap = useRef(false);
  const regionRef = useRef<{ latitudeDelta: number } | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([loadCity(String(params.id)), loadServices()])
      .then(([{ data, areas }, services]) => alive && setBase({ status: 'ready', data, areas, services }))
      .catch((err: Error) => alive && setBase({ status: 'error', message: err.message }));
    return () => {
      alive = false;
    };
  }, [params.id, attempt]);
  const reload = () => {
    setBase({ status: 'loading' });
    setAttempt((n) => n + 1);
  };

  const ready = base.status === 'ready' ? base : null;
  const locator = useMemo(() => (ready ? new AreaLocator(ready.areas) : null), [ready]);
  const shapes = useMemo(() => (ready ? toShapes(ready.areas) : []), [ready]);
  const metrics = useMemo(() => (ready ? computeMetrics(ready.data, filter) : null), [ready, filter]);
  // Detours are picked with the crime type selected when the search starts; changing it later only re-scores.
  const metricsRef = useRef(metrics);
  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  // ── Step 3: find routes when the button is pressed ────────────────────────────────────────────
  const currentKey = tripKey(ends.from, ends.to, mode);
  // A result only stays on screen while the points and travel mode are the ones it was made for.
  const active = request && request.key === currentKey ? request : null;
  const planKey = active ? `${active.key}#${active.run}` : null;

  useEffect(() => {
    if (!ready || !locator || !request) return;
    const key = `${request.key}#${request.run}`;
    const controller = new AbortController();
    const m = metricsRef.current;
    planRoutes({
      url: ready.services.routingUrl,
      from: request.from.coord,
      to: request.to.coord,
      mode: request.mode,
      locator,
      densityOf: (k) => m?.byKey.get(k)?.perKm2Month ?? null,
      signal: controller.signal,
      onUpdate: (routes, refining) => {
        if (!controller.signal.aborted) setPlan({ key, routes, refining, error: null });
      },
    })
      .then((routes) => {
        if (!controller.signal.aborted) setPlan({ key, routes, refining: false, error: null });
      })
      .catch((e) => {
        if (isAbort(e) || controller.signal.aborted) return;
        const error = e instanceof RoutingError ? e.message : 'Something went wrong while finding routes. Please try again.';
        setPlan({ key, routes: [], refining: false, error });
      });
    return () => controller.abort();
  }, [ready, locator, request]);

  const current = plan && planKey && plan.key === planKey ? plan : null;
  const routes = current?.routes ?? NO_ROUTES;
  // Results appear once the detours have been checked, so the safest route doesn't change under the user.
  const working = !!planKey && (!current || (current.refining && !current.error));
  const planError = current?.error ?? null;

  const findRoutes = () => {
    if (!ends.from || !ends.to || !currentKey) return;
    Keyboard.dismiss();
    setRequest((r) => ({ key: currentKey, run: (r?.run ?? 0) + 1, from: ends.from!, to: ends.to!, mode }));
  };

  // ── Place search (debounced) ─────────────────────────────────────────────────────────────────
  const query = focus ? text[focus].trim() : '';
  const queryIsSelection = focus ? ends[focus]?.label === text[focus] : false;
  const searchable = !!ready && !!focus && query.length >= 3 && !queryIsSelection;
  useEffect(() => {
    if (!searchable || !ready) return;
    const controller = new AbortController();
    const t = setTimeout(() => {
      searchPlaces(ready.services.geocodingUrl, query, ready.data.bbox, controller.signal)
        .then((places) => {
          if (!controller.signal.aborted) setSearch({ query, places, error: null });
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setSearch({ query, places: [], error: 'Search isn’t available right now. You can tap the map instead.' });
        });
    }, 350);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [searchable, ready, query]);
  const searchDone = search && search.query === query ? search : null;
  const searching = searchable && !searchDone;
  // While a new search runs, keep showing the previous results instead of flashing an empty list.
  const places = searchable ? (searchDone ?? search)?.places ?? [] : [];
  const searchError = searchable ? searchDone?.error ?? null : null;

  // ── Pick the safest and least safe route (re-runs instantly when the crime type changes) ───────
  const scored = useMemo(
    () => (locator && metrics ? routes.map((r) => ({ ...r, score: scoreRoute(r.coords, locator, metrics) })) : []),
    [routes, locator, metrics]
  );
  const choice = useMemo(() => chooseRoutes(scored), [scored]);
  const shown: { kind: RouteKind; route: (typeof scored)[number] }[] = choice.safest
    ? choice.leastSafe
      ? [
          { kind: 'safest', route: choice.safest },
          { kind: 'leastSafe', route: choice.leastSafe },
        ]
      : [{ kind: 'only', route: choice.safest }]
    : [];
  const selectedId = selected && selected.key === planKey ? selected.id : null;
  const activeShown = shown.find((s) => s.route.id === selectedId) ?? shown[0];
  const activeId = activeShown?.route.id ?? null;
  const showResults = !!planKey && !working && !planError && shown.length > 0;

  const fitTo = (pts: LatLng[]) =>
    mapRef.current?.fitToCoordinates(pts, {
      edgePadding: { top: topHeight + 30, bottom: sheetHeight + 30, left: 40, right: 40 },
      animated: true,
    });

  // Zoom to the routes when the results appear.
  useEffect(() => {
    if (!showResults || !ends.from || !ends.to) return;
    const pts: LatLng[] = [ends.from.coord, ends.to.coord];
    for (const s of shown) for (let i = 0; i < s.route.coords.length; i += 8) pts.push(s.route.coords[i]);
    fitTo(pts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResults, planKey]);

  // ── Steps 1 & 2: choosing the points ─────────────────────────────────────────────────────────
  const labelFor = (coord: LatLng) => {
    const area = locator?.locate(coord);
    return area ? `Pin · ${area.name}` : 'Dropped pin';
  };

  const setPoint = (field: Field, coord: LatLng, label = labelFor(coord)) => {
    setRequest(null); // a new trip: go back to the steps
    setEnds((e) => ({ ...e, [field]: { coord, label } }));
    setText((t) => ({ ...t, [field]: label }));
  };

  const onMapPress = (e: MapPressEvent) => {
    if (focus) {
      Keyboard.dismiss();
      return;
    }
    if (skipNextMapTap.current) {
      skipNextMapTap.current = false;
      return;
    }
    if (showResults || working) return; // "Edit trip" first, so a stray tap doesn't throw the results away
    const coord = e.nativeEvent.coordinate;
    if (!coord) return;
    // Ignore taps right on top of an existing pin (they select the pin instead).
    const nearKm = ((regionRef.current?.latitudeDelta ?? 0.05) * 111) / 30;
    if ((['from', 'to'] as Field[]).some((f) => ends[f] && distanceKm(ends[f]!.coord, coord) < nearKm)) return;
    setPoint(!ends.from ? 'from' : 'to', coord);
  };

  const markOverlayTap = () => {
    skipNextMapTap.current = true;
    setTimeout(() => {
      skipNextMapTap.current = false;
    }, 350);
  };

  const choosePlace = (field: Field, place: Place) => {
    setPoint(field, place.coord, place.title);
    const other: Field = field === 'from' ? 'to' : 'from';
    if (!ends[other]) {
      inputs[other].current?.focus();
      mapRef.current?.animateToRegion({ ...place.coord, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 400);
    } else Keyboard.dismiss();
  };

  const clearField = (field: Field) => {
    setRequest(null);
    setEnds((e) => ({ ...e, [field]: null }));
    setText((t) => ({ ...t, [field]: '' }));
  };

  const swap = () => {
    setRequest(null);
    setEnds((e) => ({ from: e.to, to: e.from }));
    setText((t) => ({ from: t.to, to: t.from }));
  };

  const onType = (field: Field, value: string) => {
    setText((t) => ({ ...t, [field]: value }));
    if (ends[field] && ends[field]?.label !== value) {
      setRequest(null);
      setEnds((e) => ({ ...e, [field]: null }));
    }
  };

  const editTrip = () => setRequest(null);

  // ── Step 4: hand the chosen route to a navigation app ────────────────────────────────────────
  const startNavigation = (coords: LatLng[]) => {
    if (!ends.from || !ends.to) return;
    const stops = pickWaypoints(coords);
    const open = (url: string) =>
      Linking.openURL(url).catch(() => Alert.alert('Couldn’t open Maps', 'Please check that the Maps app is installed.'));
    const apple = () => open(appleMapsUrl(ends.from!.coord, ends.to!.coord, stops, mode));
    const google = () => open(googleMapsUrl(ends.from!.coord, ends.to!.coord, stops, mode));
    const title = 'Start this route in…';
    const message = `The route is passed on with ${stops.length} stop${stops.length === 1 ? '' : 's'} along the way, so the maps app follows SafeHop’s route.`;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title, message, options: ['Apple Maps', 'Google Maps', 'Cancel'], cancelButtonIndex: 2 },
        (i) => (i === 0 ? apple() : i === 1 ? google() : undefined)
      );
    } else {
      Alert.alert(title, message, [{ text: 'Google Maps', onPress: google }, { text: 'Cancel', style: 'cancel' }]);
    }
  };

  const selectRoute = (id: string) => {
    setSelected({ key: planKey ?? '', id });
    const r = scored.find((x) => x.id === id);
    if (r) fitTo(r.coords.filter((_, i) => i % 6 === 0).concat(r.coords[r.coords.length - 1]));
  };

  // ── Render ─────────────────────────────────────────────────────────────────────────────────────
  if (base.status !== 'ready') {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Safest route' }} />
        {base.status === 'loading' ? (
          <ActivityIndicator size="large" color={colors.brand} />
        ) : (
          <>
            <Text style={styles.errorTitle}>Data unavailable</Text>
            <Text style={[styles.muted, { textAlign: 'center' }]}>{base.message}</Text>
            <Pressable style={styles.button} onPress={reload} accessibilityRole="button">
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  const { data } = base;
  // Someone typing another SafeHop city (e.g. "New York" while in Chicago) gets a clear explanation.
  const q = query.toLowerCase();
  const otherCity =
    q.length >= 3
      ? CITY_LIST.find(
          (c) =>
            c.id !== data.id &&
            [c.name, c.id, ...(CITY_ALIASES[c.id] ?? [])].some((name) => {
              const n = name.toLowerCase();
              return n.startsWith(q) || q === n || q.startsWith(`${n} `);
            })
        )
      : undefined;
  const showSuggestions =
    focus !== null && (places.length > 0 || searching || !!searchError || !!otherCity) && !queryIsSelection;
  const outside = (['from', 'to'] as Field[]).filter((f) => ends[f] && !locator?.locate(ends[f]!.coord));
  const canFind = !!ends.from && !!ends.to;
  const crimeType = CATEGORY_META[filter].short.toLowerCase();
  const modeWord = mode === 'walk' ? 'Walking' : 'Driving';

  // One sentence comparing the two routes, including the time difference.
  let summary = '';
  if (choice.safest && choice.leastSafe && choice.gain !== null) {
    const extra = choice.safest.durationMin - choice.leastSafe.durationMin;
    const time =
      extra >= 1
        ? ` and takes ${formatDuration(extra)} longer`
        : extra <= -1
          ? ` and is also ${formatDuration(-extra)} faster`
          : ' in about the same time';
    summary =
      choice.gain >= 0.05
        ? `The safest route passes through areas with ${Math.round(choice.gain * 100)}% less reported crime${time}.`
        : 'Both routes pass through areas with almost the same crime levels.';
  } else if (choice.safest) {
    summary = 'Only one practical route was found between these points, so there is no safer one to compare it with.';
  }
  const through = activeShown
    ? activeShown.route.score.areas
        .filter((a) => a.km > 0.1)
        .map((a) => a.name)
        .join(' → ')
    : '';

  const steps: { done: boolean; text: string }[] = [
    { done: !!ends.from, text: ends.from ? `Start: ${ends.from.label}` : 'Choose your start point' },
    { done: !!ends.to, text: ends.to ? `Destination: ${ends.to.label}` : 'Choose your destination' },
  ];

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: 'Safest route' }} />
      <MapView
        ref={mapRef}
        style={styles.flex}
        initialRegion={regionForBbox(data.bbox)}
        mapPadding={{ top: topHeight, right: 0, bottom: sheetHeight, left: 0 }}
        onPress={onMapPress}
        onRegionChangeComplete={(r) => (regionRef.current = r)}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        showsPointsOfInterests={false}
      >
        {shapes.map((s) => {
          const lc = levelColors[metrics?.byKey.get(s.key)?.level ?? 'none'];
          return s.polys.map((p, i) => (
            <Polygon
              key={`${s.key}-${i}`}
              coordinates={p.outer}
              holes={p.holes}
              fillColor={faded(lc.fill)}
              strokeColor="rgba(15,61,62,0.25)"
              strokeWidth={1}
              tappable={false}
            />
          ));
        })}

        {showResults &&
          [...shown]
            .sort((a, b) => (a.route.id === activeId ? 1 : 0) - (b.route.id === activeId ? 1 : 0))
            .map(({ kind, route }) => {
              const isActive = route.id === activeId;
              const color = ROUTE_STYLE[kind].color;
              return [
                isActive ? (
                  <Polyline key={`${route.id}-halo`} coordinates={route.coords} strokeColor="#FFFFFF" strokeWidth={10} zIndex={9} />
                ) : null,
                <Polyline
                  key={route.id}
                  coordinates={route.coords}
                  strokeColor={isActive ? color : `${color}AA`}
                  strokeWidth={isActive ? 6 : 4}
                  lineDashPattern={kind === 'leastSafe' ? [10, 6] : undefined}
                  zIndex={isActive ? 10 : 5}
                  tappable
                  onPress={() => {
                    markOverlayTap();
                    selectRoute(route.id);
                  }}
                />,
              ];
            })}

        {ends.from && (
          <Marker
            coordinate={ends.from.coord}
            draggable
            onDragEnd={(e) => setPoint('from', e.nativeEvent.coordinate)}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={markOverlayTap}
            onDragStart={markOverlayTap}
            title="Start"
          >
            <View style={[styles.pin, { backgroundColor: colors.brand }]}>
              <Text style={styles.pinText}>A</Text>
            </View>
          </Marker>
        )}
        {ends.to && (
          <Marker
            coordinate={ends.to.coord}
            draggable
            onDragEnd={(e) => setPoint('to', e.nativeEvent.coordinate)}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={markOverlayTap}
            onDragStart={markOverlayTap}
            title="Destination"
          >
            <View style={[styles.pin, { backgroundColor: '#14181F' }]}>
              <Text style={styles.pinText}>B</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {/* ── Top: start / destination ── */}
      <View style={styles.top} onLayout={(e) => setTopHeight(Math.round(e.nativeEvent.layout.height) + 10)}>
        <View style={styles.inputCard}>
          <View style={styles.inputs}>
            {(['from', 'to'] as Field[]).map((field) => (
              <View key={field} style={styles.inputRow}>
                <View style={[styles.dot, { backgroundColor: field === 'from' ? colors.brand : '#14181F' }]}>
                  <Text style={styles.dotText}>{field === 'from' ? 'A' : 'B'}</Text>
                </View>
                <TextInput
                  ref={inputs[field]}
                  style={[styles.input, focus === field && styles.inputFocused]}
                  value={text[field]}
                  onChangeText={(v) => onType(field, v)}
                  onFocus={() => setFocus(field)}
                  onBlur={() => setFocus((f) => (f === field ? null : f))}
                  placeholder={field === 'from' ? `Start in ${data.name}: search or tap the map` : `Destination in ${data.name}`}
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="search"
                  autoCorrect={false}
                  accessibilityLabel={field === 'from' ? 'Start point' : 'Destination'}
                />
                {!!text[field] && (
                  <Pressable onPress={() => clearField(field)} hitSlop={10} accessibilityLabel="Clear" style={styles.clear}>
                    <Text style={styles.clearText}>✕</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
          <Pressable onPress={swap} style={styles.swap} hitSlop={6} accessibilityRole="button" accessibilityLabel="Swap start and destination">
            <Text style={styles.swapText}>⇅</Text>
          </Pressable>
        </View>

        {showSuggestions && focus && (
          <ScrollView style={styles.suggestions} keyboardShouldPersistTaps="handled">
            {searching && places.length === 0 && <Text style={styles.suggestionInfo}>Searching…</Text>}
            {!!searchError && <Text style={styles.suggestionInfo}>{searchError}</Text>}
            {places.map((p) => (
              <Pressable key={p.id} onPress={() => choosePlace(focus, p)} style={styles.suggestion} accessibilityRole="button">
                <Text style={styles.suggestionTitle} numberOfLines={1}>
                  {p.title}
                </Text>
                {!!p.detail && (
                  <Text style={styles.suggestionDetail} numberOfLines={1}>
                    {p.detail}
                  </Text>
                )}
              </Pressable>
            ))}
            {!searching && !searchError && places.length === 0 && (
              <Text style={styles.suggestionInfo}>
                {otherCity
                  ? `${otherCity.name} is a separate city in SafeHop. Both points must be in ${data.name}, because the crime data covers one city at a time. Go back and open ${otherCity.name} to plan a route there.`
                  : `No places found in ${data.name}. Both points must be in ${data.name}.`}
              </Text>
            )}
          </ScrollView>
        )}
      </View>

      {/* ── Bottom sheet: steps → progress → results ── */}
      <View
        style={[styles.sheet, { paddingBottom: insets.bottom + 10 }]}
        onLayout={(e) => setSheetHeight(Math.round(e.nativeEvent.layout.height))}
      >
        {working ? (
          <View style={styles.progress}>
            <ActivityIndicator color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>Finding the safest route…</Text>
              <Text style={styles.muted}>Comparing possible routes by the reported crime in the areas they pass through.</Text>
            </View>
          </View>
        ) : planError ? (
          <View style={styles.block}>
            <Text style={[styles.sheetTitle, styles.padded]}>No route found</Text>
            <Text style={[styles.muted, styles.padded]}>{planError}</Text>
            <View style={styles.row}>
              <Pressable style={styles.button} onPress={findRoutes} accessibilityRole="button">
                <Text style={styles.buttonText}>Try again</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={editTrip} accessibilityRole="button">
                <Text style={styles.secondaryButtonText}>Edit trip</Text>
              </Pressable>
            </View>
          </View>
        ) : showResults ? (
          <View style={styles.block}>
            <View style={styles.resultsHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {modeWord} · based on {crimeType}
              </Text>
              <Pressable onPress={editTrip} hitSlop={8} accessibilityRole="button">
                <Text style={styles.link}>Edit trip</Text>
              </Pressable>
            </View>
            <View style={styles.cards}>
              {shown.map(({ kind, route }) => (
                <RouteCard
                  key={route.id}
                  kind={kind}
                  selected={route.id === activeId}
                  durationMin={route.durationMin}
                  distanceKm={route.distanceKm}
                  score={route.score}
                  level={metrics ? routeLevel(route.score, metrics.thresholds) : 'none'}
                  hasFerry={route.hasFerry}
                  onPress={() => selectRoute(route.id)}
                />
              ))}
            </View>
            {activeShown && (
              <Pressable
                style={({ pressed }) => [
                  styles.startButton,
                  { backgroundColor: ROUTE_STYLE[activeShown.kind].color },
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => startNavigation(activeShown.route.coords)}
                accessibilityRole="button"
                accessibilityHint="Opens Apple Maps or Google Maps with turn-by-turn directions for this route"
              >
                <Text style={styles.startButtonText}>
                  {activeShown.kind === 'only' ? 'Start route' : `Start ${ROUTE_STYLE[activeShown.kind].label.toLowerCase()}`} ➜
                </Text>
              </Pressable>
            )}
            {!!summary && <Text style={styles.summary}>{summary}</Text>}
            {!!through && activeShown && (
              <Text style={[styles.muted, styles.padded]} numberOfLines={2}>
                {shown.length > 1 ? `${ROUTE_STYLE[activeShown.kind].label} goes through: ` : 'Goes through: '}
                {through}
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.block}>
            {steps.map((s, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={[styles.stepBadge, s.done && styles.stepBadgeDone]}>
                  <Text style={[styles.stepBadgeText, s.done && styles.stepBadgeTextDone]}>{s.done ? '✓' : i + 1}</Text>
                </View>
                <Text style={[styles.stepText, s.done && styles.stepTextDone]} numberOfLines={1}>
                  {s.text}
                </Text>
              </View>
            ))}
            {!canFind && <Text style={[styles.muted, styles.padded]}>Type a place in the boxes above, or tap the map.</Text>}

            <View style={styles.row}>
              <Text style={styles.labelInline}>Travel</Text>
              <View style={styles.modeRow}>
                {(['walk', 'drive'] as TravelMode[]).map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setMode(m)}
                    style={[styles.mode, mode === m && styles.modeSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: mode === m }}
                  >
                    <Text style={[styles.modeText, mode === m && styles.modeTextSelected]}>{m === 'walk' ? 'Walk' : 'Drive'}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Text style={[styles.label, styles.padded]}>Safety based on</Text>
            <CategoryChips value={filter} onChange={setFilter} />

            <Pressable
              style={[styles.findButton, !canFind && styles.findButtonDisabled]}
              onPress={findRoutes}
              disabled={!canFind}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canFind }}
            >
              <Text style={styles.findButtonText}>Find the safest route</Text>
            </Pressable>
          </View>
        )}

        {outside.length > 0 && (
          <Text style={styles.note}>
            The {outside.length === 2 ? 'start and destination are' : outside[0] === 'from' ? 'start is' : 'destination is'} outside
            SafeHop’s {data.name} areas; that part of the trip has no crime data.
          </Text>
        )}
        <Text style={styles.footer}>
          Based on crimes reported to police per area in the last 6 months — not a guarantee of safety. Routes & search ©{' '}
          <Text style={styles.link} onPress={() => Linking.openURL(OSM_COPYRIGHT)}>
            OpenStreetMap
          </Text>{' '}
          contributors ·{' '}
          <Text style={styles.link} onPress={() => Linking.openURL(OSM_FIX)}>
            Report a map error
          </Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  padded: { paddingHorizontal: 16 },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  button: { backgroundColor: colors.brand, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.pill },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontWeight: '600' },

  top: { position: 'absolute', top: 10, left: 12, right: 12, gap: 8 },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  inputs: { flex: 1, gap: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 30,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
  },
  inputFocused: { backgroundColor: colors.brandSoft },
  clear: { position: 'absolute', right: 8, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  clearText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  swap: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  swapText: { fontSize: 20, color: colors.brand, fontWeight: '700' },

  suggestions: {
    maxHeight: 260,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  suggestion: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  suggestionTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  suggestionDetail: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  suggestionInfo: { padding: 14, fontSize: 13, color: colors.textMuted },

  pin: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  pinText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
  },
  block: { gap: 8 },
  progress: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  labelInline: { fontSize: 13, fontWeight: '700', color: colors.textMuted, width: 52 },

  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeDone: { backgroundColor: colors.brand },
  stepBadgeText: { fontSize: 12, fontWeight: '800', color: colors.brand },
  stepBadgeTextDone: { color: '#fff' },
  stepText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  stepTextDone: { color: colors.textMuted, fontWeight: '500' },

  modeRow: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: radius.pill, padding: 3, gap: 2 },
  mode: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: radius.pill },
  modeSelected: { backgroundColor: colors.brand },
  modeText: { fontSize: 14, fontWeight: '600', color: colors.text },
  modeTextSelected: { color: '#fff' },

  findButton: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  findButtonDisabled: { opacity: 0.35 },
  findButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  startButton: { marginHorizontal: 16, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  startButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  resultsHeader: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cards: { flexDirection: 'row', gap: 10, paddingHorizontal: 12 },
  summary: { paddingHorizontal: 16, fontSize: 14, lineHeight: 19, fontWeight: '600', color: colors.text },
  note: { paddingHorizontal: 16, fontSize: 12, lineHeight: 16, color: colors.warningText },
  footer: { paddingHorizontal: 16, fontSize: 11, lineHeight: 15, color: colors.textMuted },
  link: { color: colors.brand, fontWeight: '600' },
});
