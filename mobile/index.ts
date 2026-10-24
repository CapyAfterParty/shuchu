// On the web the GPU canvas (CanvasKit) must load before anything draws.
// On phones Skia is native, so the app starts at once.
import { Platform } from 'react-native';

if (Platform.OS === 'web') {
  const { LoadSkiaWeb } = require('@shopify/react-native-skia/lib/module/web');
  // relative, so the web build also works from a sub-folder
  LoadSkiaWeb({ locateFile: (file: string) => file }).then(() => require('expo-router/entry'));
} else {
  require('expo-router/entry');
}
