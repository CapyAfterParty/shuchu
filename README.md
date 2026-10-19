# Shuchu

Catch tasks on your phone; find them waiting at your desk. 

## Step 1: sync and task model

- `shared/task.ts` – the one task model, used by phone, desk and server.
- `server/` – one server holds the truth (`data/tasks.json`), pushes every change over Server-Sent Events.
- `clients/` – logic (`sync.ts`, `phone/phone.ts`, `desktop/desk.ts`) kept apart from presentation (`*/look.ts`, `desktop/view.ts`, `public/*.html`, `public/mist.css`).

### Run

```sh
npm install
npm start
```

It prints the desk URL and a phone URL on your local network.

### Test: save on the phone, see it on the desk in under 1 second

1. Open `http://localhost:4545/desk` on the computer.
2. Open the printed `http://<your-ip>:4545/phone` on the phone (same Wi-Fi).
3. Type a thought and press send. It appears on the desk. The phone whispers
   `on your desk · N ms` – the time for the task to go through the server and
   come back the same way the desk receives it.
4. Stop and restart the server: tasks are still there.
