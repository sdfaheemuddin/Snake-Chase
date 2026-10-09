// Built-in safe defaults let Snake Chase work offline before a config has been cached.
// The public, editable game-config.json overrides only these validated settings.
export const GAME_CONFIG = Object.freeze({
  boardSize: 420,
  scoringRadius: 100,
  collisionRadius: 23,
  maximumPointsPerTap: 100,
  initialSpeed: 150,
  speedIncreasePerLevel: 12,
  foodsPerSpeedLevel: 10,
  maximumSpeed: 220, // Base speed limit; short bursts may temporarily exceed it.
  accelerationRate: 3,
  initialSnakeLength: 100,
  growthPerFood: 4,
  maximumSnakeLength: 250,
  lives: 3,
  headScore: Object.freeze({
    enabled: true,             // Show live points possible beside the moving head.
    tapAnimationAtHead: true,  // Start the existing scoring animation at the tap-time head.
    showZero: false,            // Show +0 before the snake enters the scoring circle.
    offset: 38,                // Logical screen units above the snake's head.
  }),
  speedBursts: Object.freeze({
    enabled: true,
    startAtSpeedLevel: 1, // Inclusive: bursts can start in level 1.
    minimumDelaySeconds: 2,
    maximumDelaySeconds: 5,
    multiplier: 1.5,
    durationMs: 600,
  }),
  shrinkingRadius: Object.freeze({
    enabled: true,
    reductionPerSpeedLevel: 5,
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
  const headScore = input.headScore && typeof input.headScore === 'object' && !Array.isArray(input.headScore)
    ? input.headScore : {};
  const shrink = input.shrinkingRadius && typeof input.shrinkingRadius === 'object' && !Array.isArray(input.shrinkingRadius)
    ? input.shrinkingRadius : {};
  const maximumSpeed = numberInRange(input.maximumSpeed, b.maximumSpeed, 130, 500);
  const initialSpeed = Math.min(maximumSpeed, numberInRange(input.initialSpeed, b.initialSpeed, 30, 400));
  const scoringRadius = numberInRange(input.scoringRadius, b.scoringRadius, 55, 160);
  const minimumRadius = Math.min(scoringRadius,
    numberInRange(shrink.minimumRadius, b.shrinkingRadius.minimumRadius, b.collisionRadius + 10, 160));
  const minimumBurstDelay = numberInRange(burst.minimumDelaySeconds,
    b.speedBursts.minimumDelaySeconds, 0.25, 30);
  const maximumBurstDelay = Math.max(minimumBurstDelay,
    numberInRange(burst.maximumDelaySeconds, b.speedBursts.maximumDelaySeconds, 0.25, 60));
  // Compatibility: old startAfterSpeedLevel: 3 meant the first eligible level was 4.
  const requestedBurstStart = burst.startAtSpeedLevel !== undefined
    ? burst.startAtSpeedLevel
    : typeof burst.startAfterSpeedLevel === 'number' ? burst.startAfterSpeedLevel + 1 : undefined;
  return Object.freeze({
    ...b,
    initialSpeed,
    maximumSpeed,
    scoringRadius,
    speedIncreasePerLevel: numberInRange(input.speedIncreasePerLevel, b.speedIncreasePerLevel, 0, 60),
    foodsPerSpeedLevel: numberInRange(input.foodsPerSpeedLevel, b.foodsPerSpeedLevel, 1, 50, true),
    lives: numberInRange(input.lives, b.lives, 1, 9, true),
    headScore: Object.freeze({
      enabled: booleanOr(headScore.enabled, b.headScore.enabled),
      tapAnimationAtHead: booleanOr(headScore.tapAnimationAtHead, b.headScore.tapAnimationAtHead),
      showZero: booleanOr(headScore.showZero, b.headScore.showZero),
      offset: numberInRange(headScore.offset, b.headScore.offset, 22, 90),
    }),
    speedBursts: Object.freeze({
      enabled: booleanOr(burst.enabled, b.speedBursts.enabled),
      startAtSpeedLevel: numberInRange(requestedBurstStart,
        b.speedBursts.startAtSpeedLevel, 1, 30, true),
      minimumDelaySeconds: minimumBurstDelay,
      maximumDelaySeconds: maximumBurstDelay,
      multiplier: numberInRange(burst.multiplier, b.speedBursts.multiplier, 1, 3),
      durationMs: numberInRange(burst.durationMs, b.speedBursts.durationMs, 100, 5000, true),
    }),
    shrinkingRadius: Object.freeze({
      enabled: booleanOr(shrink.enabled, b.shrinkingRadius.enabled),
      reductionPerSpeedLevel: numberInRange(shrink.reductionPerSpeedLevel,
        b.shrinkingRadius.reductionPerSpeedLevel, 0, 15),
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
