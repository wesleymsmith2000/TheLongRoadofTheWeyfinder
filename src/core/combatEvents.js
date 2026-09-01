export const SPECIAL_DEFEAT_HOOKS = Object.freeze({
  inchwormAllSegmentsFirst: 'inchwormAllSegmentsFirst',
  frogDistractedByConstruct: 'frogDistractedByConstruct',
  buzzardLandedForScrap: 'buzzardLandedForScrap',
});

export const ACTIVITY_FLAGS = Object.freeze({
  distractedByEnemy: 'distractedByEnemy',
  distractedByConstruct: 'distractedByConstruct',
  collectingScrap: 'collectingScrap',
  landedForScrap: 'landedForScrap',
  phasedIn: 'phasedIn',
  phasedOut: 'phasedOut',
  firingSequence: 'firingSequence',
});

export const TARGET_CONDITIONS = Object.freeze({
  targetIsDistracted: 'targetIsDistracted',
  targetIsCollectingScrap: 'targetIsCollectingScrap',
  targetIsLandedForScrap: 'targetIsLandedForScrap',
  targetIsPhasedIn: 'targetIsPhasedIn',
  targetIsDamaged: 'targetIsDamaged',
});

export function createCombatEventStats() {
  return {
    enemyDefeats: {},
    specialDefeats: {},
  };
}

export function recordEnemyDefeat(score, enemy) {
  const id = enemy?.archetypeId ?? enemy?.assetId ?? enemy?.kind;
  if (!id) return score;
  score.enemyDefeats ??= {};
  score.enemyDefeats[id] = (score.enemyDefeats[id] ?? 0) + 1;
  return score;
}

export function recordSpecialDefeat(score, hook) {
  if (!Object.values(SPECIAL_DEFEAT_HOOKS).includes(hook)) return score;
  score.specialDefeats ??= {};
  score.specialDefeats[hook] = (score.specialDefeats[hook] ?? 0) + 1;
  return score;
}

export function targetMatchesCondition(target, condition) {
  const flags = target?.activityFlags ?? {};
  if (condition === TARGET_CONDITIONS.targetIsDistracted) return Boolean(flags.distractedByEnemy || flags.distractedByConstruct);
  if (condition === TARGET_CONDITIONS.targetIsCollectingScrap) return Boolean(flags.collectingScrap);
  if (condition === TARGET_CONDITIONS.targetIsLandedForScrap) return Boolean(flags.landedForScrap);
  if (condition === TARGET_CONDITIONS.targetIsPhasedIn) return Boolean(flags.phasedIn);
  if (condition === TARGET_CONDITIONS.targetIsDamaged) return (target?.damageTaken ?? 0) > 0;
  return false;
}
