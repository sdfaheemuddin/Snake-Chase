import { GAME_CONFIG } from './config.js';

const copyPoint = point => ({ x: point.x, y: point.y });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function directionTo(from, to) {
  const length = Math.max(0.0001, distance(from, to));
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}

/** Pure gameplay model: no browser, DOM, localStorage, or rendering dependencies. */
export class SnakeGame {
  constructor({ config = GAME_CONFIG, random = Math.random } = {}) {
    this.config = config;
    this.random = random;
    this.scoringRadius = config.scoringRadius;
    this.boardWidth = config.boardSize;
    this.boardHeight = config.boardSize;
    this.reset();
  }

  reset() {
    const c = this.config;
    this.status = 'ready';
    this.score = 0;
    this.foods = 0;
    this.currentSpeed = c.initialSpeed;
    this.targetSpeed = c.initialSpeed;
    this.snakeLength = c.initialSnakeLength;
    this.head = { x: this.boardWidth / 2 - 80, y: this.boardHeight / 2 };
    this.food = { x: this.boardWidth / 2 + 115, y: this.boardHeight / 2 };
    this.direction = directionTo(this.head, this.food);
    this.trail = [];
    for (let offset = c.initialSnakeLength; offset >= 0; offset -= 5) {
      this.trail.push({ x: this.head.x - offset, y: this.head.y });
    }
    this.trail.push(copyPoint(this.head));
  }

  start() {
    this.reset();
    this.status = 'playing';
  }

  pause() {
    if (this.status !== 'playing') return false;
    this.status = 'paused';
    return true;
  }

  resume() {
    if (this.status !== 'paused') return false;
    this.status = 'playing';
    return true;
  }

  /** Keep the board fully usable in both portrait and landscape without stretching it. */
  setBoardDimensions(width, height) {
    if (![width, height].every(v => Number.isFinite(v) && v >= 160)) {
      throw new RangeError('Invalid game board dimensions.');
    }
    const previousWidth = this.boardWidth;
    const previousHeight = this.boardHeight;
    if (Math.abs(previousWidth - width) < 0.5 && Math.abs(previousHeight - height) < 0.5) return;
    this.boardWidth = width;
    this.boardHeight = height;
    if (this.status === 'ready') { this.reset(); return; }

    // Maintain the current snake, target and trail across orientation changes.
    const scaleX = width / previousWidth;
    const scaleY = height / previousHeight;
    this.head.x *= scaleX;
    this.head.y *= scaleY;
    this.food.x *= scaleX;
    this.food.y *= scaleY;
    for (const part of this.trail) { part.x *= scaleX; part.y *= scaleY; }
    this.direction = directionTo(this.head, this.food);
  }

  setBoardHeight(value) { this.setBoardDimensions(this.boardWidth, value); }

  get distanceToFood() { return distance(this.head, this.food); }
  get speedLevel() { return Math.floor(this.foods / this.config.foodsPerSpeedLevel) + 1; }
  get levelProgress() { return this.foods % this.config.foodsPerSpeedLevel; }

  get availablePoints() {
    const d = this.distanceToFood;
    const c = this.config;
    if (d > this.scoringRadius || d <= c.collisionRadius) return 0;
    const ratio = (this.scoringRadius - d) / (this.scoringRadius - c.collisionRadius);
    return Math.max(1, Math.min(c.maximumPointsPerTap, Math.round(ratio * c.maximumPointsPerTap)));
  }

  /** A tap always redirects to a new food, including an early (zero-point) tap. */
  tap() {
    if (this.status !== 'playing') return { accepted: false, reason: `Game is ${this.status}.` };
    if (this.distanceToFood <= this.config.collisionRadius) {
      this.status = 'gameover';
      return { accepted: false, reason: 'The snake has already reached the food.' };
    }

    const earned = this.availablePoints;
    const oldFood = copyPoint(this.food);
    const oldHead = copyPoint(this.head);
    const previousLevel = this.speedLevel;
    this.score += earned;

    if (earned > 0) {
      this.foods += 1;
      this.snakeLength = Math.min(this.config.maximumSnakeLength, this.snakeLength + this.config.growthPerFood);
    }

    const speedUp = this.speedLevel > previousLevel;
    if (speedUp) {
      this.targetSpeed = Math.min(
        this.config.maximumSpeed,
        this.config.initialSpeed + (this.speedLevel - 1) * this.config.speedIncreasePerLevel,
      );
    }

    this.placeNextFood(oldFood);
    this.direction = directionTo(this.head, this.food);

    return {
      accepted: true,
      points: earned,
      foodCollected: earned > 0,
      speedUp,
      speedLevel: this.speedLevel,
      // Useful for integrations and deterministic testing.
      oldHead,
      newHead: copyPoint(this.head),
      oldFood,
      newFood: copyPoint(this.food),
    };
  }

  placeNextFood(previousFood) {
    const c = this.config;
    const edgePadding = 55;
    const rangeX = this.boardWidth - 2 * edgePadding;
    const rangeY = this.boardHeight - 2 * edgePadding;
    const minimumDistance = Math.max(155, this.scoringRadius + 25);
    let selected = null;
    let best = null;
    let bestQuality = -Infinity;

    for (let attempt = 0; attempt < 160; attempt += 1) {
      const candidate = {
        x: edgePadding + this.random() * rangeX,
        y: edgePadding + this.random() * rangeY,
      };
      if (distance(this.head, candidate) < minimumDistance || distance(previousFood, candidate) < 75) continue;
      if (this.trail.some((point, index) => index % 9 === 0 && distance(candidate, point) < 31)) continue;

      const nextDirection = directionTo(this.head, candidate);
      const dot = this.direction.x * nextDirection.x + this.direction.y * nextDirection.y;
      const quality = (1 - dot) * 100 + this.random() * 30;
      if (quality > bestQuality) { bestQuality = quality; best = candidate; }
      if (dot < 0.6) { selected = candidate; break; }
    }

    if (!selected) selected = best;
    if (!selected) {
      const corners = [
        { x: 60, y: 60 }, { x: this.boardWidth - 60, y: 60 },
        { x: 60, y: this.boardHeight - 60 }, { x: this.boardWidth - 60, y: this.boardHeight - 60 },
      ];
      corners.sort((a, b) => distance(this.head, b) - distance(this.head, a));
      selected = corners[0];
    }
    this.food = selected;
  }

  /** Advance the same snake (including its entire body trail) by delta seconds. */
  update(deltaSeconds) {
    if (this.status !== 'playing') return { changed: false };
    const dt = Math.max(0, Math.min(Number(deltaSeconds) || 0, 0.05));
    if (dt === 0) return { changed: false };
    const c = this.config;

    // Smooth exponential-style easing from the previous level's speed to the new one.
    this.currentSpeed += (this.targetSpeed - this.currentSpeed) * Math.min(1, c.accelerationRate * dt);
    this.direction = directionTo(this.head, this.food);
    const distanceRemaining = this.distanceToFood;
    const move = this.currentSpeed * dt;

    // Prevent the snake stepping past a target between animation frames.
    if (distanceRemaining <= c.collisionRadius + move) {
      const safeMove = Math.max(0, distanceRemaining - c.collisionRadius);
      this.head.x += this.direction.x * safeMove;
      this.head.y += this.direction.y * safeMove;
      this.trail.push(copyPoint(this.head));
      this.trimTrail();
      this.status = 'gameover';
      return { changed: true, gameOver: true };
    }

    this.head.x += this.direction.x * move;
    this.head.y += this.direction.y * move;
    this.trail.push(copyPoint(this.head));
    this.trimTrail();
    return { changed: true, gameOver: false };
  }

  trimTrail() {
    let retainedLength = 0;
    let earliestIndex = 0;
    for (let i = this.trail.length - 1; i > 0; i -= 1) {
      const segment = distance(this.trail[i], this.trail[i - 1]);
      if (retainedLength + segment >= this.snakeLength) {
        const ratio = segment > 0 ? (this.snakeLength - retainedLength) / segment : 0;
        this.trail[i - 1] = {
          x: this.trail[i].x + (this.trail[i - 1].x - this.trail[i].x) * ratio,
          y: this.trail[i].y + (this.trail[i - 1].y - this.trail[i].y) * ratio,
        };
        earliestIndex = i - 1;
        break;
      }
      retainedLength += segment;
    }
    if (earliestIndex > 0) this.trail.splice(0, earliestIndex);
    if (this.trail.length > 1500) this.trail.splice(0, this.trail.length - 1500);
  }

  getState() {
    return {
      status: this.status,
      score: this.score,
      foods: this.foods,
      speedLevel: this.speedLevel,
      levelProgress: this.levelProgress,
      currentSpeed: this.currentSpeed,
      targetSpeed: this.targetSpeed,
      availablePoints: this.availablePoints,
      distanceToFood: this.distanceToFood,
      scoringRadius: this.scoringRadius,
      boardWidth: this.boardWidth,
      boardHeight: this.boardHeight,
      head: copyPoint(this.head),
      food: copyPoint(this.food),
      bodyLength: this.snakeLength,
    };
  }
}
