// Buying Shuchu Sync in the app, through Google Play or the App Store, by way
// of RevenueCat. The customer is the link's anonymous space id (never a
// person), so a subscription bought here, in the other store or on the web
// unlocks the same link everywhere. The site's server asks RevenueCat who has
// paid; this file only shows the prices and makes the purchase.
//
// Keys: RevenueCat → Project → API keys → the public app keys, in app.json
// under expo.extra.revenuecat.{android,ios}. Without them (or on the web
// preview) Sync is simply bought on the computer.

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';

type SDK = typeof import('react-native-purchases').default;

const keys = (Constants.expoConfig?.extra?.revenuecat ?? {}) as { android?: string; ios?: string };
let sdk: Promise<SDK | null> | null = null;
function load(): Promise<SDK | null> {
  const key = Platform.OS === 'ios' ? keys.ios : Platform.OS === 'android' ? keys.android : undefined;
  if (!key) return Promise.resolve(null);
  return (sdk ??= import('react-native-purchases')
    .then((m) => { m.default.configure({ apiKey: key }); return m.default; })
    .catch(() => null));
}

export interface Offer { id: string; price: string; per: 'year' | 'month'; pkg: PurchasesPackage }

/** The two plans with this store's own prices, yearly first; empty if buying here isn't set up. */
export async function offers(customer: string): Promise<Offer[]> {
  const P = await load();
  if (!P) return [];
  try {
    await P.logIn(customer);
    const current = (await P.getOfferings()).current;
    return (current?.availablePackages ?? [])
      .filter((p) => p.packageType === 'ANNUAL' || p.packageType === 'MONTHLY')
      .map((p) => ({ id: p.identifier, price: p.product.priceString, per: p.packageType === 'ANNUAL' ? 'year' as const : 'month' as const, pkg: p }))
      .sort((a) => (a.per === 'year' ? -1 : 1));
  } catch {
    return [];
  }
}

/** Buy a plan. 'done' once the store confirms; the server then sees it through RevenueCat. */
export async function buy(customer: string, offer: Offer): Promise<'done' | 'cancelled' | 'failed'> {
  const P = await load();
  if (!P) return 'failed';
  try {
    await P.logIn(customer);
    await P.purchasePackage(offer.pkg);
    return 'done';
  } catch (e) {
    return (e as { userCancelled?: boolean }).userCancelled ? 'cancelled' : 'failed';
  }
}

/** Bring back a subscription bought earlier with this store account (after relinking, say). */
export async function restoreBought(customer: string): Promise<boolean> {
  const P = await load();
  if (!P) return false;
  try {
    await P.logIn(customer);
    const info = await P.restorePurchases();
    return Object.keys(info.entitlements.active).length > 0;
  } catch {
    return false;
  }
}
