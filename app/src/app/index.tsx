import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CITY_LIST } from '../config';
import { loadIndex } from '../data/api';
import type { DataIndex } from '../data/types';
import { formatRange } from '../lib/stats';
import { colors, levelColors, radius } from '../theme';

export default function HomeScreen() {
  const [index, setIndex] = useState<DataIndex | null>(null);

  useEffect(() => {
    let alive = true;
    loadIndex().then(({ index }) => alive && setIndex(index));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Know the neighborhood{'\n'}before you go.</Text>
        <Text style={styles.heroText}>
          See where theft, pickpocketing, car break-ins and other incidents are reported most — based on 6 months of
          official police data.
        </Text>
        <View style={styles.swatches}>
          {(['lower', 'moderate', 'higher'] as const).map((l) => (
            <View key={l} style={[styles.swatch, { backgroundColor: levelColors[l].solid }]} />
          ))}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Choose a city</Text>
      {CITY_LIST.map((c) => {
        const meta = index?.cities.find((x) => x.id === c.id);
        return (
          <Pressable
            key={c.id}
            style={({ pressed }) => [styles.cityCard, pressed && { opacity: 0.85 }]}
            onPress={() => router.push({ pathname: '/city/[id]', params: { id: c.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Open ${c.name}`}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cityName}>
                {c.name} <Text style={styles.cityState}>{c.state}</Text>
              </Text>
              <Text style={styles.cityTagline}>{c.tagline}</Text>
              {meta && (
                <Text style={styles.cityMeta}>
                  Data: {formatRange(meta.window.start, meta.window.end)}
                  {meta.stale ? ' · not updated recently' : ''}
                </Text>
              )}
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        );
      })}

      <Pressable onPress={() => router.push('/about')} style={styles.aboutLink} accessibilityRole="link">
        <Text style={styles.aboutText}>How SafeHop works & data sources</Text>
      </Pressable>

      <Text style={styles.disclaimer}>
        SafeHop shows reported incidents, not a guarantee of safety. It is not affiliated with any police department or
        government agency. In an emergency, call 911.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  hero: { backgroundColor: colors.brand, borderRadius: radius.lg, padding: 20 },
  heroTitle: { fontSize: 26, lineHeight: 32, fontWeight: '800', color: '#fff' },
  heroText: { marginTop: 10, fontSize: 15, lineHeight: 21, color: '#D5E6E5' },
  swatches: { flexDirection: 'row', gap: 6, marginTop: 16 },
  swatch: { width: 28, height: 8, borderRadius: 4 },
  sectionTitle: { marginTop: 24, marginBottom: 10, fontSize: 17, fontWeight: '700', color: colors.text },
  cityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cityName: { fontSize: 18, fontWeight: '700', color: colors.text },
  cityState: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  cityTagline: { marginTop: 2, fontSize: 14, color: colors.textMuted },
  cityMeta: { marginTop: 6, fontSize: 12, color: colors.brand },
  chevron: { fontSize: 28, color: colors.textMuted, marginLeft: 8 },
  aboutLink: { marginTop: 14, paddingVertical: 10 },
  aboutText: { color: colors.brand, fontSize: 15, fontWeight: '600' },
  disclaimer: { marginTop: 8, fontSize: 12, lineHeight: 17, color: colors.textMuted },
});
