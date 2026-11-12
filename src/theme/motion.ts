import type {WithSpringConfig} from 'react-native-reanimated';

export type M3MotionSpeed = 'fast' | 'default' | 'slow';

const spring = (damping: number, stiffness: number): WithSpringConfig => ({
  damping,
  stiffness,
  mass: 1,
});

/**
 * UIKit-style springs. Converted from (response, dampingFraction) with
 * mass = 1: stiffness = (2*pi/response)^2, damping = 4*pi*fraction/response.
 *  - standard: response 0.50, fraction 0.82 (default navigation/sheet feel)
 *  - snappy:   response 0.35, fraction 0.85 (taps, toggles, press release)
 *  - gentle:   response 0.65, fraction 0.90 (large surfaces, player sheet)
 */
export const IOS_SPRING = {
  standard: {damping: 20.6, stiffness: 158, mass: 1},
  snappy: {damping: 30.5, stiffness: 322, mass: 1},
  gentle: {damping: 17.4, stiffness: 93, mass: 1},
} as const satisfies Record<string, WithSpringConfig>;

/** Scale a pressed control settles at (iOS buttons shrink slightly). */
export const IOS_PRESS_SCALE = 0.965;

export const M3_MOTION = {
  spatial: {
    fast: spring(0.6, 800),
    default: spring(0.8, 380),
    slow: spring(0.8, 200),
  },
  effects: {
    fast: spring(1, 3800),
    default: spring(1, 1600),
    slow: spring(1, 800),
  },
} as const satisfies Record<
  'spatial' | 'effects',
  Record<M3MotionSpeed, WithSpringConfig>
>;
