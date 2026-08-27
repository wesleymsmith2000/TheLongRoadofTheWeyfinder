import { repairVehicleDamage, replaceDetachedVehicleCell } from './vehicle.js';
import { secondaryAmmoCapacity } from './secondaryWeapon.js';

export const SHOP_COSTS = {
  repair: 2,
  replaceDetached: 16,
  ammoRefillFraction: 0.5,
  ammoModuleMultiplier: 4,
  scrapMagnetVoxels: 30,
};

const REPAIR_POWER_PER_SCRAP = 16;

export function repairVehicleWithScrap(game) {
  if (game.scrap < SHOP_COSTS.repair) return false;
  const repaired = repairVehicleDamage(game.vehicle, SHOP_COSTS.repair * REPAIR_POWER_PER_SCRAP);
  if (repaired <= 0) return false;
  game.scrap -= SHOP_COSTS.repair;
  return true;
}

export function replaceDetachedWithScrap(game) {
  if (game.scrap < SHOP_COSTS.replaceDetached) return false;
  const replaced = replaceDetachedVehicleCell(game.vehicle);
  if (!replaced) return false;
  game.scrap -= SHOP_COSTS.replaceDetached;
  return true;
}

export function refillAmmoWithScrap(game, weapon = game.secondary.selected) {
  const capacity = secondaryAmmoCapacity(weapon);
  if (!Number.isFinite(capacity) || capacity <= 0) return false;
  const cost = ammoRefillCost(weapon);
  if (game.scrap < cost || game.secondary.ammo[weapon] >= capacity) return false;
  game.scrap -= cost;
  game.secondary.ammo[weapon] = capacity;
  return true;
}

export function ammoRefillCost(weapon) {
  const capacity = secondaryAmmoCapacity(weapon);
  if (!Number.isFinite(capacity) || capacity <= 0) return Infinity;
  return Math.ceil(capacity * SHOP_COSTS.ammoRefillFraction);
}

export function ammoModuleCost(weapon) {
  const capacity = secondaryAmmoCapacity(weapon);
  if (!Number.isFinite(capacity) || capacity <= 0) return Infinity;
  return Math.ceil(capacity * SHOP_COSTS.ammoModuleMultiplier);
}
