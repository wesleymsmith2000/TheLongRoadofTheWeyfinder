import { SHOP_COSTS, UPGRADE_DEFINITIONS, upgradeCost } from './economy.js';
import {
  MAX_PRIMARY_SLOTS,
  MAX_SECONDARY_SLOTS,
  PRIMARY_WEAPON_IDS,
  SECONDARY_WEAPON_IDS,
  normalizeGunLoadouts,
  setGunLoadoutSlot,
} from './weaponLoadout.js';

export const WEAPON_SLOT_KINDS = ['primary', 'secondary'];
export const LITE_SLOT_UNLOCK_COST = SHOP_COSTS.replaceDetached * 5;

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
    inventory: Object.fromEntries([...PRIMARY_WEAPON_IDS, ...SECONDARY_WEAPON_IDS].map((id) => [id, 0])),
    unlockedSlots,
  };
}

export function normalizeWeaponBayState(state, vehicleDefinition, runMode = 'normal') {
  const fallback = createWeaponBayState(vehicleDefinition, runMode);
  const inventory = { ...fallback.inventory };
  for (const [weaponId, quantity] of Object.entries(state?.inventory ?? {})) {
    if (!(weaponId in inventory)) continue;
    inventory[weaponId] = Math.max(0, Math.floor(Number(quantity) || 0));
  }
  const unlockedSlots = {};
  for (const [cellId, slots] of Object.entries(fallback.unlockedSlots)) {
    const saved = state?.unlockedSlots?.[cellId];
    unlockedSlots[cellId] = {
      primary: normalizeSlotFlags(saved?.primary, slots.primary),
      secondary: normalizeSlotFlags(saved?.secondary, slots.secondary),
    };
  }
  return { available: Boolean(state?.available), inventory, unlockedSlots };
}

export function weaponBayAvailable(game) {
  return Boolean(game?.levelComplete && game?.weaponBay?.available);
}

export function weaponSlotUnlocked(game, cellId, slotKind, slotIndex) {
  if (!WEAPON_SLOT_KINDS.includes(slotKind)) return false;
  return game?.weaponBay?.unlockedSlots?.[cellId]?.[slotKind]?.[slotIndex] === true;
}

export function weaponConstructionCost(game, weaponId) {
  if (!weaponCatalogForId(weaponId)) return Infinity;
  const levelOneUpgrades = UPGRADE_DEFINITIONS.filter((upgrade) =>
    upgrade.requires?.primary === weaponId || upgrade.requires?.secondary === weaponId,
  );
  const pristineGame = { upgrades: {} };
  return SHOP_COSTS.replaceDetached + levelOneUpgrades.reduce((sum, upgrade) => sum + upgradeCost(pristineGame, upgrade.id), 0);
}

export function buildWeaponWithScrap(game, weaponId) {
  if (!weaponBayAvailable(game)) return { changed: false, reason: 'Weapon construction is only available at an inter-zone rest area.' };
  const cost = weaponConstructionCost(game, weaponId);
  if (!Number.isFinite(cost)) return { changed: false, reason: 'Unknown weapon.' };
  if (game.scrap < cost) return { changed: false, reason: `Need ${cost - game.scrap} more scrap.` };
  game.scrap -= cost;
  game.weaponBay.inventory[weaponId] = (game.weaponBay.inventory[weaponId] ?? 0) + 1;
  return { changed: true, cost, quantity: game.weaponBay.inventory[weaponId] };
}

export function swapWeaponSlot(game, cellId, slotKind, slotIndex, weaponId) {
  if (!weaponBayAvailable(game)) return { changed: false, reason: 'Weapon swapping is only available at an inter-zone rest area.' };
  if (!weaponSlotUnlocked(game, cellId, slotKind, slotIndex)) return { changed: false, reason: 'Unlock this weapon slot first.' };
  const catalog = slotKind === 'primary' ? PRIMARY_WEAPON_IDS : SECONDARY_WEAPON_IDS;
  if (weaponId != null && !catalog.includes(weaponId)) return { changed: false, reason: 'That weapon does not fit this slot.' };
  const loadout = normalizeGunLoadouts(game.vehicleDefinition).find((entry) => entry.cellId === cellId);
  const currentWeapon = loadout?.[slotKind]?.[slotIndex] ?? null;
  if (currentWeapon === (weaponId || null)) return { changed: false, reason: 'That weapon is already installed.' };
  if (weaponId && (game.weaponBay.inventory[weaponId] ?? 0) <= 0) return { changed: false, reason: 'Construct or recover that weapon first.' };

  const result = setGunLoadoutSlot(game.vehicleDefinition, cellId, slotKind, slotIndex, weaponId || null);
  if (!result.changed) return result;
  if (currentWeapon) game.weaponBay.inventory[currentWeapon] = (game.weaponBay.inventory[currentWeapon] ?? 0) + 1;
  if (weaponId) game.weaponBay.inventory[weaponId] -= 1;
  game.vehicleDefinition = result.definition;
  return { changed: true, removed: currentWeapon, installed: weaponId || null, definition: result.definition };
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
  const loadout = normalizeGunLoadouts(game.vehicleDefinition).find((entry) => entry.cellId === cellId);
  return {
    unlocked: weaponSlotUnlocked(game, cellId, slotKind, slotIndex),
    weaponId: loadout?.[slotKind]?.[slotIndex] ?? null,
  };
}

function countUnlockedSlots(game, cellId) {
  const slots = game.weaponBay.unlockedSlots?.[cellId];
  return [...(slots?.primary ?? []), ...(slots?.secondary ?? [])].filter(Boolean).length;
}

function normalizeSlotFlags(value, fallback) {
  return fallback.map((defaultValue, index) => typeof value?.[index] === 'boolean' ? value[index] : defaultValue);
}

function weaponCatalogForId(weaponId) {
  if (PRIMARY_WEAPON_IDS.includes(weaponId)) return 'primary';
  if (SECONDARY_WEAPON_IDS.includes(weaponId)) return 'secondary';
  return null;
}
