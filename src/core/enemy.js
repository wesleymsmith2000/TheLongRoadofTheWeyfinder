import { recalculateCell } from './cell.js';
import { instantiateConstruct } from './constructDefinition.js';
import { createPatternState } from './patternDefinition.js';
import { applyDamage, applyNearestDamage, CELL_LAYER_HEIGHT, CELL_SIZE, Roles, VOXELS } from './voxelMask.js';
import { clamp } from './math.js';
import basicTurretDefinition from '../../content/constructs/basic_turret.json' with { type: 'json' };
import enemyAimedShotDefinition from '../../content/patterns/enemy_aimed_shot.json' with { type: 'json' };
import enemyRadialBurstDefinition from '../../content/patterns/enemy_radial_burst.json' with { type: 'json' };
import rotatableBossCannonDefinition from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.rotatable_boss_cannon_sculpted.json' with { type: 'json' };
import { createCell } from './cell.js';
import { createConnection } from './connections.js';

const BASIC_ENEMY_PATTERNS = [enemyAimedShotDefinition, enemyRadialBurstDefinition];
export const ENEMY_MODULE_LINEAR_SCALE = 2;
const WALKER_SUPPORT_ROLES = new Set(['supportLeg', 'legArmor', 'legJoint']);
const WALKER_BODY_ROLES = new Set(['elevatedBody', 'turretGun']);
const ZEPPELIN_VISUAL_SCALE = 2.25;
const ZEPPELIN_BASE_ELEVATION = CELL_LAYER_HEIGHT * 14;
const ZEPPELIN_SHELL_HP_MULTIPLIER = 5;

export function createEnemy(x, y, definition = basicTurretDefinition, patternDefinitions = BASIC_ENEMY_PATTERNS, options = {}) {
  const construct = instantiateConstruct(definition);
  return enlargeEnemyModules({
    assetId: construct.assetId,
    x,
    y,
    vx: 0,
    vy: 0,
    presentation: construct.presentation,
    poseRig: construct.poseRig,
    radius: constructRadius(construct.cells),
    patterns: patternDefinitions.map((pattern) => createPatternState(pattern)),
    cells: construct.cells,
    connections: construct.connections,
    damageTaken: 0,
    destroyed: false,
    explosionStart: null,
    kind: 'standard',
  }, options.moduleScale ?? ENEMY_MODULE_LINEAR_SCALE);
}

export function createEnhancedEnemy(x, y) {
  const enemy = createEnemy(x, y, basicTurretDefinition, BASIC_ENEMY_PATTERNS, { moduleScale: 1 });
  enemy.kind = 'enhanced';
  addMobileEnemyEngines(enemy);
  enemy.charge = { state: 'idle', timer: 1.8, x: 0, y: 1 };
  enemy.shieldActive = false;
  return enlargeEnemyModules(enemy);
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
    addCell('port-engine', 'engine', -1, -2, sternCarve);
    addCell('starboard-engine', 'engine', 1, -2, sternCarve);
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
    connect(connections, 'stern-left', 'port-engine', 'top');
    connect(connections, 'stern-right', 'starboard-engine', 'top');
  }

  return enlargeEnemyModules({
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
  }, options.moduleScale ?? ENEMY_MODULE_LINEAR_SCALE);
}

function addMobileEnemyEngines(enemy) {
  const left = createCell('engine-left', 'engine', -1, 1);
  const right = createCell('engine-right', 'engine', 1, 1);
  enemy.cells.push(left, right);
  enemy.connections.push(createConnection('armor-left-bottom', left.id, 'bottom'));
  enemy.connections.push(createConnection('armor-right-bottom', right.id, 'bottom'));
  enemy.radius = constructRadius(enemy.cells);
  return enemy;
}

export function createEnhancedPirateShipEnemy(x, y) {
  const enemy = createPirateShipEnemy(x, y, { kind: 'enhanced', ramBulkhead: true });
  enemy.charge = { state: 'idle', timer: 1.8, x: 0, y: 1 };
  enemy.shieldActive = false;
  return enemy;
}

export function createMortarSkiffEnemy(x, y) {
  const cells = [];
  const connections = [];
  const addCell = (id, type, gridX, gridY, carve = null) => {
    const cell = createCell(id, type, gridX, gridY);
    if (carve) carveVoxelMask(cell, carve);
    cells.push(cell);
    return cell;
  };

  addCell('stern', 'armor', 0, -1, sternCarve);
  addCell('port-hull', 'armor', -1, 0, sternCarve);
  addCell('core', 'core', 0, 0);
  addCell('mortar-gun', 'gun', 1, 0, sideGunCarve);
  addCell('bow', 'armor', 0, 1, bowPointCarve);

  connect(connections, 'core', 'stern', 'top');
  connect(connections, 'core', 'port-hull', 'left');
  connect(connections, 'core', 'mortar-gun', 'right');
  connect(connections, 'core', 'bow', 'bottom');

  return enlargeEnemyModules({
    assetId: 'enemy.mortar_skiff.prototype0',
    archetypeId: 'mortar_skiff.prototype0',
    displayName: 'Dizzy Mortar Skiff',
    x,
    y,
    vx: 0,
    vy: 0,
    radius: constructRadius(cells),
    patterns: [],
    cells,
    connections,
    damageTaken: 0,
    destroyed: false,
    explosionStart: null,
    kind: 'standard',
    silhouette: 'pirateShip',
    mortarSkiff: true,
    visualHeading: Math.PI / 2,
    artilleryTimer: 1.8,
    roamTimer: 0,
    dizzyTimer: 0,
  });
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

  return enlargeEnemyModules({
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
  });
}

export function createZeppelinBossEnemy(x, y) {
  const cells = [];
  const connections = [];
  const byKey = new Map();
  const addCell = (id, type, gridX, gridY, gridZ, role = undefined) => {
    const cell = createCell(id, type, gridX, gridY, gridZ);
    if (role) cell.role = role;
    cells.push(cell);
    byKey.set(`${gridX},${gridY},${gridZ}`, cell);
    return cell;
  };

  const lengthRadius = 11;
  const widthRadius = 6;
  const heightRadius = 3;
  let armorIndex = 0;
  let liningIndex = 0;
  for (let zOffset = -heightRadius; zOffset <= heightRadius; zOffset += 1) {
    for (let yOffset = -widthRadius; yOffset <= widthRadius; yOffset += 1) {
      for (let xOffset = -lengthRadius; xOffset <= lengthRadius; xOffset += 1) {
        const normalized =
          (xOffset * xOffset) / (lengthRadius * lengthRadius) +
          (yOffset * yOffset) / (widthRadius * widthRadius) +
          (zOffset * zOffset) / (heightRadius * heightRadius);
        if (normalized > 1.05) continue;
        const inner =
          (xOffset * xOffset) / ((lengthRadius - 2) * (lengthRadius - 2)) +
          (yOffset * yOffset) / ((widthRadius - 2) * (widthRadius - 2)) +
          (zOffset * zOffset) / Math.max(0.001, (heightRadius - 1) * (heightRadius - 1));
        if (inner < 0.82) continue;
        const type = inner < 1.18 ? 'armor' : 'armor';
        const role = inner < 1.18 ? 'innerLining' : 'zeppelinHull';
        addCell(`${role}-${role === 'innerLining' ? liningIndex++ : armorIndex++}`, type, xOffset, yOffset, zOffset + 4, role);
      }
    }
  }

  carveZeppelinCannonSocket(cells, byKey, 0, 0, 1);
  addCell('core-undercarriage', 'core', 0, 0, 1, 'zeppelinCore');
  addCell('port-fin', 'armor', -11, -6, 4, 'zeppelinFin');
  addCell('starboard-fin', 'armor', -11, 6, 4, 'zeppelinFin');
  addCell('dorsal-fin', 'armor', -11, 0, 8, 'zeppelinFin');
  addCell('port-thruster', 'engine', -13, -3, 4, 'zeppelinThruster');
  addCell('starboard-thruster', 'engine', -13, 3, 4, 'zeppelinThruster');
  attachZeppelinCannonConstruct(cells, connections, byKey, 'port-cannon', 0, -6, 3, 0);
  attachZeppelinCannonConstruct(cells, connections, byKey, 'starboard-cannon', 0, 6, 3, 2);
  attachZeppelinCannonConstruct(cells, connections, byKey, 'forward-cannon', 10, 0, 3, 1);

  for (const cell of cells) {
    if (cell.type === 'armor' && ['zeppelinHull', 'innerLining', 'zeppelinFin'].includes(cell.role)) {
      multiplyCellVoxelHp(cell, ZEPPELIN_SHELL_HP_MULTIPLIER);
    }
  }

  for (const cell of cells) {
    for (const [dx, dy, dz, side] of [
      [1, 0, 0, 'right'],
      [0, 1, 0, 'bottom'],
      [0, 0, 1, 'above'],
    ]) {
      const neighbor = byKey.get(`${cell.gridX + dx},${cell.gridY + dy},${(cell.gridZ ?? 0) + dz}`);
      if (neighbor) connections.push(createConnection(cell.id, neighbor.id, side));
    }
  }
  connect(connections, 'core-undercarriage', 'innerLining-0', 'above');

  return {
    assetId: 'boss.zeppelin.prototype0',
    kind: 'zeppelinBoss',
    archetypeId: 'boss.zeppelin.prototype0',
    displayName: 'Prototype Zeppelin Boss',
    x,
    y,
    vx: 0,
    vy: 0,
    radius: constructRadius(cells) * ZEPPELIN_VISUAL_SCALE,
    radiusIncludesVisualScale: true,
    visualScale: ZEPPELIN_VISUAL_SCALE,
    patterns: [],
    cells,
    connections,
    damageTaken: 0,
    destroyed: false,
    explosionStart: null,
    visualHeading: Math.PI / 2,
    elevation: { z: ZEPPELIN_BASE_ELEVATION, canBeHitByGroundFire: false, arcCollision: true, layeredExposure: true },
    zeppelin: {
      phase: 'turn',
      runCount: 0,
      turnTimer: 0,
      atsCooldown: 1.4,
      laserCooldown: 2.2,
      harpoonSpawnTimer: 0,
      walkerDropPending: false,
      innerLiningTotal: Math.max(1, liningIndex),
      meltdownTimer: null,
    },
  };
}

function multiplyCellVoxelHp(cell, multiplier) {
  for (const row of cell.mask) {
    for (const voxel of row) {
      if (voxel.hp <= 0 || voxel.maxHp <= 0) continue;
      voxel.hp *= multiplier;
      voxel.maxHp *= multiplier;
    }
  }
  recalculateCell(cell);
}

function attachZeppelinCannonConstruct(cells, connections, byKey, prefix, anchorX, anchorY, anchorZ, rotationTurns = 0) {
  const construct = instantiateConstruct(rotatableBossCannonDefinition);
  const idMap = new Map();
  const barrelTipY = Math.min(...construct.cells.filter((cell) => cell.role === 'cannonBarrel').map((cell) => cell.gridY));
  let attachCellId = null;
  for (const source of construct.cells) {
    const rotated = rotateGridQuarterTurns(source.gridX, source.gridY, rotationTurns);
    carveZeppelinCannonSocket(cells, byKey, anchorX + rotated.x, anchorY + rotated.y, anchorZ + (source.gridZ ?? source.layer ?? 0));
    const clone = {
      ...source,
      id: `${prefix}:${source.id}`,
      type: source.type === 'core' ? 'armor' : source.type,
      gridX: anchorX + rotated.x,
      gridY: anchorY + rotated.y,
      gridZ: anchorZ + (source.gridZ ?? source.layer ?? 0),
      layer: anchorZ + (source.gridZ ?? source.layer ?? 0),
      role: source.role === 'cannonBarrel' && source.gridY === barrelTipY ? 'zeppelinCannon' : `zeppelin${capitalize(source.role ?? source.type)}`,
      mask: structuredClone(source.mask),
      state: null,
    };
    recalculateCell(clone);
    cells.push(clone);
    byKey.set(`${clone.gridX},${clone.gridY},${clone.gridZ}`, clone);
    idMap.set(source.id, clone.id);
    if (source.id === 'core_x0_y0') attachCellId = clone.id;
  }
  for (const edge of construct.connections ?? []) {
    const a = idMap.get(edge.a);
    const b = idMap.get(edge.b);
    if (a && b) connections.push(createConnection(a, b, edge.aSide, edge.bSide, edge.type));
  }
  if (attachCellId) connections.push(createConnection('core-undercarriage', attachCellId, 'above', 'bottom', 'structural'));
}

function carveZeppelinCannonSocket(cells, byKey, gridX, gridY, gridZ) {
  const key = `${gridX},${gridY},${gridZ}`;
  const existing = byKey.get(key);
  if (!existing || !['zeppelinHull', 'innerLining'].includes(existing.role)) return;
  const index = cells.indexOf(existing);
  if (index >= 0) cells.splice(index, 1);
  byKey.delete(key);
}

function rotateGridQuarterTurns(x, y, turns = 0) {
  const normalized = ((Math.round(turns) % 4) + 4) % 4;
  if (normalized === 1) return { x: -y, y: x };
  if (normalized === 2) return { x: -x, y: -y };
  if (normalized === 3) return { x: y, y: -x };
  return { x, y };
}

function capitalize(value) {
  const text = String(value);
  return `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`;
}

function connect(connections, a, b, side, type = 'structural') {
  connections.push(createConnection(a, b, side, undefined, type));
}

function enlargeEnemyModules(enemy, linearScale = ENEMY_MODULE_LINEAR_SCALE) {
  const factor = Math.max(1, Math.floor(linearScale));
  if (factor <= 1 || enemy.moduleLinearScale >= factor) return enemy;
  const cells = [];
  for (const cell of enemy.cells) {
    if (cell.type === 'core') {
      cells.push(cloneEnemyCell(cell, cell.id, cell.gridX, cell.gridY));
      continue;
    }
    for (let y = 0; y < factor; y += 1) {
      for (let x = 0; x < factor; x += 1) {
        const id = x === 0 && y === 0 ? cell.id : `${cell.id}__${x}_${y}`;
        cells.push(cloneEnemyCell(cell, id, expandedGridCoordinate(cell.gridX, x, factor), expandedGridCoordinate(cell.gridY, y, factor)));
      }
    }
  }
  enemy.cells = cells;
  enemy.connections = moduleAdjacencyConnections(cells);
  enemy.radius = constructRadius(cells);
  enemy.moduleLinearScale = factor;
  return enemy;
}

function cloneEnemyCell(cell, id, gridX, gridY) {
  const clone = {
    ...cell,
    id,
    gridX,
    gridY,
    gridZ: cell.gridZ ?? cell.layer ?? 0,
    layer: cell.gridZ ?? cell.layer ?? 0,
    mask: structuredClone(cell.mask),
    state: null,
  };
  recalculateCell(clone);
  return clone;
}

function expandedGridCoordinate(value, index, factor) {
  if (value < 0) return value * factor + index;
  if (value > 0) return value * factor - (factor - 1) + index;
  return index - Math.floor(factor / 2);
}

function moduleAdjacencyConnections(cells) {
  const byPosition = new Map(cells.map((cell) => [`${cell.gridX},${cell.gridY}`, cell]));
  const connections = [];
  for (const cell of cells) {
    const right = byPosition.get(`${cell.gridX + 1},${cell.gridY}`);
    const bottom = byPosition.get(`${cell.gridX},${cell.gridY + 1}`);
    if (right) connections.push(createConnection(cell.id, right.id, 'right'));
    if (bottom) connections.push(createConnection(cell.id, bottom.id, 'bottom'));
  }
  return connections;
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

function enemyIncomingDamageScale(enemy, projectile) {
  if (enemy.kind !== 'zeppelinBoss' || enemy.harpoonField) return 1;
  if (projectile?.behavior === 'arc' || projectile?.behavior === 'blast') return 0.08;
  return 0;
}

export function applyEnemyDamage(enemy, projectile) {
  if (enemy.kind === 'zeppelinBoss' && !enemy.harpoonField && projectile?.behavior !== 'arc') {
    return { hit: false, removed: 0, destroyedNow: false };
  }
  const scale = enemyVisualScale(enemy);
  const local = enemyWorldToLocal(enemy, projectile);
  const localX = local.x;
  const localY = local.y;
  const localProjectile = {
    ...projectile,
    radius: (projectile.radius ?? 0) / scale,
    damage: projectile.damage * enemyIncomingDamageScale(enemy, projectile),
  };
  const harpoonLiftedShot = enemy.kind === 'zeppelinBoss' && enemy.harpoonField && projectile?.behavior !== 'arc';
  const zeppelinGlancingHit = enemy.kind === 'zeppelinBoss' && !enemy.harpoonField;
  const candidateCells = cachedEnemyCellsForDirectDamage(enemy, {
    groundOnly: projectile?.behavior !== 'arc' && !harpoonLiftedShot,
    topFirst: projectile?.behavior === 'arc' || harpoonLiftedShot,
  });
  let cell = null;
  for (const candidate of candidateCells) {
    if (candidate.state.destroyed) continue;
    if (zeppelinGlancingHit && (candidate.type === 'core' || candidate.role === 'zeppelinCore')) continue;
    const minX = candidate.gridX * CELL_SIZE - CELL_SIZE / 2;
    const minY = candidate.gridY * CELL_SIZE - CELL_SIZE / 2;
    if (localX < minX || localX > minX + CELL_SIZE || localY < minY || localY > minY + CELL_SIZE) continue;
    cell = candidate;
    break;
  }
  if (!cell) return { hit: false, removed: 0, destroyedNow: false };
  const result = applyDamage(
    cell.mask,
    localX - cell.gridX * CELL_SIZE,
    localY - cell.gridY * CELL_SIZE,
    localProjectile.radius * 3.4,
    localProjectile.damage,
  );
  if (!result.hit) {
    const fallback = damageNearestLiveVoxel(cell, localX - cell.gridX * CELL_SIZE, localY - cell.gridY * CELL_SIZE, localProjectile);
    if (!fallback.hit) return { hit: false, removed: 0, destroyedNow: false };
    recalculateCell(cell);
    enemy.damageTaken += fallback.damage + fallback.removed * 3;
    const wasDestroyed = enemy.destroyed;
    const collapse = collapseExposedArmorLayers(enemy);
    invalidateEnemyRuntimeCaches(enemy);
    enemy.damageTaken += collapse.removed * 3;
    updateEnemyDestroyed(enemy);
    return { hit: true, cell, removed: fallback.removed + collapse.removed, destroyedNow: !wasDestroyed && enemy.destroyed };
  }
  recalculateCell(cell);
  enemy.damageTaken += localProjectile.damage + result.removed * 3;
  const wasDestroyed = enemy.destroyed;
  const collapse = collapseExposedArmorLayers(enemy);
  invalidateEnemyRuntimeCaches(enemy);
  enemy.damageTaken += collapse.removed * 3;
  updateEnemyDestroyed(enemy);
  return { hit: true, cell, removed: result.removed + collapse.removed, destroyedNow: !wasDestroyed && enemy.destroyed };
}

function damageNearestLiveVoxel(cell, localX, localY, projectile) {
  return applyNearestDamage(cell.mask, localX, localY, projectile.damage, {
    maxDistance: Math.max(projectile.radius * 3.4, CELL_SIZE),
    minFalloff: 0.5,
  });
}

export function applyEnemyVoxelDamage(enemy, hit, damage) {
  if (enemy.destroyed || !hit?.cell || hit.cell.state.destroyed || !hit?.voxelIndex) return { hit: false, removed: 0, destroyedNow: false };
  const voxel = hit.cell.mask[hit.voxelIndex.y]?.[hit.voxelIndex.x];
  if (!voxel || voxel.hp <= 0) return { hit: false, removed: 0, destroyedNow: false };
  const wasDestroyed = enemy.destroyed;
  const before = voxel.hp;
  voxel.hp = Math.max(0, voxel.hp - damage);
  const removed = before > 0 && voxel.hp <= 0 ? 1 : 0;
  recalculateCell(hit.cell);
  enemy.damageTaken += damage + removed * 3;
  const collapse = collapseExposedArmorLayers(enemy);
  invalidateEnemyRuntimeCaches(enemy);
  enemy.damageTaken += collapse.removed * 3;
  updateEnemyDestroyed(enemy);
  return { hit: true, cell: hit.cell, removed: removed + collapse.removed, damage, destroyedNow: !wasDestroyed && enemy.destroyed };
}

export function applyEnemyProjectilePierceDamage(enemies, projectile, options = {}) {
  const pierce = Math.max(0, Math.floor(projectile.pierce ?? 0));
  if (pierce <= 0 || projectile.damage <= 0) return { hit: false, removed: 0, destroyedNow: false, destroyedEnemies: [], hitEnemies: [] };
  const angle = options.angle ?? projectile.angle ?? Math.atan2(projectile.vy, projectile.vx);
  const unit = CELL_SIZE / VOXELS;
  const start = options.start ?? {
    x: projectile.x + Math.cos(angle) * unit,
    y: projectile.y + Math.sin(angle) * unit,
  };
  const maxLength = options.maxLength ?? unit * (pierce + 2) * 2.4;
  const maxHits = options.maxHits ?? pierce;
  const halfWidth = options.halfWidth ?? Math.max(0, projectile.radius ?? 0);
  let power = projectile.damage * (options.damageScale ?? projectile.pierceDamageScale ?? 0.7);
  const falloff = projectile.pierceDamageFalloff ?? 0.68;
  const hits = traceEnemyVoxelPierceLine(enemies, start, angle, maxLength, maxHits, halfWidth, {
    groundOnly: options.groundOnly ?? (projectile?.behavior !== 'arc'),
  });
  let hit = false;
  let removed = 0;
  let damage = 0;
  let destroyedNow = false;
  const destroyedEnemies = [];
  const hitEnemies = [];
  const hitEnemySet = new Set();
  for (const voxelHit of hits) {
    if (power <= 0.05) break;
    const result = applyEnemyVoxelDamage(voxelHit.enemy, voxelHit, power);
    if (!result.hit) continue;
    hit = true;
    if (!hitEnemySet.has(voxelHit.enemy)) {
      hitEnemySet.add(voxelHit.enemy);
      hitEnemies.push(voxelHit.enemy);
    }
    removed += result.removed;
    damage += result.damage ?? power;
    if (result.destroyedNow) {
      destroyedNow = true;
      destroyedEnemies.push(voxelHit.enemy);
    }
    power = Math.max(0, power - voxelHit.maxHpBeforeDamage) * falloff;
  }
  return { hit, removed, damage, remainingDamage: power, destroyedNow, destroyedEnemies, hitEnemies };
}

export function applyEnemyBlastDamage(enemy, origin, options = {}) {
  if (enemy.destroyed) return { hit: false, removed: 0, destroyedNow: false };
  const voxelSize = (CELL_SIZE / VOXELS) * enemyVisualScale(enemy);
  const maxDistance = options.maxVoxelDistance ?? 20;
  const closeDistance = options.closeVoxelDistance ?? 5;
  const closePenetration = options.closePenetration ?? 3;
  const farPenetration = options.farPenetration ?? 1;
  const damage = (options.damage ?? 18) * enemyIncomingDamageScale(enemy, { behavior: 'blast', team: origin?.team, weapon: origin?.weapon });
  const zeppelinGlancingHit = enemy.kind === 'zeppelinBoss' && !enemy.harpoonField;
  const wasDestroyed = enemy.destroyed;
  let hit = false;
  let removed = 0;
  const propagationLoss = options.propagationLoss ?? 0.18;
  const changedCells = new Set();
  const shellDepths = enemyLiveVoxelShellDepths(enemy);

  for (const cell of enemy.cells) {
    if (cell.state.destroyed) continue;
    if (zeppelinGlancingHit && (cell.type === 'core' || cell.role === 'zeppelinCore')) continue;
    let cellRemoved = 0;
    let cellHit = false;
    for (let vy = 0; vy < VOXELS; vy += 1) {
      for (let vx = 0; vx < VOXELS; vx += 1) {
        const voxel = cell.mask[vy][vx];
        if (voxel.hp <= 0) continue;
        const world = enemyVoxelWorldCenter3d(enemy, cell, vx, vy);
        const distanceVoxels = distance3d(world, origin) / voxelSize;
        if (distanceVoxels > maxDistance) continue;
        const penetration = blastPenetration(distanceVoxels, closeDistance, maxDistance, closePenetration, farPenetration);
        if (enemyVoxelShellDepth(shellDepths, cell, vx, vy) > penetration) continue;
        const falloff = clamp(1 - distanceVoxels / maxDistance, 0.35, 1);
        const before = voxel.hp;
        const appliedDamage = damage * falloff;
        voxel.hp = Math.max(0, voxel.hp - appliedDamage);
        hit = true;
        cellHit = true;
        if (before > 0 && voxel.hp <= 0) {
          removed += 1;
          cellRemoved += 1;
          const excess = Math.max(0, appliedDamage - before) * (1 - propagationLoss);
          const propagated = propagateBlastExcess(enemy, cell, vx, vy, origin, maxDistance, penetration, excess, shellDepths);
          removed += propagated.removed;
          cellRemoved += propagated.removed;
          for (const changedCell of propagated.changedCells) changedCells.add(changedCell);
        }
      }
    }
    if (!cellHit && enemyCellIntersectsBlast(enemy, cell, origin, maxDistance * voxelSize)) {
      const fallback = applyEnemyBlastFallback(enemy, cell, origin, {
        damage,
        maxDistance,
        closeDistance,
        closePenetration,
        farPenetration,
        voxelSize,
        shellDepths,
      });
      if (fallback.hit) {
        hit = true;
        cellHit = true;
        removed += fallback.removed;
        cellRemoved += fallback.removed;
      }
    }
    if (cellHit) recalculateCell(cell);
    if (cellRemoved > 0) enemy.damageTaken += cellRemoved * 3;
  }

  for (const cell of changedCells) recalculateCell(cell);
  const collapse = collapseExposedArmorLayers(enemy);
  if (hit || collapse.removed > 0) invalidateEnemyRuntimeCaches(enemy);
  removed += collapse.removed;
  enemy.damageTaken += collapse.removed * 3;
  if (hit) enemy.damageTaken += damage * 0.35;
  updateEnemyDestroyed(enemy);
  return { hit, removed, destroyedNow: !wasDestroyed && enemy.destroyed };
}

function propagateBlastExcess(enemy, sourceCell, sourceVx, sourceVy, origin, maxDistance, penetration, initialPower, shellDepths) {
  let power = initialPower;
  let removed = 0;
  let current = enemyVoxelWorldCenter3d(enemy, sourceCell, sourceVx, sourceVy);
  const visited = new Set([`${sourceCell.id}:${sourceVx}:${sourceVy}`]);
  const changedCells = new Set();
  while (power > 0.05) {
    const next = nearestBlastPropagationVoxel(enemy, current, origin, maxDistance, penetration + removed, visited, shellDepths);
    if (!next) break;
    visited.add(`${next.cell.id}:${next.vx}:${next.vy}`);
    const before = next.voxel.hp;
    next.voxel.hp = Math.max(0, next.voxel.hp - power);
    changedCells.add(next.cell);
    if (before > 0 && next.voxel.hp <= 0) {
      removed += 1;
      power = Math.max(0, power - before) * 0.82;
      current = next.world;
      continue;
    }
    power = 0;
  }
  return { removed, changedCells };
}

function nearestBlastPropagationVoxel(enemy, from, origin, maxDistance, penetration, visited, shellDepths) {
  const voxelSize = (CELL_SIZE / VOXELS) * enemyVisualScale(enemy);
  let nearest = null;
  for (const cell of enemy.cells) {
    if (cell.state.destroyed) continue;
    for (let vy = 0; vy < VOXELS; vy += 1) {
      for (let vx = 0; vx < VOXELS; vx += 1) {
        const key = `${cell.id}:${vx}:${vy}`;
        if (visited.has(key)) continue;
        const voxel = cell.mask[vy][vx];
        if (voxel.hp <= 0) continue;
        if (enemyVoxelShellDepth(shellDepths, cell, vx, vy) > penetration + 1) continue;
        const world = enemyVoxelWorldCenter3d(enemy, cell, vx, vy);
        const originDistance = distance3d(world, origin) / voxelSize;
        if (originDistance > maxDistance) continue;
        const stepDistance = distance3d(world, from);
        if (!nearest || stepDistance < nearest.distance) nearest = { cell, vx, vy, voxel, world, distance: stepDistance };
      }
    }
  }
  return nearest;
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
          vx: (rng?.range(-17.5, 17.5) ?? 0) + enemy.vx * 0.15,
          vy: (rng?.range(-17.5, 17.5) ?? 0) + enemy.vy * 0.15,
          value: 1,
          radius: Math.max(1.1, unit * 0.55),
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

export function traceEnemyVoxelRay(enemies, start, angle, maxLength, pierce = 0, options = {}) {
  const step = CELL_SIZE / VOXELS / 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const pierced = new Set();
  for (let distance = 0; distance <= maxLength; distance += step) {
    const point = {
      x: start.x + dx * distance,
      y: start.y + dy * distance,
    };
    const hit = findEnemyVoxelAt(enemies, point, options);
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

export function traceEnemyVoxelBeam(enemies, start, angle, maxLength, halfWidth = 0, pierce = 0, options = {}) {
  const unit = CELL_SIZE / VOXELS;
  const sampleStep = Math.max(unit * 0.5, halfWidth <= 0 ? unit : halfWidth / 3);
  const laneCount = halfWidth <= unit * 0.5 ? 1 : Math.max(1, Math.ceil((halfWidth * 2) / sampleStep) + 1);
  const laneSpacing = laneCount === 1 ? 0 : (halfWidth * 2) / (laneCount - 1);
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  const hitsByVoxel = new Map();
  const traceOptions = { ...options, cellCache: options.cellCache ?? new Map() };
  const candidateEnemies = enemiesNearTracePath(enemies, start, angle, maxLength, halfWidth + CELL_SIZE);

  for (let lane = 0; lane < laneCount; lane += 1) {
    const offset = laneCount === 1 ? 0 : -halfWidth + lane * laneSpacing;
    const laneStart = { x: start.x + nx * offset, y: start.y + ny * offset };
    for (const hit of traceEnemyVoxelPierceLine(candidateEnemies, laneStart, angle, maxLength, pierce, 0, traceOptions)) {
      const key = enemyVoxelKey(hit);
      const existing = hitsByVoxel.get(key);
      if (!existing || hit.distance < existing.distance) hitsByVoxel.set(key, hit);
    }
  }

  const hits = [...hitsByVoxel.values()].sort((a, b) => a.distance - b.distance);
  const endDistance = hits.length > 0 ? Math.min(maxLength, Math.max(...hits.map((hit) => hit.distance))) : maxLength;
  return {
    hits,
    x: start.x + Math.cos(angle) * endDistance,
    y: start.y + Math.sin(angle) * endDistance,
    distance: endDistance,
  };
}

function traceEnemyVoxelPierceLine(enemies, start, angle, maxLength, pierce = 0, halfWidth = 0, options = {}) {
  const step = CELL_SIZE / VOXELS / 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;
  const hitsByVoxel = new Map();
  const pierced = new Set();
  const maxHits = Math.max(1, Math.floor(pierce) + 1);
  const laneCount = halfWidth <= step ? 1 : Math.min(9, Math.max(3, Math.ceil((halfWidth * 2) / step) + 1));
  const laneSpacing = laneCount === 1 ? 0 : (halfWidth * 2) / (laneCount - 1);
  const traceOptions = options.cellCache ? options : { ...options, cellCache: new Map() };
  const candidateEnemies = enemiesNearTracePath(enemies, start, angle, maxLength, halfWidth + CELL_SIZE);
  for (let distance = 0; distance <= maxLength; distance += step) {
    for (let lane = 0; lane < laneCount; lane += 1) {
      const offset = laneCount === 1 ? 0 : -halfWidth + lane * laneSpacing;
      const point = {
        x: start.x + dx * distance + nx * offset,
        y: start.y + dy * distance + ny * offset,
      };
      const hit = findEnemyVoxelAt(candidateEnemies, point, traceOptions) ?? findNearestEnemyVoxelInCellAt(candidateEnemies, point, traceOptions);
      if (!hit) continue;
      const key = enemyVoxelKey(hit);
      if (pierced.has(key)) continue;
      pierced.add(key);
      hitsByVoxel.set(key, { ...hit, maxHpBeforeDamage: hit.voxel.hp, x: point.x, y: point.y, distance });
      if (hitsByVoxel.size >= maxHits) break;
    }
    if (hitsByVoxel.size >= maxHits) break;
  }
  return [...hitsByVoxel.values()].sort((a, b) => a.distance - b.distance);
}

function enemiesNearTracePath(enemies, start, angle, maxLength, margin = 0) {
  const end = {
    x: start.x + Math.cos(angle) * maxLength,
    y: start.y + Math.sin(angle) * maxLength,
  };
  return enemies.filter((enemy) => {
    if (enemy.destroyed) return false;
    const radius = enemyWorldRadius(enemy) + margin;
    return pointSegmentDistanceSquared(enemy, start, end) <= radius * radius;
  });
}

function enemyWorldRadius(enemy) {
  const radius = enemy.radius ?? CELL_SIZE;
  return radius * (enemy.radiusIncludesVisualScale ? 1 : enemyVisualScale(enemy));
}

function pointSegmentDistanceSquared(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0.000001) return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  const closestX = start.x + dx * t;
  const closestY = start.y + dy * t;
  return (point.x - closestX) ** 2 + (point.y - closestY) ** 2;
}

function enemyVoxelKey(hit) {
  return `${hit.enemy.x}:${hit.enemy.y}:${hit.cell.id}:${hit.voxelIndex?.x ?? ''}:${hit.voxelIndex?.y ?? ''}`;
}

function findEnemyVoxelAt(enemies, worldPoint, options = {}) {
  for (const enemy of enemies) {
    if (enemy.destroyed) continue;
    const { x: localX, y: localY } = enemyWorldToLocal(enemy, worldPoint);
    for (const cell of cachedEnemyCellsForDirectDamage(enemy, options)) {
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

function findNearestEnemyVoxelInCellAt(enemies, worldPoint, options = {}) {
  const cellHit = findEnemyCellAt(enemies, worldPoint, options);
  if (!cellHit) return null;
  const unit = CELL_SIZE / VOXELS;
  const candidates = [];
  for (let y = 0; y < VOXELS; y += 1) {
    for (let x = 0; x < VOXELS; x += 1) {
      const voxel = cellHit.cell.mask[y][x];
      if (voxel.hp <= 0) continue;
      const cx = (x + 0.5) * unit - CELL_SIZE / 2;
      const cy = (y + 0.5) * unit - CELL_SIZE / 2;
      candidates.push({
        voxel,
        voxelIndex: { x, y },
        distance: Math.hypot(cellHit.cellLocalX - cx, cellHit.cellLocalY - cy),
      });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.distance - b.distance);
  const nearest = candidates[0];
  return {
    enemy: cellHit.enemy,
    cell: cellHit.cell,
    voxel: nearest.voxel,
    voxelIndex: nearest.voxelIndex,
  };
}

function findEnemyCellAt(enemies, worldPoint, options = {}) {
  for (const enemy of enemies) {
    if (enemy.destroyed) continue;
    const { x: localX, y: localY } = enemyWorldToLocal(enemy, worldPoint);
    for (const cell of cachedEnemyCellsForDirectDamage(enemy, options)) {
      if (cell.state.destroyed) continue;
      const cellLocalX = localX - cell.gridX * CELL_SIZE;
      const cellLocalY = localY - cell.gridY * CELL_SIZE;
      if (Math.abs(cellLocalX) > CELL_SIZE / 2 || Math.abs(cellLocalY) > CELL_SIZE / 2) continue;
      return { enemy, cell, cellLocalX, cellLocalY };
    }
  }
  return null;
}

function applyEnemyBlastFallback(enemy, cell, origin, options) {
  const candidates = [];
  for (let vy = 0; vy < VOXELS; vy += 1) {
    for (let vx = 0; vx < VOXELS; vx += 1) {
      const voxel = cell.mask[vy][vx];
      if (voxel.hp <= 0) continue;
      const world = enemyVoxelWorldCenter3d(enemy, cell, vx, vy);
      const distanceVoxels = distance3d(world, origin) / options.voxelSize;
      const shellDistance = Math.min(distanceVoxels, options.maxDistance);
      const penetration = blastPenetration(shellDistance, options.closeDistance, options.maxDistance, options.closePenetration, options.farPenetration);
      if (enemyVoxelShellDepth(options.shellDepths, cell, vx, vy) > penetration) continue;
      candidates.push({ voxel, distanceVoxels });
    }
  }
  if (candidates.length === 0) return { hit: false, removed: 0 };
  candidates.sort((a, b) => a.distanceVoxels - b.distanceVoxels);
  let removed = 0;
  for (const candidate of candidates.slice(0, options.maxDistance > 8 ? 2 : 1)) {
    const before = candidate.voxel.hp;
    const falloff = clamp(1 - Math.min(candidate.distanceVoxels, options.maxDistance) / Math.max(options.maxDistance, 1), 0.25, 1);
    candidate.voxel.hp = Math.max(0, candidate.voxel.hp - options.damage * falloff);
    if (before > 0 && candidate.voxel.hp <= 0) removed += 1;
  }
  return { hit: true, removed };
}

function enemyCellIntersectsBlast(enemy, cell, origin, radius) {
  const scale = enemyVisualScale(enemy);
  const { x: localX, y: localY } = enemyWorldToLocal(enemy, origin);
  const minX = cell.gridX * CELL_SIZE - CELL_SIZE / 2;
  const maxX = minX + CELL_SIZE;
  const minY = cell.gridY * CELL_SIZE - CELL_SIZE / 2;
  const maxY = minY + CELL_SIZE;
  const dx = localX < minX ? minX - localX : localX > maxX ? localX - maxX : 0;
  const dy = localY < minY ? minY - localY : localY > maxY ? localY - maxY : 0;
  const dz = enemyCellWorldHeight(enemy, cell) - (origin.z ?? 0);
  return Math.hypot(dx * scale, dy * scale, dz) <= radius;
}

function enemyVoxelWorldCenter(enemy, cell, vx, vy) {
  const unit = CELL_SIZE / VOXELS;
  const localX = cell.gridX * CELL_SIZE + (vx + 0.5) * unit - CELL_SIZE / 2;
  const localY = cell.gridY * CELL_SIZE + (vy + 0.5) * unit - CELL_SIZE / 2;
  return enemyLocalToWorld(enemy, { x: localX, y: localY });
}

function enemyVoxelWorldCenter3d(enemy, cell, vx, vy) {
  const world = enemyVoxelWorldCenter(enemy, cell, vx, vy);
  return {
    ...world,
    z: enemyCellWorldHeight(enemy, cell),
  };
}

function enemyCellWorldHeight(enemy, cell) {
  const baseElevation = enemy.elevation?.z ?? 0;
  const layerLift = Math.max(0, cellLayer(cell) - enemyLowestLiveLayer(enemy)) * CELL_LAYER_HEIGHT;
  return baseElevation + layerLift * enemyVisualScale(enemy);
}

function distance3d(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

function cellLayer(cell) {
  return Number.isFinite(cell.gridZ) ? cell.gridZ : Number.isFinite(cell.layer) ? cell.layer : 0;
}

function enemyHasLayeredCells(enemy) {
  const layers = new Set(enemy.cells?.filter((cell) => !cell.state?.destroyed).map(cellLayer));
  return layers.size > 1;
}

function enemyLowestLiveLayer(enemy) {
  let lowest = Infinity;
  for (const cell of enemy.cells ?? []) {
    if (cell.state?.destroyed) continue;
    lowest = Math.min(lowest, cellLayer(cell));
  }
  return Number.isFinite(lowest) ? lowest : 0;
}

function enemyCellsForDirectDamage(enemy, options = {}) {
  const cells = (enemy.cells ?? []).filter((cell) => !cell.state?.destroyed);
  const groundOnly = Boolean(options.groundOnly) && enemyHasLayeredCells(enemy);
  const lowest = groundOnly ? enemyLowestLiveLayer(enemy) : null;
  return cells
    .filter((cell) => !groundOnly || cellLayer(cell) === lowest)
    .sort((a, b) => {
      const layerSort = (options.topFirst ? cellLayer(b) - cellLayer(a) : cellLayer(a) - cellLayer(b));
      return layerSort || a.gridY - b.gridY || a.gridX - b.gridX || a.id.localeCompare(b.id);
    });
}

function cachedEnemyCellsForDirectDamage(enemy, options = {}) {
  const key = `${options.groundOnly ? 'ground' : 'all'}:${options.topFirst ? 'top' : 'bottom'}`;
  if (!options.cellCache) {
    enemy._directDamageCellsCache ??= new Map();
    if (!enemy._directDamageCellsCache.has(key)) enemy._directDamageCellsCache.set(key, enemyCellsForDirectDamage(enemy, options));
    return enemy._directDamageCellsCache.get(key);
  }
  let byEnemy = options.cellCache.get(enemy);
  if (!byEnemy) {
    byEnemy = new Map();
    options.cellCache.set(enemy, byEnemy);
  }
  if (!byEnemy.has(key)) byEnemy.set(key, enemyCellsForDirectDamage(enemy, options));
  return byEnemy.get(key);
}

function collapseExposedArmorLayers(enemy) {
  if (!enemyHasLayeredCells(enemy)) return { removed: 0 };
  let removed = 0;
  while (enemyHasLayeredCells(enemy)) {
    const lowest = enemyLowestLiveLayer(enemy);
    const lowestCells = (enemy.cells ?? []).filter((cell) => !cell.state?.destroyed && cellLayer(cell) === lowest);
    if (lowestCells.length === 0 || lowestCells.some((cell) => cell.type !== 'armor')) break;
    for (const cell of lowestCells) {
      for (const voxel of cell.mask.flat()) {
        if (voxel.hp > 0) removed += 1;
        voxel.hp = 0;
      }
      recalculateCell(cell);
    }
  }
  removed += collapseUnstableWalkerSupport(enemy).removed;
  return { removed };
}

function collapseUnstableWalkerSupport(enemy) {
  if (!isWalkerSupportConstruct(enemy) || enemy.stability?.fallen) return { removed: 0 };
  let removed = 0;
  let changed = true;
  while (changed) {
    changed = false;
    const bodyLayer = lowestWalkerBodyLayer(enemy);
    const supportLayers = liveWalkerSupportLayers(enemy).filter((layer) => layer < bodyLayer);
    for (const layer of supportLayers) {
      const cells = liveWalkerSupportCells(enemy).filter((cell) => cellLayer(cell) === layer);
      if (cells.length === 0) continue;
      const legs = cells.filter((cell) => cell.role === 'supportLeg');
      if (walkerSupportIsStable(enemy, legs)) continue;
      removed += detachWalkerSupportCells(enemy, cells, `unstable support slice ${layer}`);
      changed = true;
      break;
    }
  }

  const remainingLegs = liveWalkerSupportCells(enemy).filter((cell) => cell.role === 'supportLeg');
  if (!walkerSupportIsStable(enemy, remainingLegs)) {
    const remainingSupport = liveWalkerSupportCells(enemy);
    removed += detachWalkerSupportCells(enemy, remainingSupport, 'walker fall');
    if (remainingSupport.length === 0) recordWalkerFallEvent(enemy, remainingLegs.length === 0 ? 'no live supports' : 'unstable support polygon');
    enemy.stability = {
      ...(enemy.stability ?? {}),
      fallen: true,
      reason: remainingLegs.length === 0 ? 'no live supports' : 'unstable support polygon',
    };
  }
  return { removed };
}

function recordWalkerFallEvent(enemy, reason) {
  const body = (enemy.cells ?? []).filter((cell) => !cell.state?.destroyed && (WALKER_BODY_ROLES.has(cell.role) || cell.type === 'core'));
  const source = body.length > 0 ? body : enemy.cells ?? [];
  const cellCount = Math.max(1, source.length);
  enemy.detachEvents ??= [];
  enemy.detachEvents.push({
    reason: 'walker fall',
    detail: reason,
    cellCount: 0,
    voxels: 0,
    gridX: source.reduce((sum, cell) => sum + cell.gridX, 0) / cellCount,
    gridY: source.reduce((sum, cell) => sum + cell.gridY, 0) / cellCount,
    gridZ: source.reduce((sum, cell) => sum + cellLayer(cell), 0) / cellCount,
  });
}

function isWalkerSupportConstruct(enemy) {
  const cells = enemy.cells ?? [];
  return cells.some((cell) => WALKER_SUPPORT_ROLES.has(cell.role)) && cells.some((cell) => WALKER_BODY_ROLES.has(cell.role) || cell.type === 'core');
}

function liveWalkerSupportCells(enemy) {
  return (enemy.cells ?? []).filter((cell) => !cell.state?.destroyed && WALKER_SUPPORT_ROLES.has(cell.role));
}

function liveWalkerSupportLayers(enemy) {
  return [...new Set(liveWalkerSupportCells(enemy).map(cellLayer))].sort((a, b) => a - b);
}

function lowestWalkerBodyLayer(enemy) {
  const body = (enemy.cells ?? []).filter((cell) => !cell.state?.destroyed && (WALKER_BODY_ROLES.has(cell.role) || cell.type === 'core' || cell.type === 'gun'));
  if (body.length === 0) return Infinity;
  return Math.min(...body.map(cellLayer));
}

function walkerSupportIsStable(enemy, supportLegs) {
  const groups = walkerSupportGroups(enemy, supportLegs);
  if (groups.length <= 1) return false;
  const sides = new Set(groups.map((group) => group.side));
  if (groups.length <= 2 && sides.size <= 1) return false;
  return sides.size >= 2;
}

function walkerSupportGroups(enemy, supportLegs) {
  const centerX = walkerBodyCenterX(enemy);
  const groups = new Map();
  for (const cell of supportLegs) {
    const id = cell.legId ?? cell.supportId ?? `${cell.gridX < centerX ? 'left' : 'right'}:${cell.gridY}`;
    const group = groups.get(id) ?? { id, x: 0, y: 0, count: 0, side: 'right' };
    group.x += cell.gridX;
    group.y += cell.gridY;
    group.count += 1;
    groups.set(id, group);
  }
  return [...groups.values()].map((group) => {
    const x = group.x / group.count;
    return {
      ...group,
      x,
      y: group.y / group.count,
      side: x < centerX ? 'left' : 'right',
    };
  });
}

function walkerBodyCenterX(enemy) {
  const body = (enemy.cells ?? []).filter((cell) => WALKER_BODY_ROLES.has(cell.role) || cell.type === 'core');
  const source = body.length > 0 ? body : enemy.cells ?? [];
  return source.length === 0 ? 0 : source.reduce((sum, cell) => sum + cell.gridX, 0) / source.length;
}

function detachWalkerSupportCells(enemy, cells, reason) {
  let removed = 0;
  let x = 0;
  let y = 0;
  let z = 0;
  let cellCount = 0;
  for (const cell of cells) {
    if (cell.state?.destroyed) continue;
    const cellRemoved = destroyCellVoxels(cell);
    if (cellRemoved <= 0) continue;
    removed += cellRemoved;
    x += cell.gridX;
    y += cell.gridY;
    z += cellLayer(cell);
    cellCount += 1;
  }
  if (removed > 0 && cellCount > 0) {
    enemy.detachEvents ??= [];
    enemy.detachEvents.push({
      reason,
      cellCount,
      voxels: removed,
      gridX: x / cellCount,
      gridY: y / cellCount,
      gridZ: z / cellCount,
    });
  }
  return removed;
}

function destroyCellVoxels(cell) {
  let removed = 0;
  for (const voxel of cell.mask.flat()) {
    if (voxel.hp > 0) removed += 1;
    voxel.hp = 0;
  }
  recalculateCell(cell);
  return removed;
}

function invalidateEnemyRuntimeCaches(enemy) {
  if (!enemy) return;
  enemy.walkerRuntime = null;
  enemy._directDamageCellsCache = null;
  enemy._renderableCellCache = null;
}

export function drainEnemyDetachEvents(enemy) {
  const events = enemy.detachEvents ?? [];
  enemy.detachEvents = [];
  return events;
}

function enemyVisualScale(enemy) {
  return Math.max(0.001, enemy.visualScale ?? 1);
}

function enemyCollisionRotation(enemy) {
  return Number.isFinite(enemy.collisionRotation) ? enemy.collisionRotation : 0;
}

function enemyWorldToLocal(enemy, point) {
  const scale = enemyVisualScale(enemy);
  const dx = (point.x - enemy.x) / scale;
  const dy = (point.y - enemy.y) / scale;
  const rotation = enemyCollisionRotation(enemy);
  if (Math.abs(rotation) <= 0.000001) return { x: dx, y: dy };
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: dx * cos + dy * sin,
    y: -dx * sin + dy * cos,
  };
}

function enemyLocalToWorld(enemy, point) {
  const scale = enemyVisualScale(enemy);
  const rotation = enemyCollisionRotation(enemy);
  if (Math.abs(rotation) <= 0.000001) {
    return {
      x: enemy.x + point.x * scale,
      y: enemy.y + point.y * scale,
    };
  }
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: enemy.x + (point.x * cos - point.y * sin) * scale,
    y: enemy.y + (point.x * sin + point.y * cos) * scale,
  };
}

function blastPenetration(distanceVoxels, closeDistance, maxDistance, closePenetration, farPenetration) {
  if (distanceVoxels <= closeDistance) return closePenetration;
  const t = clamp((distanceVoxels - closeDistance) / Math.max(1, maxDistance - closeDistance), 0, 1);
  return farPenetration + (closePenetration - farPenetration) * (1 - t);
}

function enemyLiveVoxelShellDepths(enemy) {
  const live = new Set();
  for (const cell of enemy.cells) {
    if (cell.state.destroyed) continue;
    for (let vy = 0; vy < VOXELS; vy += 1) {
      for (let vx = 0; vx < VOXELS; vx += 1) {
        if (cell.mask[vy][vx].hp > 0) live.add(enemyVoxelGridKey(cell, vx, vy));
      }
    }
  }

  const depths = new Map();
  const queue = [];
  for (const key of live) {
    const [x, y, z] = key.split(',').map(Number);
    if (
      !live.has(`${x - 1},${y},${z}`) ||
      !live.has(`${x + 1},${y},${z}`) ||
      !live.has(`${x},${y - 1},${z}`) ||
      !live.has(`${x},${y + 1},${z}`)
    ) {
      depths.set(key, 1);
      queue.push({ x, y, z, depth: 1 });
    }
  }

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const [nx, ny] of [
      [current.x - 1, current.y],
      [current.x + 1, current.y],
      [current.x, current.y - 1],
      [current.x, current.y + 1],
    ]) {
      const key = `${nx},${ny},${current.z}`;
      if (!live.has(key) || depths.has(key)) continue;
      depths.set(key, current.depth + 1);
      queue.push({ x: nx, y: ny, z: current.z, depth: current.depth + 1 });
    }
  }

  return depths;
}

function enemyVoxelShellDepth(shellDepths, cell, vx, vy) {
  return shellDepths?.get(enemyVoxelGridKey(cell, vx, vy)) ?? Infinity;
}

function enemyVoxelGridKey(cell, vx, vy) {
  return `${cell.gridX * VOXELS + vx},${cell.gridY * VOXELS + vy},${cellLayer(cell)}`;
}

export function updateEnemyDestroyed(enemy) {
  if (enemy.kind === 'boss') {
    const centralCores = enemy.cells.filter((cell) => cell.id.startsWith('core-'));
    enemy.destroyed = centralCores.length > 0 && centralCores.every((cell) => cell.state.destroyed);
    return enemy.destroyed;
  }
  enemy.destroyed = !enemy.cells.some((cell) => cell.type === 'core' && !cell.state.destroyed);
  return enemy.destroyed;
}

export function enemyIntegrity(enemy) {
  const total = enemy.cells.length;
  const remaining = enemy.cells.filter((cell) => !cell.state.destroyed).length;
  return total === 0 ? 0 : remaining / total;
}

export function enemyGunEfficiency(enemy) {
  return typedCellEfficiency(enemy, 'gun', 0);
}

export function enemyEngineEfficiency(enemy) {
  return typedCellEfficiency(enemy, 'engine', 1);
}

export function enemyCoreEfficiency(enemy) {
  return typedCellEfficiency(enemy, 'core', 1);
}

function typedCellEfficiency(enemy, type, fallback) {
  const cells = enemy.cells.filter((cell) => cell.type === type);
  if (cells.length === 0) return fallback;
  const integrity = cells.reduce((sum, cell) => sum + Math.min(cell.state.deviceIntegrity, cell.state.wiringIntegrity, cell.state.structureIntegrity), 0) / cells.length;
  return clamp(integrity, 0, 1);
}
