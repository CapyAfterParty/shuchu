// A press on glass: it squashes under the finger, then wobbles back like jelly.

import type { ReactNode } from 'react';
import { Pressable, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { feel } from '../feel/feel';
import { Glass, type Frame } from '../scene/Glass';
import { ripple } from '../scene/world';
import { spring } from '../theme/tokens';

export interface GlassButtonProps {
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  radius?: number;
  pearl?: number | SharedValue<number>;
  warm?: number | SharedValue<number>;
  lift?: number;
  melt?: number;
  presence?: number | SharedValue<number>;
  frame?: SharedValue<Frame>;
  label?: string;
  disabled?: boolean;
  hitSlop?: number;
}

const center: ViewStyle = { alignItems: 'center', justifyContent: 'center' };

const OUTER = new Set(['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical', 'alignSelf', 'position', 'top', 'left', 'right', 'bottom']);

/** Layout belongs to the touch target; padding and looks belong to the glass. */
function split(style: StyleProp<ViewStyle>): [ViewStyle, ViewStyle] {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = { flexGrow: 1 };
  for (const [k, v] of Object.entries(flat)) (OUTER.has(k) ? outer : inner)[k] = v;
  return [outer as ViewStyle, inner as ViewStyle];
}

export function GlassButton({
  onPress, onLongPress, style, children, radius = 24, pearl = 0, warm = 0, lift = 0.6, melt = 0,
  presence = 1, frame, label, disabled, hitSlop = 8,
}: GlassButtonProps) {
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const [outer, inner] = split(style);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={hitSlop}
      style={outer}
      onPressIn={(e) => {
        feel.touch();
        // a ring of light spreads through the mist under your finger
        ripple(e.nativeEvent.pageX, e.nativeEvent.pageY, 0.45);
        sx.value = withSpring(1.07, spring.touch);
        sy.value = withSpring(0.9, spring.touch);
      }}
      onPressOut={() => {
        sx.value = withSpring(1, spring.jelly);
        sy.value = withSpring(1, spring.jelly);
      }}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <Glass style={inner} contentStyle={center} radius={radius} pearl={pearl} warm={warm} lift={lift} melt={melt} sx={sx} sy={sy} presence={presence} frame={frame}>
        {children}
      </Glass>
    </Pressable>
  );
}
