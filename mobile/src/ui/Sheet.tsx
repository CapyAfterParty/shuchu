// A sheet of glass that grows out of the mist and can be pulled away.

import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { feel } from '../feel/feel';
import { Glass } from '../scene/Glass';
import { useTheme } from '../theme/theme';
import { RevealContext } from './motion';
import { spring } from '../theme/tokens';

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Shrinks the sheet back when something sits on top of it. */
  recede?: boolean;
  /** Extra presence control, e.g. for nested content. */
  presence?: SharedValue<number>;
}

export function Sheet({ open, onClose, children, recede = false }: Props) {
  const [mounted, setMounted] = useState(open);
  const presence = useSharedValue(0);
  const dy = useSharedValue(0);
  const scale = useSharedValue(1);
  const back = useSharedValue(0);
  const dismiss = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const p = useTheme();

  useEffect(() => {
    if (open) {
      setMounted(true);
      dy.value = 0;
      presence.value = withSpring(1, spring.sheet);
    } else {
      presence.value = withTiming(0, { duration: 420 });
      const t = setTimeout(() => setMounted(false), 440);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    scale.value = withSpring(recede ? 0.94 : 1, spring.sheet);
    back.value = withTiming(recede ? 1 : 0, { duration: 420 });
  }, [recede]);

  useAnimatedReaction(
    () => dismiss.value,
    (now, before) => {
      if (now === 1 && before !== 1) scheduleOnRN(onClose);
    },
  );

  const pan = usePanGesture({
    activeOffsetY: [-12, 12],
    onUpdate: (e) => {
      'worklet';
      const t = e.translationY;
      // free downwards, stiff upwards (rubber band)
      dy.value = t > 0 ? t : -Math.sqrt(-t) * 4;
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > height * 0.18 || e.velocityY > 900) {
        dy.value = withSpring(height * 0.4, spring.sheet);
        dismiss.value = 1;
      } else {
        dy.value = withSpring(0, spring.jelly);
      }
    },
  });

  useEffect(() => {
    if (open) dismiss.value = 0;
  }, [open]);

  // a sheet that recedes sinks into the mist, so nothing shows through the one on top
  const bodyStyle = useAnimatedStyle(() => ({ opacity: 1 - back.value }));
  // glass inside the sheet grows and sinks with it
  const inner = useDerivedValue(() => presence.value * (1 - back.value));

  if (!mounted) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 6 }]} pointerEvents={open ? 'box-none' : 'none'}>
      <Glass
        style={styles.sheet}
        radius={46}
        lift={0.9}
        melt={0}
        wobble={1.2}
        presence={presence}
        dy={dy}
        scale={scale}
      >
        <GestureDetector gesture={pan}>
          <View style={styles.grabZone} accessibilityLabel="Pull down to close" onTouchStart={() => feel.touch()}>
            <View style={[styles.grabber, { backgroundColor: p.inkFaint }]} />
          </View>
        </GestureDetector>
        <Animated.View style={[styles.body, { paddingBottom: insets.bottom }, bodyStyle]} pointerEvents={recede ? 'none' : 'auto'}>
          <RevealContext.Provider value={inner}>{children}</RevealContext.Provider>
        </Animated.View>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, marginHorizontal: 8 },
  grabZone: { height: 30, alignItems: 'center', justifyContent: 'center' },
  grabber: { width: 38, height: 4, borderRadius: 2, opacity: 0.6 },
  body: { flex: 1 },
});
