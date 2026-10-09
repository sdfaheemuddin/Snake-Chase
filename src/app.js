import { loadGameConfig } from './config.js?v=6';
import { SnakeGame } from './game-engine.js?v=6';
import { GameRenderer } from './renderer.js?v=6';
import { buildScreenSnapshot, canvasToPngFile } from './share.js?v=6';

const $ = id => document.getElementById(id);
const GAME_CONFIG = await loadGameConfig();
const game = new SnakeGame({ config: GAME_CONFIG });
const renderer = new GameRenderer($('game-canvas'), GAME_CONFIG.boardSize, (width, height) => game.setBoardDimensions(width, height));
const overlay = $('game-overlay');
const popup = $('points-popup');
let best = readBest();
let lastTime = 0;
let animationId = null;
let deferredInstallPrompt = null;
let toastTimeout = null;
let lastAccessibleStatus = '';
let missFlashTimeout = null;

function readBest() {
  try { return Math.max(0, Number(localStorage.getItem(GAME_CONFIG.storageKey)) || 0); }
  catch (error) { console.warn('High score storage unavailable:', error); return 0; }
}

function persistBest() {
  if (game.score <= best) return;
  best = game.score;
  try { localStorage.setItem(GAME_CONFIG.storageKey, String(best)); }
  catch (error) { console.warn('Could not save high score:', error); }
}

function showOverlay(symbol, title, description, buttonLabel, gameOver = false) {
  overlay.classList.toggle('game-over', gameOver);
  $('overlay-symbol').textContent = symbol;
  $('overlay-title').textContent = title;
  $('overlay-message').textContent = description;
  $('start-button').textContent = buttonLabel;
  overlay.hidden = false;
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('visible'), 2600);
}

function syncUI() {
  $('score').textContent = game.score;
  $('best').textContent = best;
  $('foods').textContent = game.foods;
  const hearts = Array.from({ length: GAME_CONFIG.lives }, (_, i) => i < game.lives ? '♥' : '♡').join(' ');
  $('lives').textContent = hearts;
  $('lives').setAttribute('aria-label', `${game.lives} of ${GAME_CONFIG.lives} lives remaining`);
  $('lives-count').textContent = `${game.lives}/${GAME_CONFIG.lives}`;
  $('radius-value').textContent = String(game.scoringRadius);
  $('points-now').textContent = game.status === 'playing' || game.status === 'paused' ? game.availablePoints : 0;
  $('level').textContent = game.speedLevel;
  $('speed-value').textContent = `${Math.round(game.effectiveSpeed)} px/s${game.speedBurstActive ? ' ⚡' : ''}`;
  $('progress-fill').style.width = `${(game.levelProgress / GAME_CONFIG.foodsPerSpeedLevel) * 100}%`;
  $('progress-text').textContent = `${game.levelProgress} / ${GAME_CONFIG.foodsPerSpeedLevel} foods`;
  $('distance').textContent = `${Math.round(game.distanceToFood)} px away`;

  const status = game.status === 'playing'
    ? game.availablePoints >= 75 ? 'Perfect zone — TAP NOW!'
      : game.availablePoints > 0 ? 'Scoring zone — tap!' : 'Approaching food…'
    : game.status === 'paused' ? 'Game paused'
      : game.status === 'gameover' ? (game.gameOverReason === 'misses' ? 'No lives left — game over' : 'Food reached — game over') : 'Ready to play';
  if (status !== lastAccessibleStatus) {
    $('game-status').textContent = status;
    lastAccessibleStatus = status;
  }
}

function stopLoop() {
  if (animationId !== null) cancelAnimationFrame(animationId);
  animationId = null;
  lastTime = 0;
}

function loop(timestamp) {
  if (game.status !== 'playing') return;
  if (lastTime !== 0) {
    const result = game.update((timestamp - lastTime) / 1000);
    if (result.gameOver) {
      endGame();
      return;
    }
  }
  lastTime = timestamp;
  renderer.render(game, timestamp);
  syncUI();
  animationId = requestAnimationFrame(loop);
}

function start() {
  stopLoop();
  game.start();
  overlay.hidden = true;
  $('pause-button').textContent = 'Ⅱ Pause';
  $('restart-button').textContent = '↻ Restart';
  $('board').classList.remove('miss-flash');
  popup.classList.remove('animate');
  syncUI();
  renderer.render(game);
  animationId = requestAnimationFrame(loop);
}

function endGame() {
  stopLoop();
  persistBest();
  syncUI();
  renderer.render(game);
  showOverlay('💥', 'GAME OVER',
    `You scored ${game.score} points across ${game.foods} collected foods. You reached speed level ${game.speedLevel}.`,
    '↻ Play Again', true);
  $('pause-button').textContent = '↻ Play Again';
  $('restart-button').textContent = '↗ Share Score';
  $('board').classList.remove('miss-flash');
  popup.classList.remove('animate');
}

function togglePause() {
  if (game.status === 'gameover') { start(); return; }
  if (game.pause()) {
    stopLoop();
    $('pause-button').textContent = '▶ Resume';
    showOverlay('Ⅱ', 'PAUSED', 'Your snake will continue from exactly this position.', '▶ Resume');
  } else if (game.resume()) {
    overlay.hidden = true;
    $('pause-button').textContent = 'Ⅱ Pause';
    lastTime = 0;
    animationId = requestAnimationFrame(loop);
  }
  syncUI();
}

function flashPoints(result) {
  popup.classList.remove('animate');
  void popup.offsetWidth; // Restart animation even on rapid consecutive taps.
  popup.textContent = result.missed ? `MISS! ${result.lives} ♥ LEFT`
    : result.burstStarted ? `SPEED BURST! +${result.points}`
    : result.speedUp ? `SPEED UP! +${result.points}`
    : result.points === 0 ? 'TOO EARLY · +0'
      : result.points >= 90 ? `+${result.points} PERFECT!` : `+${result.points}`;
  popup.style.color = result.missed ? '#ff918b' : result.speedUp || result.points >= 75 ? '#bfff9b'
    : result.points > 0 ? '#ffd683' : '#e1e7dd';
  popup.classList.add('animate');
}

function tap() {
  if (game.status !== 'playing') return;
  // Each deliberate pointerdown counts, including rapid consecutive misses.
  // The board has only one pointer listener, so no 220ms debounce is needed.
  const result = game.tap();
  if (!result.accepted) {
    if (game.status === 'gameover') endGame();
    return;
  }
  persistBest();
  if (result.gameOver) {
    endGame();
    return;
  }
  flashPoints(result);
  if (result.missed) {
    const board = $('board');
    board.classList.remove('miss-flash');
    void board.offsetWidth;
    board.classList.add('miss-flash');
    clearTimeout(missFlashTimeout);
    missFlashTimeout = setTimeout(() => board.classList.remove('miss-flash'), 380);
  }
  syncUI();
  renderer.render(game);
}

function canonicalGameUrl() {
  const url = new URL('./', document.baseURI);
  url.search = '';
  url.hash = '';
  return url.href;
}

async function shareImage() {
  let snapshot;
  let file;
  try {
    snapshot = buildScreenSnapshot($('app'), $('game-canvas'));
    file = canvasToPngFile(snapshot);
  } catch (error) {
    console.error('Snapshot creation failed:', error);
    showToast('Could not capture the game screen. Please try again.');
    return;
  }

  // Native share sheet: allows the player to pick ANY installed compatible app.
  // Call share() without an intervening await to preserve the user gesture.
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({
        files: [file],
        title: 'Snake Chase',
        text: `I scored ${game.score} points and reached speed level ${game.speedLevel} in Snake Chase! Play: ${canonicalGameUrl()}`,
      });
      return;
    }
  } catch (error) {
    if (error.name === 'AbortError') return; // User canceled the native chooser.
    console.warn('Native image sharing unavailable:', error);
  }

  // Desktop and browsers without file sharing: let the user save the actual PNG.
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  showToast('Image saved. You can share it from your gallery or files.');
}

function updateNetworkIndicator() {
  // Kept for future connectivity messaging; the full-screen UI has no status badge.
  if (!navigator.onLine) console.info('Snake Chase: playing offline.');
}

async function installApp() {
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
    showToast('Snake Chase is already installed.');
    return;
  }
  if (!deferredInstallPrompt) {
    $('install-help').hidden = !$('install-help').hidden;
    return;
  }
  try {
    const installEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice?.outcome === 'accepted') showToast('Installation requested!');
    else showToast('You can install later from the browser menu.');
  } catch (error) {
    console.warn('Installation prompt failed:', error);
    $('install-help').hidden = false;
  }
}

$('start-button').addEventListener('click', event => {
  event.stopPropagation();
  if (game.status === 'paused') togglePause();
  else start();
});
$('board').addEventListener('pointerdown', event => {
  if (!overlay.hidden || event.target.closest('button')) return;
  if (!event.isPrimary) return;
  event.preventDefault();
  tap();
});
$('board').addEventListener('keydown', event => {
  if ((event.code === 'Enter' || event.code === 'Space') && !event.repeat && overlay.hidden) {
    event.preventDefault();
    tap();
  }
});
$('pause-button').addEventListener('click', togglePause);
$('restart-button').addEventListener('click', () => { if (game.status === 'gameover') shareImage(); else start(); });
$('install-button').addEventListener('click', installApp);
window.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.repeat) return;
  if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(document.activeElement?.tagName || '')) return;
  if (document.activeElement === $('board')) return;
  if (game.status === 'playing') { event.preventDefault(); tap(); }
  else if (game.status === 'paused') { event.preventDefault(); togglePause(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && game.status === 'playing') togglePause(); });
window.addEventListener('online', updateNetworkIndicator);
window.addEventListener('offline', updateNetworkIndicator);
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  $('install-button').textContent = '↓ Install app';
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  $('install-help').hidden = true;
  showToast('Snake Chase installed!');
});

// Minimal public interface for automation or later integration.
window.SnakeChaseAPI = Object.freeze({
  getState: () => game.getState(),
  start,
  restart: start,
  pause: () => { if (game.status === 'playing') togglePause(); },
  resume: () => { if (game.status === 'paused') togglePause(); },
  tap,
  shareImage,
  getConfig: () => ({...GAME_CONFIG, speedBursts: {...GAME_CONFIG.speedBursts}, shrinkingRadius: {...GAME_CONFIG.shrinkingRadius}}),
});

updateNetworkIndicator();
syncUI();
renderer.render(game);
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try { await navigator.serviceWorker.register('./sw.js', { scope: './' }); }
    catch (error) { console.warn('Offline caching unavailable:', error); }
  });
}
