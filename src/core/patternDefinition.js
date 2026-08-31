import { createProjectile } from './projectile.js';
import { CANON_STATUSES, CONTENT_SCHEMA_VERSION, isCompatibleSchemaVersion, isNonEmptyString, isPlainObject, isStringArray } from './contentSchema.js';

export const PATTERN_SCHEMA_VERSION = CONTENT_SCHEMA_VERSION;
export const PATTERN_EMITTER_KINDS = ['aimed', 'radial', 'sequentialRadial'];

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
    sequenceIndex: 0,
  };
}

export function firePattern(definitionOrState, source, target, rng) {
  const state = definitionOrState?.definition ? definitionOrState : null;
  const definition = state?.definition ?? definitionOrState;
  const report = validatePatternDefinition(definition);
  if (!report.valid) {
    throw new Error(`Invalid pattern "${definition?.assetId ?? 'unknown'}": ${report.errors.join(' ')}`);
  }
  const emitter = definition.emitter;
  if (emitter.kind === 'aimed') return fireAimed(emitter, source, target, rng);
  if (emitter.kind === 'radial') return fireRadial(emitter, source, rng);
  if (emitter.kind === 'sequentialRadial') return fireSequentialRadial(emitter, state, source, target, rng);
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

function fireSequentialRadial(emitter, state, source, target, rng) {
  const count = emitter.count ?? 1;
  const index = state ? state.sequenceIndex % count : 0;
  if (state) state.sequenceIndex = (state.sequenceIndex + 1) % count;
  const jitter = emitter.jitterRadians ?? 0;
  const angle = (emitter.startAngle ?? 0) + (Math.PI * 2 * index) / count + (rng?.range(-jitter, jitter) ?? 0);
  return [createPatternProjectile(source, emitter, angle, target, rng)];
}

function createPatternProjectile(source, emitter, angle, target = null, rng = null) {
  const projectile = emitter.projectile;
  const speed = emitter.speed ?? projectile.projectileSpeed ?? projectile.speed ?? 0;
  return createProjectile(source.x, source.y, Math.cos(angle) * speed, Math.sin(angle) * speed, {
    team: projectile.team ?? 'enemy',
    weapon: projectile.weapon ?? 'bullet',
    behavior: projectile.behavior ?? 'ballistic',
    angle,
    radius: projectile.radius,
    color: projectile.color,
    damage: projectile.damage,
    impulse: projectile.impulse,
    lifetime: projectile.lifetime,
    verticalVelocity: projectile.verticalVelocity ?? projectile.vz ?? 0,
    gravity: projectile.gravity ?? 0,
    maxArcHeight: projectile.maxArcHeight ?? projectile.arcHeight ?? 1,
    shadowRadius: projectile.shadowRadius ?? projectile.radius,
    delayBeforeAcceleration: projectile.delayBeforeAcceleration ?? 0,
    stopBeforeAcceleration: projectile.stopBeforeAcceleration,
    acceleration: projectile.acceleration ?? 0,
    accelerationDuration: projectile.accelerationDuration ?? Infinity,
    accelerationTarget: target,
    accelerationJitter: rng?.range(-(projectile.accelerationSpreadRadians ?? 0), projectile.accelerationSpreadRadians ?? 0) ?? 0,
    maxSpeed: projectile.maxSpeed ?? Infinity,
    explodeAfterAcceleration: projectile.explodeAfterAcceleration,
    blastOnExpire: projectile.blastOnExpire,
    vanishOffscreen: projectile.vanishOffscreen,
    absorbsPlayerProjectiles: projectile.absorbsPlayerProjectiles,
    absorbHp: projectile.absorbHp,
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
  if (emitter.sequenceRest != null) validateNumber(emitter.sequenceRest, 'emitter.sequenceRest', errors, { min: 0 });
  if (emitter.spreadRadians != null) validateNumber(emitter.spreadRadians, 'emitter.spreadRadians', errors, { min: 0 });
  if (emitter.jitterRadians != null) validateNumber(emitter.jitterRadians, 'emitter.jitterRadians', errors, { min: 0 });
  if ((emitter.kind === 'aimed' || emitter.kind === 'sequentialRadial') && emitter.target !== 'player') warnings.push('Aimed pattern target is not currently available in Prototype 0.');
  validateProjectile(emitter.projectile, errors);
}

function validateProjectile(projectile, errors) {
  if (!isPlainObject(projectile)) {
    errors.push('emitter.projectile must be an object.');
    return;
  }
  if (!['player', 'enemy'].includes(projectile.team)) errors.push('emitter.projectile.team must be player or enemy.');
  if (!['ballistic', 'homing', 'beam', 'blast', 'arc'].includes(projectile.behavior)) errors.push('emitter.projectile.behavior is not available.');
  validateNumber(projectile.radius, 'emitter.projectile.radius', errors, { min: 0 });
  if (projectile.color != null && typeof projectile.color !== 'string') errors.push('emitter.projectile.color must be a string when provided.');
  if (projectile.absorbHp != null) validateNumber(projectile.absorbHp, 'emitter.projectile.absorbHp', errors, { min: 0 });
  validateNumber(projectile.damage, 'emitter.projectile.damage', errors, { min: 0 });
  validateNumber(projectile.impulse, 'emitter.projectile.impulse', errors, { min: 0 });
  validateNumber(projectile.lifetime, 'emitter.projectile.lifetime', errors, { min: 0 });
  if (projectile.verticalVelocity != null) validateNumber(projectile.verticalVelocity, 'emitter.projectile.verticalVelocity', errors, { min: 0 });
  if (projectile.vz != null) validateNumber(projectile.vz, 'emitter.projectile.vz', errors, { min: 0 });
  if (projectile.gravity != null) validateNumber(projectile.gravity, 'emitter.projectile.gravity', errors, { min: 0 });
  if (projectile.maxArcHeight != null) validateNumber(projectile.maxArcHeight, 'emitter.projectile.maxArcHeight', errors, { min: 0.001 });
  if (projectile.arcHeight != null) validateNumber(projectile.arcHeight, 'emitter.projectile.arcHeight', errors, { min: 0.001 });
  if (projectile.shadowRadius != null) validateNumber(projectile.shadowRadius, 'emitter.projectile.shadowRadius', errors, { min: 0 });
  if (projectile.delayBeforeAcceleration != null) validateNumber(projectile.delayBeforeAcceleration, 'emitter.projectile.delayBeforeAcceleration', errors, { min: 0 });
  if (projectile.acceleration != null) validateNumber(projectile.acceleration, 'emitter.projectile.acceleration', errors, { min: 0 });
  if (projectile.accelerationDuration != null) validateNumber(projectile.accelerationDuration, 'emitter.projectile.accelerationDuration', errors, { min: 0 });
  if (projectile.maxSpeed != null) validateNumber(projectile.maxSpeed, 'emitter.projectile.maxSpeed', errors, { min: 0 });
  if (projectile.accelerationSpreadRadians != null) validateNumber(projectile.accelerationSpreadRadians, 'emitter.projectile.accelerationSpreadRadians', errors, { min: 0 });
  if (projectile.blastOnExpire != null) validateBlastOnExpire(projectile.blastOnExpire, errors);
}

function validateBlastOnExpire(blast, errors) {
  if (!isPlainObject(blast)) {
    errors.push('emitter.projectile.blastOnExpire must be an object when provided.');
    return;
  }
  validateNumber(blast.radius, 'emitter.projectile.blastOnExpire.radius', errors, { min: 0 });
  validateNumber(blast.damage, 'emitter.projectile.blastOnExpire.damage', errors, { min: 0 });
  validateNumber(blast.impulse ?? 0, 'emitter.projectile.blastOnExpire.impulse', errors, { min: 0 });
}

function validateNumber(value, label, errors, options = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${label} must be a finite number.`);
    return;
  }
  if (options.integer && !Number.isInteger(value)) errors.push(`${label} must be an integer.`);
  if (options.min != null && value < options.min) errors.push(`${label} must be at least ${options.min}.`);
}
