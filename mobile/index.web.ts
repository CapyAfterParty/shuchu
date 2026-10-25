// On the web the GPU canvas (CanvasKit) must load before anything draws.
// Kept in a web-only entry so native builds never see the web loader.
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

// Behave like an app, not a page: a long press must never select text or open
// the browser's touch menu (that cancels the touch). Text fields still work.
const style = document.createElement('style');
style.textContent = `
  #root, #root * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
  #root input, #root textarea { -webkit-user-select: text; user-select: text; }
  html, body { overscroll-behavior: none; }
`;
document.head.appendChild(style);

// relative, so the web build also works from a sub-folder
LoadSkiaWeb({ locateFile: (file: string) => file })
  .then(() => require('expo-router/entry'))
  .catch(() => {
    // Some embedded browsers block WebAssembly; say so instead of a blank page.
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML =
        '<div style="margin:auto;max-width:300px;padding:24px;text-align:center;font:300 16px/1.5 system-ui;color:#17212c">' +
        'This preview needs WebGL and WebAssembly, which this browser blocked.<br><br>' +
        'Open it in Chrome or Safari, or run the app with Expo Go.</div>';
      root.style.background = '#d9e2eb';
    }
  });
