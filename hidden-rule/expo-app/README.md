# Hidden Rule Expo Preview

Native preview shell for physical testing in `Expo Go`.

## Run

```bash
npm install
npm run start -- --lan --port 8082
```

Open `Expo Go` on a device connected to the same Wi-Fi and scan `expo-qr.png`.

Manual URL fallback:

```text
exp://10.100.102.198:8082
```

## Notes

- This app is a native mobile preview, separate from the Vite web prototype.
- The current flow includes two playable prototype chapters and rule selection without text input.
