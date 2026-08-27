import { createCell, recalculateCell } from './cell.js';
import { createConnection, updateConnectionValidity, connectedFromCore } from './connections.js';
import { applyDamage, CELL_SIZE, createVoxelMask } from './voxelMask.js';
import { localToWorld, rotatePoint, worldToLocal } from './math.js';

export function createStartingVehicle() {
  const cells = [
    createCell('armor-left', 'armor', -1, -1),
    createCell('gun', 'gun', 0, -1),
    createCell('armor-right', 'armor', 1, -1),
    createCell('wheel-left', 'wheel', -1, 0),
    createCell('core', 'core', 0, 0),
    createCell('wheel-right', 'wheel', 1, 0),
    createCell('engine', 'engine', 0, 1),
  ];
  const connections = [
    createConnection('core', 'gun', 'top'),
    createConnection('gun', 'armor-left', 'left', 'right'),
    createConnection('gun', 'armor-right', 'right', 'left'),
    createConnection('core', 'wheel-left', 'left'),
    createConnection('core', 'wheel-right', 'right'),
    createConnection('core', 'engine', 'bottom'),
  ];
  const vehicle = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    heading: 0,
    angularVelocity: 0,
    turretHeading: -Math.PI / 2,
    manualAimGrace: 0,
    cells,
    connections,
    detachedPieces: [],
    totalMass: 1,
    centerOfMass: { x: 0, y: 0 },
    momentOfInertia: 1,
    lastHitCellId: null,
    alive: true,
  };
  recalculateVehicle(vehicle);
  return vehicle;
}

export function recalculateVehicle(vehicle) {
  const attached = vehicle.cells.filter((cell) => cell.attached && !cell.state.destroyed);
  let totalMass = 0;
  let comX = 0;
  let comY = 0;
  for (const cell of attached) {
    const x = cell.gridX * CELL_SIZE + cell.state.centerOfMassLocal.x;
    const y = cell.gridY * CELL_SIZE + cell.state.centerOfMassLocal.y;
    totalMass += cell.state.mass;
    comX += x * cell.state.mass;
    comY += y * cell.state.mass;
  }
  vehicle.totalMass = Math.max(totalMass, 1);
  vehicle.centerOfMass = totalMass > 0 ? { x: comX / totalMass, y: comY / totalMass } : { x: 0, y: 0 };

  let inertia = 0;
  for (const cell of attached) {
    const x = cell.gridX * CELL_SIZE + cell.state.centerOfMassLocal.x - vehicle.centerOfMass.x;
    const y = cell.gridY * CELL_SIZE + cell.state.centerOfMassLocal.y - vehicle.centerOfMass.y;
    inertia += cell.state.mass * (x * x + y * y + CELL_SIZE * CELL_SIZE * 0.16);
  }
  vehicle.momentOfInertia = Math.max(inertia, 1200);
  const core = vehicle.cells.find((cell) => cell.id === 'core');
  vehicle.alive = Boolean(core?.attached && !core.state.destroyed && core.state.deviceIntegrity > 0.05);
  return vehicle;
}

export function applyVehicleDamage(vehicle, worldPoint, radius, damage, impulse = 0, impulseDirection = { x: 0, y: 0 }) {
  const local = worldToLocal(worldPoint, vehicle);
  const cell = findAttachedCellAtLocal(vehicle, local);
  if (!cell) return { hit: false, detached: [] };
  const cellLocalX = local.x - cell.gridX * CELL_SIZE;
  const cellLocalY = local.y - cell.gridY * CELL_SIZE;
  const result = applyDamage(cell.mask, cellLocalX, cellLocalY, radius, damage);
  if (!result.hit) return { hit: false, detached: [] };
  recalculateCell(cell);
  vehicle.lastHitCellId = cell.id;
  applyImpulse(vehicle, worldPoint, impulseDirection, impulse);
  const detached = updateStructure(vehicle);
  recalculateVehicle(vehicle);
  return { hit: true, cell, detached };
}

export function updateStructure(vehicle) {
  const cellsById = new Map(vehicle.cells.map((cell) => [cell.id, cell]));
  updateConnectionValidity(vehicle.connections, cellsById);
  const connected = connectedFromCore(vehicle.cells.filter((cell) => cell.attached), vehicle.connections);
  const detached = [];
  for (const cell of vehicle.cells) {
    if (!cell.attached || cell.state.destroyed) continue;
    if (!connected.has(cell.id)) {
      cell.attached = false;
      detached.push(cell);
      spawnDetachedPiece(vehicle, cell);
    }
  }
  return detached;
}

export function findAttachedCellAtLocal(vehicle, local) {
  return vehicle.cells.find((cell) => {
    if (!cell.attached || cell.state.destroyed) return false;
    const minX = cell.gridX * CELL_SIZE - CELL_SIZE / 2;
    const maxX = minX + CELL_SIZE;
    const minY = cell.gridY * CELL_SIZE - CELL_SIZE / 2;
    const maxY = minY + CELL_SIZE;
    return local.x >= minX && local.x <= maxX && local.y >= minY && local.y <= maxY;
  });
}

export function hasFunctionalGun(vehicle) {
  return vehicle.cells.some((cell) => cell.attached && cell.type === 'gun' && !cell.state.destroyed && cell.state.deviceIntegrity > 0.15);
}

export function gunMuzzleWorld(vehicle, aimHeading = vehicle.turretHeading) {
  const gun = vehicle.cells.find((cell) => cell.attached && cell.type === 'gun' && !cell.state.destroyed);
  if (!gun) return null;
  const base = localToWorld({ x: gun.gridX * CELL_SIZE, y: gun.gridY * CELL_SIZE }, vehicle);
  return { x: base.x + Math.cos(aimHeading) * CELL_SIZE * 0.72, y: base.y + Math.sin(aimHeading) * CELL_SIZE * 0.72 };
}

export function applyImpulse(vehicle, worldPoint, direction, impulse) {
  if (impulse <= 0) return;
  const invMass = 1 / Math.max(vehicle.totalMass, 1);
  vehicle.vx += direction.x * impulse * invMass;
  vehicle.vy += direction.y * impulse * invMass;
  const r = worldToLocal(worldPoint, vehicle);
  const localDir = rotatePoint(direction.x, direction.y, -vehicle.heading);
  const torque = r.x * localDir.y - r.y * localDir.x;
  vehicle.angularVelocity += (torque * impulse) / Math.max(vehicle.momentOfInertia, 1);
}

export function repairVehicleDamage(vehicle, repairPower) {
  let repaired = 0;
  for (const cell of vehicle.cells) {
    if (!cell.attached) continue;
    for (const row of cell.mask) {
      for (const voxel of row) {
        if (voxel.hp >= voxel.maxHp) continue;
        const amount = Math.min(voxel.maxHp - voxel.hp, repairPower - repaired);
        voxel.hp += amount;
        repaired += amount;
        if (repaired >= repairPower) {
          recalculateCell(cell);
          recalculateVehicle(vehicle);
          return repaired;
        }
      }
    }
    recalculateCell(cell);
  }
  if (repaired > 0) updateStructure(vehicle);
  recalculateVehicle(vehicle);
  return repaired;
}

export function replaceDetachedVehicleCell(vehicle) {
  const cell = vehicle.cells.find((candidate) => !candidate.attached);
  if (!cell) return null;
  cell.mask = createVoxelMask(cell.type);
  cell.attached = true;
  recalculateCell(cell);
  vehicle.detachedPieces = vehicle.detachedPieces.filter((piece) => piece.cell !== cell);
  updateStructure(vehicle);
  recalculateVehicle(vehicle);
  return cell;
}

export function countDetachedVehicleCells(vehicle) {
  return vehicle.cells.filter((cell) => !cell.attached).length;
}

export function hasRepairableVehicleDamage(vehicle) {
  return vehicle.cells.some((cell) => cell.attached && cell.mask.some((row) => row.some((voxel) => voxel.hp < voxel.maxHp)));
}

function spawnDetachedPiece(vehicle, cell) {
  const world = localToWorld({ x: cell.gridX * CELL_SIZE, y: cell.gridY * CELL_SIZE }, vehicle);
  const sideKick = rotatePoint(cell.gridX * 30, cell.gridY * 30, vehicle.heading);
  vehicle.detachedPieces.push({
    cell,
    x: world.x,
    y: world.y,
    vx: vehicle.vx + sideKick.x * 0.06,
    vy: vehicle.vy + sideKick.y * 0.06,
    heading: vehicle.heading,
    angularVelocity: vehicle.angularVelocity + (cell.gridX - cell.gridY) * 0.8,
    life: 8,
  });
}
