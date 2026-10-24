# Shuchu

Catch tasks on your phone; find them waiting at your desk.

- `shared/task.ts`: the one task model, used by phone, desk and server.
- `server/`: one server holds the truth (`data/tasks.json`) and pushes every change over Server-Sent Events.
- `clients/`: logic (`sync.ts`, `phone/phone.ts`, `phone/outbox.ts`, `desktop/desk.ts`) kept apart from
  presentation (`glass.ts`, `phone/look.ts`, `desktop/view.ts`, `public/*.html`, `public/mist.css`).

## Run

```sh
npm install
npm start
```

It prints the desk URL and a phone URL on your local network.

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
