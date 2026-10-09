import { GAME_CONFIG } from './config.js';
import { SnakeGame } from './game-engine.js';
import { GameRenderer } from './renderer.js';

const $ = id => document.getElementById(id);
const game = new SnakeGame();
const renderer = new GameRenderer($('game-canvas'), GAME_CONFIG.boardSize);
const overlay = $('game-overlay');
const popup = $('points-popup');
let best = readBest();
let lastTime = 0;
let animationId = null;
let deferredInstallPrompt = null;
let toastTimeout = null;
let lastAccessibleStatus = '';

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

function showOverlay(symbol, title, description, buttonLabel, allowSharing = false) {
  $('overlay-symbol').textContent = symbol;
  $('overlay-title').textContent = title;
  $('overlay-message').textContent = description;
  $('start-button').textContent = buttonLabel;
  $('gameover-share').hidden = !allowSharing;
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
  $('points-now').textContent = game.status === 'playing' || game.status === 'paused' ? game.availablePoints : 0;
  $('level').textContent = game.speedLevel;
  $('speed-value').textContent = `${Math.round(game.currentSpeed)} px/s`;
  $('progress-fill').style.width = `${(game.levelProgress / GAME_CONFIG.foodsPerSpeedLevel) * 100}%`;
  $('progress-text').textContent = `${game.levelProgress} / ${GAME_CONFIG.foodsPerSpeedLevel} foods`;
  $('distance').textContent = `${Math.round(game.distanceToFood)} px away`;
  $('radius-label').textContent = `${game.scoringRadius} px`;

  const status = game.status === 'playing'
    ? game.availablePoints >= 75 ? 'Perfect zone — TAP NOW!'
      : game.availablePoints > 0 ? 'Scoring zone — tap!' : 'Approaching food…'
    : game.status === 'paused' ? 'Game paused'
      : game.status === 'gameover' ? 'Food reached — game over' : 'Ready to play';
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
}

function togglePause() {
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
  popup.textContent = result.speedUp ? `SPEED UP! +${result.points}`
    : result.points === 0 ? 'TOO EARLY · +0'
      : result.points >= 90 ? `+${result.points} PERFECT!` : `+${result.points}`;
  popup.style.color = result.speedUp || result.points >= 75 ? '#bfff9b'
    : result.points > 0 ? '#ffd683' : '#e1e7dd';
  popup.classList.add('animate');
}

function tap() {
  if (game.status !== 'playing') return;
  const result = game.tap();
  if (!result.accepted) {
    if (game.status === 'gameover') endGame();
    return;
  }
  persistBest();
  flashPoints(result);
  syncUI();
  renderer.render(game);
}

function canonicalGameUrl() {
  const url = new URL('./', window.location.href);
  url.search = '';
  url.hash = '';
  return url.href;
}

function shareWhatsApp() {
  const title = 'Snake Chase';
  const message = `I scored ${game.score} points and collected ${game.foods} foods in ${title}! Can you beat me? Play here: ${canonicalGameUrl()}`;
  // The official click-to-chat URL opens WhatsApp or WhatsApp Web, where available.
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) window.location.href = url;
}

function updateNetworkIndicator() {
  $('network-status').classList.toggle('offline', !navigator.onLine);
  $('network-text').textContent = navigator.onLine ? 'READY' : 'OFFLINE';
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
$('restart-button').addEventListener('click', start);
$('radius-slider').addEventListener('input', event => {
  try { game.setScoringRadius(event.target.value); syncUI(); renderer.render(game); }
  catch (error) { showToast(error.message); }
});
$('whatsapp-button').addEventListener('click', shareWhatsApp);
$('gameover-share').addEventListener('click', event => { event.stopPropagation(); shareWhatsApp(); });
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
  setScoringRadius: value => { const applied = game.setScoringRadius(value); $('radius-slider').value = String(applied); syncUI(); renderer.render(game); return applied; },
  shareWhatsApp,
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
