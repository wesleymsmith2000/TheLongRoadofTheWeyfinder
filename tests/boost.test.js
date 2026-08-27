import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoostState, boostRechargeFactor, dodgeDirection, stepBoost } from '../src/core/boost.js';
import { createStartingVehicle } from '../src/core/vehicle.js';

test('boost dodge spends fuel and pushes in the requested direction', () => {
  const vehicle = createStartingVehicle();
  const boost = createBoostState();
  const used = stepBoost(vehicle, boost, { dodgePressed: true, dodgeX: 1, dodgeY: 0 }, 0, 0.016);
  assert.equal(used, true);
  assert.equal(boost.fuel < boost.maxFuel, true);
  assert.equal(vehicle.vx > 50, true);
  assert.equal(boost.activeTime > 0, true);
});

test('boost defaults to forward dodge without a movement direction', () => {
  const direction = dodgeDirection({ dodgePressed: true, x: 0, y: 0 });
  assert.equal(direction.x, 0);
  assert.equal(direction.y, -1);
});

test('damaged engine integrity slows boost recharge', () => {
  const vehicle = createStartingVehicle();
  const engine = vehicle.cells.find((cell) => cell.type === 'engine');
  engine.state.deviceIntegrity = 0.2;
  engine.state.wiringIntegrity = 0.1;
  assert.equal(boostRechargeFactor(vehicle) < 0.5, true);
});
