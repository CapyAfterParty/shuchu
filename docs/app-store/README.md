# Shuchu on iPhone: build and App Store

The app is ready for iPhone: same code, same features. What only you can do is
the Apple side, because builds must be signed by an Apple Developer account in
your name. You don't need a Mac: Expo's cloud builds and uploads it.

## 1. One-time accounts

1. **Apple Developer Program**: developer.apple.com/programs → Enroll ($99 a
   year, needs an Apple ID with two-factor authentication; you must be 18 or
   enrolled by a parent/guardian or as a business).
2. **App Store Connect** (comes with it): My Apps → **+** → New App:
   - Platform iOS, name **Shuchu: Catch a Thought**, language English,
   - Bundle ID **app.shuchu** (EAS registers it on the first build if it isn't
     listed yet), SKU `shuchu`.

## 2. Build and send it to TestFlight

In `mobile/`:

```sh
npm install -g eas-cli      # once
eas login                   # your Expo account
eas build --platform ios --profile production
```

EAS asks to sign in to Apple once and creates the certificates for you (say
yes to each). About 20 minutes later:

```sh
eas submit --platform ios --latest
```

The build appears in App Store Connect → TestFlight after Apple processes it
(10–30 minutes). Add yourself as a tester, install **TestFlight** on your
iPhone, and Shuchu is on your phone.

## 3. Subscriptions (App Store Connect → Monetization → Subscriptions)

- Subscription group **Shuchu Sync**, two subscriptions:
  - `shuchu_sync_monthly`: $1.99, 1 month
  - `shuchu_sync_yearly`: $14.99, 1 year
- Display name "Shuchu Sync", description "Phone and computer in step, encrypted."
- No introductory free trial (Shuchu gives 14 days itself from linking).
- Connect App Store Connect to RevenueCat (RevenueCat → Project → App Store:
  the in-app purchase key), add both products to the `sync` entitlement and
  the default offering, and put the **Apple public API key** in
  `mobile/app.json` → `expo.extra.revenuecat.ios`. Rebuild.

## 4. The listing (App Store Connect → the app → App Store tab)

| Field | What to paste |
| --- | --- |
| Name | Shuchu: Catch a Thought |
| Subtitle (30) | Catch a thought. Plan calmly. |
| Promotional text | Your head isn't a to-do list. Catch it in three seconds; it waits, timed, for a calm plan later. |
| Description | The **Full description** from [`../play-store/listing.md`](../play-store/listing.md), then this line at the end: `Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/` |
| Keywords (100) | `to do,todo,inbox,thoughts,capture,planner,focus,calm,adhd,tasks,brain dump,timer,notes,sync` |
| Support URL | https://[YOUR SITE] |
| Privacy Policy URL | https://[YOUR SITE]/privacy |
| Category | Productivity (secondary: Lifestyle) |
| Age rating | 4+ (answer None to every content question) |
| Screenshots, 6.9" display | [`images/iphone-1-catch.png`](images/) … `iphone-5-hello.png` (1320 × 2868) |
| Copyright | 2026 [YOUR NAME] |

## 5. App Privacy (App Store Connect → App Privacy)

**Do you or your third-party partners collect data from this app?** Yes.

| Data type | Used for | Linked to the user? | Tracking? |
| --- | --- | --- | --- |
| Purchases → **Purchase History** | App Functionality | No | No |

That's the only one: RevenueCat records whether a link is subscribed, under an
anonymous link id. Synced thoughts are end-to-end encrypted (Apple counts data
"collected" only if you or partners can access it in a readable form), and
nothing else leaves the phone.

## 6. Export compliance (asked on each build)

Sync encrypts thoughts with a standard, published algorithm
(XChaCha20-Poly1305, via the @noble/ciphers library) on top of Apple's own
HTTPS, so `ITSAppUsesNonExemptEncryption` is set to **true** in `app.json`.
App Store Connect then asks a few questions; the honest answers are:

- Does your app use encryption? **Yes**
- Does it qualify for an exemption (authentication only, HTTPS only, etc.)? **No**
- Does it implement standard encryption algorithms (not proprietary)? **Yes**
- Will it be available in France? (your choice; Apple shows what's needed)

This is the common "mass market, standard encryption" case. Apple may ask you
to upload a US export classification document; if it does, its help page
explains it, and many developers file the one-page annual self-classification
report with the US Bureau of Industry and Security. Check Apple's current
guidance when you get there.

## 7. Review notes (App Review Information)

```
Shuchu works without any account. To try Sync (optional): open https://[YOUR SITE]/app
on a computer, click "Link your phone", and in the app go to Settings → Computer → Scan.
Sync is free for 14 days from linking, then a subscription (Settings → Computer → Keep Sync;
"Restore a purchase" is right below it).
```

Then **Add for Review** → Submit. First reviews usually take a day or two.
