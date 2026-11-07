import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RouteScore } from '../lib/routeScore';
import type { Level } from '../lib/stats';
import { colors, levelColors, radius } from '../theme';

export type RouteKind = 'safest' | 'leastSafe' | 'only';

export const ROUTE_STYLE: Record<RouteKind, { label: string; color: string }> = {
  safest: { label: 'Safest route', color: '#1E9E62' },
  leastSafe: { label: 'Least safe route', color: '#D6453A' },
  only: { label: 'Only route found', color: '#0F3D3E' },
};

export const LEVEL_TEXT: Record<Level, string> = {
  lower: 'Low crime along the way',
  moderate: 'Medium crime along the way',
  higher: 'High crime along the way',
  none: 'No crime data for this route',
};

export function formatDuration(min: number): string {
  const m = Math.max(1, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export function formatDistance(km: number): string {
  const mi = km * 0.621371;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km · ${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
}

interface Props {
  kind: RouteKind;
  selected: boolean;
  durationMin: number;
  distanceKm: number;
  score: RouteScore;
  level: Level;
  hasFerry: boolean;
  onPress: () => void;
}

const BAR: { key: keyof RouteScore['share']; color: string }[] = [
  { key: 'lower', color: levelColors.lower.solid },
  { key: 'moderate', color: levelColors.moderate.solid },
  { key: 'higher', color: levelColors.higher.solid },
  { key: 'none', color: levelColors.none.solid },
  { key: 'outside', color: '#D5DAE0' },
];

export function RouteCard({ kind, selected, durationMin, distanceKm, score, level, hasFerry, onPress }: Props) {
  const style = ROUTE_STYLE[kind];
  const highPct = Math.round(score.share.higher * 100);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { borderColor: selected ? style.color : colors.border }]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${style.label}. ${formatDuration(durationMin)}, ${formatDistance(distanceKm)}. ${LEVEL_TEXT[level]}.`}
    >
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: style.color }]} />
        <Text style={[styles.title, { color: style.color }]} numberOfLines={1}>
          {style.label}
        </Text>
      </View>
      <Text style={styles.time}>{formatDuration(durationMin)}</Text>
      <Text style={styles.muted}>{formatDistance(distanceKm)}</Text>

      <View style={styles.bar} accessibilityElementsHidden importantForAccessibility="no">
        {BAR.map((b) =>
          score.share[b.key] > 0.005 ? <View key={b.key} style={{ flex: score.share[b.key], backgroundColor: b.color }} /> : null
        )}
      </View>

      <Text style={[styles.line, styles.bold, { color: level === 'none' ? colors.textMuted : levelColors[level].solid }]}>
        {LEVEL_TEXT[level]}
      </Text>
      {level !== 'none' && <Text style={styles.muted}>{highPct}% of the way in high-crime areas</Text>}
      {hasFerry && <Text style={[styles.muted, { color: colors.warningText }]}>Includes a ferry</Text>}
      {score.share.outside > 0.05 && (
        <Text style={styles.muted}>{Math.round(score.share.outside * 100)}% outside SafeHop’s areas</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  title: { flexShrink: 1, fontSize: 15, fontWeight: '800' },
  time: { fontSize: 24, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'], marginTop: 2 },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.border, marginVertical: 4 },
  line: { fontSize: 13, color: colors.text, lineHeight: 18 },
  bold: { fontWeight: '700' },
  muted: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
});
