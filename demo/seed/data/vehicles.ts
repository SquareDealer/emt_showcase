export const HATCH_CODES = ['R50', 'R53', 'R56', 'F56', 'F55'];
export const HATCH_MODELS = ['Cooper', 'Cooper S', 'One', 'John Cooper Works'];

/** Relative frequency of MINI generations among customer cars. */
export const MINI_GEN_WEIGHTS: Record<string, number> = {
  R56: 20, F56: 20, F55: 12, F60: 12, R60: 8,
  R55: 4, F54: 4, R50: 3, R53: 3, R57: 3, F57: 2, R61: 2,
  R52: 1, R58: 1, R59: 1, J01: 1, U25: 1, F66: 1, F65: 1,
};

export interface OtherMake {
  make: string;
  wmi: string;
  models: string[];
}

export const OTHER_MAKES: OtherMake[] = [
  { make: 'Toyota', wmi: 'JTN', models: ['Camry', 'RAV4', 'Corolla', 'Land Cruiser Prado'] },
  { make: 'Kia', wmi: 'KNA', models: ['Rio', 'Sportage', 'Ceed', 'Sorento'] },
  { make: 'Hyundai', wmi: 'KMH', models: ['Solaris', 'Creta', 'Tucson', 'Elantra'] },
  { make: 'Volkswagen', wmi: 'WVW', models: ['Polo', 'Tiguan', 'Golf', 'Passat'] },
  { make: 'Skoda', wmi: 'TMB', models: ['Octavia', 'Rapid', 'Kodiaq', 'Fabia'] },
  { make: 'Lada', wmi: 'XTA', models: ['Vesta', 'Granta', 'Niva Travel', 'Largus'] },
];

export const OTHER_MAKE_WEIGHTS = [3, 3, 3, 3, 2, 2];

/** Plate region codes (2–3 digits). */
export const PLATE_REGIONS = ['77', '97', '99', '177', '197', '777', '50', '150', '750', '78'];

export const CLIENT_NOTES = [
  'Просит звонить после 18:00',
  'Предпочитает оригинальные запчасти',
  'Привозит машину по записи, ждёт в зоне ожидания',
  'Согласовывать работы дороже 20 000 ₽ по телефону',
  'Старые детали забирает с собой',
  'Напомнить о ТО за неделю',
];
