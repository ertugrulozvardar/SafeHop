import { StyleSheet, Text, View } from 'react-native';
import { colors, levelColors, radius } from '../theme';

interface Props {
  caption: string;
  /** Defaults to the crime levels (lower / moderate / higher). */
  items?: { color: string; label: string }[];
}

const CRIME_ITEMS = (['lower', 'moderate', 'higher'] as const).map((l) => ({ color: levelColors[l].solid, label: levelColors[l].label }));

export function Legend({ caption, items = CRIME_ITEMS }: Props) {
  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.row}>
        {items.map((it) => (
          <View key={it.label} style={styles.item}>
            <View style={[styles.swatch, { backgroundColor: it.color }]} />
            <Text style={styles.label}>{it.label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  caption: { marginTop: 6, fontSize: 12, color: colors.textMuted },
});
