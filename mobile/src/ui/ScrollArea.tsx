// A scroll view that glass can ride on.
//
// Glass finds itself on screen with measure(), which reads React's layout
// tree. A scroll view's offset reaches that tree a few frames after the
// content has actually moved, so glass inside one used to trail behind its
// own text while scrolling. Inside a ScrollArea, glass instead takes its
// place within the content (measured against the content itself, so any
// staleness cancels out) and adds the live scroll offset from the UI thread.

import { createContext, useContext, type ReactNode } from 'react';
import { type ScrollViewProps, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, {
  type AnimatedRef,
  measure,
  type SharedValue,
  useAnimatedRef,
  useScrollOffset,
} from 'react-native-reanimated';

export interface ScrollTrack {
  outer: AnimatedRef<Animated.ScrollView>;
  content: AnimatedRef<View>;
  offset: SharedValue<number>;
}

const ScrollContext = createContext<ScrollTrack | null>(null);
export const useScrollTrack = () => useContext(ScrollContext);

export function ScrollArea({
  children, contentContainerStyle, ...rest
}: Omit<ScrollViewProps, 'contentContainerStyle'> & { children: ReactNode; contentContainerStyle?: StyleProp<ViewStyle> }) {
  const outer = useAnimatedRef<Animated.ScrollView>();
  const content = useAnimatedRef<View>();
  const offset = useScrollOffset(outer);
  return (
    <ScrollContext.Provider value={{ outer, content, offset }}>
      <Animated.ScrollView ref={outer} scrollEventThrottle={16} contentContainerStyle={{ flexGrow: 1 }} {...rest}>
        <View ref={content} collapsable={false} style={[{ flexGrow: 1 }, contentContainerStyle]}>
          {children}
        </View>
      </Animated.ScrollView>
    </ScrollContext.Provider>
  );
}

export interface Placed {
  x: number; y: number; w: number; h: number;
  /** 1 inside the scroll window, falling to 0 as it slides out past an edge. */
  inView: number;
}

/**
 * Where a view is on screen right now. Pass the surrounding ScrollTrack (or
 * null) from the component that owns the ref.
 */
export function placeOnScreen(ref: AnimatedRef<View>, track: ScrollTrack | null): Placed | null {
  'worklet';
  const m = measure(ref);
  if (!m) return null;
  if (!track) return { x: m.pageX, y: m.pageY, w: m.width, h: m.height, inView: 1 };
  const c = measure(track.content);
  const o = measure(track.outer);
  if (!c || !o) return { x: m.pageX, y: m.pageY, w: m.width, h: m.height, inView: 1 };
  const x = o.pageX + (m.pageX - c.pageX);
  const y = o.pageY - track.offset.value + (m.pageY - c.pageY);
  // glass slides out of the window like the text does, dissolving at the edge
  const reach = Math.max(12, m.height * 0.6);
  const above = o.pageY - y;
  const below = y + m.height - (o.pageY + o.height);
  const inView = Math.max(0, Math.min(1, 1 - Math.max(above, below, 0) / reach));
  return { x, y, w: m.width, h: m.height, inView };
}
