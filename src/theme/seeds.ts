export type SeedOption = {
  name: string;
  color: string;
};

export const DEFAULT_SEED = '#FFFFFF';
export const LEGACY_TERTIARY_BACKGROUND = '#1C1C1E';

type HexColor = `#${string}`;

export const mixHex = (
  color: string,
  target: string,
  amount: number,
): HexColor => {
  const parse = (value: string) =>
    [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16));
  const sourceRgb = parse(color);
  const targetRgb = parse(target);
  const mixed = sourceRgb.map((channel, index) =>
    Math.round(channel + (targetRgb[index] - channel) * amount),
  );
  return `#${mixed.map(channel => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase() as HexColor;
};

export const readableOnColor = (color: string): HexColor => {
  const [red, green, blue] = [1, 3, 5].map(index =>
    parseInt(color.slice(index, index + 2), 16),
  );
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance > 150 ? '#17100F' : '#FFFFFF';
};

export const createCoherentAccentRoles = (seed: string) => {
  const primary = seed.toUpperCase() as HexColor;
  const primaryContainer = mixHex(primary, '#000000', 0.48);
  const fixed = mixHex(primary, '#FFFFFF', 0.76);
  const fixedDim = mixHex(primary, '#FFFFFF', 0.48);

  return {
    primary,
    onPrimary: readableOnColor(primary),
    primaryContainer,
    onPrimaryContainer: mixHex(primary, '#FFFFFF', 0.82),
    inversePrimary: mixHex(primary, '#000000', 0.25),
    secondary: mixHex(primary, '#FFFFFF', 0.24),
    onSecondary: readableOnColor(mixHex(primary, '#FFFFFF', 0.24)),
    secondaryContainer: mixHex(primary, '#000000', 0.58),
    onSecondaryContainer: mixHex(primary, '#FFFFFF', 0.84),
    tertiary: mixHex(primary, '#FFFFFF', 0.4),
    onTertiary: readableOnColor(mixHex(primary, '#FFFFFF', 0.4)),
    tertiaryContainer: mixHex(primary, '#000000', 0.66),
    onTertiaryContainer: mixHex(primary, '#FFFFFF', 0.86),
    surfaceTint: primary,
    primaryFixed: fixed,
    primaryFixedDim: fixedDim,
    onPrimaryFixed: '#17100F',
    onPrimaryFixedVariant: mixHex(primary, '#000000', 0.55),
    secondaryFixed: fixed,
    secondaryFixedDim: fixedDim,
    onSecondaryFixed: '#17100F',
    onSecondaryFixedVariant: mixHex(primary, '#000000', 0.55),
    tertiaryFixed: fixed,
    tertiaryFixedDim: fixedDim,
    onTertiaryFixed: '#17100F',
    onTertiaryFixedVariant: mixHex(primary, '#000000', 0.55),
    background: mixHex(primary, '#000000', 0.94),
    surface: mixHex(primary, '#000000', 0.94),
    surfaceDim: mixHex(primary, '#000000', 0.94),
    surfaceContainerLowest: mixHex(primary, '#000000', 0.97),
    surfaceContainerLow: mixHex(primary, '#000000', 0.9),
    surfaceContainer: mixHex(primary, '#000000', 0.86),
    surfaceContainerHigh: mixHex(primary, '#000000', 0.81),
    surfaceContainerHighest: mixHex(primary, '#000000', 0.75),
    surfaceBright: mixHex(primary, '#000000', 0.7),
    surfaceVariant: mixHex(primary, '#000000', 0.72),
    onBackground: '#F5F0EF',
    onSurface: '#F5F0EF',
    onSurfaceVariant: '#D4CBC9',
    outline: '#9E9290',
    outlineVariant: '#514846',
  } as const;
};

/**
 * iOS dark-mode system colors. Surfaces step up in clear layers on the black
 * background (grouped cell -> raised cell -> pressed/selected fill) instead of
 * one flat gray, which is what gives iOS lists and cards their depth.
 */
export const IOS_DARK = {
  background: '#000000',
  grouped: '#1C1C1E',
  raised: '#2C2C2E',
  fill: '#3A3A3C',
  label: '#FFFFFF',
  secondaryLabel: '#A1A1A6',
  separator: '#38383A',
  chevron: '#636366',
} as const;

export const LEGACY_NEUTRAL_SURFACE_ROLES = {
  surface: IOS_DARK.grouped,
  surfaceDim: '#0B0B0C',
  surfaceContainerLowest: '#101012',
  surfaceContainerLow: IOS_DARK.grouped,
  surfaceContainer: IOS_DARK.grouped,
  surfaceContainerHigh: IOS_DARK.raised,
  surfaceContainerHighest: IOS_DARK.fill,
  surfaceBright: IOS_DARK.fill,
  surfaceVariant: IOS_DARK.raised,
  onSurface: IOS_DARK.label,
  onSurfaceVariant: IOS_DARK.secondaryLabel,
  outline: IOS_DARK.chevron,
  outlineVariant: IOS_DARK.separator,
} as const;

/**
 * Curated seed colors. Each one is fed through `SchemeTonalSpot` to generate a
 * full Material 3 palette, so every option yields usable contrast in dark mode.
 */
export const M3_SEEDS: SeedOption[] = [
  {name: 'White', color: DEFAULT_SEED},
  {name: 'Tomato', color: '#FF6347'},
  {name: 'Gray', color: '#9E9E9E'},
  {name: 'Blue', color: '#2196F3'},
  {name: 'Lavender', color: '#B2A4D4'},
];

export const isCuratedSeed = (color: string): boolean =>
  M3_SEEDS.some(seed => seed.color.toLowerCase() === color.toLowerCase());
