// One place for the app's icon set, so it can be swapped without touching every screen.
// Ionicons loads its font through expo-font at runtime, which works in Expo Go and in store builds.
import { Ionicons, type IoniconsIconName } from '@react-native-vector-icons/ionicons';

export type IconName = IoniconsIconName;

export function Icon({ name, size = 16, color }: { name: IconName; size?: number; color: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}
