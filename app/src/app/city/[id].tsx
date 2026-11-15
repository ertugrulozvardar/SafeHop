import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Polygon } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AreaSheet } from '../../components/AreaSheet';
import { CategoryChips } from '../../components/CategoryChips';
import { ChoiceChips } from '../../components/ChoiceChips';
import { CostSheet } from '../../components/CostSheet';
import type { IconName } from '../../components/Icon';
import { Legend } from '../../components/Legend';
import { ModeTabs } from '../../components/ModeTabs';
import { GOOD_VALUE_COLOR, PriceMarker } from '../../components/PriceMarker';
import { type DataOrigin, loadCity, loadCosts } from '../../data/api';
import { CATEGORY_META } from '../../data/categories';
import type { AreaCollection, CategoryFilter, CityData, CostData } from '../../data/types';
import {
  formatMonth,
  formatUsd,
  type PriceMetrics,
  RENT_LABEL,
  RENT_SHORT,
  rentMetrics,
  type RentSize,
  STAY_LABEL,
  type StayKind,
  stayMetrics,
} from '../../lib/costs';
import { type LabelCandidate, labelPoints, labelWidth, type MapRegion, placeLabels } from '../../lib/labels';
import { regionForBbox, toShapes } from '../../lib/shapes';
import { computeMetrics, formatRange } from '../../lib/stats';
import { colors, levelColors, priceColors, radius } from '../../theme';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: CityData; areas: AreaCollection; origin: DataOrigin };

type Tab = 'safety' | 'stay' | 'rent';
const TABS = [
  { key: 'safety', label: 'Safety', icon: 'shield-checkmark-outline', iconSelected: 'shield-checkmark' },
  { key: 'stay', label: 'Stay', icon: 'bed-outline', iconSelected: 'bed' },
  { key: 'rent', label: 'Rent', icon: 'home-outline', iconSelected: 'home' },
] as const satisfies { key: Tab; label: string; icon: IconName; iconSelected: IconName }[];
const FADED = 'rgba(154,164,174,0.08)';

/** Until the map reports what it shows, assume the whole city. */
const region0 = (bbox: CityData['bbox']): MapRegion => regionForBbox(bbox);

/** Legend labels for the three price groups, rounded to readable steps. */
function priceLegend(m: PriceMetrics, step: number, withNoData: boolean) {
  const r = (n: number) => formatUsd(Math.round(n / step) * step);
  const items: { color: string; label: string }[] = [
    { color: priceColors.cheaper.solid, label: `Under ${r(m.thresholds[0])}` },
    { color: priceColors.mid.solid, label: `${r(m.thresholds[0])}–${r(m.thresholds[1])}` },
    { color: priceColors.pricier.solid, label: `Over ${r(m.thresholds[1])}` },
  ];
  if (withNoData) items.push({ color: priceColors.none.solid, label: 'Too few listings' });
  return items;
}

export default function CityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [tab, setTab] = useState<Tab>('safety');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [stayKind, setStayKind] = useState<StayKind>('entire');
  const [rentSize, setRentSize] = useState<RentSize>(1);
  const [saferOnly, setSaferOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [costs, setCosts] = useState<{ id: string; data: CostData | null } | null>(null);
  // Height of the legend card, so the map's logo/"Legal" link (Apple Maps / Google)
  // is laid out above it instead of being covered — required by the map providers.
  const [legendHeight, setLegendHeight] = useState(90);
  // What the map currently shows, to decide which price labels fit (more appear as you zoom in).
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<MapRegion | null>(null);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [topHeight, setTopHeight] = useState(110);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    loadCity(String(id))
      .then(({ data, areas, origin }) => alive && setState({ status: 'ready', data, areas, origin }))
      .catch((err: Error) => alive && setState({ status: 'error', message: err.message }));
    loadCosts(String(id)).then((data) => alive && setCosts({ id: String(id), data }));
    return () => {
      alive = false;
    };
  }, [id, attempt]);

  const load = () => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  };

  const shapes = useMemo(() => (state.status === 'ready' ? toShapes(state.areas) : []), [state]);
  const metrics = useMemo(() => (state.status === 'ready' ? computeMetrics(state.data, filter) : null), [state, filter]);
  // Crime over all categories: used to fade higher-crime areas and in the cost details.
  const crimeAll = useMemo(() => (state.status === 'ready' ? computeMetrics(state.data, 'all') : null), [state]);
  const costData = costs && costs.id === String(id) ? costs.data : null;
  const costsLoading = !costs || costs.id !== String(id);
  const priceMetrics = useMemo(
    () => (tab === 'stay' ? stayMetrics(costData, stayKind) : tab === 'rent' ? rentMetrics(costData, rentSize) : null),
    [tab, costData, stayKind, rentSize]
  );
  const points = useMemo(() => (state.status === 'ready' ? labelPoints(state.areas) : new Map()), [state]);

  if (state.status === 'loading') {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: '' }} />
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.muted}>Loading the latest data…</Text>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: '' }} />
        <Text style={styles.errorTitle}>Data unavailable</Text>
        <Text style={[styles.muted, { textAlign: 'center' }]}>{state.message}</Text>
        <Pressable style={styles.button} onPress={load} accessibilityRole="button">
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const { data } = state;
  const initialRegion = regionForBbox(data.bbox);
  const selectedArea = selected ? data.areas.find((a) => a.key === selected) : undefined;
  const selectedMetric = selected && metrics ? metrics.byKey.get(selected) : undefined;

  // One note at the top of the map, depending on the layer.
  let banner: string | null | undefined = null;
  if (tab === 'safety') banner = data.stale ? data.staleReason : data.notes[0];
  else if (costsLoading) banner = null;
  else if (!costData) banner = 'Prices couldn’t be loaded. Check your connection and open the city again.';
  else if (tab === 'stay' && !costData.stay) banner = `Nightly prices aren’t available for ${data.name} yet.`;
  else if (tab === 'stay' && costData.stay && costData.stay.longStayShare >= 0.3)
    banner = `About ${Math.round(costData.stay.longStayShare * 100)}% of the listings here require stays of 30 nights or more, so prices partly reflect month-long stays.`;
  else if (tab === 'rent' && !costData.rent) banner = 'Rent data isn’t available yet.';

  // ★ Good value: lower reported crime (all categories) and not in the priciest third of the city.
  const isGoodValue = (key: string) => {
    const level = priceMetrics?.byKey.get(key)?.level;
    return crimeAll?.byKey.get(key)?.level === 'lower' && (level === 'cheaper' || level === 'mid');
  };
  const areaSize = new Map(data.areas.map((a) => [a.key, a.areaKm2]));
  const labels: (LabelCandidate & { text: string; goodValue: boolean })[] = [];
  if (tab !== 'safety' && priceMetrics) {
    for (const [key, m] of priceMetrics.byKey) {
      const pt = points.get(key);
      if (!pt || (saferOnly && crimeAll?.byKey.get(key)?.level === 'higher')) continue;
      const text = formatUsd(m.value);
      const goodValue = isGoodValue(key);
      labels.push({
        key,
        ...pt,
        text,
        goodValue,
        width: labelWidth(text, goodValue),
        priority: (key === selected ? 1e6 : 0) + (goodValue ? 1e4 : 0) + (areaSize.get(key) ?? 0),
      });
    }
  }
  const shownLabels = placeLabels(labels, region ?? region0(data.bbox), mapSize, {
    top: topHeight + 4,
    bottom: legendHeight + insets.bottom + 16,
  });
  const anyGoodValue = labels.some((l) => l.goodValue);

  const fillFor = (key: string) => {
    if (tab === 'safety') return levelColors[metrics?.byKey.get(key)?.level ?? 'none'].fill;
    if (saferOnly && crimeAll?.byKey.get(key)?.level === 'higher') return FADED;
    return priceColors[priceMetrics?.byKey.get(key)?.level ?? 'none'].fill;
  };

  let legend = (
    <Legend
      caption={`${CATEGORY_META[filter].label} per km², compared with other areas in ${data.name} · ${formatRange(data.window.start, data.window.end)}${state.origin === 'offline-copy' ? ' (offline copy)' : ''}. Tap an area for details.`}
    />
  );
  if (tab !== 'safety' && priceMetrics && costData) {
    const faded = saferOnly ? ' Faded = higher-crime areas.' : '';
    const star = anyGoodValue ? [{ color: GOOD_VALUE_COLOR, icon: 'star' as const, label: 'Good value' }] : [];
    const starNote = anyGoodValue ? ' ★ = lower crime, not among the priciest.' : '';
    legend =
      tab === 'stay' && costData.stay ? (
        <Legend
          items={[...priceLegend(priceMetrics, 10, priceMetrics.byKey.size < data.areas.length), ...star]}
          caption={`Median nightly price, ${STAY_LABEL[stayKind].toLowerCase()} · Airbnb listings collected ${formatMonth(costData.stay.snapshot)} (Inside Airbnb).${faded}${starNote} Zoom in for more prices.`}
        />
      ) : costData.rent ? (
        <Legend
          items={[...priceLegend(priceMetrics, 50, false), ...star]}
          caption={`Typical monthly rent, ${RENT_LABEL[rentSize].toLowerCase()} · HUD FY${costData.rent.fy}, estimated from ZIP codes.${faded}${starNote} Zoom in for more prices.`}
        />
      ) : (
        legend
      );
  }

  const saferChip = {
    key: 'safer',
    label: 'Lower-crime areas only',
    selected: saferOnly,
    toggle: true,
    icon: 'shield-checkmark-outline' as const,
    onPress: () => setSaferOnly((v) => !v),
  };

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: data.name,
          headerRight: () => (
            <Pressable onPress={() => router.push('/about')} hitSlop={10} accessibilityRole="link" accessibilityLabel="About the data">
              <Text style={styles.headerLink}>About</Text>
            </Pressable>
          ),
        }}
      />
      <MapView
        style={styles.flex}
        ref={mapRef}
        initialRegion={initialRegion}
        onLayout={(e) => setMapSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        onRegionChangeComplete={(r) => setRegion(r)}
        onMapReady={() => {
          // The map fits the requested region to its own shape; read back what it really shows.
          mapRef.current
            ?.getMapBoundaries()
            .then(({ northEast: ne, southWest: sw }) =>
              setRegion({
                latitude: (ne.latitude + sw.latitude) / 2,
                longitude: (ne.longitude + sw.longitude) / 2,
                latitudeDelta: ne.latitude - sw.latitude,
                longitudeDelta: ne.longitude - sw.longitude,
              })
            )
            .catch(() => {});
        }}
        mapPadding={{ top: 0, right: 0, bottom: legendHeight + insets.bottom + 16, left: 0 }}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {shapes.map((s) => {
          const isSel = s.key === selected;
          return s.polys.map((p, i) => (
            <Polygon
              key={`${s.key}-${i}`}
              coordinates={p.outer}
              holes={p.holes}
              fillColor={fillFor(s.key)}
              strokeColor={isSel ? '#111' : 'rgba(15,61,62,0.55)'}
              strokeWidth={isSel ? 3 : 1}
              zIndex={isSel ? 2 : 1}
              tappable
              onPress={() => setSelected(s.key)}
            />
          ));
        })}
        {labels
          .filter((l) => shownLabels.has(l.key))
          .map((l) => (
            <PriceMarker
              key={`${tab}-${l.key}-${l.text}-${l.goodValue ? 1 : 0}-${l.key === selected ? 1 : 0}`}
              coordinate={{ latitude: l.latitude, longitude: l.longitude }}
              text={l.text}
              level={priceMetrics?.byKey.get(l.key)?.level ?? 'none'}
              goodValue={l.goodValue}
              selected={l.key === selected}
              onPress={() => setSelected(l.key)}
            />
          ))}
      </MapView>

      <View
        style={styles.topOverlay}
        pointerEvents="box-none"
        onLayout={(e) => {
          const h = Math.round(e.nativeEvent.layout.y + e.nativeEvent.layout.height);
          if (Math.abs(h - topHeight) > 2) setTopHeight(h);
        }}
      >
        <ModeTabs value={tab} options={TABS} onChange={setTab} />
        {tab === 'safety' ? (
          <CategoryChips value={filter} onChange={setFilter} available={data.categories} />
        ) : tab === 'stay' ? (
          <ChoiceChips
            items={[
              ...(['entire', 'room'] as StayKind[]).map((k) => ({
                key: k,
                label: STAY_LABEL[k],
                icon: k === 'entire' ? ('home-outline' as const) : ('bed-outline' as const),
                selected: stayKind === k,
                onPress: () => setStayKind(k),
              })),
              saferChip,
            ]}
          />
        ) : (
          <ChoiceChips
            items={[
              ...([0, 1, 2, 3] as RentSize[]).map((n) => ({
                key: String(n),
                label: RENT_SHORT[n],
                selected: rentSize === n,
                onPress: () => setRentSize(n),
              })),
              saferChip,
            ]}
          />
        )}
        {!!banner && dismissed !== banner && (
          <Pressable style={styles.banner} onPress={() => setDismissed(banner ?? null)} accessibilityHint="Dismiss">
            <Text style={styles.bannerText}>{banner}</Text>
            <Text style={styles.bannerDismiss}>✕</Text>
          </Pressable>
        )}
        {tab !== 'safety' && costsLoading && (
          <View style={styles.loadingPill}>
            <ActivityIndicator size="small" color={colors.brand} />
            <Text style={styles.loadingText}>Loading prices…</Text>
          </View>
        )}
      </View>

      {selectedArea && tab !== 'safety' && costData ? (
        <CostSheet
          city={data}
          area={selectedArea}
          mode={tab}
          costs={costData}
          stayKind={stayKind}
          rentSize={rentSize}
          price={priceMetrics?.byKey.get(selectedArea.key)}
          crime={crimeAll?.byKey.get(selectedArea.key)}
          goodValue={isGoodValue(selectedArea.key)}
          onShowCrime={() => setTab('safety')}
          onClose={() => setSelected(null)}
          bottomInset={insets.bottom}
        />
      ) : selectedArea && selectedMetric ? (
        <AreaSheet
          city={data}
          area={selectedArea}
          metric={selectedMetric}
          filter={filter}
          onFilterChange={setFilter}
          onClose={() => setSelected(null)}
          bottomInset={insets.bottom}
        />
      ) : (
        <View
          style={[styles.bottomOverlay, { bottom: insets.bottom + 12 }]}
          pointerEvents="box-none"
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            if (Math.abs(h - legendHeight) > 2) setLegendHeight(h);
          }}
        >
          {/* Inside the measured overlay, so the map keeps its logo and "Legal" link above the button too. */}
          <Pressable
            onPress={() => router.push({ pathname: '/route/[id]', params: { id: data.id, filter } })}
            style={({ pressed }) => [styles.routeButton, pressed && styles.routeButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Find a safe route in ${data.name}`}
          >
            <Text style={styles.routeButtonIcon}>➜</Text>
            <Text style={styles.routeButtonText}>Find a safe route</Text>
          </Pressable>
          {legend}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  muted: { color: colors.textMuted, fontSize: 14 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  button: { marginTop: 8, backgroundColor: colors.brand, paddingHorizontal: 20, paddingVertical: 12, borderRadius: radius.pill },
  buttonText: { color: '#fff', fontWeight: '700' },
  headerLink: { color: colors.brand, fontSize: 16, fontWeight: '600' },
  routeButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: 22,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  routeButtonPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  routeButtonIcon: { color: '#fff', fontSize: 16, fontWeight: '800' },
  routeButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  topOverlay: { position: 'absolute', top: 10, left: 0, right: 0, gap: 8 },
  banner: {
    marginHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bannerText: { flex: 1, color: colors.warningText, fontSize: 13, lineHeight: 18 },
  bannerDismiss: { color: colors.warningText, fontWeight: '700' },
  loadingPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  loadingText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  bottomOverlay: { position: 'absolute', left: 12, right: 12 },
});
