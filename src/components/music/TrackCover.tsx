import React from 'react';
import {Image, View} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {useM3Colors} from '../../theme/M3PaletteContext';

interface Props {
  uri?: string | null;
  size: number;
  radius?: number;
}

const TrackCover = ({uri, size, radius = 10}: Props) => {
  const colors = useM3Colors();
  if (uri) {
    return (
      <Image
        source={{uri}}
        style={{
          backgroundColor: colors.surfaceContainerHigh,
          borderRadius: radius,
          height: size,
          width: size,
        }}
      />
    );
  }
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: colors.secondaryContainer,
        borderRadius: radius,
        height: size,
        justifyContent: 'center',
        width: size,
      }}>
      <MaterialCommunityIcons
        name="music-note"
        size={size * 0.5}
        color={colors.onSecondaryContainer}
      />
    </View>
  );
};

export default TrackCover;
