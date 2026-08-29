import { CELL_SIZE } from './voxelMask.js';
import { CANON_STATUSES, CONTENT_SCHEMA_VERSION, isCompatibleSchemaVersion, isNonEmptyString, isPlainObject, isStringArray } from './contentSchema.js';

export const WEAPON_SCHEMA_VERSION = CONTENT_SCHEMA_VERSION;
export const PROJECTILE_BEHAVIORS = ['ballistic', 'homing', 'beam', 'blast'];
export const PROJECTILE_TEAMS = ['player', 'enemy'];

export function validateWeaponDefinition(definition) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(definition)) return { valid: false, errors: ['Weapon definition must be an object.'], warnings };

  if (!isCompatibleSchemaVersion(definition.schemaVersion)) {
    errors.push(`Unsupported weapon schemaVersion "${definition.schemaVersion ?? 'missing'}". Expected 0.x.`);
  }
  if (!isNonEmptyString(definition.assetId)) errors.push('assetId must be a non-empty string.');
  if (definition.canonStatus != null && !CANON_STATUSES.includes(definition.canonStatus)) {
    errors.push(`canonStatus must be one of: ${CANON_STATUSES.join(', ')}.`);
  }
  validateNumber(definition.ammo, 'ammo', errors, { min: 0, allowInfinity: true });
  validateNumber(definition.heat, 'heat', errors, { min: 0 });
  validateNumber(definition.cooldown, 'cooldown', errors, { min: 0 });
  if (definition.tags != null && !isStringArray(definition.tags)) warnings.push('tags should be an array of strings.');
  if (definition.dependencies != null && !isStringArray(definition.dependencies)) warnings.push('dependencies should be an array of strings.');

  validateProjectile(definition.projectile, errors, warnings);
  if (definition.projectile?.behavior === 'beam' && (definition.projectile.length ?? 0) <= 0) {
    warnings.push('Beam weapon has no positive length.');
  }
  if ((definition.ammo ?? 0) === 0) warnings.push('Weapon has no ammo capacity.');
  if ((definition.projectile?.damage ?? 0) <= 0 && definition.projectile?.behavior !== 'blast') warnings.push('Weapon projectile has no positive damage.');

  return { valid: errors.length === 0, errors, warnings };
}

export function runtimeWeaponDefinition(definition) {
  const report = validateWeaponDefinition(definition);
  if (!report.valid) {
    throw new Error(`Invalid weapon "${definition?.assetId ?? 'unknown'}": ${report.errors.join(' ')}`);
  }
  const projectile = definition.projectile;
  return {
    id: definition.assetId,
    displayName: definition.displayName ?? definition.assetId,
    ammo: definition.ammo,
    heat: definition.heat,
    cooldown: definition.cooldown,
    projectileSpeed: projectile.projectileSpeed ?? projectile.speed ?? 0,
    radius: projectile.radius,
    damage: projectile.damage,
    impulse: projectile.impulse,
    behavior: projectile.behavior,
    lifetime: projectile.lifetime,
    length: projectile.length ?? 0,
    turnRate: projectile.turnRate ?? 0,
    acceleration: projectile.acceleration ?? 0,
    maxSpeed: projectile.maxSpeed ?? projectile.projectileSpeed ?? projectile.speed ?? Infinity,
    usesVehicleVelocityOnly: Boolean(projectile.usesVehicleVelocityOnly),
    targetHint: projectile.targetHint ?? null,
    blastDamage: projectile.blastDamage ?? 0,
    blastRadius: projectile.blastRadius ?? (projectile.blastRadiusCells != null ? projectile.blastRadiusCells * CELL_SIZE : 0),
    blastKnockback: projectile.blastKnockback ?? 0,
    shrapnelCount: projectile.shrapnelCount ?? 0,
    shrapnelDamageScale: projectile.shrapnelDamageScale ?? 1,
    pierce: projectile.pierce ?? 0,
    frames: projectile.frames ?? 0,
  };
}

function validateProjectile(projectile, errors, warnings) {
  if (!isPlainObject(projectile)) {
    errors.push('projectile must be an object.');
    return;
  }
  if (projectile.team != null && !PROJECTILE_TEAMS.includes(projectile.team)) {
    errors.push(`projectile.team must be one of: ${PROJECTILE_TEAMS.join(', ')}.`);
  }
  if (!PROJECTILE_BEHAVIORS.includes(projectile.behavior)) {
    errors.push(`projectile.behavior must be one of: ${PROJECTILE_BEHAVIORS.join(', ')}.`);
  }
  validateNumber(projectile.projectileSpeed ?? projectile.speed ?? 0, 'projectile.projectileSpeed', errors, { min: 0 });
  validateNumber(projectile.radius, 'projectile.radius', errors, { min: 0 });
  validateNumber(projectile.damage, 'projectile.damage', errors, { min: 0 });
  validateNumber(projectile.impulse, 'projectile.impulse', errors, { min: 0 });
  validateNumber(projectile.lifetime, 'projectile.lifetime', errors, { min: 0 });
  if (projectile.behavior === 'homing' && (projectile.turnRate ?? 0) <= 0) warnings.push('Homing projectile has no positive turnRate.');
  if (projectile.behavior === 'homing' && (projectile.acceleration ?? 0) <= 0) warnings.push('Homing projectile has no positive acceleration.');
}

function validateNumber(value, label, errors, options = {}) {
  if (options.allowInfinity && value === Infinity) return;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${label} must be a finite number.`);
    return;
  }
  if (options.min != null && value < options.min) errors.push(`${label} must be at least ${options.min}.`);
}
