import type { ConfigContext, ExpoConfig } from 'expo/config';

// Change this before your first store build if you prefer another identifier.
// It must be unique on the App Store and Google Play and can't be changed after publishing.
const BUNDLE_ID = process.env.SAFEHOP_BUNDLE_ID ?? 'com.ertugrulozvardar.safehop';

// EAS project: https://expo.dev/accounts/ozvardar.ertugrul/projects/safehop
const EAS_OWNER = 'ozvardar.ertugrul';
const EAS_PROJECT_ID = '341108a8-22ba-446f-b725-0d2c6a355162';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'SafeHop',
  slug: 'safehop',
  owner: EAS_OWNER,
  scheme: 'safehop',
  version: '1.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: false,
    bundleIdentifier: BUNDLE_ID,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#0F3D3E',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  ...(EAS_PROJECT_ID ? { extra: { ...config.extra, eas: { projectId: EAS_PROJECT_ID } } } : {}),
  plugins: [
    'expo-router',
    [
      'react-native-maps',
      {
        // Required for Android store builds (Expo Go works without it).
        // Set GOOGLE_MAPS_ANDROID_API_KEY as an EAS environment variable / secret.
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? '',
      },
    ],
  ],
});
