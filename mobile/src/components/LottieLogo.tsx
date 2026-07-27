import React from 'react';
import { Image, ImageStyle, StyleProp, ViewStyle } from 'react-native';
import Constants from 'expo-constants';

// lottie-react-native binds a native module that is absent in Expo Go — lazily
// require it only outside Expo Go, and fall back to the static emblem there.
const isExpoGo = Constants.appOwnership === 'expo';
let LottieView: any = null;
if (!isExpoGo) {
  try {
    LottieView = require('lottie-react-native').default;
  } catch {
    LottieView = null;
  }
}

// True when the animated (Lottie) logo is available — screens use this to avoid
// doubling motion (e.g. hide the JS SpeedLines when Lottie brings its own).
export const lottieAvailable = !!LottieView;

const animation = require('../../assets/logo-lottie.json');
const fallback = require('../../assets/splash-icon.png');

interface Props {
  style?: StyleProp<ViewStyle & ImageStyle>;
  loop?: boolean;
  autoPlay?: boolean;
}

export default function LottieLogo({ style, loop = false, autoPlay = true }: Props) {
  if (!LottieView) {
    return <Image source={fallback} style={style} resizeMode="contain" />;
  }
  return (
    <LottieView source={animation} autoPlay={autoPlay} loop={loop} style={style} resizeMode="contain" />
  );
}
