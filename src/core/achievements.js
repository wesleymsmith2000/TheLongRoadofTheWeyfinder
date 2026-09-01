import { SPECIAL_DEFEAT_HOOKS } from './combatEvents.js';

export const ACHIEVEMENT_DEFINITIONS = [
  {
    id: 'calmari',
    title: 'Calmari',
    description: 'Defeat the first boss.',
    reward: { equipment: { armor: 2 } },
    earned: (stats) => stats.bossLevelsCompleted >= 1,
  },
  {
    id: 'road-tested',
    title: 'Road Tested',
    description: 'Complete three levels in a run.',
    reward: { equipment: { gun: 1 } },
    earned: (stats) => stats.levelsCompleted >= 3,
  },
  {
    id: 'first-clear',
    title: 'First Road Cleared',
    description: 'Complete one level.',
    reward: { equipment: { engine: 1 } },
    earned: (stats) => stats.levelsCompleted >= 1,
  },
  {
    id: 'scrap-hauler',
    title: 'Scrap Hauler',
    description: 'Collect 50 scrap in a run.',
    reward: { equipment: { wheel: 1 } },
    earned: (stats) => stats.scrapCollected >= 50,
  },
  {
    id: 'damage-scribe',
    title: 'Damage Scribe',
    description: 'Deal 1000 damage in a run.',
    reward: { equipment: { armor: 3 } },
    earned: (stats) => stats.damageDone >= 1000,
  },
  {
    id: 'mortar-combat',
    title: 'Mortar Combat',
    description: 'Defeat 4 mortar boats.',
    reward: { weaponUnlocks: { primary: ['mortar'] } },
    earned: (stats) => (stats.enemyDefeats?.['heavy_mortar_boat.pirates_road'] ?? 0) >= 4,
  },
  {
    id: 'mothra-pillar',
    title: 'Look Out, Its MOTHRA-pillar',
    description: 'Defeat a caterpillar enemy after destroying all of its segments first.',
    reward: { weaponUnlocks: { primary: ['tracking_flechette'] } },
    earned: (stats) => (stats.specialDefeats?.[SPECIAL_DEFEAT_HOOKS.inchwormAllSegmentsFirst] ?? 0) >= 1,
  },
  {
    id: 'danger-skittles',
    title: 'Beware the Danger Skittles',
    description: 'Defeat a frog enemy while it is distracted with another construct.',
    reward: { weaponUnlocks: { primary: ['tractor_beam', 'repulsor_beam'] } },
    earned: (stats) => (stats.specialDefeats?.[SPECIAL_DEFEAT_HOOKS.frogDistractedByConstruct] ?? 0) >= 1,
  },
  {
    id: 'buzz-off',
    title: 'Buzz Off',
    description: 'Defeat a buzzard enemy after it lands to eat scraps.',
    reward: { weaponUnlocks: { secondary: ['sta_missile'] } },
    earned: (stats) => (stats.specialDefeats?.[SPECIAL_DEFEAT_HOOKS.buzzardLandedForScrap] ?? 0) >= 1,
  },
  {
    id: 'leg-up',
    title: 'Getting a Leg Up on the Competition',
    description: 'Defeat a walker enemy.',
    reward: { weaponUnlocks: { secondary: ['orb_of_blades'] } },
    earned: (stats) =>
      (stats.enemyDefeats?.['starlight_walker.prototype0'] ?? 0) + (stats.enemyDefeats?.['twilight_walker.prototype0'] ?? 0) >= 1,
  },
  {
    id: 'crouching-weyfinder-hidden-phantom',
    title: 'Crouching Weyfinder Hidden Phantom',
    description: 'Defeat a ghost.',
    reward: { moduleUnlocks: ['cloaking'] },
    earned: (stats) =>
      (stats.enemyDefeats?.['ghost_phaser.ghost_forrest'] ?? 0) + (stats.enemyDefeats?.['example.ghost_phase_mob.ghost_forrest'] ?? 0) >= 1,
  },
];

export function achievementStatsFromGame(game) {
  return {
    levelsCompleted: game.levelsCompleted ?? 0,
    bossLevelsCompleted: game.bossLevelsCompleted ?? 0,
    scrapCollected: game.score?.scrapCollected ?? 0,
    damageDone: game.score?.damageDone ?? 0,
    enemyDefeats: game.score?.enemyDefeats ?? {},
    specialDefeats: game.score?.specialDefeats ?? {},
  };
}

export function awardAchievements(account, stats) {
  const next = structuredClone(account);
  next.achievements ??= { unlocked: [] };
  next.achievements.unlocked ??= [];
  const unlocked = new Set(next.achievements.unlocked);
  let changed = false;
  for (const achievement of ACHIEVEMENT_DEFINITIONS) {
    if (unlocked.has(achievement.id) || !achievement.earned(stats)) continue;
    unlocked.add(achievement.id);
    applyReward(next, achievement.reward);
    changed = true;
  }
  if (!changed) return account;
  next.achievements.unlocked = [...unlocked];
  return next;
}

export function achievementRewardText(reward) {
  const equipment = Object.entries(reward.equipment ?? {});
  const primaryWeapons = reward.weaponUnlocks?.primary ?? [];
  const secondaryWeapons = reward.weaponUnlocks?.secondary ?? [];
  const modules = reward.moduleUnlocks ?? [];
  const lines = [
    ...equipment.map(([type, amount]) => `+${amount} ${labelForEquipment(type)}`),
    ...primaryWeapons.map((id) => `Unlock ${labelForWeapon(id)} primary`),
    ...secondaryWeapons.map((id) => `Unlock ${labelForWeapon(id)} secondary`),
    ...modules.map((id) => `Unlock ${labelForModule(id)} module`),
  ];
  if (lines.length === 0) return 'Reward pending';
  return lines.join(', ');
}

function applyReward(account, reward) {
  for (const [type, amount] of Object.entries(reward.equipment ?? {})) {
    account.equipment ??= {};
    account.equipment[type] ??= { unlocked: true, quantity: 0 };
    account.equipment[type].unlocked = true;
    account.equipment[type].quantity = Math.max(0, account.equipment[type].quantity ?? 0) + amount;
  }
  for (const [slotKind, weaponIds] of Object.entries(reward.weaponUnlocks ?? {})) {
    account.weaponUnlocks ??= { primary: ['main.basic'], secondary: [] };
    account.weaponUnlocks[slotKind] ??= [];
    const unlocked = new Set(account.weaponUnlocks[slotKind]);
    for (const weaponId of weaponIds) unlocked.add(weaponId);
    account.weaponUnlocks[slotKind] = [...unlocked];
  }
  for (const moduleId of reward.moduleUnlocks ?? []) {
    account.moduleUnlocks ??= [];
    if (!account.moduleUnlocks.includes(moduleId)) account.moduleUnlocks.push(moduleId);
  }
}

function labelForEquipment(type) {
  if (type === 'armor') return 'armor plates';
  if (type === 'gun') return 'gun module';
  if (type === 'engine') return 'engine module';
  if (type === 'wheel') return 'wheel module';
  return type;
}

function labelForWeapon(id) {
  return id
    .replaceAll('_', ' ')
    .replaceAll('.', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function labelForModule(id) {
  return id
    .replaceAll('_', ' ')
    .replaceAll('.', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
