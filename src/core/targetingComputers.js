export const TARGETING_COMPUTER_DEFINITIONS = Object.freeze([
  definition('main.basic', 'primary', 20),
  definition('tracking_flechette', 'primary', 16),
  definition('mortar', 'primary', 12),
  definition('blade_launcher', 'primary', 14),
  definition('mini_beam', 'primary', 16),
  definition('rocket', 'secondary', 14),
  definition('cannon', 'secondary', 14),
  definition('beam', 'secondary', 16),
  definition('tractor_beam', 'secondary', 12),
  definition('sta_missile', 'secondary', 12),
  definition('orb_of_blades', 'secondary', 14),
]);

const DEFINITION_BY_WEAPON = new Map(TARGETING_COMPUTER_DEFINITIONS.map((entry) => [entry.weaponId, entry]));

export function targetingComputerModuleId(weaponId) {
  return `targeting_computer.${weaponId}`;
}

export function targetingComputerDefinition(weaponId) {
  return DEFINITION_BY_WEAPON.get(weaponId) ?? null;
}

export function targetingComputerUnlocks(account) {
  const modules = new Set(account?.moduleUnlocks ?? []);
  return TARGETING_COMPUTER_DEFINITIONS
    .filter((entry) => modules.has(entry.moduleId))
    .map((entry) => entry.weaponId);
}

export function syncTargetingComputerUnlocks(game, account) {
  game.targetingComputerUnlocks = targetingComputerUnlocks(account);
  return game.targetingComputerUnlocks;
}

export function hasTargetingComputer(game, weaponId) {
  return Array.isArray(game?.targetingComputerUnlocks) && game.targetingComputerUnlocks.includes(weaponId);
}

export function primaryTargetingReticleKey(cellId, slotIndex, weaponId) {
  return `primary:${cellId}:${slotIndex}:${weaponId}`;
}

export function secondaryTargetingReticleKey(weaponId) {
  return `secondary:${weaponId}`;
}

export function targetingReticleForKey(game, key) {
  return game?.independentAimReticles?.[key] ?? game?.aimReticle ?? null;
}

export function targetingReticleForPrimary(game, cellId, slotIndex, weaponId) {
  if (!hasTargetingComputer(game, weaponId)) return game?.aimReticle ?? null;
  return targetingReticleForKey(game, primaryTargetingReticleKey(cellId, slotIndex, weaponId));
}

export function targetingReticleForSecondary(game, weaponId) {
  if (!hasTargetingComputer(game, weaponId)) return game?.aimReticle ?? null;
  return targetingReticleForKey(game, secondaryTargetingReticleKey(weaponId));
}

function definition(weaponId, slotKind, defeatThreshold) {
  return Object.freeze({
    weaponId,
    slotKind,
    defeatThreshold,
    moduleId: targetingComputerModuleId(weaponId),
  });
}
