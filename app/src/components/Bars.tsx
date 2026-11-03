import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATEGORY_META } from '../data/categories';
import type { CategoryFilter, CategoryId, DateRange } from '../data/types';
import { formatDate, formatNumber } from '../lib/stats';
import { colors } from '../theme';

/** Six vertical bars, one per 30-day period (oldest → newest). */
export function TrendBars({ values, buckets, color }: { values: number[]; buckets: DateRange[]; color: string }) {
  const max = Math.max(1, ...values);
  return (
    <View>
      <View style={styles.trendRow}>
        {values.map((v, i) => (
          <View key={i} style={styles.trendCol} accessibilityLabel={`${formatNumber(v)} incidents, period ${i + 1}`}>
            <Text style={styles.trendValue}>{formatNumber(v)}</Text>
            <View style={styles.trendTrack}>
              <View style={[styles.trendFill, { height: `${Math.max(4, (v / max) * 100)}%`, backgroundColor: color }]} />
            </View>
          </View>
        ))}
      </View>
      {buckets.length > 0 && (
        <View style={styles.trendAxis}>
          <Text style={styles.axisText}>{formatDate(buckets[0].start, false)}</Text>
          <Text style={styles.axisText}>{formatDate(buckets[buckets.length - 1].end, false)}</Text>
        </View>
      )}
    </View>
  );
}

/** Horizontal bars per category; tapping a row selects that category on the map. */
export function CategoryBars({
  counts,
  selected,
  onSelect,
}: {
  counts: { id: CategoryId; value: number }[];
  selected: CategoryFilter;
  onSelect: (id: CategoryId) => void;
}) {
  const max = Math.max(1, ...counts.map((c) => c.value));
  return (
    <View style={{ gap: 8 }}>
      {counts.map(({ id, value }) => {
        const active = selected === id;
        return (
          <Pressable key={id} onPress={() => onSelect(id)} accessibilityRole="button" accessibilityLabel={`${CATEGORY_META[id].label}: ${value}`}>
            <View style={styles.catHeader}>
              <Text style={[styles.catLabel, active && styles.catLabelActive]}>{CATEGORY_META[id].label}</Text>
              <Text style={styles.catValue}>{formatNumber(value)}</Text>
            </View>
            <View style={styles.catTrack}>
              <View
                style={[
                  styles.catFill,
                  { width: `${(value / max) * 100}%`, backgroundColor: active ? colors.brand : '#8FA3A4' },
                ]}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  trendRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 110 },
  trendCol: { flex: 1, alignItems: 'center', height: '100%' },
  trendValue: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  trendTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', backgroundColor: '#F0F2F4', borderRadius: 6, overflow: 'hidden' },
  trendFill: { width: '100%', borderRadius: 6 },
  trendAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisText: { fontSize: 11, color: colors.textMuted },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  catLabel: { fontSize: 14, color: colors.text },
  catLabelActive: { fontWeight: '700' },
  catValue: { fontSize: 14, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  catTrack: { height: 8, backgroundColor: '#F0F2F4', borderRadius: 4, overflow: 'hidden' },
  catFill: { height: '100%', borderRadius: 4 },
});
