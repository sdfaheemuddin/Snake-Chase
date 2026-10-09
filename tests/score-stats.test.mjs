import test from 'node:test';
import assert from 'node:assert/strict';
import { averagePointsPerFood } from '../src/score-stats.js';

test('average per food is zero before the first food', () => {
  assert.equal(averagePointsPerFood(0, 0), '0.0');
});
test('average per food uses collected foods rather than tap count', () => {
  assert.equal(averagePointsPerFood(90, 1), '90.0');
  assert.equal(averagePointsPerFood(2406, 48), '50.1');
  assert.equal(averagePointsPerFood(155, 3), '51.7');
});
test('average per food resets between games', () => {
  assert.equal(averagePointsPerFood(100, 2), '50.0');
  assert.equal(averagePointsPerFood(0, 0), '0.0');
});
