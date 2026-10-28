import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {MaterialIcons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import PosterWall from './PosterWall';
import AuthInput, {RED} from './AuthInput';
import {TVFocusable} from '../../components/tv';
import {isTV} from '../../lib/tv';
import useAuthStore from '../../lib/zustand/authStore';
import {socialLinks} from '../../lib/constants';

type Mode = 'signin' | 'signup' | 'forgot';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TITLES: Record<Mode, string> = {
  signin: 'Sign In',
  signup: 'Create Account',
  forgot: 'Reset Password',
};

const AuthScreen = () => {
  const signIn = useAuthStore(s => s.signIn);
  const signUp = useAuthStore(s => s.signUp);
  const resetPassword = useAuthStore(s => s.resetPassword);

  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const emailRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);

  // --- logo intro -------------------------------------------------------
  const logoScale = useSharedValue(0.55);
  const logoOpacity = useSharedValue(0);
  const glow = useSharedValue(0.35);
  const shake = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, {duration: 700});
    logoScale.value = withSpring(1, {damping: 11, stiffness: 90});
    glow.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(0.8, {duration: 1800, easing: Easing.inOut(Easing.quad)}),
          withTiming(0.3, {duration: 1800, easing: Easing.inOut(Easing.quad)}),
        ),
        -1,
        false,
      ),
    );
  }, [logoOpacity, logoScale, glow]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{scale: logoScale.value}],
  }));
  const glowStyle = useAnimatedStyle(() => ({opacity: glow.value}));
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{translateX: shake.value}],
  }));

  const fail = useCallback(
    (message: string) => {
      setNotice('');
      setError(message);
      shake.value = withSequence(
        withTiming(-12, {duration: 55}),
        withRepeat(withTiming(12, {duration: 110}), 5, true),
        withTiming(0, {duration: 55}),
      );
    },
    [shake],
  );

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setError('');
    setNotice('');
  }, []);

  const submit = useCallback(async () => {
    if (busy) {
      return;
    }
    setError('');
    setNotice('');

    if (mode === 'signup' && name.trim().length < 2) {
      return fail('Please enter your name.');
    }
    if (!EMAIL_RE.test(email.trim())) {
      return fail('Enter a valid email address.');
    }
    if (mode !== 'forgot' && password.length < 6) {
      return fail('Password must be at least 6 characters.');
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else if (mode === 'signup') {
        const result = await signUp(email, password, name);
        if (result.needsEmailConfirmation) {
          setMode('signin');
          setPassword('');
          setNotice(
            'Account created! Check your email and confirm it, then sign in.',
          );
        }
      } else {
        await resetPassword(email);
        setMode('signin');
        setNotice('Password reset email sent. Check your inbox.');
      }
    } catch (e) {
      fail(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }, [busy, mode, name, email, password, signIn, signUp, resetPassword, fail]);

  const fs = isTV ? 1.25 : 1;
  const cardWidth = isTV ? 520 : undefined;

  return (
    <View style={{flex: 1, backgroundColor: '#000'}}>
      <PosterWall />
      <SafeAreaView style={{flex: 1}}>
        <KeyboardAvoidingView
          style={{flex: 1}}
          behavior={isTV ? undefined : 'padding'}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            focusable={false}
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 22,
              paddingVertical: 24,
            }}>
            {/* ---- brand ---- */}
            <View style={{alignItems: 'center', marginBottom: isTV ? 18 : 22}}>
              <View style={{alignItems: 'center', justifyContent: 'center'}}>
                <Animated.View
                  style={[
                    {
                      position: 'absolute',
                      width: 150 * fs,
                      height: 150 * fs,
                      borderRadius: 100,
                      backgroundColor: RED,
                      shadowColor: RED,
                      shadowOpacity: 1,
                      shadowRadius: 50,
                    },
                    glowStyle,
                  ]}
                />
                <Animated.View style={logoStyle}>
                  <Image
                    source={require('../../../assets/logo.png')}
                    style={{width: 104 * fs, height: 104 * fs, borderRadius: 26 * fs}}
                    resizeMode="contain"
                  />
                </Animated.View>
              </View>
              <Animated.Text
                entering={FadeInUp.delay(350).duration(600)}
                style={{
                  color: '#fff',
                  fontSize: 30 * fs,
                  fontWeight: '900',
                  letterSpacing: 6,
                  marginTop: 14,
                }}>
                CINE<Text style={{color: RED}}>HUB</Text>
              </Animated.Text>
              <Animated.Text
                entering={FadeIn.delay(700).duration(700)}
                style={{
                  color: 'rgba(255,255,255,0.55)',
                  fontSize: 13 * fs,
                  marginTop: 4,
                  letterSpacing: 1,
                }}>
                Unlimited movies, shows & more
              </Animated.Text>
            </View>

            {/* ---- form card ---- */}
            <Animated.View
              entering={FadeInDown.delay(500).duration(650).springify().damping(16)}
              layout={LinearTransition.duration(250)}
              style={[
                {
                  width: '100%',
                  maxWidth: cardWidth ?? 440,
                  backgroundColor: 'rgba(0,0,0,0.72)',
                  borderRadius: 18,
                  padding: isTV ? 30 : 22,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                },
                shakeStyle,
              ]}>
              <Animated.Text
                key={mode}
                entering={FadeIn.duration(280)}
                style={{
                  color: '#fff',
                  fontSize: 26 * fs,
                  fontWeight: '800',
                  marginBottom: 18,
                }}>
                {TITLES[mode]}
              </Animated.Text>

              {mode === 'signup' && (
                <Animated.View
                  entering={FadeInDown.duration(260)}
                  exiting={FadeOutUp.duration(180)}>
                  <AuthInput
                    label="Your name"
                    icon="person-outline"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                    textContentType="name"
                    editable={!busy}
                  />
                </Animated.View>
              )}

              <Animated.View layout={LinearTransition.duration(250)}>
                <AuthInput
                  ref={emailRef}
                  label="Email address"
                  icon="mail-outline"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType={mode === 'forgot' ? 'send' : 'next'}
                  onSubmitEditing={() =>
                    mode === 'forgot' ? submit() : passRef.current?.focus()
                  }
                  editable={!busy}
                />
              </Animated.View>

              {mode !== 'forgot' && (
                <Animated.View
                  entering={FadeInDown.duration(260)}
                  exiting={FadeOutUp.duration(180)}>
                  <AuthInput
                    ref={passRef}
                    label="Password"
                    icon="lock-outline"
                    value={password}
                    onChangeText={setPassword}
                    secure
                    autoCapitalize="none"
                    autoComplete={mode === 'signup' ? 'password-new' : 'password'}
                    textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                    returnKeyType="go"
                    onSubmitEditing={submit}
                    editable={!busy}
                  />
                </Animated.View>
              )}

              {!!error && (
                <Animated.View
                  entering={FadeIn.duration(200)}
                  exiting={FadeOut.duration(150)}
                  style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
                  <MaterialIcons name="error-outline" size={18} color="#ff6b73" />
                  <Text style={{color: '#ff6b73', marginLeft: 6, flex: 1, fontSize: 13.5 * fs}}>
                    {error}
                  </Text>
                </Animated.View>
              )}
              {!!notice && (
                <Animated.View
                  entering={FadeIn.duration(200)}
                  style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
                  <MaterialIcons name="check-circle-outline" size={18} color="#46d369" />
                  <Text style={{color: '#46d369', marginLeft: 6, flex: 1, fontSize: 13.5 * fs}}>
                    {notice}
                  </Text>
                </Animated.View>
              )}

              {/* primary button */}
              <TVFocusable
                onPress={submit}
                disabled={busy}
                borderRadius={10}
                focusScale={1.04}
                hasTVPreferredFocus={isTV}
                accessibilityRole="button"
                accessibilityLabel={TITLES[mode]}
                style={{
                  height: isTV ? 60 : 54,
                  borderRadius: 10,
                  backgroundColor: busy ? '#9b0710' : RED,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 4,
                }}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{color: '#fff', fontSize: 17 * fs, fontWeight: '800', letterSpacing: 0.4}}>
                    {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Sign Up' : 'Send reset link'}
                  </Text>
                )}
              </TVFocusable>

              {mode === 'signin' && (
                <TVFocusable
                  onPress={() => switchMode('forgot')}
                  borderRadius={8}
                  style={{alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 10, marginTop: 4}}>
                  <Text style={{color: 'rgba(255,255,255,0.65)', fontSize: 14 * fs}}>
                    Forgot password?
                  </Text>
                </TVFocusable>
              )}

              <View style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8, flexWrap: 'wrap'}}>
                <Text style={{color: 'rgba(255,255,255,0.55)', fontSize: 14.5 * fs}}>
                  {mode === 'signin' ? 'New to CineHub? ' : mode === 'signup' ? 'Already a member? ' : 'Remembered it? '}
                </Text>
                <TVFocusable
                  onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                  borderRadius={8}
                  style={{paddingVertical: 8, paddingHorizontal: 6}}>
                  <Text style={{color: '#fff', fontSize: 14.5 * fs, fontWeight: '800'}}>
                    {mode === 'signin' ? 'Sign up now' : 'Sign in'}
                  </Text>
                </TVFocusable>
              </View>
            </Animated.View>

            <Animated.View entering={FadeIn.delay(1100).duration(600)} style={{marginTop: 14}}>
              <TVFocusable
                onPress={() => Linking.openURL(socialLinks.telegram)}
                borderRadius={8}
                style={{flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14}}>
                <MaterialIcons name="support-agent" size={18} color="rgba(255,255,255,0.6)" />
                <Text style={{color: 'rgba(255,255,255,0.6)', marginLeft: 6, fontSize: 13 * fs}}>
                  Need help? Join our support group
                </Text>
              </TVFocusable>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

export default AuthScreen;
