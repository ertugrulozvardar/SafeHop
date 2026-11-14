import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { CATEGORY_META, FILTERS } from '../data/categories';
import type { CategoryFilter, CategoryId } from '../data/types';
import { colors, radius } from '../theme';

interface Props {
  value: CategoryFilter;
  onChange: (value: CategoryFilter) => void;
  /** Categories this city's police data can tell apart (others are hidden). */
  available?: readonly CategoryId[];
}

export function CategoryChips({ value, onChange, available }: Props) {
  const filters = available ? FILTERS.filter((f) => f === 'all' || available.includes(f)) : FILTERS;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {filters.map((f) => {
        const selected = f === value;
        return (
          <Pressable
            key={f}
            onPress={() => onChange(f)}
            style={[styles.chip, selected && styles.chipSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Show ${CATEGORY_META[f].label}`}
          >
            <Text style={[styles.text, selected && styles.textSelected]}>{CATEGORY_META[f].short}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  chipSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  text: { fontSize: 14, fontWeight: '600', color: colors.text },
  textSelected: { color: '#fff' },
});
