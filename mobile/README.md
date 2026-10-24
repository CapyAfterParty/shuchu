# Shuchu: the phone app

Catch a thought in under three seconds. It waits at your desk.

## See it on your iPhone

You need [Node.js](https://nodejs.org) 22+ on your computer and **Expo Go** (App Store) on the phone. Both on the same Wi-Fi.

```sh
# 1. the desk server (from the repo root)
npm install
npm start

# 2. the app (second terminal)
cd mobile
npm install
npx expo start
```

Scan the QR code with the iPhone camera. It opens in Expo Go. The app finds the desk server on the same computer by itself; you can also enter an address in Settings → Your desk.

Without a server the app still works: every thought is kept on the phone and sent once a desk is linked.

Web preview (same code, in a browser): `npm run export:web`, then serve `dist/`.

## What's where

```
src/
  app/          routes: _layout (fonts, scene, theme) and index (the stage)
  scene/        the glass engine
    shader.ts     one SkSL shader: atmosphere, glass, shadows, sparks, ripples
    Scene.tsx     the canvas behind everything; tilt light, adaptive quality
    world.ts      shared UI-thread state: 24 glass slots, sparks, ripples
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
