// The top of every sheet: one large title and a close button, on the same grid.

import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/theme';
import { space } from '../theme/tokens';
import { GlassButton } from './GlassButton';
import { Icon } from './Icon';
import { Reveal } from './motion';
import { Txt } from './Txt';

export function SheetHeader({ title, onClose, closeLabel = 'Close' }: { title?: string; onClose: () => void; closeLabel?: string }) {
  const p = useTheme();
  return (
    <View style={styles.head}>
      <Reveal delay={60} style={styles.title}>
        {title ? <Txt variant="display" numberOfLines={1}>{title}</Txt> : null}
      </Reveal>
      <GlassButton onPress={onClose} style={styles.close} radius={22} label={closeLabel}>
        <Icon name="close" color={p.inkSoft} size={18} />
      </GlassButton>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingTop: space.xs,
    paddingBottom: space.s,
    minHeight: 52,
  },
  title: { flex: 1, paddingRight: space.l },
  close: { width: 40, height: 40 },
});
