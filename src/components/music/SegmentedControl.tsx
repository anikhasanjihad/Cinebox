import React, {useEffect, useRef, useState} from 'react';
import {Animated, View} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {IOS_SPRING} from '../../theme/motion';
import AppText from '../ui/Text';
import MusicButton from './MusicButton';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface SegmentOption {
  key: string;
  label: string;
  icon?: IconName;
}

interface Props {
  options: SegmentOption[];
  value: string;
  onChange: (key: string) => void;
}

const PAD = 3;

/** iOS segmented control: a raised pill slides under the selected segment. */
const SegmentedControl = ({options, value, onChange}: Props) => {
  const colors = useM3Colors();
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const index = Math.max(
    options.findIndex(o => o.key === value),
    0,
  );
  const segment = options.length ? Math.max(width - PAD * 2, 0) / options.length : 0;
  const first = useRef(true);

  useEffect(() => {
    if (!segment) {
      return;
    }
    if (first.current) {
      first.current = false;
      x.setValue(index * segment);
      return;
    }
    Animated.spring(x, {
      toValue: index * segment,
      useNativeDriver: true,
      ...IOS_SPRING.snappy,
    }).start();
  }, [index, segment, x]);

  return (
    <View
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      style={{
        backgroundColor: colors.surfaceContainerHigh,
        borderRadius: 12,
        flexDirection: 'row',
        padding: PAD,
      }}>
      {segment > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            backgroundColor: colors.surfaceContainerHighest,
            borderRadius: 9,
            bottom: PAD,
            left: PAD,
            position: 'absolute',
            top: PAD,
            transform: [{translateX: x}],
            width: segment,
          }}
        />
      ) : null}
      {options.map(option => {
        const selected = option.key === value;
        return (
          <MusicButton
            key={option.key}
            label={option.label}
            borderRadius={9}
            onPress={() => onChange(option.key)}
            style={{
              alignItems: 'center',
              flex: 1,
              flexDirection: 'row',
              height: 34,
              justifyContent: 'center',
            }}>
            {option.icon ? (
              <MaterialCommunityIcons
                name={option.icon}
                size={16}
                color={selected ? colors.onSurface : colors.onSurfaceVariant}
                style={{marginRight: 6}}
              />
            ) : null}
            <AppText
              role={selected ? 'labelLargeEmphasized' : 'labelLarge'}
              numberOfLines={1}
              style={{
                color: selected ? colors.onSurface : colors.onSurfaceVariant,
              }}>
              {option.label}
            </AppText>
          </MusicButton>
        );
      })}
    </View>
  );
};

export default SegmentedControl;
