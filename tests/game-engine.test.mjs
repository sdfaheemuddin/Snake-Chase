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

test('JSON configuration enables both challenges with 150 initial speed', () => {
  const loaded = resolveGameConfig(getJson());
  assert.equal(loaded.initialSpeed, 150);
  assert.equal(loaded.maximumSpeed, 220);
  assert.equal(loaded.lives, 3);
  assert.equal(loaded.scoringRadius, 100);
  assert.equal(loaded.speedBursts.enabled, true);
  assert.equal(loaded.speedBursts.startAtSpeedLevel, 1);
  assert.equal(loaded.speedBursts.multiplier, 1.5);
  assert.equal(loaded.speedBursts.minimumDelaySeconds, 2);
  assert.equal(loaded.speedBursts.maximumDelaySeconds, 5);
  assert.equal(loaded.shrinkingRadius.enabled, true);
  assert.equal(loaded.shrinkingRadius.reductionPerSpeedLevel, 5);
  assert.equal(loaded.shrinkingRadius.startAfterSpeedLevel, 3);
  assert.equal(Object.isFrozen(loaded.speedBursts), true);
});

test('remote JSON loads correctly; bad data falls back to safe defaults', async () => {
  const valid = await loadGameConfig(async () => ({ ok: true, json: async () => getJson() }));
  assert.equal(valid.initialSpeed, 150);
  assert.equal(resolveGameConfig({ lives: -4, scoringRadius: 3 }).lives, 3);
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const offline = await loadGameConfig(async () => { throw new Error('offline'); });
    assert.equal(offline, GAME_CONFIG);
  } finally { console.warn = originalWarn; }
});

test('new game starts with 3 lives, speed 150, and full radius', () => {
  const game = new SnakeGame();
  game.start();
  assert.equal(game.status, 'playing');
  assert.equal(game.lives, 3);
  assert.equal(game.currentSpeed, 150);
  assert.equal(game.targetSpeed, 150);
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
    assert.equal(game.targetSpeed, 150 + Math.floor(i / 10) * 12);
  }
  assert.equal(game.targetSpeed, 186);
  assert.equal(game.currentSpeed, 150);
  game.update(.016);
  assert.ok(game.currentSpeed > 150 && game.currentSpeed < 186);
});

test('speed cap remains 220 even after 200 foods', () => {
  const game = new SnakeGame(); game.start();
  for (let i = 0; i < 200; i++) accurateTap(game);
  assert.equal(game.foods, 200);
  assert.equal(game.targetSpeed, 220);
});

test('level-4 burst setting keeps levels 1–3 free of bursts', () => {
  const config = resolveGameConfig({ speedBursts: { startAtSpeedLevel: 4 } });
  const game = new SnakeGame({ config, random: () => 0 }); game.start();
  for (let i = 0; i < 29; i++) accurateTap(game);
  assert.equal(game.speedLevel, 3);
  for (let i = 0; i < 120; i++) {
    game.food = { x: game.head.x + 10000, y: game.head.y };
    game.update(.05);
    assert.equal(game.speedBurstActive, false);
  }
  assert.equal(game.burstDelaySeconds, null);
});

test('a level-4 burst setting schedules bursts and freezes when paused', () => {
  const config = resolveGameConfig({ speedBursts: { startAtSpeedLevel: 4 } });
  const game = new SnakeGame({ config, random: () => 0 }); game.start();
  for (let i = 0; i < 30; i++) accurateTap(game);
  assert.equal(game.speedLevel, 4);
  assert.equal(game.burstDelaySeconds, 2);
  assert.equal(game.speedBurstActive, false);
  game.pause();
  game.update(.05);
  assert.equal(game.burstDelaySeconds, 2);
  game.resume();
  let startEvents = 0;
  for (let i = 0; i < 41; i++) {
    game.food = { x: game.head.x + 10000, y: game.head.y };
    const result = game.update(.05);
    if (result.burstStarted) startEvents++;
  }
  assert.equal(startEvents, 1);
  assert.ok(game.speedBurstActive);
  assert.ok(close(game.effectiveSpeed, game.currentSpeed * 1.5));
  const remaining = game.burstRemainingSeconds;
  game.pause();
  game.update(.05);
  assert.equal(game.burstRemainingSeconds, remaining);
  game.resume();
  for (let i = 0; i < 13; i++) {
    game.food = { x: game.head.x + 10000, y: game.head.y };
    game.update(.05);
  }
  assert.equal(game.speedBurstActive, false);
  assert.ok(game.burstDelaySeconds > 0);
  for (let i = 0; i < 41; i++) {
    game.food = { x: game.head.x + 10000, y: game.head.y };
    const result = game.update(.05);
    if (result.burstStarted) startEvents++;
  }
  assert.equal(startEvents, 2);
});

test('configured bursts start from level 1 before collecting foods', () => {
  const game = new SnakeGame({ random: () => 0 });
  game.start();
  assert.equal(game.speedLevel, 1);
  assert.equal(game.burstEligible, true);
  game.food = { x: game.head.x + 10000, y: game.head.y };
  let starts = 0;
  for (let i = 0; i < 41; i++) {
    if (game.update(0.05).burstStarted) starts++;
  }
  assert.equal(starts, 1);
  assert.ok(game.speedBurstActive);
  assert.equal(game.effectiveSpeed, game.currentSpeed * 1.5);
});

test('legacy startAfterSpeedLevel remains backward compatible', () => {
  const config = resolveGameConfig({ speedBursts: { startAfterSpeedLevel: 3 } });
  assert.equal(config.speedBursts.startAtSpeedLevel, 4);
  const game = new SnakeGame({ config });
  game.start();
  assert.equal(game.burstEligible, false);
  for (let i = 0; i < 30; i++) accurateTap(game);
  assert.equal(game.burstEligible, true);
});

test('random delay range varies between minimum and maximum, independent of food counts', () => {
  const shortest = new SnakeGame({ random: () => 0 }); shortest.start();
  const longest = new SnakeGame({ random: () => 0.999999 }); longest.start();
  for (let i = 0; i < 30; i++) { accurateTap(shortest); accurateTap(longest); }
  assert.equal(shortest.burstDelaySeconds, 2);
  assert.ok(longest.burstDelaySeconds > 4.99);
  assert.ok(longest.burstDelaySeconds <= 5);
  assert.equal(shortest.getState().burstDelaySeconds, 2);
  assert.equal(resolveGameConfig({speedBursts:{minimumDelaySeconds:8, maximumDelaySeconds:2}})
    .speedBursts.maximumDelaySeconds, 8);
});

test('active burst applies 1.5x movement without resetting base speed', () => {
  const game = new SnakeGame(); game.start();
  for (let i = 0; i < 30; i++) accurateTap(game);
  game.food = { x: game.head.x + 500, y: game.head.y };
  game.burstRemainingSeconds = .6;
  const x = game.head.x;
  game.update(.02);
  assert.ok(close(game.head.x - x, game.currentSpeed * .02 * 1.5));
  assert.equal(game.targetSpeed, 186);
});

test('radius stays at 100 through level 3; starts shrinking at level 4 and stops at 75', () => {
  const game = new SnakeGame(); game.start();
  for (let i = 1; i <= 100; i++) {
    const result = accurateTap(game);
    const expected = Math.max(75, 100 - Math.max(0, Math.floor(i / 10) - 2) * 5);
    assert.equal(game.scoringRadius, expected, `At food ${i}`);
    assert.equal(result.radiusChanged, i >= 30 && i <= 70 && i % 10 === 0);
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


test('rapid consecutive misses without time delay consume all three lives', () => {
  const game = new SnakeGame(); game.start();
  const results = Array.from({ length: 3 }, () => game.tap());
  assert.deepEqual(results.map(result => result.lives), [2, 1, 0]);
  assert.equal(results[2].gameOver, true);
  assert.equal(game.status, 'gameover');
  assert.equal(game.missedTaps, 3);
});

test('radius reduction is configurable per speed level (not every ten foods)', () => {
  const config = resolveGameConfig({
    foodsPerSpeedLevel: 5,
    shrinkingRadius: { enabled: true, startAfterSpeedLevel: 3, reductionPerSpeedLevel: 7, minimumRadius: 75 },
  });
  assert.equal(config.shrinkingRadius.reductionPerSpeedLevel, 7);
  assert.equal('reductionPer10Foods' in config.shrinkingRadius, false);
  const game = new SnakeGame({ config });
  game.start();
  for (let i = 1; i <= 20; i++) {
    accurateTap(game);
    const expected = Math.max(75, 100 - Math.max(0, Math.floor(i / 5) - 2) * 7);
    assert.equal(game.scoringRadius, expected, 'at food ' + i);
  }
  assert.equal(game.scoringRadius, 86);
  assert.equal(resolveGameConfig({ shrinkingRadius: { reductionPerSpeedLevel: 20 } })
    .shrinkingRadius.reductionPerSpeedLevel, 5);
});

test('radius cutoff is configurable through public game JSON', () => {
  const config = resolveGameConfig({ shrinkingRadius: { startAfterSpeedLevel: 5 } });
  const game = new SnakeGame({ config }); game.start();
  for (let i=0; i<50; i++) accurateTap(game);
  assert.equal(game.scoringRadius, 95); // Reduction starts when level 6 begins
});

test('head-score settings are public, individually configurable, and validated', () => {
  const config = resolveGameConfig(getJson());
  assert.deepEqual(config.headScore, {
    enabled: true, tapAnimationAtHead: true, showZero: true, offset: 38,
  });
  assert.equal(Object.isFrozen(config.headScore), true);
  const disabled = resolveGameConfig({headScore: {enabled: false, tapAnimationAtHead: false, showZero: false, offset: 55}});
  assert.equal(disabled.headScore.enabled, false);
  assert.equal(disabled.headScore.tapAnimationAtHead, false);
  assert.equal(disabled.headScore.showZero, false);
  assert.equal(disabled.headScore.offset, 55);
  assert.equal(resolveGameConfig({headScore: {offset: 1000, enabled: 'no'}}).headScore.offset, 38);
  assert.equal(resolveGameConfig({headScore: {enabled: 'no'}}).headScore.enabled, true);
});

test('foodsPerSpeedLevel is configurable and drives speed, burst and radius milestones', () => {
  const config = resolveGameConfig({...getJson(), foodsPerSpeedLevel: 5,
    speedBursts: {...getJson().speedBursts, startAtSpeedLevel: 4}});
  const game = new SnakeGame({config, random: () => .5});
  game.start();
  for (let i=1; i<=20; i++) {
    const result = accurateTap(game);
    assert.equal(result.speedUp, i % 5 === 0);
    assert.equal(game.speedLevel, Math.floor(i/5) + 1);
    if (i < 15) {
      assert.equal(game.scoringRadius, 100);
      assert.equal(game.burstDelaySeconds, null);
    }
  }
  assert.equal(game.targetSpeed, 198);
  assert.equal(game.scoringRadius, 90);
  assert.ok(game.burstDelaySeconds >= 2 && game.burstDelaySeconds <= 5);
  assert.equal(resolveGameConfig({foodsPerSpeedLevel: 500}).foodsPerSpeedLevel, 10);
});
