export const M3_SHAPES = {
  none: 0,
  extraSmall: 4,
  small: 10,
  medium: 14,
  large: 18,
  largeIncreased: 22,
  extraLarge: 24,
  extraLargeIncreased: 32,
  extraExtraLarge: 48,
  full: 9999,
} as const;

export const M3_SHAPE_MORPHS = {
  button: {rest: M3_SHAPES.full, pressed: M3_SHAPES.large},
  iconButton: {rest: M3_SHAPES.full, pressed: M3_SHAPES.medium},
  card: {rest: M3_SHAPES.extraLarge, pressed: M3_SHAPES.large},
  chip: {rest: M3_SHAPES.small, pressed: M3_SHAPES.extraSmall},
} as const;
