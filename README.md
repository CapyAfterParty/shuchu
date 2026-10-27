# Shuchu

Catch tasks on your phone; find them waiting at your desk.

**The phone app lives in [`mobile/`](mobile/README.md).** Start there to run it on your phone (Android or iPhone).
**The desk app lives in [`desk/`](desk/):** open it on your computer at `http://localhost:4545/desk`.

- `shared/task.ts`: the one task model, used by phone, desk and server.
- `server/`: one server holds the truth (`data/tasks.json`) and pushes every change over Server-Sent Events.
- `desk/`: the desk app (served at `/desk`): your inbox live from the phone, the time
  question, a calm shortlist, focus with a timer, and a receipt. Same glass and Shu as the phone.
- `clients/`: the original browser phone client (`sync.ts`, `phone/`), kept for phones without the app.

## Run

```sh
npm run setup   # once: installs and builds the desk app
npm start
```

It prints the desk URL and a phone URL on your local network. Open the desk URL
on your computer; in the phone app, the desk is found automatically (or set its
address in Settings → Desk).

## The desk

- Everything you catch on the phone appears within a second, with Shu noticing.
  Catch thoughts at the desk too: press `N`, type, Enter.
- Press `S` (Start): *How long do you have?* `1`–`4` for 15 min, 30 min, 1 h, 2 h.
- A calm plan of at most three things that fit, oldest worries first
  (`desk/src/plan.ts`, tested with `npm --prefix desk test`).
- Focus: one at a time with a quiet timer. `D` done (the real minutes go back to
  the phone and sharpen its estimates), `N` not now (leave a one-line note),
  `L` let go.
- A receipt of what you cleared, and how long it really took.
- `?` shows every key. Porcelain is in the top bar.

To develop it with live reload: `npm start` in one terminal, `npm --prefix desk run dev`
in another, then open `http://localhost:5175/desk/`.

## Step 1: sync

1. Open `http://localhost:4545/desk` on the computer.
2. Open the printed `http://<your-ip>:4545/phone` on the phone (same Wi-Fi).
3. Type a thought and press send. It appears on the desk, and the phone shows
   `on your desk · N ms`.

## Step 2: phone capture, including offline

Every task is saved on the phone before the buzz, then sent. It stays on the
phone until the server confirms it, and the server ignores repeats.

- **Offline save:** turn on airplane mode, save a few thoughts. The phone says
  they're kept until you're online. Turn airplane mode off: they arrive on the desk.
- **Install it:** in the phone's browser menu, "Add to Home Screen".
- **Open it with no connection:** phones only allow this over https. Make a
  certificate with [mkcert](https://github.com/FiloSottile/mkcert)
  (`mkcert -install && mkcert <your-ip>`), install mkcert's root certificate on the
  phone, then start with:

  ```sh
  SHUCHU_CERT=<your-ip>.pem SHUCHU_KEY=<your-ip>-key.pem npm start
  ```

  Over plain http, offline saving still works while the app is open.

## The glass

`clients/glass.ts` gives every `.glass` element a highlight that follows your
finger or cursor and a squish on press. In Chromium browsers (Chrome, Edge,
Android) it also refracts: each surface gets a displacement map shaped like its
rim, so the backdrop bends at the edges with a faint rainbow fringe. Safari and
Firefox get the same glass without the bending.
