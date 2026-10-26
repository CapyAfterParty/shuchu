import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import {
  Urbanist_200ExtraLight,
  Urbanist_200ExtraLight_Italic,
  Urbanist_300Light,
  Urbanist_300Light_Italic,
  Urbanist_400Regular,
  Urbanist_500Medium,
} from '@expo-google-fonts/urbanist';
import { useFonts } from 'expo-font';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { settingsReady, useSettings } from '../data/settings';
import { startTasks } from '../data/tasks';
import { syncEvening } from '../feel/evening';
import { Scene } from '../scene/Scene';
import { motion } from '../scene/world';
import { useReducedMotion } from 'react-native-reanimated';
import { useTheme, useThemeBlend } from '../theme/theme';
import type { Rgb } from '../theme/tokens';

// The launch screen (Shu on the mist) stays until the app can take over from it.
void SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 350 });

const css = (c: Rgb) => `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;

export default function Root() {
  const [fonts] = useFonts({
    Urbanist_200ExtraLight,
    Urbanist_200ExtraLight_Italic,
    Urbanist_300Light,
    Urbanist_300Light_Italic,
    Urbanist_400Regular,
    Urbanist_500Medium,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });
  const [ready, setReady] = useState(false);
  const palette = useTheme();
  useThemeBlend(palette);
  const calm = useSettings((x) => x.calmMotion);
  const reduced = useReducedMotion();
  useEffect(() => {
    motion.value = calm || reduced ? 0 : 1;
  }, [calm, reduced]);

  useEffect(() => {
    void settingsReady.then(startTasks).then(() => {
      setReady(true);
      void syncEvening();
    });
  }, []);

  useEffect(() => {
    if (fonts && ready) requestAnimationFrame(() => SplashScreen.hide());
  }, [fonts, ready]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(css(palette.air)).catch(() => {});
  }, [palette.air]);

  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <StatusBar style={palette.statusBar} />
        <View style={[styles.fill, { backgroundColor: css(palette.air) }]}>
          <Scene />
          {fonts && ready && <Slot />}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
