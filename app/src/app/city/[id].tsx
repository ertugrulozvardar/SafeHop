import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Polygon } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AreaSheet } from '../../components/AreaSheet';
import { CategoryChips } from '../../components/CategoryChips';
import { Legend } from '../../components/Legend';
import { type DataOrigin, loadCity } from '../../data/api';
import { CATEGORY_META } from '../../data/categories';
import type { AreaCollection, CategoryFilter, CityData } from '../../data/types';
import { regionForBbox, toShapes } from '../../lib/shapes';
import { computeMetrics, formatRange } from '../../lib/stats';
import { colors, levelColors, radius } from '../../theme';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: CityData; areas: AreaCollection; origin: DataOrigin };

export default function CityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [noteDismissed, setNoteDismissed] = useState(false);
  // Height of the legend card, so the map's logo/"Legal" link (Apple Maps / Google)
  // is laid out above it instead of being covered — required by the map providers.
  const [legendHeight, setLegendHeight] = useState(90);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    loadCity(String(id))
      .then(({ data, areas, origin }) => alive && setState({ status: 'ready', data, areas, origin }))
      .catch((err: Error) => alive && setState({ status: 'error', message: err.message }));
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
  const region = regionForBbox(data.bbox);
  const selectedArea = selected ? data.areas.find((a) => a.key === selected) : undefined;
  const selectedMetric = selected && metrics ? metrics.byKey.get(selected) : undefined;
  const banner = data.stale ? data.staleReason : data.notes[0];

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
        initialRegion={region}
        mapPadding={{ top: 0, right: 0, bottom: legendHeight + insets.bottom + 16, left: 0 }}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {shapes.map((s) => {
          const m = metrics?.byKey.get(s.key);
          const lc = levelColors[m?.level ?? 'none'];
          const isSel = s.key === selected;
          return s.polys.map((p, i) => (
            <Polygon
              key={`${s.key}-${i}`}
              coordinates={p.outer}
              holes={p.holes}
              fillColor={lc.fill}
              strokeColor={isSel ? '#111' : 'rgba(15,61,62,0.55)'}
              strokeWidth={isSel ? 3 : 1}
              zIndex={isSel ? 2 : 1}
              tappable
              onPress={() => setSelected(s.key)}
            />
          ));
        })}
      </MapView>

      <View style={styles.topOverlay} pointerEvents="box-none">
        <CategoryChips value={filter} onChange={setFilter} />
        {banner && !noteDismissed && (
          <Pressable style={styles.banner} onPress={() => setNoteDismissed(true)} accessibilityHint="Dismiss">
            <Text style={styles.bannerText}>{banner}</Text>
            <Text style={styles.bannerDismiss}>✕</Text>
          </Pressable>
        )}
      </View>

      {selectedArea && selectedMetric ? (
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
          <Legend
            caption={`${CATEGORY_META[filter].label} per km², compared with other areas in ${data.name} · ${formatRange(data.window.start, data.window.end)}${state.origin === 'offline-copy' ? ' (offline copy)' : ''}. Tap an area for details.`}
          />
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
  bottomOverlay: { position: 'absolute', left: 12, right: 12 },
});
