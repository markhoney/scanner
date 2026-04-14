# Membership Scanner (Vue, No Build)

A static Vue web app that scans QR codes and common 1D barcodes using the mobile camera.

It now includes:

- Optional auto-submit of scans to an API endpoint
- PWA install/offline support
- Duplicate cooldown and haptic/audio feedback on successful scans

## Stack

- Vue 3 via CDN (no bundler)
- html5-qrcode via CDN
- Plain HTML/CSS/JS

## Run Locally

From this folder, start a static server:

```bash
npx serve .
```

Then open the shown URL in your browser.

## Use On Mobile

Camera access generally requires one of these:

- `https://` origin, or
- `http://localhost` (local device only)

For testing from your phone on the same network, use a secure tunnel (for example, Cloudflare Tunnel, ngrok, or localtunnel) that provides an `https://` URL.

## API Auto-Submit

In the app:

- Enter your endpoint in `API Endpoint`
- Enable `Auto-submit every successful scan`

Each scan sends a `POST` request with JSON:

```json
{
	"code": "decoded value",
	"format": "decoded format",
	"scannedAt": "2026-04-14T12:34:56.000Z"
}
```

The Recent Reads list shows `Submitting`, `Submitted`, or `Submit failed`.

## PWA Install + Offline

- The app includes `manifest.webmanifest` and `service-worker.js`
- When install is available, an `Install App` button appears
- Core files are cached for offline app shell access

## Cooldown + Feedback

- Duplicate scans of the same value/format are blocked during the configured cooldown window
- Default cooldown is `2500 ms` (adjustable in UI)
- On successful scan, the app triggers vibration (if available) and a short beep

## Files

- `index.html`: App shell + CDN scripts
- `app.js`: Vue logic, scan handling, auto-submit, install flow
- `styles.css`: Mobile-first styling
- `manifest.webmanifest`: PWA metadata
- `service-worker.js`: offline caching strategy

## Supported Scans

- QR Code
- Code 128
- Code 39
- EAN-13 / EAN-8
- UPC-A / UPC-E
- ITF
- Codabar
