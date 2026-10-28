import { isPlainObject } from './contentSchema.js';

export const HOSTILE_ATTACK_KINDS = ['hostile_wavelet', 'gravity_bomb'];
export const HOSTILE_ATTACK_DEFAULTS = Object.freeze({
  hostile_wavelet: { warningSeconds: 2, chargeSeconds: 3, length: 1100, halfWidth: 120, pullAcceleration: 350, damage: 18, knockback: 170, frontSpeed: 560 },
  gravity_bomb: { flightSeconds: 1.5, chargeSeconds: 3, radius: 190, pullAcceleration: 420, damage: 24, knockback: 900, explosionRadius: 250 },
});

export function normalizeHostileAttack(definition) {
  const defaults = HOSTILE_ATTACK_DEFAULTS[definition?.kind];
  if (!defaults) throw new Error(`Unknown hostile attack kind: ${definition?.kind}`);
  return { kind: definition.kind, ...defaults, ...definition,
    // The warning must always precede suction by at least two seconds.
    ...(definition.kind === 'hostile_wavelet' ? { warningSeconds: Math.max(2, definition.warningSeconds ?? 2) } : {}),
  };
}

export function validateHostileAttack(definition, label = 'attack') {
  const errors = [];
  if (!isPlainObject(definition) || !HOSTILE_ATTACK_KINDS.includes(definition.kind)) return { valid: false, errors: [`${label}.kind must be hostile_wavelet or gravity_bomb.`] };
  for (const key of Object.keys(HOSTILE_ATTACK_DEFAULTS[definition.kind])) {
    if (definition[key] == null) continue;
    const minimum = ['damage', 'knockback', 'pullAcceleration'].includes(key) ? 0 : key === 'warningSeconds' ? 2 : 0.01;
    if (!Number.isFinite(definition[key]) || definition[key] < minimum) errors.push(`${label}.${key} must be finite and at least ${minimum}.`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateHostileHazard(hazard, label = 'hazard') {
  const errors = [];
  if (!isPlainObject(hazard)) return { valid: false, errors: [`${label} must be an object.`] };
  errors.push(...validateHostileAttack(hazard.attack, `${label}.attack`).errors);
  for (const key of ['origin', 'target']) {
    const point = hazard[key];
    if (!isPlainObject(point)) { errors.push(`${label}.${key} must be a road-relative point.`); continue; }
    if (point.edge != null && !['left', 'right', 'ahead', 'behind'].includes(point.edge)) errors.push(`${label}.${key}.edge is invalid.`);
    for (const field of ['laneOffset', 'roadY', 'margin']) if (point[field] != null && !Number.isFinite(point[field])) errors.push(`${label}.${key}.${field} must be finite.`);
    if (point.margin != null && point.margin < 0) errors.push(`${label}.${key}.margin must be non-negative.`);
  }
  if (hazard.atDistance != null && (!Number.isFinite(hazard.atDistance) || hazard.atDistance < 0)) errors.push(`${label}.atDistance must be non-negative and finite.`);
  return { valid: errors.length === 0, errors };
}
