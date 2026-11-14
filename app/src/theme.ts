import type { Level } from './lib/stats';

export const colors = {
  brand: '#0F3D3E',
  brandSoft: '#E6F0EF',
  text: '#14181F',
  textMuted: '#5B6573',
  border: '#E3E7EC',
  background: '#F6F7F9',
  card: '#FFFFFF',
  warningBg: '#FFF6E0',
  warningText: '#7A5300',
};

export const levelColors: Record<Level, { solid: string; fill: string; label: string }> = {
  lower: { solid: '#1E9E62', fill: 'rgba(30,158,98,0.32)', label: 'Lower' },
  moderate: { solid: '#E0A100', fill: 'rgba(240,180,0,0.38)', label: 'Moderate' },
  higher: { solid: '#D6453A', fill: 'rgba(214,69,58,0.40)', label: 'Higher' },
  none: { solid: '#9AA4AE', fill: 'rgba(154,164,174,0.25)', label: 'No reports' },
};

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };

/** Price layers use a separate blue scale so "expensive" is never confused with "more crime". */
export const priceColors = {
  cheaper: { solid: '#7DB4E8', fill: 'rgba(125,180,232,0.45)', label: 'Cheaper' },
  mid: { solid: '#3A7BD5', fill: 'rgba(58,123,213,0.45)', label: 'Mid-range' },
  pricier: { solid: '#1B3A8A', fill: 'rgba(27,58,138,0.50)', label: 'Pricier' },
  none: { solid: '#9AA4AE', fill: 'rgba(154,164,174,0.22)', label: 'No data' },
} as const;
