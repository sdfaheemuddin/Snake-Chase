# Snake Chase — installable Android PWA

A shareable, offline-capable snake timing game. No npm install or backend needed to play.

## Game rules

- The **same snake** continuously moves toward the red food.
- **Tap anywhere on the game board** (or press Space) before the snake touches it.
- Your tap always places a **new food target on the same board**, and the existing snake turns toward it; the snake's current position and body trail are preserved.
- Outside the **fixed 100-unit** yellow scoring radius (visually scaled to the device width): **0 points**. Inside the circle: up to **100 points** as you get closer.
- Only positive-point taps count as **collected foods**; zero-point taps still move the food.
- After **10, 20, 30, ...** collected foods, target speed rises by **12 px/s**, from **100 px/s** to a maximum of **220 px/s**. Speed eases gradually toward each new target.
- The game ends if the snake reaches the food before you tap.
- Best score is stored in this browser on this device, not synced between devices.

## Publish on GitHub Pages (recommended)

1. Create a GitHub repository, e.g. `snake-chase`.
2. **Extract the ZIP**, then upload **the contents of this folder** to the repository root. Include the hidden `.github/workflows/deploy.yml` and `.nojekyll` files; do not upload the ZIP alone.
3. In your GitHub repository, open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. Commit/push to the `main` branch, or start the workflow from **Actions → Deploy Snake Chase to GitHub Pages → Run workflow**.
5. Once deployment succeeds, open `https://YOUR-USERNAME.github.io/snake-chase/` (substitute your real repository name). Share the game link anywhere.

If your repository uses a different default branch, change `main` in `.github/workflows/deploy.yml`.

The manifest, service worker, and asset URLs are **relative**. No base-path edits are needed for `username.github.io` or `username.github.io/repository-name` hosting.

## Install on Android

1. Open the published **HTTPS** game link in Chrome on Android.
2. Use the **Install app** button when Chrome offers the install prompt, or Chrome's **⋮ → Install app / Add to Home screen** menu.
3. Launch the game from the home screen like a standalone app. After the first online visit and service-worker installation, the game works offline.

Chrome may take a little time and user interaction before offering its in-page install prompt. Opening files with `file://` does **not** support service workers; deploy to HTTPS or use localhost.

## Test locally

From this directory, run:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/` in a browser. For automated gameplay tests:

```sh
node --test tests/*.test.mjs
```

The PWA requires a local HTTP server; opening `index.html` directly as a file will not load its ES modules reliably.

## Screen snapshot and native sharing

Use **Share image** to capture the current game board, snake, food, scores,
progress, and the small game-over badge (when the game is over) as a PNG.
On Android Chrome, the operating-system sharing sheet opens and you can pick
WhatsApp, Bluetooth, Nearby Share, or any other supported app. When the browser
does not support sharing image files, the PNG is downloaded instead.
The image is generated entirely on-device; no upload or third-party screenshot
service is used. If you cancel the Android share sheet, no file is downloaded.

## Full-screen game and fixed radius

The installed PWA requests **fullscreen** presentation. The game fills the
available browser / device viewport, and the canvas uses a responsive portrait
playfield without stretching the snake or the 100-unit scoring circle.
There is no scoring-radius slider or public radius-changing API.
At game-over the board stays visible behind a small icon + GAME OVER badge,
and the Pause button changes into **Play Again**.

## File layout

```text
index.html                  Game interface
styles.css                  Responsive Android-friendly styling
manifest.webmanifest        PWA name, scope, icons and display mode
sw.js                       Offline cache service worker
src/config.js               Game configuration
src/game-engine.js          Testable gameplay model and scoring logic
src/renderer.js             Responsive Canvas view
src/share.js                Offline PNG screenshot/share rendering
src/app.js                  View model, controls, storage, install, share, and public API
assets/                     Android, favicon, and Apple icons
.github/workflows/deploy.yml  Automatic GitHub Pages deployment
tests/                      Node.js logic tests
```

## JavaScript API

The game exposes a small integration API:

```js
window.SnakeChaseAPI.getState();      // JSON-friendly snapshot
window.SnakeChaseAPI.start();
window.SnakeChaseAPI.tap();
window.SnakeChaseAPI.pause();
window.SnakeChaseAPI.resume();
window.SnakeChaseAPI.restart();
window.SnakeChaseAPI.shareImage();
```

To adjust progression, edit `src/config.js`. If you publish an update to static files, **increment `CACHE_NAME` in `sw.js`** so already-installed apps fetch the revised assets.

No analytics, trackers, server, user login, or online leaderboard are included.

## Source icons in this repository

The tracked icon sources are `assets/favicon.svg` and `assets/icon-maskable.svg`.
The GitHub Pages workflow generates the Android PNG icons before publishing.
To generate PNGs for local use, run:

```sh
python -m pip install cairosvg
python tools/generate_icons.py
```

**Important:** For GitHub Pages to be publicly accessible on a free GitHub account,
make the repository **Public** in Settings → General → Danger Zone (if appropriate).
Pages access for a private repository depends on your GitHub plan and settings.
