import { StyleSheet, Text, View } from 'react-native';
import { colors, levelColors, radius } from '../theme';

interface Props {
  caption: string;
}

export function Legend({ caption }: Props) {
  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.row}>
        {(['lower', 'moderate', 'higher'] as const).map((l) => (
          <View key={l} style={styles.item}>
            <View style={[styles.swatch, { backgroundColor: levelColors[l].solid }]} />
            <Text style={styles.label}>{levelColors[l].label}</Text>
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
  row: { flexDirection: 'row', gap: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  caption: { marginTop: 6, fontSize: 12, color: colors.textMuted },
});
