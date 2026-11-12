import React from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Modal,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {IOS_SPRING} from '../../theme/motion';
import {useImageAccent} from '../../lib/hooks/useImageAccent';
import {TVFocusable} from '../tv';
import AppText from '../ui/Text';
import MusicButton from './MusicButton';
import SeekBar from './SeekBar';
import TrackCover from './TrackCover';
import useMusicStore, {currentTrack} from '../../lib/zustand/musicStore';
import useMusicOfflineStore, {
  cancelTrackDownload,
  downloadTrack,
  removeOfflineTrack,
} from '../../lib/music/musicOffline';
import {isProviderTrack} from '../../lib/music/types';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const Control = ({
  icon,
  label,
  onPress,
  size = 30,
  active,
  box,
  hideIcon,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  size?: number;
  active?: boolean;
  box?: number;
  /** Hide the glyph (a spinner is drawn over it instead). */
  hideIcon?: boolean;
}) => {
  const colors = useM3Colors();
  const hit = box ?? 52;
  return (
    <MusicButton
      onPress={onPress}
      label={label}
      borderRadius={hit / 2}
      style={{
        alignItems: 'center',
        height: hit,
        justifyContent: 'center',
        width: hit,
      }}>
      <MaterialCommunityIcons
        name={icon}
        size={size}
        color={active ? colors.primary : colors.onSurface}
        style={hideIcon ? {opacity: 0} : undefined}
      />
    </MusicButton>
  );
};

/** `#RRGGBB` plus an alpha byte, for the cover-tinted backdrop. */
const withAlpha = (hex: string, alpha: number): string =>
  /^#[0-9a-f]{6}$/i.test(hex)
    ? `${hex}${Math.round(alpha * 255)
        .toString(16)
        .padStart(2, '0')}`
    : hex;

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
  const accent = useImageAccent(
    track?.cover_url ?? undefined,
    colors.surfaceContainerHigh,
  );

  // The artwork settles smaller while paused and grows back on play, the way
  // Apple Music does it.
  const artScale = React.useRef(new Animated.Value(playing ? 1 : 0.84)).current;
  React.useEffect(() => {
    Animated.spring(artScale, {
      toValue: playing ? 1 : 0.84,
      useNativeDriver: true,
      ...IOS_SPRING.gentle,
    }).start();
  }, [playing, artScale]);

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
  const coverSize = Math.min(landscape ? height * 0.55 : width - 56, 400);
  const canDownload = !isProviderTrack(track);

  const onDownload = () => {
    if (saved) {
      void removeOfflineTrack(track.id);
    } else if (progress !== undefined) {
      cancelTrackDownload(track.id);
    } else {
      void downloadTrack(track);
    }
  };

  const artwork = (
    <Animated.View
      style={{
        backgroundColor: colors.surfaceContainerHigh,
        borderRadius: landscape ? 20 : 24,
        elevation: 24,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 16},
        shadowOpacity: 0.5,
        shadowRadius: 28,
        transform: [{scale: artScale}],
      }}>
      <TrackCover
        uri={track.cover_url}
        size={coverSize}
        radius={landscape ? 20 : 24}
      />
    </Animated.View>
  );

  const meta = (
    <View style={{alignItems: landscape ? 'flex-start' : 'stretch'}}>
      <AppText
        role="headlineSmallEmphasized"
        numberOfLines={2}
        style={{
          color: colors.onSurface,
          fontFamily: 'Inter_700Bold',
          fontWeight: '700',
          textAlign: 'left',
        }}>
        {track.title}
      </AppText>
      <AppText
        role="titleMedium"
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
          size={40}
          onPress={s.previous}
        />
        <View>
          <Control
            box={76}
            icon={playing ? 'pause' : 'play'}
            label={playing ? 'Pause' : 'Play'}
            size={62}
            hideIcon={buffering && playing}
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
              <ActivityIndicator color={colors.onSurface} size="large" />
            </View>
          ) : null}
        </View>
        <Control
          icon="skip-next"
          label="Next track"
          size={40}
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
        {canDownload ? (
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
        ) : null}
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
      <View style={{backgroundColor: colors.background, flex: 1}}>
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(accent, 0.5), withAlpha(accent, 0.16), colors.background]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={{
            flex: 1,
            paddingBottom: Math.max(insets.bottom, 16),
            paddingHorizontal: 24,
            paddingTop: (StatusBar.currentHeight ?? insets.top) + 8,
          }}>
          {/* Grabber: the cue that this sheet closes by swiping/tapping down. */}
          <View style={{alignItems: 'center'}}>
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.35)',
                borderRadius: 3,
                height: 5,
                width: 38,
              }}
            />
          </View>
          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 4,
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
            <TVFocusable
              onPress={s.stop}
              borderRadius={26}
              accessibilityRole="button"
              accessibilityLabel="Stop and close"
              style={{
                alignItems: 'center',
                height: 52,
                justifyContent: 'center',
                width: 52,
              }}>
              <MaterialCommunityIcons
                name="stop-circle-outline"
                size={26}
                color={colors.onSurface}
              />
            </TVFocusable>
          </View>
          {landscape ? (
            <View style={{alignItems: 'center', flex: 1, flexDirection: 'row'}}>
              {artwork}
              <View style={{flex: 1, gap: 16, marginLeft: 32}}>
                {meta}
                {controls}
              </View>
            </View>
          ) : (
            <View style={{flex: 1, justifyContent: 'space-between'}}>
              <View style={{alignItems: 'center', marginTop: 16}}>
                {artwork}
              </View>
              <View style={{gap: 16}}>
                {meta}
                {controls}
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default FullPlayer;
