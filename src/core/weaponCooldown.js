export function weaponCooldown(game, entry) {
  if (!entry.weaponId || entry.weaponId === 'none' || entry.status === 'lost' || entry.standby) return { remaining: 0, duration: 0 };
  const timers = [];
  const add = (remaining, duration = remaining) => {
    if (Number.isFinite(remaining) && remaining > 0) timers.push({ remaining, duration: Math.max(remaining, duration ?? 0) });
  };
  if (entry.weaponId === 'booster') add(game.boost?.cooldown, game.boost?.cooldownDuration);
  else if (entry.weaponId !== 'scrap_magnet') {
    add(game.weaponInterlock?.remaining, game.weaponInterlock?.duration);
    if (entry.kind === 'secondary' || entry.weaponId === 'tractor_beam') add(game.secondary?.cooldown, game.secondary?.cooldownDuration);
    else {
      const key = `${entry.cellId}:${entry.kind === 'utility' ? 0 : entry.slotIndex ?? 0}:${entry.weaponId}`;
      add(game.primaryWeaponCooldowns?.[key], game.primaryWeaponCooldownDurations?.[key]);
      if (entry.weaponId === 'repulsor_beam' && game.repulsor?.charges <= 0) add(game.repulsor.rechargeTimer, game.repulsor.cooldown);
    }
  }
  return timers.sort((a, b) => b.remaining - a.remaining)[0] ?? { remaining: 0, duration: 0 };
}

export function formatCooldown(seconds) {
  if (!(seconds > 0)) return { value: '', unit: '' };
  if (seconds < 1) return { value: String(Math.min(999, Math.max(1, Math.ceil(seconds * 1000)))).padStart(3, '0'), unit: 'ms' };
  return { value: (seconds >= 1000 ? seconds / 1000 : seconds).toPrecision(3), unit: seconds >= 1000 ? 'ks' : 's' };
}
