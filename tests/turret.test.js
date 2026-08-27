import test from 'node:test';
import assert from 'node:assert/strict';
import { createStartingVehicle, gunMuzzleWorld } from '../src/core/vehicle.js';
import { compensatedAimHeading, gunnerAim, resolveTurretAim, stepTurretAim } from '../src/core/turret.js';

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

test('manual turret aim holds briefly before gunner AI takes over', () => {
  const vehicle = createStartingVehicle();
  vehicle.turretHeading = Math.PI;
  stepTurretAim(vehicle, [{ x: 100, y: 0 }], { manualAimActive: true, aimWorld: { x: -100, y: 0 } }, 0.1);
  const held = stepTurretAim(vehicle, [{ x: 100, y: 0 }], {}, 0.1);
  assert.equal(held > 2, true);
});

test('controller manual aim can hold gunner AI off for several seconds', () => {
  const vehicle = createStartingVehicle();
  vehicle.turretHeading = Math.PI;
  stepTurretAim(vehicle, [{ x: 100, y: 0 }], { manualAimActive: true, aimX: -1, aimY: 0, manualAimHold: 5 }, 0.1);
  stepTurretAim(vehicle, [{ x: 100, y: 0 }], {}, 4.8);
  assert.equal(vehicle.turretHeading > 2, true);
});

test('disabled gunner AI leaves turret heading alone without manual aim', () => {
  const vehicle = createStartingVehicle();
  vehicle.turretHeading = Math.PI;
  const angle = resolveTurretAim(vehicle, [{ x: 100, y: 0 }], { gunnerEnabled: false });
  assert.equal(angle, vehicle.turretHeading);
});

test('compensated mouse aim fires through the cursor point after vehicle velocity', () => {
  const vehicle = createStartingVehicle();
  vehicle.vx = 0;
  vehicle.vy = -180;
  const target = { x: 160, y: -40 };
  const angle = compensatedAimHeading(vehicle, target, 430);
  vehicle.turretHeading = angle;
  const muzzle = gunMuzzleWorld(vehicle);
  const shot = {
    x: Math.cos(angle) * 430 + vehicle.vx,
    y: Math.sin(angle) * 430 + vehicle.vy,
  };
  const toTarget = { x: target.x - muzzle.x, y: target.y - muzzle.y };
  const cross = shot.x * toTarget.y - shot.y * toTarget.x;
  assert.equal(Math.abs(cross) < 0.001, true);
});

test('manual aim compensation can be disabled', () => {
  const vehicle = createStartingVehicle();
  vehicle.vy = -180;
  const target = { x: 160, y: -40 };
  const direct = resolveTurretAim(vehicle, [], { aimWorld: target, compensatedAim: false });
  const compensated = resolveTurretAim(vehicle, [], { aimWorld: target, compensatedAim: true });
  assert.notEqual(direct.toFixed(4), compensated.toFixed(4));
});
