import { createCell, recalculateCell } from './cell.js';
import { applyDamage, CELL_SIZE, VOXELS } from './voxelMask.js';

const ENEMY_GRID = [
  ['armor', 'armor', 'armor'],
  ['armor', 'core', 'armor'],
  ['armor', 'armor', 'armor'],
];

export function createEnemy(x, y) {
  const cells = [];
  for (let gy = 0; gy < ENEMY_GRID.length; gy += 1) {
    for (let gx = 0; gx < ENEMY_GRID[gy].length; gx += 1) {
      cells.push(createCell(`enemy-${gx}-${gy}`, ENEMY_GRID[gy][gx], gx - 1, gy - 1));
    }
  }
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    radius: CELL_SIZE * 2,
    fireTimer: 0.4,
    burstTimer: 5.5,
    cells,
    damageTaken: 0,
    destroyed: false,
    explosionStart: null,
  };
}

export function applyEnemyDamage(enemy, projectile) {
  const localX = projectile.x - enemy.x;
  const localY = projectile.y - enemy.y;
  const cell = enemy.cells.find((candidate) => {
    if (candidate.state.destroyed) return false;
    const minX = candidate.gridX * CELL_SIZE - CELL_SIZE / 2;
    const minY = candidate.gridY * CELL_SIZE - CELL_SIZE / 2;
    return localX >= minX && localX <= minX + CELL_SIZE && localY >= minY && localY <= minY + CELL_SIZE;
  });
  if (!cell) return { hit: false, removed: 0, destroyedNow: false };
  const result = applyDamage(
    cell.mask,
    localX - cell.gridX * CELL_SIZE,
    localY - cell.gridY * CELL_SIZE,
    projectile.radius * 3.4,
    projectile.damage,
  );
  if (!result.hit) return { hit: false, removed: 0, destroyedNow: false };
  recalculateCell(cell);
  enemy.damageTaken += projectile.damage + result.removed * 3;
  const wasDestroyed = enemy.destroyed;
  updateEnemyDestroyed(enemy);
  return { hit: true, cell, removed: result.removed, destroyedNow: !wasDestroyed && enemy.destroyed };
}

export function traceEnemyVoxelRay(enemies, start, angle, maxLength) {
  const step = CELL_SIZE / VOXELS / 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let distance = 0; distance <= maxLength; distance += step) {
    const point = {
      x: start.x + dx * distance,
      y: start.y + dy * distance,
    };
    const hit = findEnemyVoxelAt(enemies, point);
    if (hit) return { ...hit, x: point.x, y: point.y, distance };
  }
  return {
    enemy: null,
    cell: null,
    voxel: null,
    x: start.x + dx * maxLength,
    y: start.y + dy * maxLength,
    distance: maxLength,
  };
}

function findEnemyVoxelAt(enemies, worldPoint) {
  for (const enemy of enemies) {
    if (enemy.destroyed) continue;
    const localX = worldPoint.x - enemy.x;
    const localY = worldPoint.y - enemy.y;
    for (const cell of enemy.cells) {
      if (cell.state.destroyed) continue;
      const cellLocalX = localX - cell.gridX * CELL_SIZE;
      const cellLocalY = localY - cell.gridY * CELL_SIZE;
      if (Math.abs(cellLocalX) > CELL_SIZE / 2 || Math.abs(cellLocalY) > CELL_SIZE / 2) continue;
      const voxelX = Math.floor(((cellLocalX + CELL_SIZE / 2) / CELL_SIZE) * VOXELS);
      const voxelY = Math.floor(((cellLocalY + CELL_SIZE / 2) / CELL_SIZE) * VOXELS);
      const voxel = cell.mask[voxelY]?.[voxelX];
      if (voxel?.hp > 0) return { enemy, cell, voxel };
    }
  }
  return null;
}

export function updateEnemyDestroyed(enemy) {
  const core = enemy.cells.find((cell) => cell.type === 'core');
  const surviving = enemy.cells.filter((cell) => !cell.state.destroyed);
  enemy.destroyed = Boolean(core?.state.destroyed || surviving.length <= 2);
  return enemy.destroyed;
}

export function enemyIntegrity(enemy) {
  const total = enemy.cells.length;
  const remaining = enemy.cells.filter((cell) => !cell.state.destroyed).length;
  return total === 0 ? 0 : remaining / total;
}
