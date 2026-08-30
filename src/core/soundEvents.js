export const SOUND_EVENTS = {
  PLAYER_MAIN_GUN: 'player-main-gun',
  PLAYER_SECONDARY_LAUNCH: 'player-secondary-launch',
  PLAYER_BEAM: 'player-beam',
  PLAYER_EXPLOSION: 'player-explosion',
  ENEMY_BULLET: 'enemy-bullet',
  ENEMY_BEAM: 'enemy-beam',
  ENEMY_DEATH: 'enemy-death',
  STAGE_VICTORY: 'stage-victory',
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
