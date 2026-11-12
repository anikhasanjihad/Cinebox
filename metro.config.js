const {getDefaultConfig} = require('expo/metro-config');
const {withNativeWind} = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Startup speed: evaluate each module the first time it is used instead of
// all of them before the first frame. Screens that are not opened at launch
// (Settings, Player, Admin, ...) no longer cost anything until you visit them.
// Bare side-effect imports (`import 'react-native-reanimated'`, polyfills) are
// never deferred by Metro, so import-order dependent setup keeps working.
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

module.exports = withNativeWind(config, {input: './src/global.css'});
