import { createProjectile } from './projectile.js';
import { gunMuzzleWorld } from './vehicle.js';

export const SECONDARY_WEAPONS = ['none', 'rocket', 'cannon', 'beam'];

const DEFINITIONS = {
  none: { ammo: Infinity, heat: 0, cooldown: 0, projectileSpeed: 0, damage: 0, radius: 0, impulse: 0 },
  rocket: { ammo: 12, heat: 28, cooldown: 0.9, projectileSpeed: 260, damage: 18, radius: 6, impulse: 420 },
  cannon: { ammo: 18, heat: 20, cooldown: 0.55, projectileSpeed: 520, damage: 14, radius: 5, impulse: 560 },
  beam: { ammo: 40, heat: 12, cooldown: 0.16, projectileSpeed: 780, damage: 7, radius: 3, impulse: 90 },
};

export function createSecondaryState() {
  return {
    selected: 'rocket',
    ammo: { rocket: 12, cannon: 18, beam: 40 },
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
  secondary.heat = Math.max(0, secondary.heat - 22 * dt);
  if (secondary.selected === 'none') return false;
  if (!input.secondaryFirePressed && !(secondary.autofire && !game.enemy.destroyed)) return false;
  return fireSecondary(game);
}

export function fireSecondary(game) {
  const secondary = game.secondary;
  const def = DEFINITIONS[secondary.selected];
  if (!def || secondary.cooldown > 0 || secondary.heat + def.heat > secondary.maxHeat) return false;
  if ((secondary.ammo[secondary.selected] ?? 0) <= 0) return false;
  const muzzle = gunMuzzleWorld(game.vehicle);
  if (!muzzle) return false;
  const angle = game.vehicle.turretHeading;
  game.playerProjectiles.push(
    createProjectile(muzzle.x, muzzle.y, Math.cos(angle) * def.projectileSpeed + game.vehicle.vx, Math.sin(angle) * def.projectileSpeed + game.vehicle.vy, {
      team: 'player',
      weapon: secondary.selected,
      radius: def.radius,
      damage: def.damage,
      impulse: def.impulse,
      lifetime: secondary.selected === 'rocket' ? 3.2 : 1.6,
    }),
  );
  secondary.ammo[secondary.selected] -= 1;
  secondary.heat += def.heat;
  secondary.cooldown = def.cooldown;
  return true;
}

function cycleSecondary(secondary, direction) {
  const current = SECONDARY_WEAPONS.indexOf(secondary.selected);
  const next = (current + direction + SECONDARY_WEAPONS.length) % SECONDARY_WEAPONS.length;
  secondary.selected = SECONDARY_WEAPONS[next];
}
