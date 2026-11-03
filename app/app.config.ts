import type { ConfigContext, ExpoConfig } from 'expo/config';

// Change this before your first store build if you prefer another identifier.
// It must be unique on the App Store and Google Play and can't be changed after publishing.
const BUNDLE_ID = process.env.SAFEHOP_BUNDLE_ID ?? 'com.ertugrulozvardar.safehop';

// Paste the ID that `eas init` prints here (README, step 4).
const EAS_PROJECT_ID = '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'SafeHop',
  slug: 'safehop',
  scheme: 'safehop',
  version: '1.0.0',
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
