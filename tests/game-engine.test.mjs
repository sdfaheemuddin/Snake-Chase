import test from 'node:test';
import assert from 'node:assert/strict';
import { SnakeGame } from '../src/game-engine.js';
import { GAME_CONFIG } from '../src/config.js';

const close = (a, b, tolerance = 1e-8) => Math.abs(a - b) <= tolerance;

test('new game preserves original gameplay values', () => {
  const game = new SnakeGame();
  game.start();
  assert.equal(game.status, 'playing');
  assert.equal(game.score, 0);
  assert.equal(game.foods, 0);
  assert.equal(game.currentSpeed, 100);
  assert.equal(game.targetSpeed, 100);
  assert.equal(game.speedLevel, 1);
  assert.equal(game.scoringRadius, 100);
  assert.ok(game.trail.length > 2);
});

test('scoring begins inside radius, rises toward food, and remains capped at 100', () => {
  const game = new SnakeGame();
  game.start();
  game.head = { x: game.food.x - 130, y: game.food.y };
  assert.equal(game.availablePoints, 0);
  game.head.x = game.food.x - game.scoringRadius;
  assert.equal(game.availablePoints, 1); // Outer boundary: minimum positive points.
  game.head.x = game.food.x - 75;
  const middle = game.availablePoints;
  assert.ok(middle > 1 && middle < 100);
  game.head.x = game.food.x - GAME_CONFIG.collisionRadius - 0.01;
  assert.equal(game.availablePoints, 100);
  game.head.x = game.food.x - GAME_CONFIG.collisionRadius;
  assert.equal(game.availablePoints, 0); // Too late; game collision takes precedence.
});

test('early tap scores zero but changes food, turns same snake, and keeps trail', () => {
  const game = new SnakeGame({ random: () => 0.5 });
  game.start();
  const head = { ...game.head }, previous = { ...game.food };
  const oldTrail = game.trail.map(point => ({ ...point }));
  assert.equal(game.availablePoints, 0);
  const result = game.tap();
  assert.equal(result.accepted, true);
  assert.equal(result.points, 0);
  assert.equal(game.foods, 0);
  assert.notDeepEqual(game.food, previous);
  assert.deepEqual(game.head, head);
  assert.deepEqual(game.trail, oldTrail);
  const towardFood = { x: game.food.x - game.head.x, y: game.food.y - game.head.y };
  assert.ok(close(game.direction.x, towardFood.x / Math.hypot(towardFood.x, towardFood.y)));
});

test('positive-point tap collects food and grows snake without resetting position', () => {
  const game = new SnakeGame();
  game.start();
  game.head.x = game.food.x - 35;
  const head = { ...game.head }, tailLength = game.trail.length;
  const result = game.tap();
  assert.equal(result.accepted, true);
  assert.ok(result.points > 0);
  assert.equal(game.foods, 1);
  assert.equal(game.score, result.points);
  assert.deepEqual(game.head, head);
  assert.equal(game.trail.length, tailLength);
  assert.equal(game.snakeLength, 104);
});

test('speed increases only at each tenth scored food, and eases gradually', () => {
  const game = new SnakeGame();
  game.start();
  for (let i = 1; i <= 30; i += 1) {
    game.head = { x: game.food.x - 24, y: game.food.y };
    const result = game.tap();
    assert.equal(result.accepted, true);
    assert.equal(result.foodCollected, true);
    assert.equal(result.speedUp, i % 10 === 0);
    assert.equal(game.speedLevel, Math.floor(i / 10) + 1);
    assert.equal(game.targetSpeed, 100 + Math.floor(i / 10) * 12);
  }
  assert.equal(game.foods, 30);
  assert.equal(game.targetSpeed, 136);
  assert.equal(game.currentSpeed, 100); // no instantaneous speed jump
  game.update(0.016);
  assert.ok(game.currentSpeed > 100 && game.currentSpeed < 136);
});

test('speed never exceeds configured maximum, even after many levels', () => {
  const game = new SnakeGame();
  game.start();
  for (let i = 0; i < 200; i += 1) {
    game.head = { x: game.food.x - 24, y: game.food.y };
    game.tap();
  }
  assert.equal(game.foods, 200);
  assert.equal(game.targetSpeed, 220);
});

test('collision ends game and prevents additional scoring', () => {
  const game = new SnakeGame();
  game.start();
  game.head = { x: game.food.x - 24, y: game.food.y };
  game.update(0.02);
  assert.equal(game.status, 'gameover');
  assert.equal(game.tap().accepted, false);
  assert.equal(game.score, 0);
});

test('pause and resume do not advance the snake; scoring radius cannot be changed', () => {
  const game = new SnakeGame();
  game.start();
  assert.equal(game.pause(), true);
  const oldHead = { ...game.head };
  assert.equal(game.update(0.5).changed, false);
  assert.deepEqual(game.head, oldHead);
  assert.equal(game.tap().accepted, false);
  assert.equal(game.resume(), true);
  assert.equal(game.scoringRadius, 100);
  assert.equal(typeof game.setScoringRadius, 'undefined');
});

test('full-height playfield accommodates portrait screens without resetting a running snake', () => {
  const game = new SnakeGame({ random: () => 0.3 });
  game.setBoardHeight(650);
  game.start();
  assert.equal(game.boardHeight, 650);
  assert.equal(game.head.y, 325);
  assert.equal(game.food.y, 325);
  const previousX = game.head.x;
  const originalTrailCount = game.trail.length;
  game.setBoardHeight(500);
  assert.equal(game.boardHeight, 500);
  assert.equal(game.head.x, previousX);
  assert.equal(game.head.y, 250);
  assert.equal(game.trail.length, originalTrailCount);
  game.head = { x: game.food.x - 50, y: game.food.y };
  game.tap();
  assert.ok(game.food.y >= 55 && game.food.y <= game.boardHeight - 55);
  assert.equal(game.scoringRadius, 100);
  assert.throws(() => game.setBoardHeight(10), /Invalid game board dimensions/);
});

test('landscape full-screen board expands horizontally without distorting the snake', () => {
  const game = new SnakeGame();
  game.setBoardDimensions(800, 420);
  game.start();
  assert.equal(game.boardWidth, 800);
  assert.equal(game.boardHeight, 420);
  assert.equal(game.head.x, 320);
  assert.equal(game.food.x, 515);
  game.tap();
  assert.ok(game.food.x >= 55 && game.food.x <= 745);
});
