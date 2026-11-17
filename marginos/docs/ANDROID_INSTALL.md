# Installing MarginOS on an Android phone

MarginOS is a Progressive Web App. Chrome on Android can install it like a native app (home-screen icon, full-screen, no browser bar).

> **Honest status:** installability was verified automatically. Chrome's own `Page.getInstallabilityErrors` check returns **no errors** against the production build, and the manifest, icons, service worker and offline page are tested. The app has **not** been installed on your physical phone from this session; no device was connected.

## Requirements

- The app must be served over **HTTPS** at a public URL (see DEPLOYMENT.md). Chrome won't offer install for plain `http://` on a phone, except `localhost`.
- Chrome for Android (recent version).

## Steps

1. Open Chrome on your phone and go to your MarginOS URL (e.g. `https://app.yourdomain.com`).
2. Sign in once.
3. Chrome shows an **"Install app"** banner, or tap the **⋮ menu → Install app** (on some versions: **Add to Home screen → Install**).
4. Confirm **Install**. The MarginOS icon (black tile with the teal margin bar) appears on your home screen and in the app drawer.
5. Launch it from the icon. It opens full-screen at the dashboard. Long-press the icon for shortcuts: *Log time*, *Record expense*, *Clients*.

## What works offline

Nothing financial is cached on the device, by design: figures must always be live, and no tenant data is stored on the phone. Without a connection the app shows a clear "You're offline" screen and recovers when you reconnect.

## Testing on a phone before deploying (optional)

With USB debugging enabled and the phone connected to a computer running MarginOS:

```bash
adb reverse tcp:3000 tcp:3000   # phone's localhost:3000 → computer's port 3000
```
Then open `http://localhost:3000` in Chrome on the phone. `localhost` counts as a secure origin, so the install option works. Verify with `chrome://inspect` on the computer → *Application → Manifest*.

## Uninstall

Long-press the icon → **Uninstall** (or App info → Uninstall).
