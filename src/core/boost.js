import { clamp, rotatePoint } from './math.js';

export function createBoostState() {
  return {
    fuel: 100,
    maxFuel: 100,
    cost: 34,
    rechargeRate: 24,
    cooldown: 0,
  };
}

export function stepBoost(vehicle, boost, input, roadHeading, dt) {
  boost.cooldown = Math.max(0, boost.cooldown - dt);
  boost.fuel = clamp(boost.fuel + boost.rechargeRate * boostRechargeFactor(vehicle) * dt, 0, boost.maxFuel);
  if (!input.dodgePressed || boost.cooldown > 0 || boost.fuel < boost.cost) return false;

  const direction = dodgeDirection(input);
  const world = rotatePoint(direction.x, direction.y, roadHeading);
  vehicle.vx += world.x * 280;
  vehicle.vy += world.y * 280;
  vehicle.angularVelocity *= 0.55;
  boost.fuel -= boost.cost;
  boost.cooldown = 0.26;
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
