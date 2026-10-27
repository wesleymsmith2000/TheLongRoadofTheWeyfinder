import { normalizeGunLoadouts, normalizeUtilityLoadouts } from './weaponLoadout.js';

export const INACTIVE_GUN_HINT = 'Gun cell inactive - additional slots open after each zone boss clear';

export function gunSlotActive(game, cellId, kind, index) {
  if (game.runMode !== 'arcade') return true;
  return index === 0 && game.weaponBay?.unlockedSlots?.[cellId]?.[kind]?.[0] === true;
}

export function gunCellInactive(game, cellId) {
  return game.runMode === 'arcade' && !gunSlotActive(game, cellId, 'primary', 0) && !gunSlotActive(game, cellId, 'secondary', 0);
}

export function firingGunLoadouts(game) {
  const explicit = new Set((game.vehicleDefinition.gunLoadouts ?? []).map(loadout => loadout.cellId));
  return normalizeGunLoadouts(game.vehicleDefinition).map(loadout => ({
    cellId: loadout.cellId,
    primary: loadout.primary.map((id, index) => gunSlotActive(game, loadout.cellId, 'primary', index) && !(game.runMode === 'arcade' && (!explicit.has(loadout.cellId) || id === 'mini_beam')) ? id : null),
    secondary: loadout.secondary.map((id, index) => gunSlotActive(game, loadout.cellId, 'secondary', index) && (game.runMode !== 'arcade' || explicit.has(loadout.cellId)) ? id : null),
  }));
}

// Preserve equipment from older, multi-slot Arcade vehicles in the Workshop.
export function prepareArcadeLoadout(definition) {
  const next = structuredClone(definition);
  const recovered = [];
  const explicit = new Map((next.gunLoadouts ?? []).map(loadout => [loadout.cellId, loadout]));
  next.gunLoadouts = normalizeGunLoadouts(next).map(loadout => {
    if (!explicit.has(loadout.cellId)) return { cellId: loadout.cellId, primary: [null], secondary: [null] };
    for (const kind of ['primary', 'secondary']) {
      if (!Array.isArray(explicit.get(loadout.cellId)[kind])) loadout[kind] = [];
      recovered.push(...loadout[kind].slice(1).filter(Boolean));
      loadout[kind] = loadout[kind].slice(0, 1);
    }
    if (loadout.primary[0] === 'mini_beam') {
      recovered.push('mini_beam');
      loadout.primary[0] = null;
    }
    return loadout;
  });
  const utilities = normalizeUtilityLoadouts(next);
  for (let index = recovered.length - 1; index >= 0; index--) {
    if (recovered[index] !== 'mini_beam') continue;
    const utility = utilities.find(entry => entry.slots.includes(null));
    if (!utility) continue;
    utility.slots[utility.slots.indexOf(null)] = 'mini_beam';
    recovered.splice(index, 1);
  }
  next.modules = [...(next.modules ?? []).filter(module => module.kind !== 'utilitySlots'), ...utilities];
  return { definition: next, recovered };
}

export function arcadeSlotFlags(definition, bossClears = 0, startingSlots = 5) {
  const ids = normalizeGunLoadouts(definition).map(loadout => loadout.cellId);
  const flags = Object.fromEntries(ids.map(id => [id, { primary: [false], secondary: [false] }]));
  const initial = ids.flatMap((id, index) => ['primary', 'secondary'].filter(kind => kind === 'primary' ? index < 2 : index < 3).map(kind => ({ id, kind })));
  for (const { id, kind } of initial.slice(0, startingSlots)) flags[id][kind][0] = true;
  const pending = ids.flatMap(id => ['primary', 'secondary'].filter(kind => !flags[id][kind][0]).map(kind => ({ id, kind })));
  for (const { id, kind } of pending.slice(0, Math.max(0, bossClears))) flags[id][kind][0] = true;
  return flags;
}
