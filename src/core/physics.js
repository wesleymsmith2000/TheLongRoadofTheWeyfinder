import { rotatePoint } from './math.js';

export function stepVehicle(vehicle, input, dt) {
  if (!vehicle.alive) return;
  const engineCount = vehicle.cells.filter((cell) => cell.attached && cell.type === 'engine' && cell.state.deviceIntegrity > 0.1).length;
  const wheelCount = vehicle.cells.filter((cell) => cell.attached && cell.type === 'wheel' && cell.state.deviceIntegrity > 0.1).length;
  const propulsion = Math.max(0.25, engineCount * 0.85 + wheelCount * 0.35);
  const turnBalance = vehicle.cells
    .filter((cell) => cell.attached && cell.type === 'wheel')
    .reduce((sum, cell) => sum + cell.gridX * cell.state.deviceIntegrity, 0);
  const pull = turnBalance * 0.35;

  const localAx = input.x * 260 * propulsion;
  const localAy = input.y * 260 * propulsion;
  const accel = rotatePoint(localAx, localAy, vehicle.heading);
  vehicle.vx += (accel.x / vehicle.totalMass) * dt;
  vehicle.vy += (accel.y / vehicle.totalMass) * dt;
  vehicle.angularVelocity += (input.turn * 4.4 + input.y * pull) * dt;

  if (input.brake) {
    vehicle.vx *= Math.pow(0.04, dt);
    vehicle.vy *= Math.pow(0.04, dt);
    vehicle.angularVelocity *= Math.pow(0.02, dt);
  }

  const drag = Math.pow(0.42, dt);
  vehicle.vx *= drag;
  vehicle.vy *= drag;
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
