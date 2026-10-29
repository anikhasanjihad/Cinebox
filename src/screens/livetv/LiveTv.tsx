import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {StatusBar} from 'expo-status-bar';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {RootStackParamList} from '../../App';
import {TVFocusable, TVFocusGuide} from '../../components/tv';
import AppText from '../../components/ui/Text';
import {
  groupCategories,
  liveChannelPlayerParams,
  loadLiveChannels,
  readCachedChannels,
  writeCachedChannels,
  type LiveChannel,
} from '../../lib/liveTv/liveTv';
import {fetchLiveTvSources} from '../../lib/services/remoteConfig';
import {isTV} from '../../lib/tv';
import {useTVFocusBorderColor} from '../../lib/tv/useTVFocusBorderColor';
import {useM3Colors} from '../../theme/M3PaletteContext';

const ALL = '__all__';
const REFRESH_AFTER_MS = 10 * 60 * 1000;

interface CardProps {
  channel: LiveChannel;
  width: number;
  preferredFocus: boolean;
  onPress: (channel: LiveChannel) => void;
}

const ChannelCard = React.memo(
  ({channel, width, preferredFocus, onPress}: CardProps) => {
    const colors = useM3Colors();
    const focusBorderColor = useTVFocusBorderColor();
    const [logoFailed, setLogoFailed] = useState(false);
    const showLogo = !!channel.logo && !logoFailed;
    return (
      <TVFocusable
        accessibilityRole="button"
        accessibilityLabel={`Play ${channel.name}`}
        hasTVPreferredFocus={preferredFocus}
        onPress={() => onPress(channel)}
        borderRadius={14}
        focusScale={1.05}
        focusBorderColor={focusBorderColor}
        style={{
          width,
          backgroundColor: colors.surfaceContainerHigh,
          borderColor: colors.outlineVariant,
          borderRadius: 14,
          borderWidth: 1,
          overflow: 'hidden',
        }}>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: colors.surfaceContainer,
            height: width * 0.62,
            justifyContent: 'center',
            padding: 10,
          }}>
          {showLogo ? (
            <Image
              source={{uri: channel.logo}}
              resizeMode="contain"
              onError={() => setLogoFailed(true)}
              style={{width: '100%', height: '100%'}}
            />
          ) : (
            <MaterialCommunityIcons
              name="television-classic"
              size={width * 0.28}
              color={colors.onSurfaceVariant}
            />
          )}
          <View
            style={{
              alignItems: 'center',
              backgroundColor: '#E50914',
              borderRadius: 6,
              flexDirection: 'row',
              gap: 4,
              left: 6,
              paddingHorizontal: 6,
              paddingVertical: 2,
              position: 'absolute',
              top: 6,
            }}>
            <View
              style={{backgroundColor: '#fff', borderRadius: 3, height: 5, width: 5}}
            />
            <AppText role="labelSmall" style={{color: '#fff', fontWeight: '800'}}>
              LIVE
            </AppText>
          </View>
        </View>
        <View style={{paddingHorizontal: 10, paddingVertical: 9}}>
          <AppText
            role="labelLargeEmphasized"
            numberOfLines={2}
            style={{color: colors.onSurface, minHeight: 36}}>
            {channel.name}
          </AppText>
        </View>
      </TVFocusable>
    );
  },
);

const LiveTv = () => {
  const insets = useSafeAreaInsets();
  const colors = useM3Colors();
  const focusBorderColor = useTVFocusBorderColor();
  const {width: screenWidth} = useWindowDimensions();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [channels, setChannels] = useState<LiveChannel[]>(() => readCachedChannels());
  const [loading, setLoading] = useState(channels.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(0);
  const [noSources, setNoSources] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState('');
  const lastLoad = useRef(0);

  const load = useCallback(async (manual: boolean) => {
    if (manual) {
      setRefreshing(true);
    }
    setError('');
    try {
      const sources = await fetchLiveTvSources();
      setNoSources(sources.length === 0);
      if (sources.length === 0) {
        setChannels([]);
        setFailed(0);
        writeCachedChannels([]);
      } else {
        const result = await loadLiveChannels(sources);
        setFailed(result.failed);
        if (result.channels.length > 0 || result.failed === sources.length) {
          // Keep the previous list if every link is down right now.
          if (result.channels.length > 0) {
            setChannels(result.channels);
            writeCachedChannels(result.channels);
          }
        }
      }
      lastLoad.current = Date.now();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load channels');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  // Coming back to the tab after a while quietly refreshes the list.
  useFocusEffect(
    useCallback(() => {
      if (lastLoad.current && Date.now() - lastLoad.current > REFRESH_AFTER_MS) {
        load(false);
      }
    }, [load]),
  );

  const categories = useMemo(() => groupCategories(channels), [channels]);

  // A category that disappeared after a refresh falls back to All.
  useEffect(() => {
    if (category !== ALL && !categories.some(c => c.name === category)) {
      setCategory(ALL);
    }
  }, [categories, category]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return channels.filter(
      c =>
        (category === ALL || c.category === category) &&
        (!q || c.name.toLowerCase().includes(q)),
    );
  }, [channels, category, query]);

  const play = useCallback(
    (channel: LiveChannel) => {
      navigation.navigate('Player', liveChannelPlayerParams(channel));
    },
    [navigation],
  );

  const padding = isTV ? 12 : 12;
  const gap = 10;
  const available = screenWidth - (isTV ? 96 : 0) - padding * 2;
  const target = isTV ? 190 : 150;
  const numColumns = Math.max(2, Math.floor((available + gap) / (target + gap)));
  const cardWidth = (available - gap * (numColumns - 1)) / numColumns;

  const chips = [{name: ALL, label: 'All', count: channels.length}].concat(
    categories.map(c => ({name: c.name, label: c.name, count: c.count})),
  );

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={{alignItems: 'center', paddingTop: 80}}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    const title = error
      ? 'Could not load channels'
      : noSources
        ? 'No channels yet'
        : query || category !== ALL
          ? 'No matching channels'
          : failed > 0
            ? 'Channels are unavailable'
            : 'No channels yet';
    const message = error
      ? error
      : noSources
        ? 'Live channels are added by the CineHub admin.'
        : query || category !== ALL
          ? 'Try another name or category.'
          : 'The channel list could not be reached. Check your internet connection and try again.';
    return (
      <View style={{alignItems: 'center', paddingHorizontal: 32, paddingTop: 80}}>
        <MaterialCommunityIcons
          name="television-off"
          size={64}
          color={colors.onSurfaceVariant}
        />
        <AppText
          role="titleLargeEmphasized"
          style={{color: colors.onSurface, marginTop: 16, textAlign: 'center'}}>
          {title}
        </AppText>
        <AppText
          role="bodyMedium"
          style={{color: colors.onSurfaceVariant, marginTop: 8, textAlign: 'center'}}>
          {message}
        </AppText>
        <TVFocusable
          accessibilityRole="button"
          onPress={() => {
            setLoading(true);
            load(false);
          }}
          hasTVPreferredFocus={isTV}
          borderRadius={22}
          focusBorderColor={focusBorderColor}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 22,
            marginTop: 20,
            paddingHorizontal: 26,
            paddingVertical: 11,
          }}>
          <AppText role="labelLargeEmphasized" style={{color: colors.onPrimary}}>
            Retry
          </AppText>
        </TVFocusable>
      </View>
    );
  };

  return (
    <TVFocusGuide
      trapFocusRight={true}
      trapFocusDown={true}
      trapFocusUp={true}
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: isTV ? 0 : insets.top,
      }}>
      <StatusBar />
      <View style={{flex: 1, paddingHorizontal: padding}}>
        <View
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 12,
            marginTop: isTV ? 16 : 22,
            paddingLeft: isTV ? 12 : 6,
            paddingRight: isTV ? 48 : 6,
          }}>
          <AppText
            role="headlineLargeEmphasized"
            style={{color: colors.onBackground}}>
            Live TV
          </AppText>
          <TVFocusable
            accessibilityRole="button"
            accessibilityLabel="Refresh channels"
            onPress={() => load(true)}
            borderRadius={20}
            focusScale={1.1}
            focusBorderColor={focusBorderColor}
            style={{
              alignItems: 'center',
              borderRadius: 20,
              justifyContent: 'center',
              minHeight: 40,
              minWidth: 40,
            }}>
            {refreshing ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <MaterialCommunityIcons name="refresh" size={26} color={colors.onSurfaceVariant} />
            )}
          </TVFocusable>
        </View>

        {channels.length > 0 && (
          <>
            <View
              style={{
                alignItems: 'center',
                backgroundColor: colors.surfaceContainerHigh,
                borderRadius: 26,
                flexDirection: 'row',
                height: isTV ? 52 : 48,
                marginBottom: 12,
                marginHorizontal: isTV ? 12 : 6,
                paddingHorizontal: 14,
              }}>
              <MaterialCommunityIcons name="magnify" size={22} color={colors.onSurfaceVariant} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search channels"
                placeholderTextColor={colors.onSurfaceVariant}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                cursorColor={colors.primary}
                selectionColor={colors.primary}
                style={{color: colors.onSurface, flex: 1, fontSize: 16, marginLeft: 10, paddingVertical: 0}}
              />
              {!!query && (
                <TVFocusable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => setQuery('')}
                  borderRadius={16}
                  style={{padding: 4}}>
                  <MaterialCommunityIcons name="close-circle" size={20} color={colors.onSurfaceVariant} />
                </TVFocusable>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{flexGrow: 0, marginBottom: 14}}
              contentContainerStyle={{
                gap: 8,
                paddingLeft: isTV ? 12 : 6,
                paddingRight: isTV ? 48 : 6,
                paddingVertical: 4,
              }}>
              {chips.map(chip => {
                const selected = chip.name === category;
                return (
                  <TVFocusable
                    key={chip.name}
                    accessibilityRole="tab"
                    accessibilityState={{selected}}
                    accessibilityLabel={`${chip.label}, ${chip.count} channels`}
                    onPress={() => setCategory(chip.name)}
                    borderRadius={18}
                    focusScale={1.06}
                    focusBorderColor={focusBorderColor}
                    style={{
                      alignItems: 'center',
                      backgroundColor: selected
                        ? colors.secondaryContainer
                        : colors.surfaceContainerHigh,
                      borderColor: selected ? colors.secondary : colors.outlineVariant,
                      borderRadius: 18,
                      borderWidth: 1,
                      flexDirection: 'row',
                      gap: 7,
                      height: isTV ? 44 : 38,
                      paddingHorizontal: 14,
                    }}>
                    <AppText
                      role="labelLargeEmphasized"
                      numberOfLines={1}
                      style={{
                        color: selected ? colors.onSecondaryContainer : colors.onSurface,
                        maxWidth: 160,
                      }}>
                      {chip.label}
                    </AppText>
                    <AppText
                      role="labelMedium"
                      style={{
                        color: selected ? colors.onSecondaryContainer : colors.onSurfaceVariant,
                        opacity: 0.8,
                      }}>
                      {chip.count}
                    </AppText>
                  </TVFocusable>
                );
              })}
            </ScrollView>
          </>
        )}

        <FlatList
          key={numColumns}
          data={visible}
          keyExtractor={item => item.id}
          numColumns={numColumns}
          columnWrapperStyle={{gap, marginBottom: gap}}
          contentContainerStyle={{paddingBottom: 24, paddingHorizontal: isTV ? 0 : 0}}
          showsVerticalScrollIndicator={false}
          initialNumToRender={numColumns * 4}
          maxToRenderPerBatch={numColumns * 3}
          windowSize={7}
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
          onRefresh={isTV ? undefined : () => load(true)}
          refreshing={refreshing}
          ListEmptyComponent={renderEmpty}
          renderItem={({item, index}) => (
            <ChannelCard
              channel={item}
              width={cardWidth}
              preferredFocus={isTV && index === 0}
              onPress={play}
            />
          )}
        />
      </View>
    </TVFocusGuide>
  );
};

export default LiveTv;
