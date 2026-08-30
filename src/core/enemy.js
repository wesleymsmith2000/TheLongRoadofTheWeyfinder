import { recalculateCell } from './cell.js';
import { instantiateConstruct } from './constructDefinition.js';
import { createPatternState } from './patternDefinition.js';
import { applyDamage, CELL_SIZE, Roles, VOXELS } from './voxelMask.js';
import { clamp } from './math.js';
import basicTurretDefinition from '../../content/constructs/basic_turret.json' with { type: 'json' };
import enemyAimedShotDefinition from '../../content/patterns/enemy_aimed_shot.json' with { type: 'json' };
import enemyRadialBurstDefinition from '../../content/patterns/enemy_radial_burst.json' with { type: 'json' };
import { createCell } from './cell.js';
import { createConnection } from './connections.js';

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
    kind: 'standard',
  };
}

export function createEnhancedEnemy(x, y) {
  const enemy = createEnemy(x, y);
  enemy.kind = 'enhanced';
  enemy.charge = { state: 'idle', timer: 1.8, x: 0, y: 1 };
  enemy.shieldActive = false;
  return enemy;
}

export function createPirateShipEnemy(x, y, options = {}) {
  const cells = [];
  const connections = [];
  const addCell = (id, type, gridX, gridY, carve = null) => {
    const cell = createCell(id, type, gridX, gridY);
    if (carve) carveVoxelMask(cell, carve);
    cells.push(cell);
    return cell;
  };

  addCell('stern-left', 'armor', -1, -1, sternCarve);
  addCell('stern', 'armor', 0, -1);
  addCell('stern-right', 'armor', 1, -1, sternCarve);
  addCell('port-gun', 'gun', -2, 0, sideGunCarve);
  addCell('port-hull', 'armor', -1, 0);
  addCell('core', 'core', 0, 0);
  addCell('starboard-hull', 'armor', 1, 0);
  addCell('starboard-gun', 'gun', 2, 0, sideGunCarve);
  addCell('bow-left', 'armor', -1, 1, bowShoulderCarve);
  addCell('bow-center', 'armor', 0, 1);
  addCell('bow-right', 'armor', 1, 1, bowShoulderCarve);
  addCell('bow', 'armor', 0, 2, bowPointCarve);

  if (options.ramBulkhead) {
    addCell('skull-bulkhead', 'armor', 0, 3, bowPointCarve);
    addCell('bulkhead-port-spike', 'gun', -1, 3, spikeCarve);
    addCell('bulkhead-starboard-spike', 'gun', 1, 3, spikeCarve);
  }

  connect(connections, 'core', 'port-hull', 'left');
  connect(connections, 'core', 'starboard-hull', 'right');
  connect(connections, 'core', 'stern', 'top');
  connect(connections, 'core', 'bow-center', 'bottom');
  connect(connections, 'port-hull', 'port-gun', 'left');
  connect(connections, 'starboard-hull', 'starboard-gun', 'right');
  connect(connections, 'stern', 'stern-left', 'left');
  connect(connections, 'stern', 'stern-right', 'right');
  connect(connections, 'bow-center', 'bow-left', 'left');
  connect(connections, 'bow-center', 'bow-right', 'right');
  connect(connections, 'bow-center', 'bow', 'bottom');
  if (options.ramBulkhead) {
    connect(connections, 'bow', 'skull-bulkhead', 'bottom');
    connect(connections, 'skull-bulkhead', 'bulkhead-port-spike', 'left');
    connect(connections, 'skull-bulkhead', 'bulkhead-starboard-spike', 'right');
  }

  return {
    assetId: options.ramBulkhead ? 'enemy.pirate_ram_ship.prototype0' : 'enemy.pirate_ship.prototype0',
    x,
    y,
    vx: 0,
    vy: 0,
    radius: constructRadius(cells),
    patterns: BASIC_ENEMY_PATTERNS.map((pattern) => createPatternState(pattern)),
    cells,
    connections,
    damageTaken: 0,
    destroyed: false,
    explosionStart: null,
    kind: options.kind ?? 'standard',
    silhouette: 'pirateShip',
    ramBulkhead: Boolean(options.ramBulkhead),
    visualHeading: Math.PI / 2,
  };
}

export function createEnhancedPirateShipEnemy(x, y) {
  const enemy = createPirateShipEnemy(x, y, { kind: 'enhanced', ramBulkhead: true });
  enemy.charge = { state: 'idle', timer: 1.8, x: 0, y: 1 };
  enemy.shieldActive = false;
  return enemy;
}

export function createBossEnemy(x, y, rng) {
  const cells = [];
  const connections = [];
  const addCell = (id, type, gridX, gridY) => {
    const cell = createCell(id, type, gridX, gridY);
    cells.push(cell);
    return cell;
  };
  for (const [id, gridX, gridY] of [
    ['core-a', 0, 0],
    ['core-b', 1, 0],
    ['core-c', 0, 1],
    ['core-d', 1, 1],
  ]) addCell(id, 'core', gridX, gridY);

  let armorIndex = 0;
  for (let yOffset = -2; yOffset <= 3; yOffset += 1) {
    for (let xOffset = -2; xOffset <= 3; xOffset += 1) {
      const inCore = xOffset >= 0 && xOffset <= 1 && yOffset >= 0 && yOffset <= 1;
      const corner = (xOffset === -2 || xOffset === 3) && (yOffset === -2 || yOffset === 3);
      if (!inCore && !corner) addCell(`boss-armor-${armorIndex++}`, 'armor', xOffset, yOffset);
    }
  }

  const directions = [
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
  ];
  const arms = [];
  for (let armIndex = 0; armIndex < directions.length; armIndex += 1) {
    const direction = directions[armIndex];
    const arm = {
      index: armIndex,
      direction,
      aim: { x: x + direction.x * CELL_SIZE * 8, y: y + direction.y * CELL_SIZE * 8 },
      phase: rng?.range(0, Math.PI * 2) ?? 0,
      fireTimer: rng?.range(0.8, 2.4) ?? 1.2,
      laser: null,
    };
    arms.push(arm);
    let previousId = null;
    for (let segment = 0; segment < 8; segment += 1) {
      const gridX = Math.round(0.5 + direction.x * (4 + segment));
      const gridY = Math.round(0.5 + direction.y * (4 + segment));
      const core = addCell(`arm-${armIndex}-${segment}-core`, 'core', gridX, gridY);
      const gun = addCell(`arm-${armIndex}-${segment}-gun`, 'gun', gridX + (direction.y || direction.x), gridY + (direction.x ? -direction.x : direction.y));
      connections.push(createConnection(core.id, gun.id, 'right', 'left'));
      if (previousId) connections.push(createConnection(previousId, core.id, 'right', 'left', 'tentacle'));
      previousId = core.id;
    }
  }

  return {
    assetId: 'boss.octopus.prototype0',
    kind: 'boss',
    x,
    y,
    vx: 0,
    vy: 0,
    radius: constructRadius(cells),
    patterns: [],
    cells,
    connections,
    arms,
    armUnfurl: 0,
    centerPulseTimer: 3.2,
    damageTaken: 0,
    destroyed: false,
    explosionStart: null,
  };
}

function connect(connections, a, b, side, type = 'structural') {
  connections.push(createConnection(a, b, side, undefined, type));
}

function carveVoxelMask(cell, keep) {
  for (let y = 0; y < VOXELS; y += 1) {
    for (let x = 0; x < VOXELS; x += 1) {
      if (keep(x, y, cell)) continue;
      cell.mask[y][x] = { role: Roles.EMPTY, hp: 0, maxHp: 0 };
    }
  }
  recalculateCell(cell);
}

function bowPointCarve(x, y) {
  return Math.abs(x - (VOXELS - 1) / 2) <= 1.15 + y * 0.46;
}

function bowShoulderCarve(x, y, cell) {
  const towardCenter = cell.gridX < 0 ? x >= y * 0.52 : x <= VOXELS - 1 - y * 0.52;
  return towardCenter;
}

function sternCarve(x, y, cell) {
  const towardCenter = cell.gridX < 0 ? x >= (VOXELS - 1 - y) * 0.34 : x <= VOXELS - 1 - (VOXELS - 1 - y) * 0.34;
  return towardCenter;
}

function sideGunCarve(x, y) {
  return y >= 1 && y <= VOXELS - 2 && x >= 1 && x <= VOXELS - 2;
}

function spikeCarve(x, y, cell) {
  const center = (VOXELS - 1) / 2;
  const width = cell.gridX < 0 ? VOXELS - x : x + 1;
  return Math.abs(y - center) <= width * 0.34;
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
  if (enemy.kind === 'boss') {
    const centralCores = enemy.cells.filter((cell) => cell.id.startsWith('core-'));
    enemy.destroyed = centralCores.length > 0 && centralCores.every((cell) => cell.state.destroyed);
    return enemy.destroyed;
  }
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
