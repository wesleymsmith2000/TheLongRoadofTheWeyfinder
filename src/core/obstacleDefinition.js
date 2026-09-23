import { isPlainObject } from './contentSchema.js';

export const OBSTACLE_MOTION_MODES = ['terrain', 'terrainVelocity', 'chase'];
export const OBSTACLE_COLLISION_MODES = ['none', 'solid', 'trigger'];
export const OBSTACLE_COLLISION_SHAPES = ['circle', 'aabb'];

export function normalizeObstacleDefinition(obstacle = {}) {
  const motion = isPlainObject(obstacle.motion) ? obstacle.motion : {};
  const collision = isPlainObject(obstacle.collision) ? obstacle.collision : {};
  const effects = isPlainObject(obstacle.effects) ? obstacle.effects : {};
  return {
    ...structuredClone(obstacle),
    motion: {
      ...structuredClone(motion),
      mode: enumValue(motion.mode, OBSTACLE_MOTION_MODES, 'terrain'),
      lateralVelocity: finiteNumber(motion.lateralVelocity, 0),
      forwardVelocity: finiteNumber(motion.forwardVelocity, 0),
      lateralAcceleration: finiteNumber(motion.lateralAcceleration, 0),
      forwardAcceleration: finiteNumber(motion.forwardAcceleration, 0),
      maxSpeed: nonNegativeNumber(motion.maxSpeed, 240),
      targetGap: nonNegativeNumber(motion.targetGap, 150),
      triggerSpeed: nonNegativeNumber(motion.triggerSpeed, 30),
      catchUpAcceleration: nonNegativeNumber(motion.catchUpAcceleration, 45),
      positionGain: nonNegativeNumber(motion.positionGain, 0.8),
      lateralTracking: nonNegativeNumber(motion.lateralTracking, 0),
    },
    collision: {
      ...structuredClone(collision),
      mode: enumValue(collision.mode, OBSTACLE_COLLISION_MODES, obstacle.kind === 'decor' ? 'none' : obstacle.kind === 'hazard' ? 'trigger' : 'solid'),
      shape: enumValue(collision.shape, OBSTACLE_COLLISION_SHAPES, 'circle'),
      radius: positiveNumber(collision.radius, null),
      halfWidth: positiveNumber(collision.halfWidth, null),
      halfHeight: positiveNumber(collision.halfHeight, null),
      restitution: rangeNumber(collision.restitution, 0.15, 0, 1),
      friction: rangeNumber(collision.friction, 0.35, 0, 1),
      impactDamageScale: nonNegativeNumber(collision.impactDamageScale, 0),
    },
    effects: {
      ...structuredClone(effects),
      damagePerSecond: nonNegativeNumber(effects.damagePerSecond, 0),
      accelerationScale: nonNegativeNumber(effects.accelerationScale, 1),
      brakingScale: nonNegativeNumber(effects.brakingScale, 1),
      primaryFireRateScale: nonNegativeNumber(effects.primaryFireRateScale, 1),
      secondaryFireRateScale: nonNegativeNumber(effects.secondaryFireRateScale, 1),
      spinoutSeconds: nonNegativeNumber(effects.spinoutSeconds, 0),
      angularImpulse: finiteNumber(effects.angularImpulse, 0),
      force: normalizeVector(effects.force),
      impulse: normalizeVector(effects.impulse),
    },
  };
}

export function validateObstacleDefinition(obstacle, label = 'obstacle') {
  const errors = [];
  if (!isPlainObject(obstacle)) return { valid: false, errors: [`${label} must be an object.`] };
  validateEnum(obstacle.motion?.mode, OBSTACLE_MOTION_MODES, `${label}.motion.mode`, errors);
  validateEnum(obstacle.collision?.mode, OBSTACLE_COLLISION_MODES, `${label}.collision.mode`, errors);
  validateEnum(obstacle.collision?.shape, OBSTACLE_COLLISION_SHAPES, `${label}.collision.shape`, errors);
  validateNumbers(obstacle.motion, `${label}.motion`, errors, [
    'lateralVelocity', 'forwardVelocity', 'lateralAcceleration', 'forwardAcceleration',
    'maxSpeed', 'targetGap', 'triggerSpeed', 'catchUpAcceleration', 'positionGain', 'lateralTracking',
  ]);
  validateNumbers(obstacle.collision, `${label}.collision`, errors, [
    'radius', 'halfWidth', 'halfHeight', 'restitution', 'friction', 'impactDamageScale',
  ]);
  validateNumbers(obstacle.effects, `${label}.effects`, errors, [
    'damagePerSecond', 'accelerationScale', 'brakingScale', 'primaryFireRateScale',
    'secondaryFireRateScale', 'spinoutSeconds', 'angularImpulse',
  ]);
  validateVector(obstacle.effects?.force, `${label}.effects.force`, errors);
  validateVector(obstacle.effects?.impulse, `${label}.effects.impulse`, errors);
  return { valid: errors.length === 0, errors };
}

function normalizeVector(value) {
  if (!isPlainObject(value)) return { lateral: 0, forward: 0 };
  return {
    lateral: finiteNumber(value.lateral ?? value.x, 0),
    forward: finiteNumber(value.forward ?? value.y, 0),
  };
}

function validateVector(value, label, errors) {
  if (value == null) return;
  if (!isPlainObject(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  validateNumbers(value, label, errors, ['lateral', 'forward', 'x', 'y']);
}

function validateNumbers(object, label, errors, keys) {
  if (object == null) return;
  if (!isPlainObject(object)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  for (const key of keys) {
    if (object[key] != null && !Number.isFinite(object[key])) errors.push(`${label}.${key} must be a finite number.`);
  }
}

function validateEnum(value, values, label, errors) {
  if (value != null && !values.includes(value)) errors.push(`${label} must be one of: ${values.join(', ')}.`);
}

function enumValue(value, values, fallback) {
  return values.includes(value) ? value : fallback;
}

function finiteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function nonNegativeNumber(value, fallback) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function positiveNumber(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function rangeNumber(value, fallback, min, max) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
