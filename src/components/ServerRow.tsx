import React, {memo, useCallback} from 'react';
import {FlatList, View} from 'react-native';
import useContentStore from '../lib/zustand/contentStore';
import type {ProviderExtension} from '../lib/storage/extensionStorage';
import {useM3Colors} from '../theme/M3PaletteContext';
import {isTV} from '../lib/tv/constants';
import {TVFocusable} from './tv';
import AppText from './ui/Text';
import PressableScale from './ui/PressableScale';
import ProviderIcon from './ProviderIcon';

const CARD_WIDTH = isTV ? 148 : 96;
const LOGO_SIZE = isTV ? 112 : 76;
const GAP = isTV ? 18 : 14;

interface CardProps {
  item: ProviderExtension;
  selected: boolean;
  onSelect: (item: ProviderExtension) => void;
}

const ServerCard = memo(({item, selected, onSelect}: CardProps) => {
  const colors = useM3Colors();
  const press = useCallback(() => onSelect(item), [item, onSelect]);

  const content = (focused: boolean) => (
    <>
      <View
        style={{
          borderColor: selected || focused ? colors.primary : 'transparent',
          borderRadius: Math.round(LOGO_SIZE * 0.3) + 4,
          borderWidth: 2,
          padding: 2,
        }}>
        <ProviderIcon
          uri={item.icon}
          name={item.display_name}
          size={LOGO_SIZE}
          background={colors.surfaceContainerHigh}
          color={colors.onSurface}
        />
      </View>
      <AppText
        role="labelMedium"
        numberOfLines={1}
        style={{
          color: selected || focused ? colors.onSurface : colors.onSurfaceVariant,
          fontWeight: selected ? '700' : '500',
          marginTop: 8,
          textAlign: 'center',
          width: CARD_WIDTH,
        }}>
        {item.display_name}
      </AppText>
    </>
  );

  if (isTV) {
    return (
      <TVFocusable
        onPress={press}
        borderRadius={26}
        focusScale={1.06}
        showFocusBorder={false}
        accessibilityLabel={item.display_name}
        style={{alignItems: 'center', width: CARD_WIDTH}}>
        {({focused}) => content(focused)}
      </TVFocusable>
    );
  }
  return (
    <PressableScale
      onPress={press}
      pressedScale={0.93}
      accessibilityRole="button"
      accessibilityLabel={item.display_name}
      accessibilityState={{selected}}
      style={{alignItems: 'center', width: CARD_WIDTH}}>
      {content(false)}
    </PressableScale>
  );
});

/**
 * Home server row: every server the admin set up, as a logo card in a
 * horizontal row you can slide. Tapping one makes it the active server and the
 * rows below reload with its content. Uses the same selection as the side
 * drawer, so nothing else about servers changes.
 */
const ServerRow = () => {
  const colors = useM3Colors();
  const providers = useContentStore(s => s.installedProviders);
  const selected = useContentStore(s => s.provider);
  const setProvider = useContentStore(s => s.setProvider);

  const onSelect = useCallback(
    (item: ProviderExtension) => {
      const current = useContentStore.getState().provider;
      if (
        current?.value === item.value &&
        current?.source?.author === item.source?.author
      ) {
        return;
      }
      setProvider(item);
    },
    [setProvider],
  );

  if (!providers || providers.length === 0) {
    return null;
  }

  return (
    <View style={{marginTop: 18, marginBottom: 6}}>
      <AppText
        role="titleLarge"
        style={{
          color: colors.onSurface,
          fontWeight: '700',
          letterSpacing: -0.4,
          marginBottom: 12,
          paddingHorizontal: isTV ? 32 : 16,
        }}>
        Servers
      </AppText>
      <FlatList
        horizontal
        data={providers}
        keyExtractor={p => `${p.source?.author}:${p.value}`}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + GAP}
        snapToAlignment="start"
        ItemSeparatorComponent={() => <View style={{width: GAP}} />}
        contentContainerStyle={{paddingHorizontal: isTV ? 32 : 16}}
        initialNumToRender={6}
        renderItem={({item}) => (
          <ServerCard
            item={item}
            selected={
              selected?.value === item.value &&
              selected?.source?.author === item.source?.author
            }
            onSelect={onSelect}
          />
        )}
      />
    </View>
  );
};

export default memo(ServerRow);
