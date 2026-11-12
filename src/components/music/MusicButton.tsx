import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {isTV} from '../../lib/tv';
import {TVFocusable} from '../tv';
import PressableScale from '../ui/PressableScale';

interface Props {
  onPress: () => void;
  label: string;
  style?: StyleProp<ViewStyle>;
  /** Corner radius of the focus ring on TV. */
  borderRadius?: number;
  disabled?: boolean;
  children: React.ReactNode;
}

/**
 * Music tab button: springs under the finger on phones (iOS feel) and keeps
 * the D-pad focus ring on Android TV.
 */
const MusicButton = ({
  onPress,
  label,
  style,
  borderRadius = 22,
  disabled,
  children,
}: Props) => {
  if (isTV) {
    return (
      <TVFocusable
        onPress={onPress}
        disabled={disabled}
        borderRadius={borderRadius}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={style as ViewStyle}>
        {children}
      </TVFocusable>
    );
  }
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={style}>
      {children}
    </PressableScale>
  );
};

export default MusicButton;
