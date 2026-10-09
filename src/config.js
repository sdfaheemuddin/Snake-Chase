// Built-in safe defaults let Snake Chase work offline before a config has been cached.
// The public, editable game-config.json overrides only these validated settings.
export const GAME_CONFIG = Object.freeze({
  boardSize: 420,
  scoringRadius: 100,
  collisionRadius: 23,
  maximumPointsPerTap: 100,
  initialSpeed: 130,
  speedIncreasePerLevel: 12,
  foodsPerSpeedLevel: 10,
  maximumSpeed: 220, // Base speed limit; short bursts may temporarily exceed it.
  accelerationRate: 3,
  initialSnakeLength: 100,
  growthPerFood: 4,
  maximumSnakeLength: 250,
  lives: 3,
  speedBursts: Object.freeze({
    enabled: true,
    startAfterFoods: 20,
    everyFoods: 5,
    multiplier: 1.2,
    durationMs: 600,
  }),
  shrinkingRadius: Object.freeze({
    enabled: true,
    reductionPer10Foods: 5,
    startAfterSpeedLevel: 3,
    minimumRadius: 75,
  }),
  storageKey: 'snake-chase-pwa-best-v1',
});

// The browser must not silently accept malformed or potentially extreme values.
function numberInRange(value, fallback, min, max, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return fallback;
  return integer ? Math.round(value) : value;
}

function booleanOr(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

/** Validate and normalize optional public settings. No browser APIs needed here. */
export function resolveGameConfig(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Game configuration must be a JSON object.');
  }
  const b = GAME_CONFIG;
  const burst = input.speedBursts && typeof input.speedBursts === 'object' && !Array.isArray(input.speedBursts)
    ? input.speedBursts : {};
  const shrink = input.shrinkingRadius && typeof input.shrinkingRadius === 'object' && !Array.isArray(input.shrinkingRadius)
    ? input.shrinkingRadius : {};
  const maximumSpeed = numberInRange(input.maximumSpeed, b.maximumSpeed, 130, 500);
  const initialSpeed = Math.min(maximumSpeed, numberInRange(input.initialSpeed, b.initialSpeed, 30, 400));
  const scoringRadius = numberInRange(input.scoringRadius, b.scoringRadius, 55, 160);
  const minimumRadius = Math.min(scoringRadius,
    numberInRange(shrink.minimumRadius, b.shrinkingRadius.minimumRadius, b.collisionRadius + 10, 160));
  return Object.freeze({
    ...b,
    initialSpeed,
    maximumSpeed,
    scoringRadius,
    speedIncreasePerLevel: numberInRange(input.speedIncreasePerLevel, b.speedIncreasePerLevel, 0, 60),
    foodsPerSpeedLevel: numberInRange(input.foodsPerSpeedLevel, b.foodsPerSpeedLevel, 1, 50, true),
    lives: numberInRange(input.lives, b.lives, 1, 9, true),
    speedBursts: Object.freeze({
      enabled: booleanOr(burst.enabled, b.speedBursts.enabled),
      startAfterFoods: numberInRange(burst.startAfterFoods, b.speedBursts.startAfterFoods, 1, 500, true),
      everyFoods: numberInRange(burst.everyFoods, b.speedBursts.everyFoods, 1, 100, true),
      multiplier: numberInRange(burst.multiplier, b.speedBursts.multiplier, 1, 3),
      durationMs: numberInRange(burst.durationMs, b.speedBursts.durationMs, 100, 5000, true),
    }),
    shrinkingRadius: Object.freeze({
      enabled: booleanOr(shrink.enabled, b.shrinkingRadius.enabled),
      reductionPer10Foods: numberInRange(shrink.reductionPer10Foods,
        b.shrinkingRadius.reductionPer10Foods, 0, 15),
      startAfterSpeedLevel: numberInRange(shrink.startAfterSpeedLevel,
        b.shrinkingRadius.startAfterSpeedLevel, 1, 30, true),
      minimumRadius,
    }),
  });
}

/** Load on every page open; freeze one copy for the full duration of that game. */
export async function loadGameConfig(fetchConfig = globalThis.fetch) {
  try {
    const response = await fetchConfig('./game-config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return resolveGameConfig(await response.json());
  } catch (error) {
    console.warn('Could not load game-config.json; using built-in offline defaults.', error);
    return GAME_CONFIG;
  }
}
