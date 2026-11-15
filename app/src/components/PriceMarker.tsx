import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import type { PriceLevel } from '../lib/costs';
import type { LatLngPoint } from '../lib/labels';
import { colors, priceColors, radius } from '../theme';
import { Icon } from './Icon';

export const GOOD_VALUE_COLOR = '#E0A100';

interface Props {
  coordinate: LatLngPoint;
  text: string;
  level: PriceLevel;
  goodValue: boolean;
  selected: boolean;
  onPress: () => void;
}

/** A small price tag on the map ("$181"), with a star for lower-crime areas that aren't among the priciest. */
export function PriceMarker({ coordinate, text, level, goodValue, selected, onPress }: Props) {
  // Google Maps (Android) draws custom markers as bitmaps: let the first layout finish, then stop
  // re-rendering them on every map frame. The marker is re-keyed whenever its content changes.
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracks(false), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={onPress}
      tracksViewChanges={tracks}
      zIndex={selected ? 30 : goodValue ? 20 : 10}
      accessibilityLabel={`${text}${goodValue ? ', lower crime and good value' : ''}`}
    >
      <View style={[styles.pill, { borderColor: priceColors[level].solid }, selected && styles.pillSelected]}>
        {goodValue && <Icon name="star" size={11} color={selected ? '#FFD34D' : GOOD_VALUE_COLOR} />}
        <Text style={[styles.text, selected && styles.textSelected]}>{text}</Text>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  pillSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  text: { fontSize: 13, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  textSelected: { color: '#fff' },
});
