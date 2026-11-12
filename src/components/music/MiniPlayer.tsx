import React from 'react';
import {ActivityIndicator, View} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {TVFocusable} from '../tv';
import AppText from '../ui/Text';
import TrackCover from './TrackCover';
import useMusicStore, {currentTrack} from '../../lib/zustand/musicStore';

const MiniPlayer = () => {
  const colors = useM3Colors();
  const track = useMusicStore(currentTrack);
  const playing = useMusicStore(s => s.playing);
  const buffering = useMusicStore(s => s.buffering);
  const positionMs = useMusicStore(s => s.positionMs);
  const durationMs = useMusicStore(s => s.durationMs);
  if (!track) {
    return null;
  }
  const ratio =
    durationMs > 0 ? Math.min(Math.max(positionMs / durationMs, 0), 1) : 0;
  const {toggle, next, openPlayer} = useMusicStore.getState();

  return (
    <View
      style={{
        backgroundColor: colors.surfaceContainerHigh,
        borderRadius: 20,
        marginBottom: 8,
        marginHorizontal: 12,
        overflow: 'hidden',
      }}>
      <View style={{alignItems: 'center', flexDirection: 'row', padding: 8}}>
        <TVFocusable
          onPress={() => openPlayer(true)}
          borderRadius={14}
          focusScale={1}
          accessibilityRole="button"
          accessibilityLabel="Open player"
          style={{alignItems: 'center', flex: 1, flexDirection: 'row'}}>
          <TrackCover uri={track.cover_url} size={44} radius={12} />
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
        <TVFocusable
          onPress={toggle}
          borderRadius={22}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause' : 'Play'}
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
        </TVFocusable>
        <TVFocusable
          onPress={() => next()}
          borderRadius={22}
          accessibilityRole="button"
          accessibilityLabel="Next track"
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
        </TVFocusable>
      </View>
      <View style={{backgroundColor: colors.surfaceContainerHighest, height: 3}}>
        <View
          style={{
            backgroundColor: colors.primary,
            height: 3,
            width: `${ratio * 100}%`,
          }}
        />
      </View>
    </View>
  );
};

export default MiniPlayer;
