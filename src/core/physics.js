import { angleDelta, clamp } from './math.js';
import { SAFE_TERRAIN_SAMPLE } from './terrainMaterial.js';

export function stepVehicle(vehicle, input, dt, roadHeading = vehicle.heading, upgrades = {}, terrainContact = SAFE_TERRAIN_SAMPLE) {
  if (!vehicle.alive) return;
  const inputX = input.x ?? 0;
  const inputY = input.y ?? 0;
  const inputTurn = input.turn ?? 0;
  const terrain = normalizeTerrainContact(terrainContact);
  const enginePower = typedModulePower(vehicle, 'engine');
  const wheelPower = typedModulePower(vehicle, 'wheel');
  const engineAcceleration = upgradeMultiplier(upgrades, 'engineAcceleration', 0.08);
  const engineMaxVelocity = upgradeMultiplier(upgrades, 'engineMaxVelocity', 0.08);
  const wheelInertiaCompensation = upgradeMultiplier(upgrades, 'wheelInertiaCompensation', 0.08);
  const propulsion = Math.max(0.25, Math.sqrt(Math.max(0.05, enginePower)));
  const turnBalance = vehicle.cells
    .filter((cell) => cell.attached && cell.type === 'wheel')
    .reduce((sum, cell) => sum + cell.gridX * cell.state.deviceIntegrity, 0);
  const pull = turnBalance * 0.35;
  const massPenalty = Math.sqrt(vehicle.totalMass / 120);

  const worldAx = (inputX * 340.5 * propulsion * engineAcceleration * terrain.traction * terrain.accelerationScale) / massPenalty;
  const worldAy = (inputY * 340.5 * propulsion * engineAcceleration * terrain.traction * terrain.accelerationScale) / massPenalty;
  const accel = { x: worldAx, y: worldAy };
  vehicle.vx += accel.x * dt;
  vehicle.vy += accel.y * dt;
  applyWheelGrounding(vehicle, accel, wheelPower, wheelInertiaCompensation * terrain.traction, dt);
  const roadAlignment = angleDelta(vehicle.heading, roadHeading) * 1.4;
  const travelAlignment = travelDirectionAlignment(vehicle, terrain.traction);
  vehicle.angularVelocity += (inputTurn * 3.6 * terrain.traction + inputY * pull * 0.45 * terrain.traction + roadAlignment + travelAlignment) * dt;

  if (input.brake) {
    const brakeGrip = clamp(terrain.traction, 0.18, 1);
    const brakeScale = Math.max(0, terrain.brakingScale) * 1.5 * Math.sqrt(Math.max(0.05, wheelPower));
    vehicle.vx *= Math.pow(1 - (1 - 0.04) * brakeGrip, dt * brakeScale);
    vehicle.vy *= Math.pow(1 - (1 - 0.04) * brakeGrip, dt * brakeScale);
    vehicle.angularVelocity *= Math.pow(1 - (1 - 0.02) * brakeGrip, dt * brakeScale);
  }

  const baseDrag = inputMagnitude(inputX, inputY) > 0.05 ? 0.32 : 0.08 / (Math.max(1, Math.sqrt(Math.max(1, wheelPower))) * wheelInertiaCompensation);
  const tractionDrag = 1 - (1 - baseDrag) * clamp(terrain.traction, 0.05, 1.5);
  const resistanceDrag = clamp(tractionDrag - terrain.rollingResistance * 0.12, 0.02, 0.99);
  const drag = Math.pow(resistanceDrag, dt);
  vehicle.vx *= drag;
  vehicle.vy *= drag;
  clampVehicleSpeed(vehicle, enginePower, wheelPower, massPenalty, engineMaxVelocity, terrain, dt);
  vehicle.angularVelocity *= Math.pow(0.24, dt);
  vehicle.x += vehicle.vx * dt;
  vehicle.y += vehicle.vy * dt;
  vehicle.heading += vehicle.angularVelocity * dt;
  stepVehicleElevation(vehicle, dt);

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

export function typedModulePower(vehicle, type) {
  return vehicle.cells
    .filter((cell) => cell.attached && cell.type === type && !cell.state.destroyed && cell.state.deviceIntegrity > 0.1)
    .reduce((sum, cell) => sum + Math.min(cell.state.deviceIntegrity, cell.state.wiringIntegrity, cell.state.structureIntegrity), 0);
}

function inputMagnitude(x, y) {
  return Math.hypot(x, y);
}

function normalizeTerrainContact(terrainContact) {
  return {
    traction: clamp(terrainContact?.traction ?? SAFE_TERRAIN_SAMPLE.traction, 0.05, 2),
    rollingResistance: clamp(terrainContact?.rollingResistance ?? SAFE_TERRAIN_SAMPLE.rollingResistance, 0, 1),
    accelerationScale: clamp(terrainContact?.accelerationScale ?? 1, 0, 4),
    brakingScale: clamp(terrainContact?.brakingScale ?? 1, 0, 4),
  };
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

function travelDirectionAlignment(vehicle, traction) {
  const speed = Math.hypot(vehicle.vx, vehicle.vy);
  if (speed < 18) return 0;
  const travelHeading = Math.atan2(vehicle.vy, vehicle.vx);
  const speedScale = clamp((speed - 18) / 140, 0, 1);
  return angleDelta(vehicle.heading, travelHeading) * 1.65 * speedScale * clamp(traction, 0.18, 1.2);
}

export function vehicleMaxSpeed(vehicle, upgrades = {}) {
  const enginePower = typedModulePower(vehicle, 'engine');
  const wheelPower = typedModulePower(vehicle, 'wheel');
  const massPenalty = Math.sqrt(vehicle.totalMass / 120);
  const engineMaxVelocity = upgradeMultiplier(upgrades, 'engineMaxVelocity', 0.08);
  return (380 * Math.sqrt(Math.max(0.05, enginePower)) * Math.sqrt(Math.max(0.05, wheelPower)) * engineMaxVelocity) / Math.max(0.8, massPenalty);
}

function clampVehicleSpeed(vehicle, enginePower, wheelPower, massPenalty, engineMaxVelocity, terrain, dt) {
  const speed = Math.hypot(vehicle.vx, vehicle.vy);
  const baseMaxSpeed = (380 * Math.sqrt(Math.max(0.05, enginePower)) * Math.sqrt(Math.max(0.05, wheelPower)) * engineMaxVelocity) / Math.max(0.8, massPenalty);
  const maxSpeed = baseMaxSpeed * Math.max(1, vehicle.maxVelocityScale ?? 1);
  if (speed <= maxSpeed) return;
  if ((vehicle.maxVelocityScale ?? 1) <= 1 && vehicle.boostOverspeed) {
    const brakeScale = 1.5 * Math.sqrt(Math.max(0.05, wheelPower)) * Math.max(0, terrain.brakingScale);
    const retention = Math.pow(0.04, dt * brakeScale);
    const nextSpeed = Math.max(baseMaxSpeed, speed * retention);
    vehicle.vx = (vehicle.vx / speed) * nextSpeed;
    vehicle.vy = (vehicle.vy / speed) * nextSpeed;
    if (nextSpeed <= baseMaxSpeed * 1.001) vehicle.boostOverspeed = false;
    return;
  }
  vehicle.vx = (vehicle.vx / speed) * maxSpeed;
  vehicle.vy = (vehicle.vy / speed) * maxSpeed;
}

export function stepVehicleElevation(vehicle, dt, gravity = 120) {
  vehicle.elevation ??= { z: 0, vz: 0 };
  const elevation = vehicle.elevation;
  elevation.z = Math.max(0, elevation.z ?? 0);
  elevation.vz = elevation.vz ?? 0;
  if (elevation.z <= 0 && elevation.vz <= 0) {
    elevation.z = 0;
    elevation.vz = 0;
    return;
  }
  elevation.z += elevation.vz * dt - 0.5 * gravity * dt * dt;
  elevation.vz -= gravity * dt;
  if (elevation.z <= 0) {
    elevation.z = 0;
    elevation.vz = 0;
  }
}

function upgradeMultiplier(upgrades, id, amount) {
  return (1 + amount) ** (upgrades?.[id] ?? 0);
}
