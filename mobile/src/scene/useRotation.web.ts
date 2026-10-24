// On the web the light stays still. Browsers inside embedded frames (like an
// artifact viewer) refuse motion sensors by throwing, so we never ask.
import { useSharedValue } from 'react-native-reanimated';

export function useRotation() {
  return useSharedValue({ pitch: 0, roll: 0, yaw: 0, qw: 1, qx: 0, qy: 0, qz: 0, interfaceOrientation: 0 });
}
