import { countDetachedVehicleCells, hasRepairableVehicleDamage, repairVehicleDamage, replaceDetachedVehicleCell } from './vehicle.js';
import { secondaryAmmoCapacity } from './secondaryWeapon.js';
import { recalculateCell } from './cell.js';
import { Roles } from './voxelMask.js';

export const SHOP_COSTS = {
  repair: 2,
  replaceDetached: 16,
  ammoRefillFraction: 0.5,
  ammoModuleMultiplier: 4,
  scrapMagnetVoxels: 30,
  upgradeBaseFraction: 0.25,
  upgradeCostGrowth: 1.25,
};

const REPAIR_POWER_PER_SCRAP = 16;

export const UPGRADE_DEFINITIONS = [
  { id: 'gunAccuracy', label: 'Main Gun Accuracy', system: 'Main Gun' },
  { id: 'gunFireRate', label: 'Main Gun Fire Rate', system: 'Main Gun' },
  { id: 'gunDamage', label: 'Main Gun Damage', system: 'Main Gun' },
  { id: 'gunVelocity', label: 'Main Gun Shot Velocity', system: 'Main Gun' },
  { id: 'cannonAmmo', label: 'Cannon Ammo Capacity', system: 'Cannon' },
  { id: 'cannonImpactDamage', label: 'Cannon Impact Damage', system: 'Cannon' },
  { id: 'cannonBlastDamage', label: 'Cannon Blast Damage', system: 'Cannon' },
  { id: 'cannonBlastRadius', label: 'Cannon Blast Radius', system: 'Cannon' },
  { id: 'cannonShrapnelCount', label: 'Cannon Shrapnel Count', system: 'Cannon' },
  { id: 'cannonShrapnelDamage', label: 'Cannon Shrapnel Damage', system: 'Cannon' },
  { id: 'cannonKnockback', label: 'Cannon Knockback', system: 'Cannon' },
  { id: 'cannonFireRate', label: 'Cannon Fire Rate', system: 'Cannon' },
  { id: 'rocketAmmo', label: 'Rocket Ammo Capacity', system: 'Rocket' },
  { id: 'rocketImpactDamage', label: 'Rocket Impact Damage', system: 'Rocket' },
  { id: 'rocketBlastDamage', label: 'Rocket Blast Damage', system: 'Rocket' },
  { id: 'rocketBlastRadius', label: 'Rocket Blast Radius', system: 'Rocket' },
  { id: 'rocketMaxVelocity', label: 'Rocket Max Velocity', system: 'Rocket' },
  { id: 'rocketTurning', label: 'Rocket Turning', system: 'Rocket' },
  { id: 'rocketKnockback', label: 'Rocket Knockback', system: 'Rocket' },
  { id: 'rocketFireRate', label: 'Rocket Fire Rate', system: 'Rocket' },
  { id: 'beamHeatEfficiency', label: 'Beam Heat Efficiency', system: 'Particle Beam' },
  { id: 'beamHeatSink', label: 'Beam Heat Sink', system: 'Particle Beam' },
  { id: 'beamAmmo', label: 'Beam Ammo Capacity', system: 'Particle Beam' },
  { id: 'beamDamage', label: 'Beam Damage', system: 'Particle Beam' },
  { id: 'beamPierce', label: 'Beam Pierce', system: 'Particle Beam' },
  { id: 'beamWidth', label: 'Beam Width', system: 'Particle Beam' },
  { id: 'beamFireTime', label: 'Beam Fire Time', system: 'Particle Beam' },
  { id: 'beamFireRate', label: 'Beam Fire Rate', system: 'Particle Beam' },
  { id: 'armorToughness', label: 'Armor Toughness', system: 'Armor' },
  { id: 'boostAcceleration', label: 'Booster Acceleration', system: 'Boosters' },
  { id: 'boostDuration', label: 'Booster Max Duration', system: 'Boosters' },
  { id: 'boostEfficiency', label: 'Booster Efficiency', system: 'Boosters' },
  { id: 'boostRecharge', label: 'Booster Recharge Rate', system: 'Boosters' },
  { id: 'boostCapacity', label: 'Booster Charge Capacity', system: 'Boosters' },
  { id: 'boostRamDamage', label: 'Booster Ram Damage', system: 'Boosters' },
  { id: 'boostRecoilDamage', label: 'Booster Recoil Damage Dampening', system: 'Boosters' },
  { id: 'boostRecoilKnockback', label: 'Booster Recoil Knockback Dampening', system: 'Boosters' },
  { id: 'boostShielding', label: 'Booster Damage Shielding', system: 'Boosters' },
  { id: 'boostCooldown', label: 'Booster Cooldown', system: 'Boosters' },
  { id: 'scrapMagnetDistance', label: 'Magnet Distance', system: 'Scrap Collection' },
  { id: 'scrapMagnetStrength', label: 'Magnet Strength', system: 'Scrap Collection' },
  { id: 'scrapCaptureRadius', label: 'Capture Radius', system: 'Scrap Collection' },
];

export function createUpgradeState() {
  return Object.fromEntries(UPGRADE_DEFINITIONS.map((upgrade) => [upgrade.id, 0]));
}

export function upgradeLevel(game, id) {
  return game.upgrades?.[id] ?? 0;
}

export function upgradeCost(game, id) {
  if (!UPGRADE_DEFINITIONS.some((upgrade) => upgrade.id === id)) return Infinity;
  const base = Math.ceil(SHOP_COSTS.replaceDetached * SHOP_COSTS.upgradeBaseFraction);
  return Math.ceil(base * SHOP_COSTS.upgradeCostGrowth ** upgradeLevel(game, id));
}

export function upgradeMultiplier(game, id, amount = 0.05) {
  return (1 + amount) ** upgradeLevel(game, id);
}

export function upgradeReduction(game, id, amount = 0.05) {
  return (1 - amount) ** upgradeLevel(game, id);
}

export function upgradeStatus(game, id) {
  const cost = upgradeCost(game, id);
  if (!Number.isFinite(cost)) return 'Unavailable';
  const level = upgradeLevel(game, id);
  return game.scrap >= cost ? `Level ${level}, ready` : `Level ${level}, need ${cost - game.scrap}`;
}

export function buyUpgradeWithScrap(game, id) {
  const cost = upgradeCost(game, id);
  if (!Number.isFinite(cost) || game.scrap < cost) return false;
  game.scrap -= cost;
  game.upgrades ??= createUpgradeState();
  game.upgrades[id] = upgradeLevel(game, id) + 1;
  applyUpgradeSideEffects(game, id);
  return true;
}

export function repairCost(game, target = 'all') {
  if (!hasRepairableVehicleDamage(game.vehicle, target)) return 0;
  return Math.ceil(SHOP_COSTS.repair * repairInflation(game));
}

export function repairInflation(game) {
  const totalUpgradeLevels = Object.values(game.upgrades ?? {}).reduce((sum, value) => sum + value, 0);
  return 1.01 ** totalUpgradeLevels;
}

export function repairVehicleWithScrap(game, target = 'all') {
  const cost = repairCost(game, target);
  if (cost <= 0 || game.scrap < cost || !hasRepairableVehicleDamage(game.vehicle, target)) return false;
  const repaired = repairVehicleDamage(game.vehicle, SHOP_COSTS.repair * REPAIR_POWER_PER_SCRAP, target);
  if (repaired <= 0) return false;
  game.scrap -= cost;
  return true;
}

export function repairStatus(game, target = 'all') {
  const cost = repairCost(game, target);
  if (cost <= 0) return 'No damage';
  return game.scrap >= cost ? 'Ready' : `Need ${cost - game.scrap}`;
}

export function replacementStatus(game) {
  const detached = countDetachedVehicleCells(game.vehicle);
  if (detached === 0) return 'None missing';
  if (game.scrap < SHOP_COSTS.replaceDetached) return `${detached} missing, need ${SHOP_COSTS.replaceDetached - game.scrap}`;
  return `${detached} missing`;
}

export function ammoStatus(game, weapon = game.secondary.selected) {
  const cost = ammoRefillCost(weapon);
  const capacity = ammoCapacityWithUpgrades(game, weapon);
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
  const capacity = ammoCapacityWithUpgrades(game, weapon);
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

function applyUpgradeSideEffects(game, id) {
  if (id === 'cannonAmmo') growAmmoReserve(game, 'cannon');
  if (id === 'rocketAmmo') growAmmoReserve(game, 'rocket');
  if (id === 'beamAmmo') growAmmoReserve(game, 'beam');
  if (id === 'armorToughness') thickenArmorVoxels(game);
}

function growAmmoReserve(game, weapon) {
  const added = Math.max(1, Math.ceil(secondaryAmmoCapacity(weapon) * 0.05));
  game.secondary.ammoBonus ??= {};
  game.secondary.ammoBonus[weapon] = (game.secondary.ammoBonus[weapon] ?? 0) + added;
  game.secondary.ammo[weapon] = Math.min(ammoCapacityWithUpgrades(game, weapon), (game.secondary.ammo[weapon] ?? 0) + added);
}

export function ammoCapacityWithUpgrades(game, weapon) {
  return secondaryAmmoCapacity(weapon) + (game.secondary?.ammoBonus?.[weapon] ?? 0);
}

function thickenArmorVoxels(game) {
  for (const cell of game.vehicle.cells) {
    if (cell.type !== 'armor') continue;
    for (const voxel of cell.mask.flat()) {
      if (voxel.role !== Roles.ARMOR) continue;
      const oldMax = voxel.maxHp;
      voxel.maxHp *= 1.05;
      voxel.hp += voxel.maxHp - oldMax;
    }
    recalculateCell(cell);
  }
}
