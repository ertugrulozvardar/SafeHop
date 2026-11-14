import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, radius } from '../theme';

export interface Choice {
  key: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Toggle chips (on/off filters) get a check mark when on. */
  toggle?: boolean;
}

/** A horizontal row of chips, styled like the crime category chips. */
export function ChoiceChips({ items }: { items: Choice[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} keyboardShouldPersistTaps="handled">
      {items.map((c) => (
        <Pressable
          key={c.key}
          onPress={c.onPress}
          style={[styles.chip, c.selected && (c.toggle ? styles.toggleOn : styles.chipSelected)]}
          accessibilityRole={c.toggle ? 'switch' : 'button'}
          accessibilityState={c.toggle ? { checked: c.selected } : { selected: c.selected }}
        >
          <Text style={[styles.text, c.selected && (c.toggle ? styles.toggleText : styles.textSelected)]}>
            {c.toggle && c.selected ? `✓ ${c.label}` : c.label}
          </Text>
        </Pressable>
      ))}
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
  toggleOn: { backgroundColor: '#E6F4EC', borderColor: '#1E9E62' },
  text: { fontSize: 14, fontWeight: '600', color: colors.text },
  textSelected: { color: '#fff' },
  toggleText: { color: '#14724A' },
});
