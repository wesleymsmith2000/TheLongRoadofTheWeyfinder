import { clamp } from './math.js';

export const CELL_SIZE = 10;
export const VOXELS = 6;

export const Roles = {
  EMPTY: 'empty',
  STRUCTURE: 'structure',
  ARMOR: 'armor',
  ANCHOR: 'anchor',
  WIRE: 'wire',
  DEVICE: 'device',
};

const ROLE_HP = {
  [Roles.EMPTY]: 0,
  [Roles.STRUCTURE]: 5,
  [Roles.ARMOR]: 8,
  [Roles.ANCHOR]: 7,
  [Roles.WIRE]: 4,
  [Roles.DEVICE]: 6,
};

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

  if (type === 'gun') {
    setRole(voxels, 2, 1, Roles.DEVICE);
    setRole(voxels, 3, 1, Roles.DEVICE);
    setRole(voxels, 2, 2, Roles.WIRE);
    setRole(voxels, 3, 2, Roles.WIRE);
  } else if (type === 'core') {
    for (let y = 2; y <= 3; y += 1) {
      for (let x = 2; x <= 3; x += 1) setRole(voxels, x, y, Roles.DEVICE);
    }
  } else if (type === 'wheel') {
    setRole(voxels, 1, 2, Roles.DEVICE);
    setRole(voxels, 1, 3, Roles.DEVICE);
    setRole(voxels, 4, 2, Roles.DEVICE);
    setRole(voxels, 4, 3, Roles.DEVICE);
  } else if (type === 'engine') {
    setRole(voxels, 2, 2, Roles.DEVICE);
    setRole(voxels, 3, 2, Roles.DEVICE);
    setRole(voxels, 2, 3, Roles.WIRE);
    setRole(voxels, 3, 3, Roles.WIRE);
  }

  return voxels;
}

function setRole(voxels, x, y, role) {
  voxels[y][x] = { role, hp: ROLE_HP[role], maxHp: ROLE_HP[role] };
}

export function applyDamage(mask, localX, localY, radius, damage) {
  let removed = 0;
  let hit = false;
  const unit = CELL_SIZE / VOXELS;
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
  const unit = CELL_SIZE / VOXELS;

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
