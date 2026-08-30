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
];

export function achievementStatsFromGame(game) {
  return {
    levelsCompleted: game.levelsCompleted ?? 0,
    bossLevelsCompleted: game.bossLevelsCompleted ?? 0,
    scrapCollected: game.score?.scrapCollected ?? 0,
    damageDone: game.score?.damageDone ?? 0,
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
  if (equipment.length === 0) return 'Reward pending';
  return equipment.map(([type, amount]) => `+${amount} ${labelForEquipment(type)}`).join(', ');
}

function applyReward(account, reward) {
  for (const [type, amount] of Object.entries(reward.equipment ?? {})) {
    account.equipment ??= {};
    account.equipment[type] ??= { unlocked: true, quantity: 0 };
    account.equipment[type].unlocked = true;
    account.equipment[type].quantity = Math.max(0, account.equipment[type].quantity ?? 0) + amount;
  }
}

function labelForEquipment(type) {
  if (type === 'armor') return 'armor plates';
  if (type === 'gun') return 'gun module';
  if (type === 'engine') return 'engine module';
  if (type === 'wheel') return 'wheel module';
  return type;
}
