import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AreaStats, CityData, CostData } from '../data/types';
import { formatMonth, formatUsd, type PriceMetric, RENT_LABEL, RENT_SHORT, type RentSize, STAY_LABEL, type StayKind } from '../lib/costs';
import type { AreaMetric } from '../lib/stats';
import { colors, levelColors, priceColors, radius } from '../theme';

interface Props {
  city: CityData;
  area: AreaStats;
  mode: 'stay' | 'rent';
  costs: CostData;
  stayKind: StayKind;
  rentSize: RentSize;
  price: PriceMetric | undefined;
  crime: AreaMetric | undefined; // all categories
  onShowCrime: () => void;
  onClose: () => void;
  bottomInset: number;
}

const PRICE_TEXT = { cheaper: 'cheaper than most of', mid: 'mid-range for', pricier: 'pricier than most of', none: '' } as const;
const CRIME_TEXT = { lower: 'Lower reported crime than most of', moderate: 'Moderate reported crime for', higher: 'Higher reported crime than most of', none: 'No crime reports in' } as const;

export function CostSheet({ city, area, mode, costs, stayKind, rentSize, price, crime, onShowCrime, onClose, bottomInset }: Props) {
  const stay = costs.stay?.areas[area.key];
  const rent = costs.rent?.areas[area.key];
  const other: StayKind = stayKind === 'entire' ? 'room' : 'entire';
  const crimeLevel = crime?.level ?? 'none';
  const unit = mode === 'stay' ? 'a night' : 'a month';

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

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 8, gap: 12 }} showsVerticalScrollIndicator={false}>
        {/* The headline: how safe + how expensive */}
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <View style={[styles.dot, { backgroundColor: levelColors[crimeLevel].solid }]} />
            <Text style={styles.summaryText}>
              <Text style={styles.bold}>Safety · </Text>
              {CRIME_TEXT[crimeLevel]} {city.name}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={[styles.dot, { backgroundColor: priceColors[price?.level ?? 'none'].solid }]} />
            <Text style={styles.summaryText}>
              <Text style={styles.bold}>Cost · </Text>
              {price
                ? `${formatUsd(price.value)} ${unit} (${mode === 'stay' ? STAY_LABEL[stayKind].toLowerCase() : RENT_LABEL[rentSize].toLowerCase()}), ${PRICE_TEXT[price.level]} ${city.name}`
                : mode === 'stay'
                  ? 'Not enough active listings here for a typical price'
                  : 'No rent data for this area'}
            </Text>
          </View>
        </View>

        {mode === 'stay' ? (
          <>
            {price && (
              <View style={styles.bigRow}>
                <Text style={styles.big}>{formatUsd(price.value)}</Text>
                <Text style={styles.bigUnit}> / night · {STAY_LABEL[stayKind].toLowerCase()}</Text>
              </View>
            )}
            {price?.count ? <Text style={styles.muted}>Median of {price.count.toLocaleString('en-US')} active listings in this area.</Text> : null}
            <Text style={styles.line}>
              {STAY_LABEL[other]}:{' '}
              {stay?.[other] ? `${formatUsd(stay[other]![0])} a night (${stay[other]![1]} listings)` : 'not enough listings'}
            </Text>
          </>
        ) : (
          <>
            {price && (
              <View style={styles.bigRow}>
                <Text style={styles.big}>{formatUsd(price.value)}</Text>
                <Text style={styles.bigUnit}> / month · {RENT_LABEL[rentSize].toLowerCase()}</Text>
              </View>
            )}
            {rent && (
              <View style={styles.statsRow}>
                {([0, 1, 2, 3] as RentSize[]).map((n) => (
                  <View key={n} style={[styles.stat, n === rentSize && styles.statSelected]}>
                    <Text style={styles.statValue}>{formatUsd(rent[n])}</Text>
                    <Text style={styles.statLabel}>{RENT_SHORT[n]}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <Pressable onPress={onShowCrime} style={styles.crimeButton} accessibilityRole="button">
          <Text style={styles.crimeButtonText}>See crime details for this area ➜</Text>
        </Pressable>

        {mode === 'stay' && costs.stay ? (
          <Text style={styles.source}>
            Nightly prices listed on Airbnb, collected {formatMonth(costs.stay.snapshot)} by{' '}
            <Text style={styles.link} onPress={() => Linking.openURL(costs.stay!.url)}>
              Inside Airbnb
            </Text>{' '}
            ({costs.stay.license}). Prices change with season and events.
          </Text>
        ) : costs.rent ? (
          <Text style={styles.source}>
            Typical rents from{' '}
            <Text style={styles.link} onPress={() => Linking.openURL(costs.rent!.url)}>
              HUD Small Area Fair Market Rents
            </Text>{' '}
            (FY{costs.rent.fy}), estimated for this area from its ZIP codes.
          </Text>
        ) : null}
      </ScrollView>
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
  summary: { backgroundColor: colors.background, borderRadius: radius.md, padding: 12, gap: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  summaryText: { flex: 1, fontSize: 14, lineHeight: 19, color: colors.text },
  bold: { fontWeight: '700' },
  bigRow: { flexDirection: 'row', alignItems: 'baseline' },
  big: { fontSize: 32, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  bigUnit: { fontSize: 15, color: colors.textMuted, fontWeight: '600' },
  muted: { fontSize: 13, color: colors.textMuted },
  line: { fontSize: 14, color: colors.text },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: colors.background, borderRadius: radius.md, padding: 8, borderWidth: 1.5, borderColor: 'transparent' },
  statSelected: { borderColor: priceColors.mid.solid },
  statValue: { fontSize: 15, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  crimeButton: { alignSelf: 'flex-start', paddingVertical: 4 },
  crimeButtonText: { color: colors.brand, fontWeight: '700', fontSize: 14 },
  source: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
  link: { color: colors.brand, fontWeight: '600' },
});
