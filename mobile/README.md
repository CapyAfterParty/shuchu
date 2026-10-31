# Shuchu: the phone app

Catch a thought in under three seconds. It waits at your desk.

## Try it on your phone today (Expo Go, 5 minutes)

You need [Node.js](https://nodejs.org) 22+ on your computer and **Expo Go** on the phone
([Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent) or the App Store). Both on the same Wi-Fi.

```sh
cd mobile
npm install
npx expo start
```

Android: open Expo Go and tap "Scan QR code". iPhone: scan it with the camera. If the phone can't reach your computer (some office or campus networks block it), run `npx expo start --tunnel` instead.

## Linking a computer

Open the web app on the computer (`/app` on the Shuchu site) and choose **Link your phone**: it shows a QR code.
On the phone, either point the camera at it (the page it opens has **Open in Shuchu**) or go to
Settings → Link a computer → Scan. From then on, what you catch on one appears on the other within seconds.

How it works (`src/data/tasks.ts`, `src/data/linkcore.ts`): every thought is saved on the phone first, then
encrypted on the phone and swapped with the site's `/api/sync`, which only ever sees sealed records; the latest
edit of each task wins. Offline, changes wait and go up when the connection returns. The code's secret
travels after the `#` of its address, so it never reaches a server. `linkcore.ts` is the same file as the
web app's `src/app/linkcore.ts` in shuchu-web; keep them identical.

Linking needs the camera, a native module added after the last build, so it needs a fresh build (below).

**Shuchu Sync** (free for 14 days from linking, then a subscription) can be bought in Settings → Computer →
Keep Sync, through Google Play or the App Store via RevenueCat (`src/data/purchases.ts`). The customer is the
link's anonymous space id, so a purchase here, in the other store, or on the web unlocks the same link. Put the
RevenueCat public app keys in `app.json` → `expo.extra.revenuecat`; until then the row stays hidden and Sync is
bought from the web app. Store setup is in shuchu-web's README → Hosting and selling Sync.

Expo Go is the real app running natively (real GPU glass, haptics, tilt), not the web preview.
It only runs while `npx expo start` is running on your computer; for an app that stays on the phone, see below.

## A real install on your phone (EAS Build)

This makes the actual app, with its own icon, that stays on your phone without your computer running.
Builds run in Expo's cloud, so you don't need Android Studio or a Mac. Free account at [expo.dev](https://expo.dev).

```sh
cd mobile
npm install -g eas-cli
eas login
eas init                                # links the project to your Expo account (one time)

eas build --platform android --profile preview
```

When it finishes (about 10–15 minutes) you get a link and a QR code. Open it on your Android phone,
download the `.apk` and install it (Android will ask you to allow installs from your browser once).

iPhone: `eas build --platform ios --profile preview` installs straight to registered iPhones. It needs a paid
Apple Developer account ($99/year); EAS walks you through registering your phone (`eas device:create`).
Or go through TestFlight, below.

## Putting it in the stores

Before the first store build, pick the app's permanent ID. It's set to `app.shuchu` in `app.json`
(`ios.bundleIdentifier` and `android.package`); change both to something you own, such as
`com.yourname.shuchu`. It can't be changed after the first upload.

```sh
eas build --platform all --profile production   # .aab for Google Play, .ipa for the App Store
eas submit --platform android                   # uploads to Play's internal testing track
eas submit --platform ios                       # uploads to App Store Connect / TestFlight
```

- **Google Play** — a [Play Console](https://play.google.com/console) account ($25 once). Create the app
  in the console first, and upload the very first `.aab` by hand (Play requires that); after that `eas submit`
  works. Send it to internal testing, then production.
- **App Store** — an [Apple Developer](https://developer.apple.com/programs/) account ($99/year).
  `eas submit` creates the App Store Connect entry and uploads; the build appears in TestFlight for you to try,
  then you submit it for review from App Store Connect.
- Version numbers: set `version` in `app.json` for each release; build numbers count up by themselves.

Both stores will ask for screenshots, a short description, a privacy policy URL and a privacy questionnaire.
For the questionnaire: Shuchu collects nothing readable. Thoughts stay on the phone and, once a computer is
linked, sync end-to-end encrypted (the server stores only sealed records it can't open); there are no accounts,
analytics or ads.

What's already set up for review: the only permissions are vibration, notifications (the evening question),
motion (the light follows tilt) and the camera (only to scan the link code). No microphone, no background
audio, no location. The encryption export question is answered (standard encryption only).

## What's where

```
src/
  app/          routes: _layout (fonts, scene, theme) and index (the stage)
  scene/        the glass engine
    shader.ts     one SkSL shader: atmosphere, glass, shadows, sparks, ripples
    Scene.tsx     the canvas behind everything; tilt light, adaptive quality
    world.ts      shared UI-thread state: 32 glass slots, sparks, ripples
    Glass.tsx     makes any view glass: claims a slot, tracks itself every frame
    useShape.ts   free glass shapes for morphing heroes and pebbles
  screens/      Onboarding, Capture, Basin, Inbox, Detail, Settings
  ui/           Txt, Icon, GlassButton, Sheet, Dial, Liquid (switch, choice), motion
  data/         tasks (offline outbox + live sync), guess, settings, store
  feel/         haptic signatures and sounds, the evening question
  theme/        tokens (mist and night), theme crossfade
```

## How the glass works

Nothing in the app draws its own glass. The whole world is one GPU shader
behind every screen. Screens wrap views in `<Glass>`, which claims a slot and
writes its shape each frame. The shader then:

- draws the atmosphere analytically: drifting light sources and far, out-of-focus
  stones. Blurring it costs nothing, since a blurred gaussian is just a wider one;
- melts nearby shapes together with a smooth union, so a bead pinches off a stone
  like a drop and controls flow into their tracks;
- looks through each surface with a lens: bent at the rim, split into red,
  green and blue, frosted and milked;
- lights it from a light that follows how you tilt the phone: a specular glint,
  a lit rim, a caustic on the far inner edge, a darker thick edge, and a shadow
  cast away from the light;
- stacks two layers, so beads on a sheet refract the sheet beneath them;
- adds sparks, ripples where things land, film grain and dithering.

If a phone can't keep up, the scene notices its own frame times and drops to a
lighter path (one sample instead of three, no second-layer refraction), then
restores it when there is headroom. Calm motion and the system's Reduce Motion
slow the drift and turn off the tilt light.

## Checks

```sh
npm run typecheck
npx expo export --platform ios   # proves the native bundle compiles
```
