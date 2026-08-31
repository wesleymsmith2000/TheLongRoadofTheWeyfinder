import { angleDelta, rotatePoint } from './math.js';

export function stepVehicle(vehicle, input, dt, roadHeading = vehicle.heading, upgrades = {}) {
  if (!vehicle.alive) return;
  const inputX = input.x ?? 0;
  const inputY = input.y ?? 0;
  const inputTurn = input.turn ?? 0;
  const enginePower = typedModulePower(vehicle, 'engine');
  const wheelPower = typedModulePower(vehicle, 'wheel');
  const engineAcceleration = upgradeMultiplier(upgrades, 'engineAcceleration', 0.08);
  const engineMaxVelocity = upgradeMultiplier(upgrades, 'engineMaxVelocity', 0.08);
  const wheelInertiaCompensation = upgradeMultiplier(upgrades, 'wheelInertiaCompensation', 0.08);
  const propulsion = Math.max(0.25, 1.275 * Math.sqrt(Math.max(0.05, enginePower)) + 0.525 * Math.sqrt(Math.max(0.05, wheelPower)));
  const turnBalance = vehicle.cells
    .filter((cell) => cell.attached && cell.type === 'wheel')
    .reduce((sum, cell) => sum + cell.gridX * cell.state.deviceIntegrity, 0);
  const pull = turnBalance * 0.35;
  const massPenalty = Math.sqrt(vehicle.totalMass / 120);

  const localAx = (inputX * 135 * propulsion * engineAcceleration) / massPenalty;
  const localAy = (inputY * 135 * propulsion * engineAcceleration) / massPenalty;
  const accel = rotatePoint(localAx, localAy, roadHeading);
  vehicle.vx += accel.x * dt;
  vehicle.vy += accel.y * dt;
  applyWheelGrounding(vehicle, accel, wheelPower, wheelInertiaCompensation, dt);
  const roadAlignment = angleDelta(vehicle.heading, roadHeading) * 1.4;
  vehicle.angularVelocity += (inputTurn * 3.6 + inputY * pull * 0.45 + roadAlignment) * dt;

  if (input.brake) {
    vehicle.vx *= Math.pow(0.04, dt);
    vehicle.vy *= Math.pow(0.04, dt);
    vehicle.angularVelocity *= Math.pow(0.02, dt);
  }

  const drag = Math.pow(inputMagnitude(inputX, inputY) > 0.05 ? 0.32 : 0.08 / (Math.max(1, Math.sqrt(Math.max(1, wheelPower))) * wheelInertiaCompensation), dt);
  vehicle.vx *= drag;
  vehicle.vy *= drag;
  clampVehicleSpeed(vehicle, enginePower, wheelPower, massPenalty, engineMaxVelocity);
  vehicle.angularVelocity *= Math.pow(0.24, dt);
  vehicle.x += vehicle.vx * dt;
  vehicle.y += vehicle.vy * dt;
  vehicle.heading += vehicle.angularVelocity * dt;

  for (const piece of vehicle.detachedPieces) {
    piece.vx *= Math.pow(0.72, dt);
    piece.vy *= Math.pow(0.72, dt);
    piece.angularVelocity *= Math.pow(0.65, dt);
    piece.x += piece.vx * dt;
    piece.y += piece.vy * dt;
    piece.heading += piece.angularVelocity * dt;
    piece.life -= dt;
  }
  vehicle.detachedPieces = vehicle.detachedPieces.filter((piece) => piece.life > 0);
}

function typedModulePower(vehicle, type) {
  return vehicle.cells
    .filter((cell) => cell.attached && cell.type === type && !cell.state.destroyed && cell.state.deviceIntegrity > 0.1)
    .reduce((sum, cell) => sum + Math.min(cell.state.deviceIntegrity, cell.state.wiringIntegrity, cell.state.structureIntegrity), 0);
}

function inputMagnitude(x, y) {
  return Math.hypot(x, y);
}

function applyWheelGrounding(vehicle, accel, wheelPower, inertiaCompensation, dt) {
  const speed = Math.hypot(vehicle.vx, vehicle.vy);
  const accelMagnitude = Math.hypot(accel.x, accel.y);
  if (speed <= 0.001 || accelMagnitude <= 0.001) return;
  const dot = (vehicle.vx * accel.x + vehicle.vy * accel.y) / (speed * accelMagnitude);
  if (dot >= 0.15) return;
  const braking = Math.pow(0.04 / (Math.max(1, Math.sqrt(Math.max(1, wheelPower))) * inertiaCompensation), dt);
  vehicle.vx *= braking;
  vehicle.vy *= braking;
}

function clampVehicleSpeed(vehicle, enginePower, wheelPower, massPenalty, engineMaxVelocity) {
  const speed = Math.hypot(vehicle.vx, vehicle.vy);
  const maxSpeed = ((195 + 48 * Math.sqrt(Math.max(0, enginePower))) * engineMaxVelocity + 18 * Math.sqrt(Math.max(0, wheelPower))) / Math.max(0.8, massPenalty);
  if (speed <= maxSpeed) return;
  vehicle.vx = (vehicle.vx / speed) * maxSpeed;
  vehicle.vy = (vehicle.vy / speed) * maxSpeed;
}

function upgradeMultiplier(upgrades, id, amount) {
  return (1 + amount) ** (upgrades?.[id] ?? 0);
}
