// Central gameplay configuration. Speeds are logical pixels per second.
export const GAME_CONFIG = Object.freeze({
  boardSize: 420,
  initialScoringRadius: 120,
  minimumScoringRadius: 70,
  maximumScoringRadius: 160,
  collisionRadius: 23,
  maximumPointsPerTap: 100,
  initialSpeed: 100,
  speedIncreasePerLevel: 12,
  foodsPerSpeedLevel: 10,
  maximumSpeed: 220,
  accelerationRate: 3,
  initialSnakeLength: 100,
  growthPerFood: 4,
  maximumSnakeLength: 250,
  storageKey: 'snake-chase-pwa-best-v1',
});
