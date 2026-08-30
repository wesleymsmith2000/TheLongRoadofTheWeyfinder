import { createProjectile } from './projectile.js';
import { gunMuzzleWorld } from './vehicle.js';
import { CELL_SIZE } from './voxelMask.js';
import { runtimeWeaponDefinition } from './weaponDefinition.js';
import { emitSoundEvent, SOUND_EVENTS } from './soundEvents.js';
import rocketDefinition from '../../content/weapons/rocket.json' with { type: 'json' };
import cannonDefinition from '../../content/weapons/cannon.json' with { type: 'json' };
import beamDefinition from '../../content/weapons/beam.json' with { type: 'json' };

export const SECONDARY_WEAPONS = ['none', 'rocket', 'cannon', 'beam'];

export const SECONDARY_DEFINITIONS = {
  none: { ammo: Infinity, heat: 0, cooldown: 0, projectileSpeed: 0, damage: 0, radius: 0, impulse: 0 },
  rocket: runtimeWeaponDefinition(rocketDefinition),
  cannon: runtimeWeaponDefinition(cannonDefinition),
  beam: runtimeWeaponDefinition(beamDefinition),
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
  const useVehicleVelocityOnly = Boolean(def.usesVehicleVelocityOnly);
  game.playerProjectiles.push(
    createProjectile(muzzle.x, muzzle.y, projectileVelocityX(game, angle, def, useVehicleVelocityOnly), projectileVelocityY(game, angle, def, useVehicleVelocityOnly), {
      team: 'player',
      weapon: secondary.selected,
      behavior: def.behavior,
      angle,
      startX: muzzle.x,
      startY: muzzle.y,
      length: def.length ?? 0,
      turnRate: def.behavior === 'homing' ? def.turnRate : 0,
      acceleration: def.behavior === 'homing' ? def.acceleration : 0,
      maxSpeed: def.behavior === 'homing' ? def.maxSpeed : Infinity,
      targetHint: def.targetHint === 'aimReticle' ? game.aimReticle : null,
      radius: def.radius,
      damage: def.damage,
      impulse: def.impulse,
      blastDamage: def.blastDamage ?? 0,
      blastRadius: def.blastRadius ?? 0,
      blastKnockback: def.blastKnockback ?? 0,
      shrapnelCount: def.shrapnelCount ?? 0,
      shrapnelDamageScale: def.shrapnelDamageScale ?? 1,
      pierce: def.pierce ?? 0,
      frames: def.behavior === 'beam' ? def.frames : 0,
      destructible: def.destructible,
      shape: def.shape,
      contrail: def.contrail,
      lifetime: def.behavior === 'beam' ? def.frames / 60 : def.lifetime,
    }),
  );
  secondary.ammo[secondary.selected] -= 1;
  secondary.heat += def.heat;
  secondary.cooldown = def.cooldown * heatCooldownScale(secondary);
  emitSoundEvent(game, secondary.selected === 'beam' ? SOUND_EVENTS.PLAYER_BEAM : SOUND_EVENTS.PLAYER_SECONDARY_LAUNCH);
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
      damage: base.damage * 0.75 * multiplier(game, 'beamDamage'),
      radius: base.radius + level(game, 'beamWidth') * (CELL_SIZE / 12),
      frames: Math.max(1, Math.round(5 * multiplier(game, 'beamFireTime'))),
      pierce: level(game, 'beamPierce'),
    };
  }
  return base;
}

function projectileVelocityX(game, angle, def, useVehicleVelocityOnly) {
  return useVehicleVelocityOnly ? game.vehicle.vx : Math.cos(angle) * def.projectileSpeed + game.vehicle.vx;
}

function projectileVelocityY(game, angle, def, useVehicleVelocityOnly) {
  return useVehicleVelocityOnly ? game.vehicle.vy : Math.sin(angle) * def.projectileSpeed + game.vehicle.vy;
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
