import test from 'node:test';
import assert from 'node:assert/strict';
import { createStartingVehicle } from '../src/core/vehicle.js';
import { gunnerAim, resolveTurretAim, stepTurretAim } from '../src/core/turret.js';

test('turret can aim at a mouse world point', () => {
  const vehicle = createStartingVehicle();
  const angle = resolveTurretAim(vehicle, [], { aimWorld: { x: 0, y: -100 } });
  assert.equal(angle.toFixed(3), (-Math.PI / 2).toFixed(3));
});

test('gunner AI leads the nearest hostile', () => {
  const vehicle = createStartingVehicle();
  const enemy = { x: 100, y: 0, vx: 100, vy: 0 };
  const angle = gunnerAim(vehicle, [enemy]);
  assert.equal(angle > 0, false);
  assert.equal(angle.toFixed(3), '0.000');
});

test('turret aim rotates toward desired heading over time', () => {
  const vehicle = createStartingVehicle();
  vehicle.turretHeading = 0;
  stepTurretAim(vehicle, [], { aimWorld: { x: 0, y: 100 } }, 0.1);
  assert.equal(vehicle.turretHeading > 0, true);
  assert.equal(vehicle.turretHeading < Math.PI / 2, true);
});
