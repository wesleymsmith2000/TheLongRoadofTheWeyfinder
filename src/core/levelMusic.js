export const DEFAULT_LEVEL_MUSIC = [
  'TheWeyfindersRoad_1',
  'TheWeyfindersRoad_2',
  'TheWeyfindersRoad_3',
  'BossFight_1',
  'DigitizedStream_1',
  'DigitizedStream_2',
  'BossFight_2',
  'PiratesRoad_1',
  'PiratesRoad_2',
  'PiratesRoad_BossFight',
  'StarlightRoad_1',
  'StarlightRoad_2',
  'TwilightCrossroads',
  'TwilightCrossroads_BossFight',
  'ShadowedRoad_1',
  'ShadowedRoad_BossFight_1',
  'ShadowedRoad_2',
  'ShadowedRoad_BossFight_2',
  'GhostForrestPathway_1',
  'GhostForrestBanshee_BossFight_1',
  'GhostForrestPathway_2',
  'GhostForrestBanshee_BossFight_2',
  'ShadowedDesert_Journey',
  'ShadowedDesert_Journey_1',
  'ShadowedDesert_OminousStormfront',
  'ShadowedDesert_BossFight',
  'ShadowedDesert_Journey_2',
  'ShadowedDesert_Journey_3',
  'ShadowedDesert_OminousStormfront_1',
  'ShadowedDesert_BossFight_1',
  'FreedomsPass_Journey',
  'FreedomsPass_DarkeningSkies',
  'FreedomsPass_StormsOfFatesShadow',
  'FreedomsPass_BossFight',
];

export function musicForLevel(level, tracks = DEFAULT_LEVEL_MUSIC) {
  if (!Array.isArray(tracks) || tracks.length === 0) return null;
  const index = Math.max(0, level - 1) % tracks.length;
  return tracks[index];
}

export function isBossMusic(trackName) {
  return /boss(?:fight)?/i.test(trackName ?? '');
}

export function hasBossMusicBeforeLevel(level, tracks = DEFAULT_LEVEL_MUSIC) {
  for (let current = 1; current < level; current += 1) {
    if (isBossMusic(musicForLevel(current, tracks))) return true;
  }
  return false;
}
