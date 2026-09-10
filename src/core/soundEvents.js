export const SOUND_EVENTS = {
  PLAYER_MAIN_GUN: 'player-main-gun',
  PLAYER_SECONDARY_LAUNCH: 'player-secondary-launch',
  PLAYER_BEAM: 'player-beam',
  PLAYER_EXPLOSION: 'player-explosion',
  ENEMY_BULLET: 'enemy-bullet',
  ENEMY_BEAM: 'enemy-beam',
  ENEMY_DEATH: 'enemy-death',
  BOSS_INTERNAL_EXPLOSION_1: 'boss-internal-explosion-1',
  BOSS_INTERNAL_EXPLOSION_2: 'boss-internal-explosion-2',
  BOSS_MAIN_EXPLOSION_1: 'boss-main-explosion-1',
  BOSS_MAIN_EXPLOSION_2: 'boss-main-explosion-2',
  STAGE_VICTORY: 'stage-victory',
  MOTH_COUNTDOWN: 'moth-countdown',
  PIRATE_YARGH: 'pirate-yargh',
  PIRATE_NO_QUARTER: 'pirate-no-quarter',
  PIRATE_BROADSIDE: 'pirate-broadside',
  PIRATE_AVAST: 'pirate-avast',
  PIRATE_BOSS_ENTRANCE: 'pirate-boss-entrance',
  PIRATE_BOSS_DEFEAT: 'pirate-boss-defeat',
  KRAKEN_ENTER: 'kraken-enter',
  KRAKEN_DEFEATED: 'kraken-defeated',
};

export function emitSoundEvent(game, id) {
  if (!game || !id) return;
  if (!Array.isArray(game.soundEvents)) game.soundEvents = [];
  game.soundEvents.push({ id });
}

export function consumeSoundEvents(game) {
  const events = Array.isArray(game?.soundEvents) ? [...game.soundEvents] : [];
  if (game) game.soundEvents = [];
  return events;
}
