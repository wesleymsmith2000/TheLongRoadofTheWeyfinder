import { recalculateCell } from './cell.js';
import { instantiateConstruct } from './constructDefinition.js';
import { createPatternState } from './patternDefinition.js';
import { applyDamage, CELL_SIZE, VOXELS } from './voxelMask.js';
import { clamp } from './math.js';
import basicTurretDefinition from '../../content/constructs/basic_turret.json' with { type: 'json' };
import enemyAimedShotDefinition from '../../content/patterns/enemy_aimed_shot.json' with { type: 'json' };
import enemyRadialBurstDefinition from '../../content/patterns/enemy_radial_burst.json' with { type: 'json' };

const BASIC_ENEMY_PATTERNS = [enemyAimedShotDefinition, enemyRadialBurstDefinition];

export function createEnemy(x, y, definition = basicTurretDefinition, patternDefinitions = BASIC_ENEMY_PATTERNS) {
  const construct = instantiateConstruct(definition);
  return {
    assetId: construct.assetId,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: constructRadius(construct.cells),
    patterns: patternDefinitions.map((pattern) => createPatternState(pattern)),
    cells: construct.cells,
    connections: construct.connections,
    damageTaken: 0,
    destroyed: false,
    explosionStart: null,
  };
}

function constructRadius(cells) {
  return cells.reduce((radius, cell) => {
    const distance = Math.hypot(cell.gridX * CELL_SIZE, cell.gridY * CELL_SIZE) + CELL_SIZE * 0.75;
    return Math.max(radius, distance);
  }, CELL_SIZE);
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

export function applyEnemyBlastDamage(enemy, origin, options = {}) {
  if (enemy.destroyed) return { hit: false, removed: 0, destroyedNow: false };
  const voxelSize = CELL_SIZE / VOXELS;
  const maxDistance = options.maxVoxelDistance ?? 20;
  const closeDistance = options.closeVoxelDistance ?? 5;
  const closePenetration = options.closePenetration ?? 3;
  const farPenetration = options.farPenetration ?? 1;
  const damage = options.damage ?? 18;
  const wasDestroyed = enemy.destroyed;
  let hit = false;
  let removed = 0;

  for (const cell of enemy.cells) {
    if (cell.state.destroyed) continue;
    let cellRemoved = 0;
    let cellHit = false;
    for (let vy = 0; vy < VOXELS; vy += 1) {
      for (let vx = 0; vx < VOXELS; vx += 1) {
        const voxel = cell.mask[vy][vx];
        if (voxel.hp <= 0) continue;
        const world = enemyVoxelWorldCenter(enemy, cell, vx, vy);
        const distanceVoxels = Math.hypot(world.x - origin.x, world.y - origin.y) / voxelSize;
        if (distanceVoxels > maxDistance) continue;
        const penetration = blastPenetration(distanceVoxels, closeDistance, maxDistance, closePenetration, farPenetration);
        if (enemyVoxelShellDepth(cell, vx, vy) > penetration) continue;
        const before = voxel.hp;
        const falloff = clamp(1 - distanceVoxels / maxDistance, 0.35, 1);
        voxel.hp = Math.max(0, voxel.hp - damage * falloff);
        hit = true;
        cellHit = true;
        if (before > 0 && voxel.hp <= 0) {
          removed += 1;
          cellRemoved += 1;
        }
      }
    }
    if (cellHit) recalculateCell(cell);
    if (cellRemoved > 0) enemy.damageTaken += cellRemoved * 3;
  }

  if (hit) enemy.damageTaken += damage * 0.35;
  updateEnemyDestroyed(enemy);
  return { hit, removed, destroyedNow: !wasDestroyed && enemy.destroyed };
}

export function harvestEnemyScrap(enemy, rng) {
  const pickups = [];
  const unit = CELL_SIZE / VOXELS;
  for (const cell of enemy.cells) {
    let changed = false;
    for (let vy = 0; vy < VOXELS; vy += 1) {
      for (let vx = 0; vx < VOXELS; vx += 1) {
        const voxel = cell.mask[vy][vx];
        if (voxel.hp <= 0) continue;
        const world = enemyVoxelWorldCenter(enemy, cell, vx, vy);
        const jitter = rng ? { x: rng.range(-unit, unit), y: rng.range(-unit, unit) } : { x: 0, y: 0 };
        pickups.push({
          x: world.x + jitter.x,
          y: world.y + jitter.y,
          vx: (rng?.range(-35, 35) ?? 0) + enemy.vx * 0.15,
          vy: (rng?.range(-35, 35) ?? 0) + enemy.vy * 0.15,
          value: 1,
          radius: Math.max(2.2, unit * 0.55),
          life: 18,
        });
        voxel.hp = 0;
        changed = true;
      }
    }
    if (changed) recalculateCell(cell);
  }
  return pickups;
}

export function traceEnemyVoxelRay(enemies, start, angle, maxLength, pierce = 0) {
  const step = CELL_SIZE / VOXELS / 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const pierced = new Set();
  for (let distance = 0; distance <= maxLength; distance += step) {
    const point = {
      x: start.x + dx * distance,
      y: start.y + dy * distance,
    };
    const hit = findEnemyVoxelAt(enemies, point);
    if (!hit) continue;
    const key = enemyVoxelKey(hit);
    if (pierced.has(key)) continue;
    if (pierced.size < pierce) {
      pierced.add(key);
      continue;
    }
    return { ...hit, x: point.x, y: point.y, distance };
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

function enemyVoxelKey(hit) {
  return `${hit.enemy.x}:${hit.enemy.y}:${hit.cell.id}:${hit.voxelIndex?.x ?? ''}:${hit.voxelIndex?.y ?? ''}`;
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
      if (voxel?.hp > 0) return { enemy, cell, voxel, voxelIndex: { x: voxelX, y: voxelY } };
    }
  }
  return null;
}

function enemyVoxelWorldCenter(enemy, cell, vx, vy) {
  const unit = CELL_SIZE / VOXELS;
  return {
    x: enemy.x + cell.gridX * CELL_SIZE + (vx + 0.5) * unit - CELL_SIZE / 2,
    y: enemy.y + cell.gridY * CELL_SIZE + (vy + 0.5) * unit - CELL_SIZE / 2,
  };
}

function blastPenetration(distanceVoxels, closeDistance, maxDistance, closePenetration, farPenetration) {
  if (distanceVoxels <= closeDistance) return closePenetration;
  const t = clamp((distanceVoxels - closeDistance) / Math.max(1, maxDistance - closeDistance), 0, 1);
  return farPenetration + (closePenetration - farPenetration) * (1 - t);
}

function enemyVoxelShellDepth(cell, vx, vy) {
  const gridX = (cell.gridX + 1) * VOXELS + vx;
  const gridY = (cell.gridY + 1) * VOXELS + vy;
  return Math.min(gridX, gridY, VOXELS * 3 - 1 - gridX, VOXELS * 3 - 1 - gridY) + 1;
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
