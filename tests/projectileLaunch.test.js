import test from 'node:test';
import assert from 'node:assert/strict';
import { forwardSafeInheritedVelocity } from '../src/core/projectileLaunch.js';

const EPSILON = 1e-9;

function approximatelyEqual(actual, expected, tolerance = EPSILON) {
  assert.equal(Math.abs(actual - expected) <= tolerance, true, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

function forwardProjection(velocity, baseVelocity) {
  const speed = Math.hypot(baseVelocity.x, baseVelocity.y);
  return speed > 0 ? (velocity.x * baseVelocity.x + velocity.y * baseVelocity.y) / speed : 0;
}

test('stationary, forward, and sideways shooter velocity is inherited exactly', () => {
  const base = { x: 160, y: 0 };
  assert.deepEqual(forwardSafeInheritedVelocity({ x: 0, y: 0 }, base), base);
  assert.deepEqual(forwardSafeInheritedVelocity({ x: 60, y: 0 }, base), { x: 220, y: 0 });
  assert.deepEqual(forwardSafeInheritedVelocity({ x: 0, y: 80 }, base), { x: 160, y: 80 });
});

test('diagonal firing preserves the shooter component perpendicular to its firing axis', () => {
  const inverseRootTwo = Math.SQRT1_2;
  const base = { x: 200 * inverseRootTwo, y: 200 * inverseRootTwo };
  const perpendicularShooter = { x: -70 * inverseRootTwo, y: 70 * inverseRootTwo };
  const velocity = forwardSafeInheritedVelocity(perpendicularShooter, base);
  approximatelyEqual(velocity.x, base.x + perpendicularShooter.x);
  approximatelyEqual(velocity.y, base.y + perpendicularShooter.y);
  approximatelyEqual(forwardProjection(velocity, base), 200);
});

test('backward inheritance is compressed toward the positive square-root speed floor', () => {
  const base = { x: 160, y: 0 };
  const mild = forwardSafeInheritedVelocity({ x: -20, y: 0 }, base);
  const extreme = forwardSafeInheritedVelocity({ x: -1_000_000, y: 0 }, base);
  assert.equal(mild.x > Math.sqrt(160), true);
  assert.equal(mild.x < 160, true);
  approximatelyEqual(extreme.x, Math.sqrt(160), 1e-8);
  assert.equal(extreme.y, 0);
});

test('backward launch curve is continuous in value and slope around zero parallel speed', () => {
  const base = { x: 160, y: 0 };
  const step = 1e-5;
  const below = forwardSafeInheritedVelocity({ x: -step, y: 0 }, base).x;
  const atZero = forwardSafeInheritedVelocity({ x: 0, y: 0 }, base).x;
  const above = forwardSafeInheritedVelocity({ x: step, y: 0 }, base).x;
  approximatelyEqual(atZero - below, step, 1e-10);
  approximatelyEqual(above - atZero, step, 1e-10);
});

test('zero and low base speeds remain finite without manufacturing a firing axis', () => {
  assert.deepEqual(forwardSafeInheritedVelocity({ x: 40, y: -20 }, { x: 0, y: 0 }), { x: 0, y: 0 });
  assert.deepEqual(forwardSafeInheritedVelocity({ x: -50, y: 12 }, { x: 1, y: 0 }), { x: 1, y: 12 });
  assert.deepEqual(forwardSafeInheritedVelocity({ x: -50, y: 12 }, { x: 0.25, y: 0 }), { x: 0.25, y: 12 });
});

test('ordinary speeds always retain at least their positive square-root forward floor', () => {
  for (const base of [{ x: 160, y: 0 }, { x: -30, y: 40 }, { x: 120, y: -75 }]) {
    const speed = Math.hypot(base.x, base.y);
    const velocity = forwardSafeInheritedVelocity({ x: -50_000, y: 80_000 }, base);
    assert.equal(forwardProjection(velocity, base) >= Math.sqrt(speed) - EPSILON, true);
  }
});
