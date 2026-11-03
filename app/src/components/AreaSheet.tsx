import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CATEGORY_META, CATEGORY_ORDER } from '../data/categories';
import type { AreaStats, CategoryFilter, CategoryId, CityData } from '../data/types';
import { type AreaMetric, formatDensity, formatNumber, formatRange } from '../lib/stats';
import { colors, levelColors, radius } from '../theme';
import { CategoryBars, TrendBars } from './Bars';

interface Props {
  city: CityData;
  area: AreaStats;
  metric: AreaMetric;
  filter: CategoryFilter;
  onFilterChange: (f: CategoryFilter) => void;
  onClose: () => void;
  bottomInset: number;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function AreaSheet({ city, area, metric, filter, onFilterChange, onClose, bottomInset }: Props) {
  const level = levelColors[metric.level];
  const label = CATEGORY_META[filter].label.toLowerCase();
  const breakdown = CATEGORY_ORDER.map((id: CategoryId) => ({ id, value: sum(area.counts[id] ?? []) }));
  const ratio = metric.ratioToMedian;

  return (
    <View style={[styles.sheet, { paddingBottom: bottomInset + 12 }]}>
      <View style={styles.handle} />
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>
            {area.name}
          </Text>
          <Text style={styles.sub}>{area.sub}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close details" style={styles.close}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.levelPill, { backgroundColor: level.fill, borderColor: level.solid }]}>
          <View style={[styles.dot, { backgroundColor: level.solid }]} />
          <Text style={styles.levelText}>
            {metric.level === 'none' ? 'No reports in this period' : `${level.label} than most of ${city.name}`}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <Stat value={formatNumber(metric.count)} label={`reported ${filter === 'all' ? 'incidents' : label}`} />
          <Stat value={formatDensity(metric.perKm2Month)} label="per km² per month" />
          <Stat value={ratio === null ? '–' : `${ratio.toFixed(1)}×`} label="vs. typical area" />
        </View>

        {metric.count > 0 && metric.count < 10 && (
          <Text style={styles.caveat}>Very few reports — small numbers can change a lot from month to month.</Text>
        )}

        <Text style={styles.sectionTitle}>Last 6 months · {CATEGORY_META[filter].short}</Text>
        <TrendBars values={metric.byBucket} buckets={city.buckets} color={level.solid} />
        <Text style={styles.hint}>The most recent weeks may still grow as late reports are added.</Text>

        <Text style={styles.sectionTitle}>What was reported here</Text>
        <CategoryBars counts={breakdown} selected={filter} onSelect={(id) => onFilterChange(id)} />
        <Text style={styles.hint}>Tap a category to color the map by it.</Text>

        <Text style={styles.source}>
          {city.source.agency} · {formatRange(city.window.start, city.window.end)}
        </Text>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '62%',
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 18,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 15, color: colors.textMuted, fontWeight: '700' },
  scroll: { marginTop: 12, flexShrink: 1 },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  levelText: { fontSize: 14, fontWeight: '600', color: colors.text },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: { flex: 1, backgroundColor: colors.background, borderRadius: radius.md, padding: 10 },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  caveat: { marginTop: 10, fontSize: 13, color: colors.warningText, backgroundColor: colors.warningBg, padding: 10, borderRadius: radius.sm },
  sectionTitle: { marginTop: 18, marginBottom: 10, fontSize: 15, fontWeight: '700', color: colors.text },
  hint: { marginTop: 6, fontSize: 12, color: colors.textMuted },
  source: { marginTop: 16, fontSize: 12, color: colors.textMuted },
});
