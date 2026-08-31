import { CONTENT_SCHEMA_VERSION, isCompatibleSchemaVersion, isPlainObject } from './contentSchema.js';

export const SAVE_STATE_SCHEMA_VERSION = CONTENT_SCHEMA_VERSION;
export const SAVE_STATE_KIND = 'weyfinder.prototype0.save';

export function createSaveState(game, playerAccount, options = {}) {
  const payload = {
    savedAt: options.savedAt ?? new Date().toISOString(),
    seed: options.seed ?? 1147,
    playerAccount: structuredClone(playerAccount),
    vehicleDefinition: structuredClone(game.vehicleDefinition ?? playerAccount?.savedVehicle ?? null),
    level: game.level,
    levelStartTime: game.levelStartTime,
    levelTimes: [...(game.levelTimes ?? [])],
    levelsCompleted: game.levelsCompleted ?? 0,
    bossLevelsCompleted: game.bossLevelsCompleted ?? 0,
    scrap: game.scrap ?? 0,
    upgrades: structuredClone(game.upgrades ?? {}),
    secondary: structuredClone(game.secondary ?? {}),
    score: structuredClone(game.score ?? {}),
    targetingMode: game.targetingMode ?? 'mixed',
  };
  return signSavePayload(payload);
}

export function signSavePayload(payload) {
  const checksum = checksumPayload(payload);
  return {
    schemaVersion: SAVE_STATE_SCHEMA_VERSION,
    kind: SAVE_STATE_KIND,
    official: true,
    checksum,
    payload,
  };
}

export function validateSaveState(saveState) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(saveState)) return { valid: false, official: false, sandboxRequired: true, errors: ['Save state must be an object.'], warnings };
  if (saveState.kind !== SAVE_STATE_KIND) errors.push(`Save kind must be ${SAVE_STATE_KIND}.`);
  if (!isCompatibleSchemaVersion(saveState.schemaVersion)) errors.push(`Unsupported save schemaVersion "${saveState.schemaVersion ?? 'missing'}". Expected 0.x.`);
  if (!isPlainObject(saveState.payload)) errors.push('payload must be an object.');
  if (errors.length > 0) return { valid: false, official: false, sandboxRequired: true, errors, warnings };
  if (checksumPayload(saveState.payload) !== saveState.checksum) warnings.push('Save checksum does not match. Load as sandbox/unofficial progress only.');
  return {
    valid: true,
    official: warnings.length === 0 && saveState.official === true,
    sandboxRequired: warnings.length > 0 || saveState.official !== true,
    errors,
    warnings,
  };
}

export function applySaveStateToGame(game, saveState) {
  const report = validateSaveState(saveState);
  if (!report.valid) throw new Error(`Invalid save state: ${report.errors.join(' ')}`);
  const payload = saveState.payload;
  game.level = positiveInteger(payload.level, 1);
  game.levelStartTime = numberOr(payload.levelStartTime, game.time);
  game.levelTimes = Array.isArray(payload.levelTimes) ? payload.levelTimes.filter(Number.isFinite) : [];
  game.levelsCompleted = positiveInteger(payload.levelsCompleted, 0);
  game.bossLevelsCompleted = positiveInteger(payload.bossLevelsCompleted, 0);
  game.scrap = positiveInteger(payload.scrap, 0);
  game.upgrades = isPlainObject(payload.upgrades) ? structuredClone(payload.upgrades) : game.upgrades;
  if (isPlainObject(payload.secondary)) game.secondary = structuredClone(payload.secondary);
  game.score = isPlainObject(payload.score) ? structuredClone(payload.score) : game.score;
  game.targetingMode = typeof payload.targetingMode === 'string' ? payload.targetingMode : game.targetingMode;
  game.levelComplete = false;
  game.gameOver = false;
  game.paused = true;
  return { game, report };
}

export function checksumPayload(payload) {
  const text = stableStringify(payload);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function numberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
