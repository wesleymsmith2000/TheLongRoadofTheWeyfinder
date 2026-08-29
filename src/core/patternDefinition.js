import { createProjectile } from './projectile.js';
import { CANON_STATUSES, CONTENT_SCHEMA_VERSION, isCompatibleSchemaVersion, isNonEmptyString, isPlainObject, isStringArray } from './contentSchema.js';

export const PATTERN_SCHEMA_VERSION = CONTENT_SCHEMA_VERSION;
export const PATTERN_EMITTER_KINDS = ['aimed', 'radial'];

export function validatePatternDefinition(definition) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(definition)) return { valid: false, errors: ['Pattern definition must be an object.'], warnings };

  if (!isCompatibleSchemaVersion(definition.schemaVersion)) {
    errors.push(`Unsupported pattern schemaVersion "${definition.schemaVersion ?? 'missing'}". Expected 0.x.`);
  }
  if (!isNonEmptyString(definition.assetId)) errors.push('assetId must be a non-empty string.');
  if (definition.canonStatus != null && !CANON_STATUSES.includes(definition.canonStatus)) {
    errors.push(`canonStatus must be one of: ${CANON_STATUSES.join(', ')}.`);
  }
  validateNumber(definition.initialDelay ?? 0, 'initialDelay', errors, { min: 0 });
  validateNumber(definition.interval, 'interval', errors, { min: 0.001 });
  if (definition.tags != null && !isStringArray(definition.tags)) warnings.push('tags should be an array of strings.');
  validateEmitter(definition.emitter, errors, warnings);

  if ((definition.emitter?.count ?? 0) === 0) warnings.push('Pattern emits no projectiles.');
  if ((definition.emitter?.projectile?.damage ?? 0) <= 0) warnings.push('Pattern projectile has no positive damage.');

  return { valid: errors.length === 0, errors, warnings };
}

export function createPatternState(definition) {
  const report = validatePatternDefinition(definition);
  if (!report.valid) {
    throw new Error(`Invalid pattern "${definition?.assetId ?? 'unknown'}": ${report.errors.join(' ')}`);
  }
  return {
    definition,
    timer: definition.initialDelay ?? definition.interval,
  };
}

export function firePattern(definition, source, target, rng) {
  const report = validatePatternDefinition(definition);
  if (!report.valid) {
    throw new Error(`Invalid pattern "${definition?.assetId ?? 'unknown'}": ${report.errors.join(' ')}`);
  }
  const emitter = definition.emitter;
  if (emitter.kind === 'aimed') return fireAimed(emitter, source, target, rng);
  if (emitter.kind === 'radial') return fireRadial(emitter, source, rng);
  return [];
}

function fireAimed(emitter, source, target, rng) {
  if (!target) return [];
  const count = emitter.count ?? 1;
  const baseAngle = Math.atan2(target.y - source.y, target.x - source.x);
  const spread = emitter.spreadRadians ?? 0;
  const projectiles = [];
  for (let index = 0; index < count; index += 1) {
    const offset = count === 1 ? rng?.range(-spread, spread) ?? 0 : spreadOffset(index, count, spread);
    projectiles.push(createPatternProjectile(source, emitter, baseAngle + offset));
  }
  return projectiles;
}

function fireRadial(emitter, source, rng) {
  const count = emitter.count ?? 1;
  const jitter = emitter.jitterRadians ?? 0;
  const startAngle = emitter.startAngle ?? 0;
  const projectiles = [];
  for (let index = 0; index < count; index += 1) {
    const angle = startAngle + (Math.PI * 2 * index) / count + (rng?.range(-jitter, jitter) ?? 0);
    projectiles.push(createPatternProjectile(source, emitter, angle));
  }
  return projectiles;
}

function createPatternProjectile(source, emitter, angle) {
  const projectile = emitter.projectile;
  const speed = emitter.speed ?? projectile.projectileSpeed ?? projectile.speed ?? 0;
  return createProjectile(source.x, source.y, Math.cos(angle) * speed, Math.sin(angle) * speed, {
    team: projectile.team ?? 'enemy',
    weapon: projectile.weapon ?? 'bullet',
    behavior: projectile.behavior ?? 'ballistic',
    angle,
    radius: projectile.radius,
    damage: projectile.damage,
    impulse: projectile.impulse,
    lifetime: projectile.lifetime,
  });
}

function spreadOffset(index, count, spread) {
  if (count <= 1) return 0;
  return ((index / (count - 1)) - 0.5) * spread * 2;
}

function validateEmitter(emitter, errors, warnings) {
  if (!isPlainObject(emitter)) {
    errors.push('emitter must be an object.');
    return;
  }
  if (!PATTERN_EMITTER_KINDS.includes(emitter.kind)) {
    errors.push(`emitter.kind must be one of: ${PATTERN_EMITTER_KINDS.join(', ')}.`);
  }
  validateNumber(emitter.count, 'emitter.count', errors, { min: 0, integer: true });
  validateNumber(emitter.speed, 'emitter.speed', errors, { min: 0 });
  if (emitter.spreadRadians != null) validateNumber(emitter.spreadRadians, 'emitter.spreadRadians', errors, { min: 0 });
  if (emitter.jitterRadians != null) validateNumber(emitter.jitterRadians, 'emitter.jitterRadians', errors, { min: 0 });
  if (emitter.kind === 'aimed' && emitter.target !== 'player') warnings.push('Aimed pattern target is not currently available in Prototype 0.');
  validateProjectile(emitter.projectile, errors);
}

function validateProjectile(projectile, errors) {
  if (!isPlainObject(projectile)) {
    errors.push('emitter.projectile must be an object.');
    return;
  }
  if (!['player', 'enemy'].includes(projectile.team)) errors.push('emitter.projectile.team must be player or enemy.');
  if (!['ballistic', 'homing', 'beam', 'blast'].includes(projectile.behavior)) errors.push('emitter.projectile.behavior is not available.');
  validateNumber(projectile.radius, 'emitter.projectile.radius', errors, { min: 0 });
  validateNumber(projectile.damage, 'emitter.projectile.damage', errors, { min: 0 });
  validateNumber(projectile.impulse, 'emitter.projectile.impulse', errors, { min: 0 });
  validateNumber(projectile.lifetime, 'emitter.projectile.lifetime', errors, { min: 0 });
}

function validateNumber(value, label, errors, options = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${label} must be a finite number.`);
    return;
  }
  if (options.integer && !Number.isInteger(value)) errors.push(`${label} must be an integer.`);
  if (options.min != null && value < options.min) errors.push(`${label} must be at least ${options.min}.`);
}
