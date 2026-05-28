# Deploy multiplayer server on Render

## Fix existing Web Service (`salinda-mobile`)

Open [service settings](https://dashboard.render.com/web/srv-d6umul1r0fns73bq0v60/settings) and set:

| Field | Value |
|--------|--------|
| **Root Directory** | `card/server` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` (runs `node dist/server/src/index.js` — not `dist/index.js`) |

Save, then **Manual Deploy → Clear build cache & deploy**.

This repo uses `card/server` (monorepo-style layout on `salinda-mobile`).

Verify: `GET https://lolos-mobile.onrender.com/` → JSON `{"status":"ok",...}`.

## Or: new service from Blueprint

`render.yaml` lives at the **repository root** (not inside `card/`). In Render: **Blueprints** → connect the repo.

Blueprint creates:

| Service | Purpose | URL |
|--------|---------|----------------|
| `lolos-mobile` | Node + Socket.IO API | `https://lolos-mobile.onrender.com` |

The web client is served from Vercel (project `salinda-mobile`, canonical URL `https://lolos-mobile.vercel.app`) — there is no longer a static-site Render service.

Use `https://lolos-mobile.vercel.app` for `EXPO_PUBLIC_WEB_APP_URL` so native invite links open the working web build.

Smoke-test after deploy:

- `GET https://lolos-mobile.onrender.com/` → 200 (Express root).
- `GET https://lolos-mobile.onrender.com/socket.io/?EIO=4&transport=polling` → handshake JSON with `sid`.
- Open `https://lolos-mobile.vercel.app/?room=1234&server=https://lolos-mobile.onrender.com` → lobby should pre-fill join.

Rebuild native production after URL changes: `eas build --platform all --profile production`.

## Client

Production builds read `EXPO_PUBLIC_SERVER_URL` from `eas.json`. Rebuild after changing the URL: `eas build --platform all --profile production`.

## Guest player in browser (no app install)

Host flow is now supported directly from the lobby:

1. Host creates room in the app.
2. In room lobby, host gets a "קישור אורח לדפדפן" and taps "שתף קישור".
3. Guest opens the link in browser, enters name, and joins.

Invite link format:

`https://<web-app-domain>?room=<ROOM_CODE>&server=<SOCKET_SERVER_URL>`

Required env values in app/web build environment:

- `EXPO_PUBLIC_SERVER_URL` = your Render socket server URL (example: `https://lolos-mobile.onrender.com`)
- `EXPO_PUBLIC_WEB_APP_URL` = your real published web client URL (currently `https://salinda-mobile.vercel.app`; it must return the game UI, not 404).
