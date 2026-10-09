# Snake Chase — installable Android PWA

A shareable, offline-capable snake timing game. No npm install or backend needed to play.

## Game rules

- The **same snake** continuously moves toward the red food.
- **Tap anywhere on the game board** (or press Space) before the snake touches it.
- A successful tap or an early tap with lives remaining places a **new food target on the same board**, and the existing snake turns toward it; the snake's current position and body trail are preserved.
- Outside the scoring radius: **0 points and one life lost**. Inside: up to **100 points**. The radius starts at **100 logical units**, stays fixed through speed level 3, and shrinks by 5 at the start of each subsequent level (30, 40, 50... foods), down to 75; it scales uniformly with the screen.
- Only positive-point taps count as **collected foods**. Each early tap loses one of 3 lives and still redirects the snake, except the third miss ends the game.
- After **10, 20, 30, ...** collected foods, base target speed rises by **12 logical units/s**, from **150** to a maximum base speed of **220**. Speed eases gradually toward each target. Starting at **speed level 3** (20 collected foods), unpredictable **1.5× speed bursts** occur after random intervals of **2–5 seconds of active gameplay**. Each burst lasts **600 ms** and turns the snake **orange-gold with a bright glow**. The burst speed is 1.5× the *current* speed and can temporarily exceed the base cap. Time spent paused does not count toward a burst.
- The game ends if the snake reaches the food or all three lives are lost.
- **Live tap value** (`+0` to `+100`) follows the snake head. The score popup animates from the head's position at tap time, with the same rising effect. Configure these independently using `headScore` in `game-config.json`.
- **Foods per speed level** is `foodsPerSpeedLevel` in `game-config.json` (default 10). Changing it also changes how soon speed levels, bursts, and shrinking radius milestones are reached.
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

On the game-over screen, tap **Share Score** to capture the current game board, snake, food, scores,
progress, active radius, and the small game-over badge as a **3× high-resolution PNG** (without action buttons). The native share text includes the achieved speed level.
On Android Chrome, the operating-system sharing sheet opens and you can pick
WhatsApp, Bluetooth, Nearby Share, or any other supported app. When the browser
does not support sharing image files, the PNG is downloaded instead.
The image is generated entirely on-device; no upload or third-party screenshot
service is used. If you cancel the Android share sheet, no file is downloaded.

## Full-screen game and adaptive challenge

The installed PWA requests **fullscreen** presentation. The game fills the
available browser / device viewport, and the canvas uses a responsive portrait
playfield without stretching the snake or scoring circle.
The radius changes automatically by difficulty level. There is no slider or player-facing radius setting.
At game-over the board stays visible behind a small icon + GAME OVER badge,
and the Pause button changes into **Play Again**. The Restart button changes to **Share Score**.

## File layout

```text
index.html                  Game interface
styles.css                  Responsive Android-friendly styling
manifest.webmanifest        PWA name, scope, icons and display mode
sw.js                       Offline cache service worker
game-config.json            Public difficulty settings (GitHub-editable)
src/config.js               Config validation and offline defaults
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

## Difficulty settings

Edit [`game-config.json`](./game-config.json) directly in GitHub to update everyone after GitHub Pages redeploys and the next page reload. Config is fetched network-first, with a service-worker cache and built-in defaults when offline. The settings are **locked for the duration of a game** (changes take effect after the next page reload). There is no backend and public config cannot securely enforce anti-cheat or protect secrets. Players with developer tools can locally override client-side gameplay; a future ranked leaderboard should validate scores on a server.

```json
{
  "initialSpeed": 150,
  "maximumSpeed": 220,
  "speedIncreasePerLevel": 12,
  "foodsPerSpeedLevel": 10,
  "lives": 3,
  "scoringRadius": 100,
  "speedBursts": { "enabled": true, "startAtSpeedLevel": 3, "minimumDelaySeconds": 2, "maximumDelaySeconds": 5, "multiplier": 1.5, "durationMs": 600 },
  "shrinkingRadius": { "enabled": true, "startAfterSpeedLevel": 3, "reductionPerSpeedLevel": 5, "minimumRadius": 75 }
}
```

The PWA uses network-first loading for all application assets and an offline cache fallback. Bump `CACHE_NAME` in `sw.js` when changing application assets so older offline caches are cleared. When changing JavaScript imports, also update the `?v=` asset version suffixes to avoid stale mixed-module versions during rollout.

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

The bottom-right food-distance label is hidden in both gameplay and shared PNGs; distance still drives scoring and collisions.

The live points label beside the snake's head is rendered as text only, without a background box; the existing tap-score animation is unchanged.

## Speed and score release notes

- Three rapid early taps now correctly consume all three lives; no tap debounce discards intentional misses.
- Scoring radius is 100 through speed levels 1–3; it starts decreasing in level 4 (30 foods).
- `shrinkingRadius.startAfterSpeedLevel` in `game-config.json` changes that milestone.
- Android native share message includes score and speed level; screenshot exports as a high-resolution PNG without controls.
- The service worker uses network-first app assets and offline cache fallback to prevent mismatched versions after deployment.

## Day 1 launch assets (social sharing)

- `assets/snake-chase-og-v1.jpg`: 1200×630 public link preview for WhatsApp, LinkedIn, and other Open Graph platforms. The HTML head includes an absolute image URL, dimensions, canonical URL, title, description and Twitter/X card metadata.
- `assets/snake-chase-launch-poster.jpg`: 1080×1350 promotional poster for social feeds. A full-quality PNG version is also saved in the marketing assets library.
- Play: https://sdfaheemuddin.github.io/Snake-Chase/
- To change the preview, use a new versioned image filename and update both `og:image` and `twitter:image` URLs in `index.html`.
- Social services may cache earlier link previews. Allow time or use a preview debugger/re-scrape option if available.

These launch assets add no analytics, trackers, login, or external scripts.

## Average points per food

The SCORE card now displays a compact **AVG/FOOD** value (total score divided by the number of successfully collected foods, rounded to one decimal place). Before collecting food it shows 0.0. Early zero-point taps do not increase the food count. The average is included in the game-over share PNG.

## Desktop game frame

On viewports at least 800px wide, Snake Chase is displayed in a centered portrait frame with a **9:16 aspect ratio**, capped at **520px wide × approximately 924px tall**. It scales down according to viewport height (for example, 432×768 in a 768px-tall browser), leaving the surrounding desktop background empty. HUD type scales with the portrait frame rather than the wide screen. Smaller mobile displays remain full-screen without aspect-ratio letterboxing. Modify `--desktop-max-width` in `styles.css` to change the desktop cap.
