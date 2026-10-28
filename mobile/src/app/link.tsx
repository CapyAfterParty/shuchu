// shuchu://link?k=…&o=… — opened from the page a phone camera lands on after
// scanning the code on the computer. Join the link, then carry on to the app,
// where Shu says it's done.

import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { joinLink } from '../data/tasks';

export default function LinkRoute() {
  const { k, o } = useLocalSearchParams<{ k?: string; o?: string }>();
  const [done, setDone] = useState(false);
  useEffect(() => {
    void joinLink(`shuchu://link?k=${k ?? ''}&o=${encodeURIComponent(o ?? '')}`).finally(() => setDone(true));
  }, [k, o]);
  return done ? <Redirect href="/" /> : null;
}
