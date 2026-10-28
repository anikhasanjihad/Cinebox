import React, {useCallback} from 'react';
import {BackHandler, Image, Linking, ScrollView, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {MaterialIcons} from '@expo/vector-icons';
import * as Application from 'expo-application';
import {TVFocusable, TVFocusGuide} from '../../components/tv';
import {isTV} from '../../lib/tv';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {socialLinks} from '../../lib/constants';

const About = ({navigation}: any) => {
  const colors = useM3Colors();

  useFocusEffect(
    useCallback(() => {
      if (!isTV) {
        return;
      }
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        navigation.goBack();
        return true;
      });
      return () => sub.remove();
    }, [navigation]),
  );

  return (
    <TVFocusGuide autoFocus trapFocusRight style={{flex: 1}}>
      <ScrollView
        focusable={false}
        style={{backgroundColor: colors.background}}
        contentContainerStyle={{padding: 20, paddingBottom: 60}}
        showsVerticalScrollIndicator={false}>
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 28}}>
          <TVFocusable onPress={() => navigation.goBack()} borderRadius={22} style={{padding: 8, marginRight: 8}}>
            <MaterialIcons name="arrow-back" size={26} color={colors.onBackground} />
          </TVFocusable>
          <Text style={{color: colors.onBackground, fontSize: 24, fontWeight: '800'}}>
            About CineHub
          </Text>
        </View>

        <View style={{alignItems: 'center', marginBottom: 30}}>
          <Image
            source={require('../../../assets/logo.png')}
            style={{width: 110, height: 110, borderRadius: 28}}
          />
          <Text style={{color: colors.onBackground, fontSize: 26, fontWeight: '900', letterSpacing: 4, marginTop: 16}}>
            CINE<Text style={{color: '#E50914'}}>HUB</Text>
          </Text>
          <Text style={{color: colors.onSurfaceVariant, marginTop: 6}}>
            Version {Application.nativeApplicationVersion ?? '1.0.0'}
          </Text>
        </View>

        <TVFocusable
          onPress={() => Linking.openURL(socialLinks.telegram)}
          borderRadius={16}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            borderRadius: 16,
            backgroundColor: colors.surfaceContainerLow,
          }}>
          <MaterialIcons name="support-agent" size={22} color={colors.onSurface} />
          <View style={{marginLeft: 14, flex: 1}}>
            <Text style={{color: colors.onSurface, fontSize: 16, fontWeight: '700'}}>
              Support group
            </Text>
            <Text style={{color: colors.onSurfaceVariant, fontSize: 13}}>
              Get help or report a problem on Telegram
            </Text>
          </View>
          <MaterialIcons name="open-in-new" size={20} color={colors.onSurfaceVariant} />
        </TVFocusable>
      </ScrollView>
    </TVFocusGuide>
  );
};

export default About;
