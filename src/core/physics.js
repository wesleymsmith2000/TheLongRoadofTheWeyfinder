import { angleDelta, rotatePoint } from './math.js';

export function stepVehicle(vehicle, input, dt, roadHeading = vehicle.heading) {
  if (!vehicle.alive) return;
  const inputX = input.x ?? 0;
  const inputY = input.y ?? 0;
  const inputTurn = input.turn ?? 0;
  const engineCount = vehicle.cells.filter((cell) => cell.attached && cell.type === 'engine' && cell.state.deviceIntegrity > 0.1).length;
  const wheelCount = vehicle.cells.filter((cell) => cell.attached && cell.type === 'wheel' && cell.state.deviceIntegrity > 0.1).length;
  const propulsion = Math.max(0.25, engineCount * 0.85 + wheelCount * 0.35);
  const turnBalance = vehicle.cells
    .filter((cell) => cell.attached && cell.type === 'wheel')
    .reduce((sum, cell) => sum + cell.gridX * cell.state.deviceIntegrity, 0);
  const pull = turnBalance * 0.35;
  const massPenalty = Math.sqrt(vehicle.totalMass / 120);

  const localAx = (inputX * 90 * propulsion) / massPenalty;
  const localAy = (inputY * 90 * propulsion) / massPenalty;
  const accel = rotatePoint(localAx, localAy, roadHeading);
  vehicle.vx += accel.x * dt;
  vehicle.vy += accel.y * dt;
  const roadAlignment = angleDelta(vehicle.heading, roadHeading) * 1.4;
  vehicle.angularVelocity += (inputTurn * 3.6 + inputY * pull * 0.45 + roadAlignment) * dt;

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
