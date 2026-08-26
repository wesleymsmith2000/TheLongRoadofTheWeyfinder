import { createCell, recalculateCell } from './cell.js';
import { applyDamage, CELL_SIZE } from './voxelMask.js';

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
  if (!cell) return { hit: false, removed: 0 };
  const result = applyDamage(
    cell.mask,
    localX - cell.gridX * CELL_SIZE,
    localY - cell.gridY * CELL_SIZE,
    projectile.radius * 3.4,
    projectile.damage,
  );
  if (!result.hit) return { hit: false, removed: 0 };
  recalculateCell(cell);
  enemy.damageTaken += projectile.damage + result.removed * 3;
  updateEnemyDestroyed(enemy);
  return { hit: true, cell, removed: result.removed };
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
