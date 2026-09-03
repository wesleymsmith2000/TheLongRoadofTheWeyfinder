export const PRIMARY_WEAPON_IDS = ['main.basic', 'tracking_flechette', 'mortar', 'blade_launcher', 'mini_beam', 'repulsor_beam'];
export const SECONDARY_WEAPON_IDS = ['rocket', 'cannon', 'beam', 'tractor_beam', 'sta_missile', 'orb_of_blades'];
export const MAX_PRIMARY_SLOTS = 2;
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
