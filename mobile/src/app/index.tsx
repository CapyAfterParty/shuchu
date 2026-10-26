// The whole app on one stage. Screens don't slide in from the side: the glass
// melts away and new glass condenses, while the mist stays put behind it all.

import { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Keyboard } from 'react-native';
import { useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { updateSettings, useSettings } from '../data/settings';
import { isOpen, useTasks } from '../data/tasks';
import { haze } from '../scene/world';
import { Capture } from '../screens/Capture';
import { Detail } from '../screens/Detail';
import { Hello } from '../screens/Hello';
import { Inbox } from '../screens/Inbox';
import { Onboarding } from '../screens/Onboarding';
import { Settings } from '../screens/Settings';
import { spring } from '../theme/tokens';
import { Sheet } from '../ui/Sheet';

type SheetName = 'inbox' | 'settings' | null;

export default function Home() {
  const onboarded = useSettings((s) => s.onboarded);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const capture = useSharedValue(0);
  const waiting = useTasks((s) => s.tasks.filter(isOpen).length);

  // Hello greets you on every launch, and again after a while away.
  const [hello, setHello] = useState(onboarded);
  const [helloCovering, setHelloCovering] = useState(onboarded);
  // the first hello continues from the launch screen's drop; later ones condense from dew
  const [cold, setCold] = useState(true);
  const away = useRef<number | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') away.current = Date.now();
      if (state === 'active' && away.current && Date.now() - away.current > 5 * 60_000 && onboarded) {
        setSheet(null);
        setDetail(null);
        setCold(false);
        setHello(true);
        setHelloCovering(true);
      }
      if (state === 'active') away.current = null;
    });
    return () => sub.remove();
  }, [onboarded]);

  const covered = !onboarded || sheet !== null || helloCovering;

  useEffect(() => {
    capture.value = covered ? withTiming(0, { duration: 380 }) : withSpring(1, spring.sheet);
    haze.value = withTiming(sheet ? 1 : 0, { duration: 700 });
    if (sheet) Keyboard.dismiss();
  }, [covered, sheet]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (detail) { setDetail(null); return true; }
      if (sheet) { setSheet(null); return true; }
      return false;
    });
    return () => sub.remove();
  }, [detail, sheet]);

  return (
    <>
      {onboarded && (
        <Capture
          presence={capture}
          active={!covered}
          onOpenInbox={() => setSheet('inbox')}
          onOpenSettings={() => setSheet('settings')}
        />
      )}

      <Sheet open={sheet === 'inbox'} onClose={() => { setDetail(null); setSheet(null); }} recede={detail !== null}>
        <Inbox onClose={() => setSheet(null)} onOpen={(id) => setDetail(id)} />
      </Sheet>

      <Sheet open={detail !== null} onClose={() => setDetail(null)}>
        {detail && <Detail id={detail} onClose={() => setDetail(null)} />}
      </Sheet>

      <Sheet open={sheet === 'settings'} onClose={() => setSheet(null)}>
        <Settings
          onClose={() => setSheet(null)}
          onReplay={() => { setSheet(null); updateSettings({ onboarded: false }); }}
        />
      </Sheet>

      {!onboarded && <Onboarding onDone={() => {}} />}

      {onboarded && hello && (
        <Hello waiting={waiting} fromSplash={cold} onLeave={() => setHelloCovering(false)} onGone={() => { setHello(false); setCold(false); }} />
      )}
    </>
  );
}
