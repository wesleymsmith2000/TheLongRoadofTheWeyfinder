import { countDetachedVehicleCells, hasRepairableVehicleDamage, repairVehicleDamage, replaceDetachedVehicleCell } from './vehicle.js';
import { secondaryAmmoCapacity } from './secondaryWeapon.js';
import { recalculateCell } from './cell.js';
import { Roles } from './voxelMask.js';
import { normalizeGunLoadouts, weaponUnlocked } from './weaponLoadout.js';

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
  { id: 'gunAccuracy', label: 'Main Gun Accuracy', system: 'Main Gun', requires: { module: 'gun', primary: 'main.basic' } },
  { id: 'gunFireRate', label: 'Main Gun Fire Rate', system: 'Main Gun', requires: { module: 'gun', primary: 'main.basic' } },
  { id: 'gunDamage', label: 'Main Gun Damage', system: 'Main Gun', requires: { module: 'gun', primary: 'main.basic' } },
  { id: 'gunVelocity', label: 'Main Gun Shot Velocity', system: 'Main Gun', requires: { module: 'gun', primary: 'main.basic' } },
  { id: 'cannonAmmo', label: 'Cannon Ammo Capacity', system: 'Cannon', requires: { module: 'gun', secondary: 'cannon' } },
  { id: 'cannonImpactDamage', label: 'Cannon Impact Damage', system: 'Cannon', requires: { module: 'gun', secondary: 'cannon' } },
  { id: 'cannonBlastDamage', label: 'Cannon Blast Damage', system: 'Cannon', requires: { module: 'gun', secondary: 'cannon' } },
  { id: 'cannonBlastRadius', label: 'Cannon Blast Radius', system: 'Cannon', requires: { module: 'gun', secondary: 'cannon' } },
  { id: 'cannonShrapnelCount', label: 'Cannon Shrapnel Count', system: 'Cannon', requires: { module: 'gun', secondary: 'cannon' } },
  { id: 'cannonShrapnelDamage', label: 'Cannon Shrapnel Damage', system: 'Cannon', requires: { module: 'gun', secondary: 'cannon' } },
  { id: 'cannonKnockback', label: 'Cannon Knockback', system: 'Cannon', requires: { module: 'gun', secondary: 'cannon' } },
  { id: 'cannonVelocity', label: 'Cannon Shot Velocity', system: 'Cannon', requires: { module: 'gun', secondary: 'cannon' } },
  { id: 'cannonFlechettePierce', label: 'Cannon Flechette Pierce', system: 'Cannon', requires: { module: 'gun', secondary: 'cannon' } },
  { id: 'cannonFireRate', label: 'Cannon Fire Rate', system: 'Cannon', requires: { module: 'gun', secondary: 'cannon' } },
  { id: 'rocketAmmo', label: 'Rocket Ammo Capacity', system: 'Rocket', requires: { module: 'gun', secondary: 'rocket' } },
  { id: 'rocketImpactDamage', label: 'Rocket Impact Damage', system: 'Rocket', requires: { module: 'gun', secondary: 'rocket' } },
  { id: 'rocketBlastDamage', label: 'Rocket Blast Damage', system: 'Rocket', requires: { module: 'gun', secondary: 'rocket' } },
  { id: 'rocketBlastRadius', label: 'Rocket Blast Radius', system: 'Rocket', requires: { module: 'gun', secondary: 'rocket' } },
  { id: 'rocketMaxVelocity', label: 'Rocket Max Velocity', system: 'Rocket', requires: { module: 'gun', secondary: 'rocket' } },
  { id: 'rocketTurning', label: 'Rocket Turning', system: 'Rocket', requires: { module: 'gun', secondary: 'rocket' } },
  { id: 'rocketKnockback', label: 'Rocket Knockback', system: 'Rocket', requires: { module: 'gun', secondary: 'rocket' } },
  { id: 'rocketFireRate', label: 'Rocket Fire Rate', system: 'Rocket', requires: { module: 'gun', secondary: 'rocket' } },
  { id: 'beamHeatEfficiency', label: 'Beam Heat Efficiency', system: 'Particle Beam', requires: { module: 'gun', secondary: 'beam' } },
  { id: 'beamHeatSink', label: 'Beam Heat Sink', system: 'Particle Beam', requires: { module: 'gun', secondary: 'beam' } },
  { id: 'beamAmmo', label: 'Beam Ammo Capacity', system: 'Particle Beam', requires: { module: 'gun', secondary: 'beam' } },
  { id: 'beamDamage', label: 'Beam Damage', system: 'Particle Beam', requires: { module: 'gun', secondary: 'beam' } },
  { id: 'beamLength', label: 'Beam Length', system: 'Particle Beam', requires: { module: 'gun', secondary: 'beam' } },
  { id: 'beamPierce', label: 'Beam Pierce', system: 'Particle Beam', requires: { module: 'gun', secondary: 'beam' } },
  { id: 'beamWidth', label: 'Beam Width', system: 'Particle Beam', requires: { module: 'gun', secondary: 'beam' } },
  { id: 'beamFireTime', label: 'Beam Fire Time', system: 'Particle Beam', requires: { module: 'gun', secondary: 'beam' } },
  { id: 'beamFireRate', label: 'Beam Fire Rate', system: 'Particle Beam', requires: { module: 'gun', secondary: 'beam' } },
  { id: 'armorToughness', label: 'Armor Toughness', system: 'Armor', requires: { module: 'armor' } },
  { id: 'engineAcceleration', label: 'Engine Acceleration', system: 'Mobility', requires: { module: 'engine' } },
  { id: 'engineMaxVelocity', label: 'Engine Max Velocity', system: 'Mobility', requires: { module: 'engine' } },
  { id: 'wheelInertiaCompensation', label: 'Wheel Inertia Compensation', system: 'Mobility', requires: { module: 'wheel' } },
  { id: 'boostAcceleration', label: 'Booster Acceleration', system: 'Boosters', requires: { module: 'engine' } },
  { id: 'boostDuration', label: 'Booster Max Duration', system: 'Boosters', requires: { module: 'engine' } },
  { id: 'boostEfficiency', label: 'Booster Efficiency', system: 'Boosters', requires: { module: 'engine' } },
  { id: 'boostRecharge', label: 'Booster Recharge Rate', system: 'Boosters', requires: { module: 'engine' } },
  { id: 'boostCapacity', label: 'Booster Charge Capacity', system: 'Boosters', requires: { module: 'engine' } },
  { id: 'boostRamDamage', label: 'Booster Ram Damage', system: 'Boosters', requires: { module: 'engine' } },
  { id: 'boostRecoilDamage', label: 'Booster Recoil Damage Dampening', system: 'Boosters', requires: { module: 'engine' } },
  { id: 'boostRecoilKnockback', label: 'Booster Recoil Knockback Dampening', system: 'Boosters', requires: { module: 'engine' } },
  { id: 'boostShielding', label: 'Booster Damage Shielding', system: 'Boosters', requires: { module: 'gun' } },
  { id: 'boostCooldown', label: 'Booster Cooldown', system: 'Boosters', requires: { module: 'engine' } },
  { id: 'scrapMagnetDistance', label: 'Magnet Distance', system: 'Scrap Collection', requires: { moduleUnlock: 'scrap_magnet' } },
  { id: 'scrapMagnetStrength', label: 'Magnet Strength', system: 'Scrap Collection', requires: { moduleUnlock: 'scrap_magnet' } },
  { id: 'scrapCaptureRadius', label: 'Capture Radius', system: 'Scrap Collection', requires: { moduleUnlock: 'scrap_magnet' } },
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

export function availableUpgradeDefinitions(game, account = game.account, vehicleDefinition = game.vehicleDefinition) {
  return UPGRADE_DEFINITIONS.filter((upgrade) => upgradeAvailable(game, upgrade.id, account, vehicleDefinition));
}

export function upgradeAvailable(game, id, account = game.account, vehicleDefinition = game.vehicleDefinition) {
  const upgrade = UPGRADE_DEFINITIONS.find((candidate) => candidate.id === id);
  if (!upgrade) return false;
  const requires = upgrade.requires ?? {};
  if (requires.module && !moduleInstalledAndUnlocked(game, account, requires.module)) return false;
  if (requires.moduleUnlock && !account?.moduleUnlocks?.includes(requires.moduleUnlock)) return false;
  if (requires.primary && !weaponInstalledAndUnlocked(account, vehicleDefinition, 'primary', requires.primary)) return false;
  if (requires.secondary && !weaponInstalledAndUnlocked(account, vehicleDefinition, 'secondary', requires.secondary)) return false;
  return true;
}

export function buyUpgradeWithScrap(game, id, account = game.account, vehicleDefinition = game.vehicleDefinition) {
  if (!upgradeAvailable(game, id, account, vehicleDefinition)) return false;
  const cost = upgradeCost(game, id);
  if (!Number.isFinite(cost) || game.scrap < cost) return false;
  game.scrap -= cost;
  game.upgrades ??= createUpgradeState();
  game.upgrades[id] = upgradeLevel(game, id) + 1;
  applyUpgradeSideEffects(game, id);
  return true;
}

function moduleInstalledAndUnlocked(game, account, moduleType) {
  const installed = game.vehicle?.cells?.some((cell) => cell.type === moduleType);
  if (!installed) return false;
  const entry = account?.equipment?.[moduleType];
  return entry == null || entry.unlocked !== false;
}

function weaponInstalledAndUnlocked(account, vehicleDefinition, slotKind, weaponId) {
  if (!weaponUnlocked(account, slotKind, weaponId)) return false;
  if (!vehicleDefinition?.cells) return ['main.basic', 'rocket', 'cannon', 'beam'].includes(weaponId);
  return normalizeGunLoadouts(vehicleDefinition).some((loadout) => loadout[slotKind].includes(weaponId));
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
