import { countDetachedVehicleCells, hasRepairableVehicleDamage, repairVehicleDamage, replaceDetachedVehicleCell } from './vehicle.js';
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
  if (game.scrap < SHOP_COSTS.repair || !hasRepairableVehicleDamage(game.vehicle)) return false;
  const repaired = repairVehicleDamage(game.vehicle, SHOP_COSTS.repair * REPAIR_POWER_PER_SCRAP);
  if (repaired <= 0) return false;
  game.scrap -= SHOP_COSTS.repair;
  return true;
}

export function repairStatus(game) {
  if (!hasRepairableVehicleDamage(game.vehicle)) return 'No damage';
  return game.scrap >= SHOP_COSTS.repair ? 'Ready' : `Need ${SHOP_COSTS.repair - game.scrap}`;
}

export function replacementStatus(game) {
  const detached = countDetachedVehicleCells(game.vehicle);
  if (detached === 0) return 'None missing';
  if (game.scrap < SHOP_COSTS.replaceDetached) return `${detached} missing, need ${SHOP_COSTS.replaceDetached - game.scrap}`;
  return `${detached} missing`;
}

export function ammoStatus(game, weapon = game.secondary.selected) {
  const cost = ammoRefillCost(weapon);
  const capacity = secondaryAmmoCapacity(weapon);
  const ammo = game.secondary.ammo[weapon];
  if (!Number.isFinite(cost) || ammo == null) return 'No ammo reserve';
  if (ammo >= capacity) return 'Full';
  return game.scrap >= cost ? `${ammo}/${capacity}` : `${ammo}/${capacity}, need ${cost - game.scrap}`;
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
