import { SHOP_COSTS, UPGRADE_DEFINITIONS, upgradeCost } from './economy.js';
import {
  MAX_PRIMARY_SLOTS,
  MAX_SECONDARY_SLOTS,
  MAX_UTILITY_SLOTS,
  PRIMARY_WEAPON_IDS,
  SECONDARY_WEAPON_IDS,
  UTILITY_EQUIPMENT_IDS,
  normalizeGunLoadouts,
  normalizeUtilityLoadouts,
  setGunLoadoutSlot,
  setUtilityLoadoutSlot,
} from './weaponLoadout.js';

export const WEAPON_SLOT_KINDS = ['primary', 'secondary'];
export const EQUIPMENT_SLOT_KINDS = [...WEAPON_SLOT_KINDS, 'utility'];
export const EQUIPMENT_IDS = [...new Set([...PRIMARY_WEAPON_IDS, ...SECONDARY_WEAPON_IDS, ...UTILITY_EQUIPMENT_IDS])];
export const LITE_SLOT_UNLOCK_COST = SHOP_COSTS.replaceDetached * 5;

const MERGE_ONLY_EQUIPMENT = new Set(['vortex_wavelet_beam']);

export function createWeaponBayState(vehicleDefinition, runMode = 'normal') {
  const unlockedSlots = {};
  for (const loadout of normalizeGunLoadouts(vehicleDefinition)) {
    unlockedSlots[loadout.cellId] = {
      primary: Array.from({ length: MAX_PRIMARY_SLOTS }, (_, index) => runMode !== 'lite' || Boolean(loadout.primary[index])),
      secondary: Array.from({ length: MAX_SECONDARY_SLOTS }, (_, index) => runMode !== 'lite' || Boolean(loadout.secondary[index])),
    };
  }
  return {
    available: false,
    inventory: Object.fromEntries(EQUIPMENT_IDS.map((id) => [id, 0])),
    unlockedSlots,
    discoveredMerges: [],
  };
}

export function normalizeWeaponBayState(state, vehicleDefinition, runMode = 'normal') {
  const fallback = createWeaponBayState(vehicleDefinition, runMode);
  const inventory = { ...fallback.inventory };
  for (const [itemId, quantity] of Object.entries(state?.inventory ?? {})) {
    inventory[itemId] = Math.max(0, Math.floor(Number(quantity) || 0));
  }
  const unlockedSlots = {};
  for (const [cellId, slots] of Object.entries(fallback.unlockedSlots)) {
    const saved = state?.unlockedSlots?.[cellId];
    unlockedSlots[cellId] = {
      primary: normalizeSlotFlags(saved?.primary, slots.primary),
      secondary: normalizeSlotFlags(saved?.secondary, slots.secondary),
    };
  }
  const discoveredMerges = [...new Set((state?.discoveredMerges ?? []).filter((id) => typeof id === 'string'))];
  return { available: Boolean(state?.available), inventory, unlockedSlots, discoveredMerges };
}

export function weaponBayAvailable(game) {
  return workshopAccess(game).loadout;
}

export function workshopAccess(game) {
  const completedLevel = Boolean(game?.levelComplete);
  const sandbox = Boolean(game?.sandbox?.enabled);
  return {
    loadout: completedLevel || sandbox,
    fabrication: completedLevel || sandbox,
    merge: completedLevel || sandbox,
    structure: sandbox || Boolean(completedLevel && game?.weaponBay?.structureAvailable),
  };
}

export function weaponSlotUnlocked(game, cellId, slotKind, slotIndex) {
  if (!WEAPON_SLOT_KINDS.includes(slotKind)) return false;
  return game?.weaponBay?.unlockedSlots?.[cellId]?.[slotKind]?.[slotIndex] === true;
}

export function weaponConstructionCost(game, weaponId) {
  return equipmentConstructionCost(game, weaponId);
}

export function equipmentConstructionCost(game, itemId) {
  if (!equipmentSlotKind(itemId) || equipmentFabricationMode(itemId) !== 'scrap') return Infinity;
  const levelOneUpgrades = UPGRADE_DEFINITIONS.filter((upgrade) =>
    upgrade.requires?.primary === itemId || upgrade.requires?.secondary === itemId || upgrade.requires?.utility === itemId,
  );
  const pristineGame = { upgrades: {} };
  return SHOP_COSTS.replaceDetached + levelOneUpgrades.reduce((sum, upgrade) => sum + upgradeCost(pristineGame, upgrade.id), 0);
}

export function buildWeaponWithScrap(game, weaponId) {
  return buildEquipmentWithScrap(game, weaponId);
}

export function buildEquipmentWithScrap(game, itemId) {
  if (!workshopAccess(game).fabrication) return { changed: false, reason: 'Fabrication is only available in the Workshop after a completed level.' };
  if (equipmentFabricationMode(itemId) === 'mergeOnly') return { changed: false, reason: 'This equipment can only be created through a merge recipe.' };
  const cost = equipmentConstructionCost(game, itemId);
  if (!Number.isFinite(cost)) return { changed: false, reason: 'Unknown equipment.' };
  if (game.scrap < cost) return { changed: false, reason: `Need ${cost - game.scrap} more scrap.` };
  game.scrap -= cost;
  game.weaponBay.inventory[itemId] = (game.weaponBay.inventory[itemId] ?? 0) + 1;
  return { changed: true, cost, quantity: game.weaponBay.inventory[itemId] };
}

export function swapWeaponSlot(game, cellId, slotKind, slotIndex, weaponId) {
  return swapEquipmentSlot(game, cellId, slotKind, slotIndex, weaponId);
}

export function swapEquipmentSlot(game, cellId, slotKind, slotIndex, itemId) {
  if (!workshopAccess(game).loadout) return { changed: false, reason: 'Loadout changes are only available in the Workshop after a completed level.' };
  if (slotKind === 'utility') return swapUtilitySlot(game, cellId, slotIndex, itemId);
  if (!weaponSlotUnlocked(game, cellId, slotKind, slotIndex)) return { changed: false, reason: 'Unlock this weapon slot first.' };
  const catalog = slotKind === 'primary' ? PRIMARY_WEAPON_IDS : SECONDARY_WEAPON_IDS;
  if (itemId != null && !catalog.includes(itemId)) return { changed: false, reason: 'That equipment does not fit this slot.' };
  const loadout = normalizeGunLoadouts(game.vehicleDefinition).find((entry) => entry.cellId === cellId);
  const currentWeapon = loadout?.[slotKind]?.[slotIndex] ?? null;
  if (currentWeapon === (itemId || null)) return { changed: false, reason: 'That equipment is already installed.' };
  if (itemId && (game.weaponBay.inventory[itemId] ?? 0) <= 0) return { changed: false, reason: 'Fabricate, merge, or recover that equipment first.' };

  const result = setGunLoadoutSlot(game.vehicleDefinition, cellId, slotKind, slotIndex, itemId || null);
  if (!result.changed) return result;
  if (currentWeapon) game.weaponBay.inventory[currentWeapon] = (game.weaponBay.inventory[currentWeapon] ?? 0) + 1;
  if (itemId) game.weaponBay.inventory[itemId] -= 1;
  game.vehicleDefinition = result.definition;
  return { changed: true, removed: currentWeapon, installed: itemId || null, definition: result.definition };
}

export function swapUtilitySlot(game, cellId, slotIndex, utilityId) {
  if (!workshopAccess(game).loadout) return { changed: false, reason: 'Loadout changes are only available in the Workshop after a completed level.' };
  const loadout = normalizeUtilityLoadouts(game.vehicleDefinition).find((entry) => entry.cellId === cellId);
  if (!loadout) return { changed: false, reason: 'Choose a utility cell first.' };
  const currentUtility = loadout.slots[slotIndex] ?? null;
  if (utilityId != null && !UTILITY_EQUIPMENT_IDS.includes(utilityId)) return { changed: false, reason: 'That equipment does not fit a utility slot.' };
  if (currentUtility === (utilityId || null)) return { changed: false, reason: 'That equipment is already installed.' };
  if (utilityId && (game.weaponBay.inventory[utilityId] ?? 0) <= 0) return { changed: false, reason: 'Fabricate, merge, or recover that equipment first.' };
  const result = setUtilityLoadoutSlot(game.vehicleDefinition, cellId, slotIndex, utilityId || null);
  if (!result.changed) return result;
  if (currentUtility) game.weaponBay.inventory[currentUtility] = (game.weaponBay.inventory[currentUtility] ?? 0) + 1;
  if (utilityId) game.weaponBay.inventory[utilityId] -= 1;
  game.vehicleDefinition = result.definition;
  return { changed: true, removed: currentUtility, installed: utilityId || null, definition: result.definition };
}

export function unlockLiteWeaponSlot(game, cellId, slotKind, slotIndex) {
  if (!weaponBayAvailable(game) || game.runMode !== 'lite') return { changed: false, reason: 'Slot unlocking is only used by Lite rest areas.' };
  if (!WEAPON_SLOT_KINDS.includes(slotKind)) return { changed: false, reason: 'Unknown weapon slot type.' };
  const flags = game.weaponBay.unlockedSlots?.[cellId]?.[slotKind];
  if (!flags || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= flags.length) return { changed: false, reason: 'Weapon slot is out of range.' };
  if (flags[slotIndex]) return { changed: false, reason: 'That slot is already unlocked.' };
  if (cellId === 'gun-support' && countUnlockedSlots(game, cellId) === 0 && (slotKind !== 'primary' || slotIndex !== 0)) {
    return { changed: false, reason: 'Unlock the support gun primary slot first.' };
  }
  if (game.scrap < LITE_SLOT_UNLOCK_COST) return { changed: false, reason: `Need ${LITE_SLOT_UNLOCK_COST - game.scrap} more scrap.` };
  game.scrap -= LITE_SLOT_UNLOCK_COST;
  flags[slotIndex] = true;
  return { changed: true, cost: LITE_SLOT_UNLOCK_COST };
}

export function weaponBaySlotView(game, cellId, slotKind, slotIndex) {
  return equipmentSlotView(game, cellId, slotKind, slotIndex);
}

export function equipmentSlotView(game, cellId, slotKind, slotIndex) {
  if (slotKind === 'utility') {
    const loadout = normalizeUtilityLoadouts(game.vehicleDefinition).find((entry) => entry.cellId === cellId);
    return { unlocked: Boolean(loadout), weaponId: loadout?.slots?.[slotIndex] ?? null };
  }
  const loadout = normalizeGunLoadouts(game.vehicleDefinition).find((entry) => entry.cellId === cellId);
  return {
    unlocked: weaponSlotUnlocked(game, cellId, slotKind, slotIndex),
    weaponId: loadout?.[slotKind]?.[slotIndex] ?? null,
  };
}

export function equipmentSlotKind(itemId) {
  if (PRIMARY_WEAPON_IDS.includes(itemId)) return 'primary';
  if (SECONDARY_WEAPON_IDS.includes(itemId)) return 'secondary';
  if (UTILITY_EQUIPMENT_IDS.includes(itemId)) return 'utility';
  return null;
}

export function equipmentIdsForSlotKind(slotKind) {
  if (slotKind === 'primary') return PRIMARY_WEAPON_IDS;
  if (slotKind === 'secondary') return SECONDARY_WEAPON_IDS;
  if (slotKind === 'utility') return UTILITY_EQUIPMENT_IDS;
  return [];
}

export function equipmentFabricationMode(itemId) {
  return MERGE_ONLY_EQUIPMENT.has(itemId) ? 'mergeOnly' : equipmentSlotKind(itemId) ? 'scrap' : null;
}

export function equipmentSlotCapacity(slotKind) {
  if (slotKind === 'primary') return MAX_PRIMARY_SLOTS;
  if (slotKind === 'secondary') return MAX_SECONDARY_SLOTS;
  if (slotKind === 'utility') return MAX_UTILITY_SLOTS;
  return 0;
}

function countUnlockedSlots(game, cellId) {
  const slots = game.weaponBay.unlockedSlots?.[cellId];
  return [...(slots?.primary ?? []), ...(slots?.secondary ?? [])].filter(Boolean).length;
}

function normalizeSlotFlags(value, fallback) {
  return fallback.map((defaultValue, index) => typeof value?.[index] === 'boolean' ? value[index] : defaultValue);
}
