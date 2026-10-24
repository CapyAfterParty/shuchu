// Phone orientation, read on the UI thread, for the tilt-following light.
import { SensorType, useAnimatedSensor } from 'react-native-reanimated';

export function useRotation() {
  return useAnimatedSensor(SensorType.ROTATION, { interval: 16 }).sensor;
}
