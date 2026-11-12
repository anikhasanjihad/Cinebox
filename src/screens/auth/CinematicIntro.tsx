import React, {useEffect} from 'react';
import {Image, StyleSheet, View} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {isTV} from '../../lib/tv';

// iOS-style curves (UIKit's default ease-out and ease-in-out).
const IOS_OUT = Easing.bezier(0.25, 0.46, 0.45, 0.94);
const IOS_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1);

const RED = '#E50914';
const TITLE = 'CINEHUB';

/** Total time the intro stays on screen before handing over to the form. */
export const INTRO_MS = 1500;

const APP_START = Date.now();
/** How much of `ms` is still ahead, counted from app launch (0 after logout). */
export const introDelayFor = (ms: number): number =>
  Math.max(0, ms - (Date.now() - APP_START));

const Letter = ({ch, index, size}: {ch: string; index: number; size: number}) => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      420 + index * 55,
      withTiming(1, {duration: 380, easing: IOS_OUT}),
    );
  }, [index, p]);
  const style = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [
      {scale: interpolate(p.value, [0, 1], [2.6, 1])},
      {translateY: interpolate(p.value, [0, 1], [-30, 0])},
    ],
  }));
  const red = index >= 4;
  return (
    <Animated.Text
      style={[
        {
          color: red ? RED : '#fff',
          fontSize: size,
          fontWeight: '900',
          letterSpacing: 5,
          textShadowColor: red ? RED : 'rgba(255,255,255,0.8)',
          textShadowRadius: 16,
          textShadowOffset: {width: 0, height: 0},
        },
        style,
      ]}>
      {ch}
    </Animated.Text>
  );
};

/**
 * Netflix-style "ta-dum" opening: a red light pulse, the mark slams in,
 * the letters drop one by one, a red streak sweeps under the name, then the
 * whole thing zooms through into the sign-in screen.
 */
const CinematicIntro = () => {
  const fs = isTV ? 1.3 : 1;
  const mark = useSharedValue(0);
  const ring = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const streak = useSharedValue(0);
  const flash = useSharedValue(0);
  const out = useSharedValue(1);
  const zoom = useSharedValue(1);

  useEffect(() => {
    mark.value = withDelay(
      120,
      withTiming(1, {duration: 520, easing: Easing.out(Easing.back(1.4))}),
    );
    ring.value = withDelay(
      120,
      withTiming(1, {duration: 900, easing: IOS_OUT}),
    );
    ring2.value = withDelay(
      320,
      withTiming(1, {duration: 900, easing: IOS_OUT}),
    );
    flash.value = withDelay(
      120,
      withSequence(
        withTiming(0.32, {duration: 90}),
        withTiming(0, {duration: 420}),
      ),
    );
    streak.value = withDelay(
      820,
      withTiming(1, {duration: 420, easing: IOS_IN_OUT}),
    );
    zoom.value = withDelay(
      1150,
      withTiming(1.18, {duration: 350, easing: IOS_IN_OUT}),
    );
    out.value = withDelay(1150, withTiming(0, {duration: 350}));
  }, [mark, ring, ring2, flash, streak, zoom, out]);

  const wrap = useAnimatedStyle(() => ({
    opacity: out.value,
    transform: [{scale: zoom.value}],
  }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: mark.value,
    transform: [{scale: interpolate(mark.value, [0, 1], [0.3, 1])}],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 0.15, 1], [0, 0.6, 0]),
    transform: [{scale: interpolate(ring.value, [0, 1], [0.3, 3.2])}],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    opacity: interpolate(ring2.value, [0, 0.15, 1], [0, 0.45, 0]),
    transform: [{scale: interpolate(ring2.value, [0, 1], [0.3, 3.6])}],
  }));
  const flashStyle = useAnimatedStyle(() => ({opacity: flash.value}));
  const streakStyle = useAnimatedStyle(() => ({
    opacity: interpolate(streak.value, [0, 0.2, 1], [0, 1, 1]),
    width: interpolate(streak.value, [0, 1], [0, 260 * fs]),
  }));

  return (
    <Animated.View
      pointerEvents="auto"
      style={[StyleSheet.absoluteFill, {backgroundColor: '#000', zIndex: 50}, wrap]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, {backgroundColor: RED}, flashStyle]}
      />
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <View style={{alignItems: 'center', justifyContent: 'center'}}>
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: 120 * fs,
                height: 120 * fs,
                borderRadius: 100,
                borderWidth: 3,
                borderColor: RED,
              },
              ringStyle,
            ]}
          />
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: 120 * fs,
                height: 120 * fs,
                borderRadius: 100,
                borderWidth: 2,
                borderColor: 'rgba(255,255,255,0.7)',
              },
              ring2Style,
            ]}
          />
          <Animated.View style={markStyle}>
            <Image
              source={require('../../../assets/logo.png')}
              style={{width: 120 * fs, height: 120 * fs, borderRadius: 28 * fs}}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        <View style={{flexDirection: 'row', marginTop: 26}}>
          {TITLE.split('').map((ch, i) => (
            <Letter key={i} ch={ch} index={i} size={40 * fs} />
          ))}
        </View>

        <Animated.View style={[{height: 4, marginTop: 14, borderRadius: 4, overflow: 'hidden'}, streakStyle]}>
          <LinearGradient
            colors={['rgba(229,9,20,0)', RED, '#ff5a63', RED, 'rgba(229,9,20,0)']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
};

export default CinematicIntro;
