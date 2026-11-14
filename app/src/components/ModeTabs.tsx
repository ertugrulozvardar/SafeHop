import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

interface Props<T extends string> {
  value: T;
  options: { key: T; label: string }[];
  onChange: (key: T) => void;
}

/** Segmented control for the map layers (Safety / Stay / Rent). */
export function ModeTabs<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.tab, selected && styles.tabSelected]}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.text, selected && styles.textSelected]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    padding: 3,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tab: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: radius.pill },
  tabSelected: { backgroundColor: colors.brand },
  text: { fontSize: 15, fontWeight: '700', color: colors.text },
  textSelected: { color: '#fff' },
});
