// On the web the GPU canvas (CanvasKit) must load before anything draws.
// Kept in a web-only entry so native builds never see the web loader.
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

// relative, so the web build also works from a sub-folder
LoadSkiaWeb({ locateFile: (file: string) => file }).then(() => require('expo-router/entry'));
