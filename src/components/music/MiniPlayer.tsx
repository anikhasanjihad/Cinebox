import React, {useEffect, useRef} from 'react';
import {ActivityIndicator, Animated, View} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {IOS_SPRING} from '../../theme/motion';
import {TVFocusable} from '../tv';
import AppText from '../ui/Text';
import MusicButton from './MusicButton';
import TrackCover from './TrackCover';
import useMusicStore, {currentTrack} from '../../lib/zustand/musicStore';

const MiniPlayer = () => {
  const colors = useM3Colors();
  const track = useMusicStore(currentTrack);
  const playing = useMusicStore(s => s.playing);
  const buffering = useMusicStore(s => s.buffering);
  const positionMs = useMusicStore(s => s.positionMs);
  const durationMs = useMusicStore(s => s.durationMs);

  // Rises into place when the first track starts, like iOS' now-playing bar.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      useNativeDriver: true,
      ...IOS_SPRING.standard,
    }).start();
  }, [enter]);

  if (!track) {
    return null;
  }
  const ratio =
    durationMs > 0 ? Math.min(Math.max(positionMs / durationMs, 0), 1) : 0;
  const {toggle, next, openPlayer} = useMusicStore.getState();

  return (
    <Animated.View
      style={{
        backgroundColor: colors.surfaceContainerHigh,
        borderColor: colors.outlineVariant,
        borderRadius: 18,
        borderWidth: 0.5,
        elevation: 8,
        marginBottom: 8,
        marginHorizontal: 12,
        opacity: enter,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.35,
        shadowRadius: 12,
        transform: [
          {
            translateY: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [28, 0],
            }),
          },
        ],
      }}>
      <View style={{alignItems: 'center', flexDirection: 'row', padding: 8}}>
        <TVFocusable
          onPress={() => openPlayer(true)}
          borderRadius={14}
          focusScale={1}
          accessibilityRole="button"
          accessibilityLabel="Open player"
          style={{alignItems: 'center', flex: 1, flexDirection: 'row'}}>
          <TrackCover uri={track.cover_url} size={44} radius={9} />
          <View style={{flex: 1, marginHorizontal: 12}}>
            <AppText
              role="titleSmall"
              numberOfLines={1}
              style={{color: colors.onSurface}}>
              {track.title}
            </AppText>
            <AppText
              role="bodySmall"
              numberOfLines={1}
              style={{color: colors.onSurfaceVariant}}>
              {track.artist || 'Unknown artist'}
            </AppText>
          </View>
        </TVFocusable>
        <MusicButton
          onPress={toggle}
          label={playing ? 'Pause' : 'Play'}
          style={{
            alignItems: 'center',
            height: 44,
            justifyContent: 'center',
            width: 44,
          }}>
          {buffering && playing ? (
            <ActivityIndicator color={colors.onSurface} />
          ) : (
            <MaterialCommunityIcons
              name={playing ? 'pause' : 'play'}
              size={30}
              color={colors.onSurface}
            />
          )}
        </MusicButton>
        <MusicButton
          onPress={() => next()}
          label="Next track"
          style={{
            alignItems: 'center',
            height: 44,
            justifyContent: 'center',
            width: 44,
          }}>
          <MaterialCommunityIcons
            name="skip-next"
            size={28}
            color={colors.onSurface}
          />
        </MusicButton>
      </View>
      <View style={{backgroundColor: colors.surfaceContainerHighest, height: 2}}>
        <View
          style={{
            backgroundColor: colors.onSurface,
            height: 2,
            width: `${ratio * 100}%`,
          }}
        />
      </View>
    </Animated.View>
  );
};

export default MiniPlayer;
