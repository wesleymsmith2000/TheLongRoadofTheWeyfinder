import { clamp } from './math.js';

export function createBoostState() {
  return {
    fuel: 100,
    maxFuel: 100,
    cost: 51,
    rechargeRate: 16,
    acceleration: 35,
    sustainAcceleration: 350,
    maxSpeed: 240,
    cooldown: 0,
    cooldownDuration: 20 / 60,
    activeTime: 0,
    driveTime: 0,
    maxDuration: 5 / 60,
    shieldDuration: 5 / 60,
    shieldScale: 1,
    driveDirection: null,
  };
}

export function stepBoost(vehicle, boost, input, _roadHeading, dt) {
  boost.cooldown = Math.max(0, boost.cooldown - dt);
  if (boost.driveTime > 0 && boost.driveDirection) {
    boost.driveTime = Math.max(0, boost.driveTime - dt);
    vehicle.vx += boost.driveDirection.x * boost.sustainAcceleration * dt;
    vehicle.vy += boost.driveDirection.y * boost.sustainAcceleration * dt;
    clampBoostSpeed(vehicle, boost.maxSpeed);
    if (boost.driveTime <= 0) boost.driveDirection = null;
  }
  boost.activeTime = Math.max(0, boost.activeTime - dt);
  boost.fuel = clamp(boost.fuel + boost.rechargeRate * boostRechargeFactor(vehicle) * dt, 0, boost.maxFuel);
  if (!input.dodgePressed || boost.cooldown > 0 || boost.fuel < boost.cost) return false;

  const direction = dodgeDirection(input);
  const world = direction;
  vehicle.vx += world.x * boost.acceleration;
  vehicle.vy += world.y * boost.acceleration;
  clampBoostSpeed(vehicle, boost.maxSpeed);
  vehicle.angularVelocity *= 0.55;
  boost.fuel -= boost.cost;
  boost.cooldown = boost.cooldownDuration;
  boost.driveTime = boost.maxDuration;
  boost.activeTime = boost.shieldDuration ?? boost.maxDuration;
  boost.driveDirection = world;
  return true;
}

export function dodgeDirection(input) {
  const x = input.dodgeX ?? input.x ?? 0;
  const y = input.dodgeY ?? input.y ?? -1;
  const length = Math.hypot(x, y);
  if (length < 0.15) return { x: 0, y: -1 };
  return { x: x / length, y: y / length };
}

export function boostRechargeFactor(vehicle) {
  const engines = vehicle.cells.filter((cell) => cell.attached && cell.type === 'engine' && !cell.state.destroyed);
  if (engines.length === 0) return 0.3;
  const integrity =
    engines.reduce((sum, cell) => sum + Math.min(cell.state.deviceIntegrity, cell.state.wiringIntegrity), 0) / engines.length;
  return clamp(0.25 + integrity * 0.75, 0.25, 1);
}

function clampBoostSpeed(vehicle, maxSpeed = Infinity) {
  const speed = Math.hypot(vehicle.vx, vehicle.vy);
  if (!Number.isFinite(maxSpeed) || speed <= maxSpeed || speed <= 0.001) return;
  vehicle.vx = (vehicle.vx / speed) * maxSpeed;
  vehicle.vy = (vehicle.vy / speed) * maxSpeed;
}
