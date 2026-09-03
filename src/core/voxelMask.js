import { clamp } from './math.js';

export const CELL_SIZE = 4;
export const VOXELS = 4;
export const VOXEL_SIZE = CELL_SIZE / VOXELS;

export const Roles = {
  EMPTY: 'empty',
  STRUCTURE: 'structure',
  ARMOR: 'armor',
  ANCHOR: 'anchor',
  WIRE: 'wire',
  DEVICE: 'device',
};

const LEGACY_VOXELS = 6;
const VOXEL_HP_SCALE = (LEGACY_VOXELS / VOXELS) ** 2;
const BASE_ROLE_HP = {
  [Roles.EMPTY]: 0,
  [Roles.STRUCTURE]: 5,
  [Roles.ARMOR]: 8,
  [Roles.ANCHOR]: 7,
  [Roles.WIRE]: 4,
  [Roles.DEVICE]: 6,
};
const ROLE_HP = Object.fromEntries(Object.entries(BASE_ROLE_HP).map(([role, hp]) => [role, hp * VOXEL_HP_SCALE]));

export function createVoxelMask(type) {
  const voxels = [];
  for (let y = 0; y < VOXELS; y += 1) {
    const row = [];
    for (let x = 0; x < VOXELS; x += 1) {
      let role = Roles.STRUCTURE;
      if (x === 0 || y === 0 || x === VOXELS - 1 || y === VOXELS - 1) role = Roles.ANCHOR;
      if ((x === 1 || x === VOXELS - 2) && (y === 1 || y === VOXELS - 2)) role = Roles.ARMOR;
      row.push({ role, hp: ROLE_HP[role], maxHp: ROLE_HP[role] });
    }
    voxels.push(row);
  }

  const [leftCenter, rightCenter] = centerPair();
  if (type === 'gun') {
    setRoleLine(voxels, Roles.DEVICE, [leftCenter, rightCenter], 1);
    setRoleLine(voxels, Roles.WIRE, [leftCenter, rightCenter], 2);
  } else if (type === 'core') {
    for (const y of [leftCenter, rightCenter]) {
      for (const x of [leftCenter, rightCenter]) setRole(voxels, x, y, Roles.DEVICE);
    }
  } else if (type === 'wheel') {
    for (const y of [leftCenter, rightCenter]) {
      setRole(voxels, 1, y, Roles.DEVICE);
      setRole(voxels, VOXELS - 2, y, Roles.DEVICE);
    }
  } else if (type === 'engine') {
    setRoleLine(voxels, Roles.DEVICE, [leftCenter, rightCenter], leftCenter);
    setRoleLine(voxels, Roles.WIRE, [leftCenter, rightCenter], rightCenter);
  } else if (type === 'utility') {
    setRole(voxels, leftCenter, leftCenter, Roles.DEVICE);
    setRole(voxels, rightCenter, rightCenter, Roles.DEVICE);
    setRole(voxels, rightCenter, leftCenter, Roles.WIRE);
    setRole(voxels, leftCenter, rightCenter, Roles.WIRE);
  }

  return voxels;
}

function centerPair() {
  const right = Math.floor(VOXELS / 2);
  return [Math.max(1, right - 1), Math.min(VOXELS - 2, right)];
}

function setRoleLine(voxels, role, xs, y) {
  for (const x of xs) setRole(voxels, x, y, role);
}

function setRole(voxels, x, y, role) {
  voxels[y][x] = { role, hp: ROLE_HP[role], maxHp: ROLE_HP[role] };
}

export function applyDamage(mask, localX, localY, radius, damage) {
  let removed = 0;
  let hit = false;
  const unit = VOXEL_SIZE;
  for (let y = 0; y < VOXELS; y += 1) {
    for (let x = 0; x < VOXELS; x += 1) {
      const voxel = mask[y][x];
      if (voxel.hp <= 0) continue;
      const cx = (x + 0.5) * unit - CELL_SIZE / 2;
      const cy = (y + 0.5) * unit - CELL_SIZE / 2;
      const dist = Math.hypot(localX - cx, localY - cy);
      if (dist <= radius) {
        hit = true;
        const before = voxel.hp;
        const falloff = clamp(1 - dist / Math.max(radius, 1), 0.25, 1);
        voxel.hp = Math.max(0, voxel.hp - damage * falloff);
        if (before > 0 && voxel.hp <= 0) removed += 1;
      }
    }
  }
  return { hit, removed };
}

export function applyNearestDamage(mask, localX, localY, damage, options = {}) {
  const unit = VOXEL_SIZE;
  const candidates = [];
  for (let y = 0; y < VOXELS; y += 1) {
    for (let x = 0; x < VOXELS; x += 1) {
      const voxel = mask[y][x];
      if (voxel.hp <= 0) continue;
      const cx = (x + 0.5) * unit - CELL_SIZE / 2;
      const cy = (y + 0.5) * unit - CELL_SIZE / 2;
      candidates.push({ voxel, x, y, distance: Math.hypot(localX - cx, localY - cy) });
    }
  }
  if (candidates.length === 0) return { hit: false, removed: 0, damage: 0, voxels: [] };
  candidates.sort((a, b) => a.distance - b.distance);
  const count = Math.max(1, Math.floor(options.count ?? 1));
  const maxDistance = options.maxDistance ?? Math.max(CELL_SIZE, candidates[0].distance);
  let removed = 0;
  let applied = 0;
  const damaged = [];
  for (const candidate of candidates.slice(0, count)) {
    const before = candidate.voxel.hp;
    const falloff = clamp(1 - candidate.distance / Math.max(maxDistance, 1), options.minFalloff ?? 0.35, 1);
    const voxelDamage = damage * falloff;
    candidate.voxel.hp = Math.max(0, candidate.voxel.hp - voxelDamage);
    applied += voxelDamage;
    if (before > 0 && candidate.voxel.hp <= 0) removed += 1;
    damaged.push({ x: candidate.x, y: candidate.y, damage: voxelDamage });
  }
  return { hit: true, removed, damage: applied, voxels: damaged };
}

export function summarizeMask(mask) {
  const summary = {
    mass: 0,
    centerOfMassLocal: { x: 0, y: 0 },
    structureIntegrity: 0,
    armorCoverage: 0,
    wiringIntegrity: 0,
    deviceIntegrity: 0,
    anchorIntegrity: { top: 0, right: 0, bottom: 0, left: 0 },
    destroyed: false,
  };
  const totals = {
    structure: 0,
    armor: 0,
    wire: 0,
    device: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
  const remaining = {
    structure: 0,
    armor: 0,
    wire: 0,
    device: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
  const unit = VOXEL_SIZE;

  for (let y = 0; y < VOXELS; y += 1) {
    for (let x = 0; x < VOXELS; x += 1) {
      const voxel = mask[y][x];
      if (voxel.role === Roles.EMPTY) continue;
      const fraction = voxel.maxHp > 0 ? voxel.hp / voxel.maxHp : 0;
      const key =
        voxel.role === Roles.ANCHOR || voxel.role === Roles.STRUCTURE
          ? 'structure'
          : voxel.role === Roles.ARMOR
            ? 'armor'
            : voxel.role === Roles.WIRE
              ? 'wire'
              : voxel.role === Roles.DEVICE
                ? 'device'
                : null;
      if (key) {
        totals[key] += 1;
        remaining[key] += fraction;
      }
      if (voxel.role === Roles.ANCHOR) {
        if (y === 0) addAnchor('top', fraction);
        if (x === VOXELS - 1) addAnchor('right', fraction);
        if (y === VOXELS - 1) addAnchor('bottom', fraction);
        if (x === 0) addAnchor('left', fraction);
      }
      if (fraction > 0) {
        const mass = voxel.role === Roles.ARMOR ? 1.45 : voxel.role === Roles.DEVICE ? 1.25 : 1;
        const weightedMass = mass * fraction;
        summary.mass += weightedMass;
        summary.centerOfMassLocal.x += ((x + 0.5) * unit - CELL_SIZE / 2) * weightedMass;
        summary.centerOfMassLocal.y += ((y + 0.5) * unit - CELL_SIZE / 2) * weightedMass;
      }
    }
  }

  function addAnchor(side, fraction) {
    totals[side] += 1;
    remaining[side] += fraction;
  }

  if (summary.mass > 0) {
    summary.centerOfMassLocal.x /= summary.mass;
    summary.centerOfMassLocal.y /= summary.mass;
  }

  summary.structureIntegrity = ratio(remaining.structure, totals.structure);
  summary.armorCoverage = ratio(remaining.armor, totals.armor);
  summary.wiringIntegrity = ratio(remaining.wire, totals.wire);
  summary.deviceIntegrity = ratio(remaining.device, totals.device);
  for (const side of Object.keys(summary.anchorIntegrity)) {
    summary.anchorIntegrity[side] = ratio(remaining[side], totals[side]);
  }
  summary.destroyed = summary.mass <= 1.5 || summary.structureIntegrity <= 0.04;
  return summary;
}

function ratio(value, total) {
  return total === 0 ? 1 : clamp(value / total, 0, 1);
}
