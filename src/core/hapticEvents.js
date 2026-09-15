export const HAPTIC_EVENTS = {
  PLAYER_VOXEL_DAMAGE: 'player-voxel-damage',
  PLAYER_CELL_LOSS: 'player-cell-loss',
  PLAYER_WEAPON_FIRE: 'player-weapon-fire',
  AMBIENT_OCEAN_WAVES: 'ambient-ocean-waves',
  AMBIENT_ROLLING_THUNDER: 'ambient-rolling-thunder',
  AMBIENT_STORM_WIND: 'ambient-storm-wind',
};

export function emitHapticEvent(game, id, options = {}) {
  if (!game || !id) return;
  if (!Array.isArray(game.hapticEvents)) game.hapticEvents = [];
  game.hapticEvents.push({ id, ...options });
}

export function consumeHapticEvents(game) {
  const events = Array.isArray(game?.hapticEvents) ? [...game.hapticEvents] : [];
  if (game) game.hapticEvents = [];
  return events;
}
