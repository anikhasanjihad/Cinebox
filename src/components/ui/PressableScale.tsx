import React, {useCallback, useRef} from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {IOS_PRESS_SCALE, IOS_SPRING} from '../../theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Scale the control settles at while pressed. */
  pressedScale?: number;
}

/**
 * iOS-style press: the control springs down under the finger and back on
 * release. Opt-in (the shared phone focusable stays a plain TouchableOpacity
 * on purpose, to keep long lists cheap), so use it for a handful of prominent
 * controls: player buttons, chips, tab buttons, cards.
 *
 * Uses RN's core Animated with the native driver; nothing runs on the JS
 * thread while the spring plays.
 */
const PressableScale = ({
  style,
  pressedScale = IOS_PRESS_SCALE,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: Props) => {
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = useCallback(
    (toValue: number) => {
      Animated.spring(scale, {
        toValue,
        useNativeDriver: true,
        ...IOS_SPRING.snappy,
      }).start();
    },
    [scale],
  );

  const flat = StyleSheet.flatten(style) as ViewStyle | undefined;
  const ownTransform = flat?.transform;
  // A string transform cannot be extended; leave such a control un-animated.
  const animate = !disabled && typeof ownTransform !== 'string';

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={e => {
        if (animate) {
          springTo(pressedScale);
        }
        onPressIn?.(e);
      }}
      onPressOut={e => {
        if (animate) {
          springTo(1);
        }
        onPressOut?.(e);
      }}
      style={[
        style,
        animate
          ? {
              transform: [
                ...(Array.isArray(ownTransform) ? ownTransform : []),
                {scale},
              ],
            }
          : undefined,
      ]}
    />
  );
};

export default PressableScale;
