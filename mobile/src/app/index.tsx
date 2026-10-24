// The whole app on one stage. Screens don't slide in from the side: the glass
// melts away and new glass condenses, while the mist stays put behind it all.

import { useEffect, useState } from 'react';
import { BackHandler, Keyboard } from 'react-native';
import { useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { updateSettings, useSettings } from '../data/settings';
import { haze } from '../scene/world';
import { Capture } from '../screens/Capture';
import { Detail } from '../screens/Detail';
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

  const covered = !onboarded || sheet !== null;

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
    </>
  );
}
