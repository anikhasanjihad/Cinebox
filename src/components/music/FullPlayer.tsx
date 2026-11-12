import React from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  StatusBar,
  useWindowDimensions,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {TVFocusable} from '../tv';
import AppText from '../ui/Text';
import SeekBar from './SeekBar';
import TrackCover from './TrackCover';
import useMusicStore, {currentTrack} from '../../lib/zustand/musicStore';
import useMusicOfflineStore, {
  cancelTrackDownload,
  downloadTrack,
  removeOfflineTrack,
} from '../../lib/music/musicOffline';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const Control = ({
  icon,
  label,
  onPress,
  size = 30,
  active,
  big,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  size?: number;
  active?: boolean;
  big?: boolean;
}) => {
  const colors = useM3Colors();
  const box = big ? 72 : 52;
  return (
    <TVFocusable
      onPress={onPress}
      borderRadius={box / 2}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        alignItems: 'center',
        backgroundColor: big ? colors.primary : 'transparent',
        borderRadius: box / 2,
        height: box,
        justifyContent: 'center',
        width: box,
      }}>
      <MaterialCommunityIcons
        name={icon}
        size={size}
        color={
          big ? colors.onPrimary : active ? colors.primary : colors.onSurface
        }
      />
    </TVFocusable>
  );
};

const FullPlayer = () => {
  const colors = useM3Colors();
  const insets = useSafeAreaInsets();
  const {width, height} = useWindowDimensions();
  const open = useMusicStore(s => s.playerOpen);
  const track = useMusicStore(currentTrack);
  const playing = useMusicStore(s => s.playing);
  const buffering = useMusicStore(s => s.buffering);
  const positionMs = useMusicStore(s => s.positionMs);
  const durationMs = useMusicStore(s => s.durationMs);
  const repeat = useMusicStore(s => s.repeat);
  const shuffle = useMusicStore(s => s.shuffle);
  const saved = useMusicOfflineStore(s =>
    track ? Boolean(s.entries[track.id]) : false,
  );
  const progress = useMusicOfflineStore(s =>
    track ? s.progress[track.id] : undefined,
  );

  React.useEffect(() => {
    if (!open) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      useMusicStore.getState().openPlayer(false);
      return true;
    });
    return () => sub.remove();
  }, [open]);

  if (!track) {
    return null;
  }

  const s = useMusicStore.getState();
  const landscape = width > height;
  const coverSize = Math.min(landscape ? height * 0.55 : width - 64, 380);

  const onDownload = () => {
    if (saved) {
      void removeOfflineTrack(track.id);
    } else if (progress !== undefined) {
      cancelTrackDownload(track.id);
    } else {
      void downloadTrack(track);
    }
  };

  const meta = (
    <View style={{alignItems: landscape ? 'flex-start' : 'center'}}>
      <AppText
        role="headlineSmallEmphasized"
        numberOfLines={2}
        style={{
          color: colors.onSurface,
          textAlign: landscape ? 'left' : 'center',
        }}>
        {track.title}
      </AppText>
      <AppText
        role="bodyLarge"
        numberOfLines={1}
        style={{color: colors.onSurfaceVariant, marginTop: 4}}>
        {[track.artist, track.album].filter(Boolean).join(' · ') ||
          'Unknown artist'}
      </AppText>
    </View>
  );

  const controls = (
    <View>
      <SeekBar
        positionMs={positionMs}
        durationMs={durationMs}
        onSeek={s.seekTo}
      />
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 8,
        }}>
        <Control
          icon="shuffle-variant"
          label="Shuffle"
          active={shuffle}
          size={24}
          onPress={s.toggleShuffle}
        />
        <Control
          icon="skip-previous"
          label="Previous track"
          size={34}
          onPress={s.previous}
        />
        <View>
          <Control
            big
            icon={playing ? 'pause' : 'play'}
            label={playing ? 'Pause' : 'Play'}
            size={38}
            onPress={s.toggle}
          />
          {buffering && playing ? (
            <View
              pointerEvents="none"
              style={{
                alignItems: 'center',
                bottom: 0,
                justifyContent: 'center',
                left: 0,
                position: 'absolute',
                right: 0,
                top: 0,
              }}>
              <ActivityIndicator color={colors.onPrimary} size="large" />
            </View>
          ) : null}
        </View>
        <Control
          icon="skip-next"
          label="Next track"
          size={34}
          onPress={() => s.next()}
        />
        <Control
          icon={repeat === 'one' ? 'repeat-once' : 'repeat'}
          label={`Repeat ${repeat}`}
          active={repeat !== 'off'}
          size={24}
          onPress={s.cycleRepeat}
        />
      </View>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
          marginTop: 4,
        }}>
        <Control
          icon="rewind-10"
          label="Back 10 seconds"
          size={26}
          onPress={() => s.seekTo(Math.max(positionMs - 10000, 0))}
        />
        <Control
          icon={
            saved
              ? 'check-circle'
              : progress !== undefined
                ? 'close-circle-outline'
                : 'download-circle-outline'
          }
          label={saved ? 'Remove offline copy' : 'Download for offline'}
          active={saved}
          size={26}
          onPress={onDownload}
        />
        <Control
          icon="fast-forward-10"
          label="Forward 10 seconds"
          size={26}
          onPress={() =>
            s.seekTo(
              durationMs > 0
                ? Math.min(positionMs + 10000, durationMs)
                : positionMs + 10000,
            )
          }
        />
      </View>
    </View>
  );

  return (
    <Modal
      visible={open}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => s.openPlayer(false)}>
      <View
        style={{
          backgroundColor: colors.surface,
          flex: 1,
          paddingBottom: Math.max(insets.bottom, 16),
          paddingHorizontal: 24,
          paddingTop: (StatusBar.currentHeight ?? insets.top) + 8,
        }}>
        <View
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}>
          <Control
            icon="chevron-down"
            label="Close player"
            size={32}
            onPress={() => s.openPlayer(false)}
          />
          <AppText role="labelLarge" style={{color: colors.onSurfaceVariant}}>
            {saved ? 'Playing offline' : 'Now playing'}
          </AppText>
          <Control
            icon="stop-circle-outline"
            label="Stop and close"
            size={26}
            onPress={s.stop}
          />
        </View>
        {landscape ? (
          <View style={{alignItems: 'center', flex: 1, flexDirection: 'row'}}>
            <TrackCover uri={track.cover_url} size={coverSize} radius={24} />
            <View style={{flex: 1, gap: 16, marginLeft: 32}}>
              {meta}
              {controls}
            </View>
          </View>
        ) : (
          <View style={{flex: 1, justifyContent: 'space-between'}}>
            <View style={{alignItems: 'center', marginTop: 16}}>
              <TrackCover uri={track.cover_url} size={coverSize} radius={28} />
            </View>
            <View style={{gap: 16}}>
              {meta}
              {controls}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

export default FullPlayer;
