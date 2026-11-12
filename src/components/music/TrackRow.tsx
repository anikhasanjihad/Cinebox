import React, {memo} from 'react';
import {ActivityIndicator, View} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {TVFocusable} from '../tv';
import AppText from '../ui/Text';
import TrackCover from './TrackCover';
import {isProviderTrack, type MusicTrack} from '../../lib/music/types';

interface Props {
  track: MusicTrack;
  active: boolean;
  playing: boolean;
  saved: boolean;
  /** 0..1 while downloading, undefined otherwise. */
  progress?: number;
  failed?: boolean;
  onPlay: (track: MusicTrack) => void;
  onDownloadPress: (track: MusicTrack) => void;
}

const TrackRow = ({
  track,
  active,
  playing,
  saved,
  progress,
  failed,
  onPlay,
  onDownloadPress,
}: Props) => {
  const colors = useM3Colors();
  const downloading = progress !== undefined;
  // Provider tracks (YouTube Music, ...) have no stored file to save.
  const canDownload = !isProviderTrack(track);

  return (
    <View style={{alignItems: 'center', flexDirection: 'row', paddingHorizontal: 12}}>
      <TVFocusable
        onPress={() => onPlay(track)}
        borderRadius={14}
        focusScale={1}
        accessibilityRole="button"
        accessibilityLabel={`Play ${track.title}`}
        style={{
          alignItems: 'center',
          backgroundColor: active ? colors.surfaceContainerHigh : 'transparent',
          borderRadius: 14,
          flex: 1,
          flexDirection: 'row',
          paddingHorizontal: 8,
          paddingVertical: 7,
        }}>
        <TrackCover uri={track.cover_url} size={52} radius={9} />
        <View style={{flex: 1, marginLeft: 12}}>
          <AppText
            role="titleMedium"
            numberOfLines={1}
            style={{color: colors.onSurface}}>
            {track.title}
          </AppText>
          <AppText
            role="bodySmall"
            numberOfLines={1}
            style={{color: colors.onSurfaceVariant, marginTop: 2}}>
            {[track.artist, track.album].filter(Boolean).join(' · ') ||
              'Unknown artist'}
          </AppText>
        </View>
        {active ? (
          <MaterialCommunityIcons
            name={playing ? 'equalizer' : 'pause'}
            size={22}
            color={colors.primary}
            style={{marginRight: 6}}
          />
        ) : null}
      </TVFocusable>
      {canDownload ? (
        <TVFocusable
          onPress={() => onDownloadPress(track)}
          borderRadius={22}
          accessibilityRole="button"
          accessibilityLabel={
            saved
              ? `Remove offline copy of ${track.title}`
              : downloading
                ? `Cancel download of ${track.title}`
                : `Download ${track.title}`
          }
          style={{
            alignItems: 'center',
            height: 44,
            justifyContent: 'center',
            width: 44,
          }}>
          {downloading ? (
            <View style={{alignItems: 'center', justifyContent: 'center'}}>
              <ActivityIndicator size="small" color={colors.primary} />
              <AppText
                role="labelSmall"
                style={{
                  color: colors.onSurfaceVariant,
                  position: 'absolute',
                  top: 24,
                }}>
                {Math.round((progress ?? 0) * 100)}%
              </AppText>
            </View>
          ) : (
            <MaterialCommunityIcons
              name={
                saved
                  ? 'check-circle'
                  : failed
                    ? 'alert-circle-outline'
                    : 'download-circle-outline'
              }
              size={26}
              color={
                saved
                  ? colors.primary
                  : failed
                    ? colors.error
                    : colors.onSurfaceVariant
              }
            />
          )}
        </TVFocusable>
      ) : (
        <View style={{width: 12}} />
      )}
    </View>
  );
};

export default memo(TrackRow);
