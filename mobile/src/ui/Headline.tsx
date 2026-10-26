// A headline that assembles itself: each word rises out of the mist a beat
// after the one before, then settles. Changing the text plays it again.

import { useEffect } from 'react';
import { StyleSheet, View, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useReveal, glide } from './motion';
import { Txt } from './Txt';

export function Headline({ text, delay = 0, style, stagger = 75 }: { text: string; delay?: number; style?: TextStyle; stagger?: number }) {
  const lines = text.split('\n').map((l) => l.split(' ').filter(Boolean));
  let n = 0;
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={text.replace(/\n/g, ' ')}>
      {lines.map((words, li) => (
        <View key={`${text}-${li}`} style={styles.line}>
          {words.map((w, wi) => (
            <Word key={`${text}-${li}-${wi}`} word={w} last={wi === words.length - 1} delay={delay + n++ * stagger} style={style} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Word({ word, last, delay, style }: { word: string; last: boolean; delay: number; style?: TextStyle }) {
  const p = useSharedValue(0);
  const parent = useReveal();
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 900, easing: glide }));
  }, [delay, p]);
  const a = useAnimatedStyle(() => {
    const v = p.value * (parent ? parent.value : 1);
    return {
      opacity: Math.min(1, v * 1.4),
      transform: [
        { translateY: (1 - p.value) * 22 },
        { scale: 0.92 + p.value * 0.08 },
        { rotateZ: `${(1 - p.value) * -3}deg` },
      ],
    };
  });
  return (
    <Animated.View style={a} importantForAccessibility="no-hide-descendants">
      <Txt variant="display" style={[style, !last && styles.gap]}>{word}</Txt>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  gap: { marginRight: 9 },
});
