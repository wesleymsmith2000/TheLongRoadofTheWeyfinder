import { CELL_SIZE } from './voxelMask.js';
import { CANON_STATUSES, CONTENT_SCHEMA_VERSION, isCompatibleSchemaVersion, isNonEmptyString, isPlainObject, isStringArray } from './contentSchema.js';

export const WEAPON_SCHEMA_VERSION = CONTENT_SCHEMA_VERSION;
export const PROJECTILE_BEHAVIORS = ['ballistic', 'homing', 'beam', 'blast', 'arc'];
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
    verticalVelocity: projectile.verticalVelocity ?? projectile.vz ?? 0,
    gravity: projectile.gravity ?? 0,
    maxArcHeight: projectile.maxArcHeight ?? projectile.arcHeight ?? 1,
    shadowRadius: projectile.shadowRadius ?? projectile.radius,
    length: projectile.length ?? 0,
    turnRate: projectile.turnRate ?? 0,
    acceleration: projectile.acceleration ?? 0,
    maxSpeed: projectile.maxSpeed ?? projectile.projectileSpeed ?? projectile.speed ?? Infinity,
    usesVehicleVelocityOnly: Boolean(projectile.usesVehicleVelocityOnly),
    targetHint: projectile.targetHint ?? null,
    detonateAtTarget: Boolean(projectile.detonateAtTarget),
    blastDamage: projectile.blastDamage ?? 0,
    blastRadius: projectile.blastRadius ?? (projectile.blastRadiusCells != null ? projectile.blastRadiusCells * CELL_SIZE : 0),
    blastKnockback: projectile.blastKnockback ?? 0,
    shrapnelCount: projectile.shrapnelCount ?? 0,
    shrapnelDamageScale: projectile.shrapnelDamageScale ?? 1,
    pierce: projectile.pierce ?? 0,
    pierceDamageScale: projectile.pierceDamageScale ?? 0.7,
    pierceDamageFalloff: projectile.pierceDamageFalloff ?? 0.68,
    frames: projectile.frames ?? 0,
    destructible: Boolean(projectile.destructible),
    shape: projectile.shape ?? null,
    contrail: projectile.contrail ?? null,
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
  validateNumber(projectile.pierce ?? 0, 'projectile.pierce', errors, { min: 0 });
  validateNumber(projectile.pierceDamageScale ?? 0.7, 'projectile.pierceDamageScale', errors, { min: 0 });
  validateNumber(projectile.pierceDamageFalloff ?? 0.68, 'projectile.pierceDamageFalloff', errors, { min: 0, max: 1 });
  if (projectile.verticalVelocity != null) validateNumber(projectile.verticalVelocity, 'projectile.verticalVelocity', errors, { min: 0 });
  if (projectile.vz != null) validateNumber(projectile.vz, 'projectile.vz', errors, { min: 0 });
  if (projectile.gravity != null) validateNumber(projectile.gravity, 'projectile.gravity', errors, { min: 0 });
  if (projectile.maxArcHeight != null) validateNumber(projectile.maxArcHeight, 'projectile.maxArcHeight', errors, { min: 0.001 });
  if (projectile.arcHeight != null) validateNumber(projectile.arcHeight, 'projectile.arcHeight', errors, { min: 0.001 });
  if (projectile.shadowRadius != null) validateNumber(projectile.shadowRadius, 'projectile.shadowRadius', errors, { min: 0 });
  if (projectile.behavior === 'arc' && (projectile.gravity ?? 0) <= 0) warnings.push('Arc projectile has no positive gravity.');
  if (projectile.behavior === 'arc' && (projectile.verticalVelocity ?? projectile.vz ?? 0) <= 0) warnings.push('Arc projectile has no positive verticalVelocity.');
  if (projectile.behavior === 'homing' && (projectile.turnRate ?? 0) <= 0) warnings.push('Homing projectile has no positive turnRate.');
  if (projectile.behavior === 'homing' && (projectile.acceleration ?? 0) <= 0) warnings.push('Homing projectile has no positive acceleration.');
  validateProjectileHull(projectile, errors, warnings);
  validateContrail(projectile.contrail, errors);
}

function validateNumber(value, label, errors, options = {}) {
  if (options.allowInfinity && value === Infinity) return;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${label} must be a finite number.`);
    return;
  }
  if (options.integer && !Number.isInteger(value)) errors.push(`${label} must be an integer.`);
  if (options.min != null && value < options.min) errors.push(`${label} must be at least ${options.min}.`);
  if (options.max != null && value > options.max) errors.push(`${label} must be at most ${options.max}.`);
}

function validateProjectileHull(projectile, errors, warnings) {
  if (!projectile.destructible) {
    if (projectile.shape != null) warnings.push('projectile.shape is ignored unless projectile.destructible is true.');
    return;
  }
  if (!isPlainObject(projectile.shape)) {
    errors.push('projectile.shape is required when projectile.destructible is true.');
    return;
  }
  if (projectile.shape.kind !== 'cylinderCone') errors.push('projectile.shape.kind must be cylinderCone.');
  validateNumber(projectile.shape.armorVoxelHp ?? 10, 'projectile.shape.armorVoxelHp', errors, { min: 0.001 });
  validateNumber(projectile.shape.bodyLength ?? 12, 'projectile.shape.bodyLength', errors, { min: 0.001 });
  validateNumber(projectile.shape.coneLength ?? 5, 'projectile.shape.coneLength', errors, { min: 0.001 });
  validateNumber(projectile.shape.halfWidth ?? projectile.radius, 'projectile.shape.halfWidth', errors, { min: 0.001 });
  validateVoxelGrid(projectile.shape.bodyVoxels, 'projectile.shape.bodyVoxels', errors);
  validateVoxelGrid(projectile.shape.coneVoxels, 'projectile.shape.coneVoxels', errors);
}

function validateVoxelGrid(grid, label, errors) {
  if (grid == null) return;
  if (!isPlainObject(grid)) {
    errors.push(`${label} must be an object when provided.`);
    return;
  }
  validateNumber(grid.columns, `${label}.columns`, errors, { min: 1, integer: true });
  validateNumber(grid.rows, `${label}.rows`, errors, { min: 1, integer: true });
}

function validateContrail(contrail, errors) {
  if (contrail == null) return;
  if (!isPlainObject(contrail)) {
    errors.push('projectile.contrail must be an object when provided.');
    return;
  }
  validateNumber(contrail.emissionMeanPerSevenFrames ?? 0, 'projectile.contrail.emissionMeanPerSevenFrames', errors, { min: 0 });
  validateNumber(contrail.maxParticlesPerStep ?? 0, 'projectile.contrail.maxParticlesPerStep', errors, { min: 0, integer: true });
  if (contrail.particleLifetimeFrames != null) {
    if (!Array.isArray(contrail.particleLifetimeFrames) || contrail.particleLifetimeFrames.length !== 2) {
      errors.push('projectile.contrail.particleLifetimeFrames must be a two-number array when provided.');
    } else {
      validateNumber(contrail.particleLifetimeFrames[0], 'projectile.contrail.particleLifetimeFrames[0]', errors, { min: 0 });
      validateNumber(contrail.particleLifetimeFrames[1], 'projectile.contrail.particleLifetimeFrames[1]', errors, { min: 0 });
    }
  }
  if (contrail.colors != null && !isStringArray(contrail.colors)) errors.push('projectile.contrail.colors must be an array of strings when provided.');
}
