import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SnakeGame } from '../src/game-engine.js';
import { GAME_CONFIG, resolveGameConfig, loadGameConfig } from '../src/config.js';

const close = (a, b, tolerance = 1e-8) => Math.abs(a - b) <= tolerance;
const accurateTap = game => {
  game.head = { x: game.food.x - game.config.collisionRadius - 1, y: game.food.y };
  return game.tap();
};

const getJson = () => JSON.parse(readFileSync(new URL('../game-config.json', import.meta.url), 'utf8'));

test('JSON configuration enables both challenges with 130 initial speed', () => {
  const loaded = resolveGameConfig(getJson());
  assert.equal(loaded.initialSpeed, 130);
  assert.equal(loaded.maximumSpeed, 220);
  assert.equal(loaded.lives, 3);
  assert.equal(loaded.scoringRadius, 100);
  assert.equal(loaded.speedBursts.enabled, true);
  assert.equal(loaded.shrinkingRadius.enabled, true);
  assert.equal(Object.isFrozen(loaded.speedBursts), true);
});

test('remote JSON loads correctly; bad data falls back to safe defaults', async () => {
  const valid = await loadGameConfig(async () => ({ ok: true, json: async () => getJson() }));
  assert.equal(valid.initialSpeed, 130);
  assert.equal(resolveGameConfig({ lives: -4, scoringRadius: 3 }).lives, 3);
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const offline = await loadGameConfig(async () => { throw new Error('offline'); });
    assert.equal(offline, GAME_CONFIG);
  } finally { console.warn = originalWarn; }
});

test('new game starts with 3 lives, speed 130, and full radius', () => {
  const game = new SnakeGame();
  game.start();
  assert.equal(game.status, 'playing');
  assert.equal(game.lives, 3);
  assert.equal(game.currentSpeed, 130);
  assert.equal(game.targetSpeed, 130);
  assert.equal(game.scoringRadius, 100);
  assert.ok(game.trail.length > 2);
});

test('scoring rises inside radius and remains capped at 100', () => {
  const game = new SnakeGame(); game.start();
  game.head = { x: game.food.x - 130, y: game.food.y };
  assert.equal(game.availablePoints, 0);
  game.head.x = game.food.x - game.scoringRadius;
  assert.equal(game.availablePoints, 1);
  game.head.x = game.food.x - 75;
  assert.ok(game.availablePoints > 1 && game.availablePoints < 100);
  game.head.x = game.food.x - GAME_CONFIG.collisionRadius - 0.01;
  assert.equal(game.availablePoints, 100);
  game.head.x = game.food.x - GAME_CONFIG.collisionRadius;
  assert.equal(game.availablePoints, 0);
});

test('early tap loses one life, moves food, and preserves the same snake', () => {
  const game = new SnakeGame({ random: () => 0.5 }); game.start();
  const oldHead = { ...game.head }, oldFood = { ...game.food };
  const oldTrail = game.trail.map(p => ({ ...p }));
  const result = game.tap();
  assert.equal(result.accepted, true);
  assert.equal(result.missed, true);
  assert.equal(result.points, 0);
  assert.equal(game.lives, 2);
  assert.equal(game.foods, 0);
  assert.deepEqual(game.head, oldHead);
  assert.deepEqual(game.trail, oldTrail);
  assert.notDeepEqual(game.food, oldFood);
  const toward = { x: game.food.x - game.head.x, y: game.food.y - game.head.y };
  assert.ok(close(game.direction.x, toward.x / Math.hypot(toward.x, toward.y)));
});

test('three early taps end game, preserving snake and last food on screen', () => {
  const game = new SnakeGame(); game.start();
  for (let lives = 2; lives >= 0; lives--) {
    game.head = { x: game.food.x - game.scoringRadius - 50, y: game.food.y };
    const before = { ...game.food };
    const result = game.tap();
    assert.equal(game.lives, lives);
    assert.equal(result.gameOver, lives === 0);
    if (lives === 0) {
      assert.equal(game.status, 'gameover');
      assert.equal(game.gameOverReason, 'misses');
      assert.deepEqual(game.food, before);
      assert.equal(game.tap().accepted, false);
    } else assert.notDeepEqual(game.food, before);
  }
  assert.equal(game.missedTaps, 3);
});

test('accurate tap adds points and snake length without spending lives', () => {
  const game = new SnakeGame(); game.start();
  const oldLength = game.trail.length;
  const result = accurateTap(game);
  assert.ok(result.points > 0);
  assert.equal(game.foods, 1);
  assert.equal(game.lives, 3);
  assert.equal(game.snakeLength, 104);
  assert.equal(game.trail.length, oldLength);
});

test('base speed changes only every tenth scored food, and eases gradually', () => {
  const game = new SnakeGame(); game.start();
  for (let i = 1; i <= 30; i++) {
    const result = accurateTap(game);
    assert.equal(result.foodCollected, true);
    assert.equal(result.speedUp, i % 10 === 0);
    assert.equal(game.targetSpeed, 130 + Math.floor(i / 10) * 12);
  }
  assert.equal(game.targetSpeed, 166);
  assert.equal(game.currentSpeed, 130);
  game.update(.016);
  assert.ok(game.currentSpeed > 130 && game.currentSpeed < 166);
});

test('speed cap remains 220 even after 200 foods', () => {
  const game = new SnakeGame(); game.start();
  for (let i = 0; i < 200; i++) accurateTap(game);
  assert.equal(game.foods, 200);
  assert.equal(game.targetSpeed, 220);
});

test('enabled burst starts at 20 and every 5 foods, lasts 600ms, and pauses correctly', () => {
  const game = new SnakeGame(); game.start();
  for (let i = 1; i <= 26; i++) {
    const result = accurateTap(game);
    assert.equal(result.burstStarted, i === 20 || i === 25);
  }
  assert.ok(game.speedBurstActive);
  assert.equal(game.burstRemainingSeconds, .6);
  game.pause(); game.update(.04);
  assert.equal(game.burstRemainingSeconds, .6);
  game.resume();
  game.food = { x: game.head.x + 1000, y: game.head.y };
  game.update(.05);
  assert.ok(game.burstRemainingSeconds < .6);
  for (let i = 0; i < 16; i++) game.update(.05);
  assert.equal(game.burstRemainingSeconds, 0);
  assert.equal(game.speedBurstActive, false);
});

test('burst uses a higher movement multiplier without resetting base speed', () => {
  const game = new SnakeGame(); game.start();
  game.food = { x: game.head.x + 500, y: game.head.y };
  game.burstRemainingSeconds = .6;
  const x = game.head.x;
  game.update(.02);
  assert.ok(game.head.x - x > game.currentSpeed * .02);
  assert.equal(game.targetSpeed, 130);
});

test('radius shrinks 5 per ten foods to minimum 75', () => {
  const game = new SnakeGame(); game.start();
  for (let i = 1; i <= 100; i++) {
    accurateTap(game);
    assert.equal(game.scoringRadius, Math.max(75, 100 - Math.floor(i / 10) * 5));
  }
  assert.equal(game.scoringRadius, 75);
});

test('both features can be individually disabled using JSON', () => {
  const config = resolveGameConfig({ speedBursts: { enabled: false }, shrinkingRadius: { enabled: false } });
  const game = new SnakeGame({ config }); game.start();
  for (let i = 0; i < 40; i++) accurateTap(game);
  assert.equal(game.scoringRadius, 100);
  assert.equal(game.burstRemainingSeconds, 0);
});

test('collision ends game, reset restores 3 lives and initial radius', () => {
  const game = new SnakeGame(); game.start();
  game.head = { x: game.food.x - 24, y: game.food.y };
  game.update(.02);
  assert.equal(game.status, 'gameover');
  assert.equal(game.gameOverReason, 'collision');
  assert.equal(game.tap().accepted, false);
  game.start();
  assert.equal(game.lives, 3);
  assert.equal(game.scoringRadius, 100);
  assert.equal(game.burstRemainingSeconds, 0);
});

test('full-height portrait and landscape screen resizing retains trail', () => {
  const game = new SnakeGame({ random: () => 0.3 });
  game.setBoardHeight(650);game.start();
  const originalTrail = game.trail.length;
  game.setBoardHeight(500);
  assert.equal(game.head.y, 250);
  assert.equal(game.trail.length, originalTrail);
  game.setBoardDimensions(800, 420);
  assert.equal(game.boardWidth, 800);
  assert.equal(game.boardHeight, 420);
  assert.throws(() => game.setBoardHeight(10), /Invalid game board dimensions/);
});
