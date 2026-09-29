export function createWeaponInterlock() {
  return { remaining: 0, source: null };
}

export function stepWeaponInterlock(game, dt) {
  game.weaponInterlock ??= createWeaponInterlock();
  game.weaponInterlock.remaining = Math.max(0, game.weaponInterlock.remaining - Math.max(0, dt));
  if (game.weaponInterlock.remaining <= 0) game.weaponInterlock.source = null;
}

export function weaponFireBlocked(game) {
  return (game?.weaponInterlock?.remaining ?? 0) > 0;
}

export function applyWeaponInterlock(game, seconds, source = null) {
  game.weaponInterlock ??= createWeaponInterlock();
  game.weaponInterlock.remaining = Math.max(game.weaponInterlock.remaining, Math.max(0, seconds));
  if (game.weaponInterlock.remaining > 0) game.weaponInterlock.source = source;
  return game.weaponInterlock;
}
