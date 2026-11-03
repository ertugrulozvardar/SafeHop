import type { CategoryFilter, CategoryId } from './types';

export const CATEGORY_ORDER: CategoryId[] = [
  'pickpocket',
  'car_breakin',
  'theft',
  'robbery',
  'assault',
  'burglary',
  'vehicle_theft',
];

export const CATEGORY_META: Record<CategoryFilter, { label: string; short: string; description: string }> = {
  all: {
    label: 'All incidents',
    short: 'All',
    description: 'All of the categories below combined.',
  },
  pickpocket: {
    label: 'Pickpocketing & snatching',
    short: 'Pickpocketing',
    description: 'Wallets, phones or bags taken from a person without force (pocket-picking, purse/phone snatching).',
  },
  car_breakin: {
    label: 'Car break-ins',
    short: 'Car break-ins',
    description: 'Items stolen from inside a vehicle, or parts taken from it. Relevant if you rent a car.',
  },
  theft: {
    label: 'Other theft',
    short: 'Theft',
    description: 'Other thefts of unattended property, e.g. from buildings or open areas. Shoplifting is excluded.',
  },
  robbery: {
    label: 'Robbery',
    short: 'Robbery',
    description: 'Taking property from a person using force or threat (e.g. a mugging).',
  },
  assault: {
    label: 'Assault',
    short: 'Assault',
    description: 'Attacks or threats of violence. Domestic incidents are excluded where the police data flags them.',
  },
  burglary: {
    label: 'Burglary',
    short: 'Burglary',
    description: 'Breaking into a home, hotel room or business to steal.',
  },
  vehicle_theft: {
    label: 'Vehicle theft',
    short: 'Vehicle theft',
    description: 'Cars, motorcycles or scooters being stolen.',
  },
};

export const FILTERS: CategoryFilter[] = ['all', ...CATEGORY_ORDER];
