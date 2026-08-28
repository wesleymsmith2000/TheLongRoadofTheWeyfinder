import { createProjectile } from './projectile.js';
import { gunMuzzleWorld } from './vehicle.js';
import { CELL_SIZE } from './voxelMask.js';

export const SECONDARY_WEAPONS = ['none', 'rocket', 'cannon', 'beam'];

export const SECONDARY_DEFINITIONS = {
  none: { ammo: Infinity, heat: 0, cooldown: 0, projectileSpeed: 0, damage: 0, radius: 0, impulse: 0 },
  rocket: { ammo: 12, heat: 28, cooldown: 0.9, projectileSpeed: 130, damage: 36, radius: 3, impulse: 210 },
  cannon: { ammo: 18, heat: 24, cooldown: 0.93, projectileSpeed: 250, damage: 18, radius: 4, impulse: 340 },
  beam: { ammo: 40, heat: 44, cooldown: 0.55, projectileSpeed: 0, damage: 2.5, radius: 1, impulse: 90 },
};

export function createSecondaryState() {
  return {
    selected: 'rocket',
    ammo: { rocket: 12, cannon: 18, beam: 40 },
    ammoBonus: {},
    heat: 0,
    maxHeat: 100,
    cooldown: 0,
    autofire: false,
  };
}

export function stepSecondaryWeapon(game, input, dt) {
  const secondary = game.secondary;
  if (input.secondarySelect && SECONDARY_WEAPONS.includes(input.secondarySelect)) secondary.selected = input.secondarySelect;
  if (input.secondaryCycle) cycleSecondary(secondary, input.secondaryCycle);
  secondary.autofire = Boolean(input.secondaryAutofire);
  secondary.cooldown = Math.max(0, secondary.cooldown - dt);
  secondary.heat = Math.max(0, secondary.heat - heatSinkRate(game) * dt);
  if (secondary.selected === 'none') return false;
  if (!input.secondaryFirePressed && !(secondary.autofire && game.enemies.some((enemy) => !enemy.destroyed))) return false;
  return fireSecondary(game);
}

export function fireSecondary(game) {
  const secondary = game.secondary;
  const def = upgradedSecondaryDefinition(game, secondary.selected);
  if (!def || secondary.cooldown > 0 || secondary.heat + def.heat > secondary.maxHeat) return false;
  if ((secondary.ammo[secondary.selected] ?? 0) <= 0) return false;
  const muzzle = gunMuzzleWorld(game.vehicle);
  if (!muzzle) return false;
  const angle = game.vehicle.turretHeading;
  const behavior = secondary.selected === 'rocket' ? 'homing' : secondary.selected === 'beam' ? 'beam' : 'ballistic';
  const droppedRocket = secondary.selected === 'rocket';
  game.playerProjectiles.push(
    createProjectile(muzzle.x, muzzle.y, projectileVelocityX(game, angle, def, droppedRocket), projectileVelocityY(game, angle, def, droppedRocket), {
      team: 'player',
      weapon: secondary.selected,
      behavior,
      angle,
      startX: muzzle.x,
      startY: muzzle.y,
      length: secondary.selected === 'beam' ? 640 : 0,
      turnRate: secondary.selected === 'rocket' ? def.turnRate : 0,
      acceleration: secondary.selected === 'rocket' ? def.acceleration : 0,
      maxSpeed: secondary.selected === 'rocket' ? def.maxSpeed : Infinity,
      targetHint: secondary.selected === 'rocket' ? game.aimReticle : null,
      radius: def.radius,
      damage: def.damage,
      impulse: def.impulse,
      blastDamage: def.blastDamage ?? 0,
      blastRadius: def.blastRadius ?? 0,
      blastKnockback: def.blastKnockback ?? 0,
      shrapnelCount: def.shrapnelCount ?? 0,
      shrapnelDamageScale: def.shrapnelDamageScale ?? 1,
      pierce: def.pierce ?? 0,
      frames: secondary.selected === 'beam' ? def.frames : 0,
      lifetime: secondary.selected === 'rocket' ? 5.8 : secondary.selected === 'beam' ? def.frames / 60 : 1.6,
    }),
  );
  secondary.ammo[secondary.selected] -= 1;
  secondary.heat += def.heat;
  secondary.cooldown = def.cooldown * heatCooldownScale(secondary);
  return true;
}

export function secondaryAmmoCapacity(weapon) {
  return SECONDARY_DEFINITIONS[weapon]?.ammo ?? 0;
}

function cycleSecondary(secondary, direction) {
  const current = SECONDARY_WEAPONS.indexOf(secondary.selected);
  const next = (current + direction + SECONDARY_WEAPONS.length) % SECONDARY_WEAPONS.length;
  secondary.selected = SECONDARY_WEAPONS[next];
}

function upgradedSecondaryDefinition(game, weapon) {
  const base = SECONDARY_DEFINITIONS[weapon];
  if (!base) return null;
  if (weapon === 'cannon') {
    return {
      ...base,
      cooldown: base.cooldown / multiplier(game, 'cannonFireRate'),
      damage: base.damage * multiplier(game, 'cannonImpactDamage'),
      impulse: base.impulse * multiplier(game, 'cannonKnockback'),
      blastDamage: 9 * multiplier(game, 'cannonBlastDamage'),
      blastRadius: CELL_SIZE * 2.55 * multiplier(game, 'cannonBlastRadius'),
      blastKnockback: 110 * multiplier(game, 'cannonKnockback'),
      shrapnelCount: 28 + level(game, 'cannonShrapnelCount'),
      shrapnelDamageScale: multiplier(game, 'cannonShrapnelDamage'),
    };
  }
  if (weapon === 'rocket') {
    return {
      ...base,
      cooldown: base.cooldown / multiplier(game, 'rocketFireRate'),
      damage: base.damage * multiplier(game, 'rocketImpactDamage'),
      impulse: base.impulse * multiplier(game, 'rocketKnockback'),
      blastDamage: 4.5 * multiplier(game, 'rocketBlastDamage'),
      blastRadius: CELL_SIZE * 1.275 * multiplier(game, 'rocketBlastRadius'),
      blastKnockback: 55 * multiplier(game, 'rocketKnockback'),
      maxSpeed: base.projectileSpeed * multiplier(game, 'rocketMaxVelocity'),
      turnRate: 2.5 * multiplier(game, 'rocketTurning'),
      acceleration: 90,
    };
  }
  if (weapon === 'beam') {
    return {
      ...base,
      cooldown: base.cooldown / multiplier(game, 'beamFireRate'),
      heat: Math.max(1, base.heat * reduction(game, 'beamHeatEfficiency')),
      damage: base.damage * multiplier(game, 'beamDamage'),
      radius: base.radius + level(game, 'beamWidth') * (CELL_SIZE / 6),
      frames: Math.max(1, Math.round(5 * multiplier(game, 'beamFireTime'))),
      pierce: level(game, 'beamPierce'),
    };
  }
  return base;
}

function projectileVelocityX(game, angle, def, droppedRocket) {
  return droppedRocket ? game.vehicle.vx : Math.cos(angle) * def.projectileSpeed + game.vehicle.vx;
}

function projectileVelocityY(game, angle, def, droppedRocket) {
  return droppedRocket ? game.vehicle.vy : Math.sin(angle) * def.projectileSpeed + game.vehicle.vy;
}

function heatSinkRate(game) {
  return 22 * multiplier(game, 'beamHeatSink', 0.1);
}

function heatCooldownScale(secondary) {
  return 1 / Math.max(0.08, 1 - secondary.heat / secondary.maxHeat);
}

function level(game, id) {
  return game.upgrades?.[id] ?? 0;
}

function multiplier(game, id, amount = 0.05) {
  return (1 + amount) ** level(game, id);
}

function reduction(game, id, amount = 0.05) {
  return (1 - amount) ** level(game, id);
}
