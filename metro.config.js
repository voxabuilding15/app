const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// The Pomodoro ambient sounds are Ogg Vorbis files, which Metro does not bundle as assets by default.
config.resolver.assetExts.push('ogg');

module.exports = withNativeWind(config, { input: './src/global.css' });
