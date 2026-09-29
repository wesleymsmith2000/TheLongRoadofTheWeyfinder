export const PRIMARY_WEAPON_IDS = ['main.basic', 'tracking_flechette', 'mortar', 'blade_launcher', 'mini_beam'];
export const SECONDARY_WEAPON_IDS = ['rocket', 'cannon', 'beam', 'sta_missile', 'orb_of_blades'];
export const COMBAT_UTILITY_IDS = ['repulsor_beam', 'tractor_beam'];
export const MAX_PRIMARY_SLOTS = 4;
export const MAX_SECONDARY_SLOTS = 3;

export function defaultGunLoadout(cellId) {
  return {
    cellId,
    primary: ['main.basic'],
    secondary: ['rocket', null, null],
  };
}

export function normalizeGunLoadouts(definition) {
  const loadouts = new Map((definition.gunLoadouts ?? []).map((loadout) => [loadout.cellId, normalizeGunLoadout(loadout)]));
  return definition.cells
    .filter((cell) => cell.type === 'gun')
    .map((cell) => normalizeGunLoadout(loadouts.get(cell.id) ?? defaultGunLoadout(cell.id), cell.id));
}

export function normalizeGunLoadout(loadout, fallbackCellId = loadout?.cellId) {
  const primary = normalizeSlots(loadout?.primary, PRIMARY_WEAPON_IDS, MAX_PRIMARY_SLOTS, 'main.basic');
  const secondary = normalizeSlots(loadout?.secondary, SECONDARY_WEAPON_IDS, MAX_SECONDARY_SLOTS, null);
  return { cellId: fallbackCellId, primary, secondary };
}

export function setGunLoadoutSlot(definition, cellId, slotKind, index, weaponId) {
  const cell = definition.cells.find((candidate) => candidate.id === cellId);
  if (!cell || cell.type !== 'gun') return { changed: false, reason: 'Choose a gun cell first.' };
  if (slotKind !== 'primary' && slotKind !== 'secondary') return { changed: false, reason: 'Unknown weapon slot type.' };
  const maxSlots = slotKind === 'primary' ? MAX_PRIMARY_SLOTS : MAX_SECONDARY_SLOTS;
  const allowed = slotKind === 'primary' ? PRIMARY_WEAPON_IDS : SECONDARY_WEAPON_IDS;
  if (!Number.isInteger(index) || index < 0 || index >= maxSlots) return { changed: false, reason: 'Weapon slot is out of range.' };
  if (weaponId != null && !allowed.includes(weaponId)) return { changed: false, reason: 'That weapon is not available for this slot.' };

  const next = cloneDefinition(definition);
  next.gunLoadouts = normalizeGunLoadouts(next);
  let loadout = next.gunLoadouts.find((candidate) => candidate.cellId === cellId);
  if (!loadout) {
    loadout = defaultGunLoadout(cellId);
    next.gunLoadouts.push(loadout);
  }
  loadout[slotKind][index] = weaponId || null;
  return { changed: true, definition: next };
}

export function weaponStackMultiplier(definition, weaponId) {
  const copies = normalizeGunLoadouts(definition).reduce(
    (sum, loadout) => sum + [...loadout.primary, ...loadout.secondary].filter((id) => id === weaponId).length,
    0,
  );
  return Math.sqrt(Math.max(1, copies));
}

export function installedPrimaryWeaponIds(definition) {
  return installedWeaponIds(definition, 'primary', PRIMARY_WEAPON_IDS);
}

export function installedSecondaryWeaponIds(definition) {
  return installedWeaponIds(definition, 'secondary', SECONDARY_WEAPON_IDS);
}

export function usableSecondaryWeaponIds(definition) {
  const installed = installedSecondaryWeaponIds(definition);
  if (utilityModuleInstalled(definition, 'tractor_beam')) installed.push('tractor_beam');
  return [...new Set(installed)];
}

export function utilityModuleInstalled(definition, moduleId) {
  if (!definition?.cells) return COMBAT_UTILITY_IDS.includes(moduleId);
  const utilityCells = new Set(definition.cells.filter((cell) => cell.type === 'utility').map((cell) => cell.id));
  return (definition.modules ?? []).some((module) =>
    module.kind === 'utilitySlots' && utilityCells.has(module.cellId) && (module.slots ?? []).includes(moduleId),
  );
}

export function utilityModuleCellIds(definition, moduleId) {
  if (!definition?.cells) return [];
  const utilityCells = new Set(definition.cells.filter((cell) => cell.type === 'utility').map((cell) => cell.id));
  return (definition.modules ?? [])
    .filter((module) => module.kind === 'utilitySlots' && utilityCells.has(module.cellId) && (module.slots ?? []).includes(moduleId))
    .map((module) => module.cellId);
}

export function migrateLegacyCombatUtilities(definition) {
  if (!definition?.cells) return definition;
  const legacyRepulsor = (definition.gunLoadouts ?? []).some((loadout) => (loadout.primary ?? []).includes('repulsor_beam'));
  const legacyTractor = (definition.gunLoadouts ?? []).some((loadout) => (loadout.secondary ?? []).includes('tractor_beam'));
  if (!legacyRepulsor && !legacyTractor) return definition;
  const next = cloneDefinition(definition);
  next.gunLoadouts = normalizeGunLoadouts(next);
  const utilityCell = next.cells.find((cell) => cell.type === 'utility');
  if (!utilityCell) return next;
  next.modules ??= [];
  let slots = next.modules.find((module) => module.kind === 'utilitySlots' && module.cellId === utilityCell.id);
  if (!slots) {
    slots = { cellId: utilityCell.id, kind: 'utilitySlots', slots: [] };
    next.modules.push(slots);
  }
  if (legacyRepulsor && !slots.slots.includes('repulsor_beam')) slots.slots.push('repulsor_beam');
  if (legacyTractor && !slots.slots.includes('tractor_beam')) slots.slots.push('tractor_beam');
  return next;
}

export function availablePrimaryWeaponIds(account) {
  return availableWeaponIds(account, 'primary', PRIMARY_WEAPON_IDS, ['main.basic', 'mini_beam']);
}

export function availableSecondaryWeaponIds(account) {
  return availableWeaponIds(account, 'secondary', SECONDARY_WEAPON_IDS, ['rocket', 'cannon', 'beam']);
}

export function weaponUnlocked(account, slotKind, weaponId) {
  if (!weaponId) return true;
  const allowed = slotKind === 'primary' ? availablePrimaryWeaponIds(account) : availableSecondaryWeaponIds(account);
  return allowed.includes(weaponId);
}

function normalizeSlots(value, allowed, maxSlots, fallback) {
  const source = Array.isArray(value) ? value : fallback == null ? [] : [fallback];
  const slots = source.slice(0, maxSlots).map((id) => (allowed.includes(id) ? id : null));
  while (slots.length < maxSlots) slots.push(null);
  return slots;
}

function cloneDefinition(definition) {
  return JSON.parse(JSON.stringify(definition));
}

function availableWeaponIds(account, slotKind, fullList, fallback) {
  const unlocks = account?.weaponUnlocks?.[slotKind];
  if (!Array.isArray(unlocks)) return [...fallback];
  return fullList.filter((id) => unlocks.includes(id));
}

function installedWeaponIds(definition, slotKind, catalog) {
  if (!definition?.cells) return [...catalog];
  const allowed = new Set(catalog);
  return [...new Set(
    normalizeGunLoadouts(definition)
      .flatMap((loadout) => loadout[slotKind])
      .filter((id) => allowed.has(id)),
  )];
}
