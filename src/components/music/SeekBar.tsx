import React, {useCallback, useRef, useState} from 'react';
import {PanResponder, View} from 'react-native';
import {useM3Colors} from '../../theme/M3PaletteContext';
import AppText from '../ui/Text';
import {formatTime} from '../../lib/music/types';

interface Props {
  positionMs: number;
  durationMs: number;
  onSeek: (ms: number) => void;
}

const SeekBar = ({positionMs, durationMs, onSeek}: Props) => {
  const colors = useM3Colors();
  const [width, setWidth] = useState(0);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const widthRef = useRef(0);
  const durationRef = useRef(durationMs);
  durationRef.current = durationMs;
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;

  const ratioFrom = (x: number): number =>
    widthRef.current > 0 ? Math.min(Math.max(x / widthRef.current, 0), 1) : 0;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => durationRef.current > 0,
      onMoveShouldSetPanResponder: () => durationRef.current > 0,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: e => setDragRatio(ratioFrom(e.nativeEvent.locationX)),
      onPanResponderMove: e => setDragRatio(ratioFrom(e.nativeEvent.locationX)),
      onPanResponderRelease: e => {
        const ratio = ratioFrom(e.nativeEvent.locationX);
        setDragRatio(null);
        onSeekRef.current(Math.round(ratio * durationRef.current));
      },
      onPanResponderTerminate: () => setDragRatio(null),
    }),
  ).current;

  const onLayout = useCallback(
    (e: {nativeEvent: {layout: {width: number}}}) => {
      widthRef.current = e.nativeEvent.layout.width;
      setWidth(e.nativeEvent.layout.width);
    },
    [],
  );

  const ratio =
    dragRatio ??
    (durationMs > 0 ? Math.min(Math.max(positionMs / durationMs, 0), 1) : 0);
  const shownMs = dragRatio !== null ? dragRatio * durationMs : positionMs;

  return (
    <View>
      <View
        {...responder.panHandlers}
        onLayout={onLayout}
        accessibilityRole="adjustable"
        accessibilityLabel="Seek"
        style={{height: 32, justifyContent: 'center'}}>
        <View
          pointerEvents="none"
          style={{
            backgroundColor: 'rgba(255,255,255,0.22)',
            borderRadius: 4,
            height: dragRatio !== null ? 10 : 5,
            overflow: 'hidden',
          }}>
          <View
            style={{
              backgroundColor: colors.onSurface,
              height: '100%',
              width: width * ratio,
            }}
          />
        </View>
        {/* iOS shows the thumb only while the scrubber is being dragged. */}
        {dragRatio !== null ? (
          <View
            pointerEvents="none"
            style={{
              backgroundColor: colors.onSurface,
              borderRadius: 9,
              height: 18,
              left: Math.max(width * ratio - 9, 0),
              position: 'absolute',
              width: 18,
            }}
          />
        ) : null}
      </View>
      <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
        <AppText role="labelMedium" style={{color: colors.onSurfaceVariant}}>
          {formatTime(shownMs)}
        </AppText>
        <AppText role="labelMedium" style={{color: colors.onSurfaceVariant}}>
          {formatTime(durationMs)}
        </AppText>
      </View>
    </View>
  );
};

export default SeekBar;
