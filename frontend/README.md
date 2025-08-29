# Anslation VPN Extension (React + MV3)

A clean Chrome Extension that lets you select a public HTTPS proxy, connect/disconnect, and view real vs masked IP. Includes a React web preview for fast UI testing.

## What’s inside
- frontend/
  - Web preview at `/` (and `/extension`) using mock data
  - Extension popup (React), background service worker (proxy apply/clear)
  - MV3 manifest and build pipeline via CRACO

> Note: No backend is required. The provided FastAPI template is unused and omitted from docs.

---

## Run preview (mocks)
```bash
cd frontend
yarn install
yarn start
```
Open http://localhost:3000/ — choose a server → Connect. This preview fakes proxy/IP for UI validation.

## Build the extension
```bash
cd frontend
yarn build
```
Then load in Chrome:
- chrome://extensions → Developer mode → Load unpacked → select `frontend/build`

## How it works
- UI: `src/extension/Popup.jsx` (shadcn + Tailwind)
- Mocks (preview): `src/extension/mock.js`
- Live APIs (extension): `src/extension/api.js` (proxy-list + ipify)
- Background: `src/extension/background.js` (PAC-based `chrome.proxy.settings`)
- Manifest: `public/manifest.json`

## Notes
- Free proxies are unstable; try another if a connection fails.
- PAC excludes `localhost` and `127.0.0.1` from proxying.

## Scripts
- `yarn start` – web preview (mocks)
- `yarn build` – builds extension & popup HTML