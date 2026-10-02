import { UPGRADE_DEFINITIONS, upgradeLevel } from './economy.js';

export function equipmentUpgradeDefinitions(itemId) {
  return UPGRADE_DEFINITIONS.filter((upgrade) => {
    const requirements = upgrade.requires ?? {};
    return requirements.primary === itemId || requirements.secondary === itemId || requirements.utility === itemId;
  });
}

export function equipmentSystemLevel(game, itemId) {
  const upgrades = equipmentUpgradeDefinitions(itemId);
  if (upgrades.length === 0) return 0;
  return Math.min(...upgrades.map((upgrade) => upgradeLevel(game, upgrade.id)));
}
