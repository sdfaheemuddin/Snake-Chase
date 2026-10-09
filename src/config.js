// Central gameplay configuration. Distances use a 420-unit logical board width.
export const GAME_CONFIG = Object.freeze({
  boardSize: 420,
  scoringRadius: 100, // Fixed; visually scales to the player's device width.
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
