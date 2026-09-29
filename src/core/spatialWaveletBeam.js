import { applyEnemyVoxelDamage, traceEnemyVoxelBeam } from './enemy.js';
import { applyWeaponInterlock } from './weaponInterlock.js';

export const WAVELET_FIELD_STATES = Object.freeze({
  CHARGING: 'CHARGING',
  DISCHARGING: 'DISCHARGING',
  DONE: 'DONE',
});

let nextWaveletFieldId = 1;

export function resolveWaveletTier(effectDefinition, tier = 0) {
  const tiers = Array.isArray(effectDefinition?.tiers) ? effectDefinition.tiers : [];
  const index = Math.max(0, Math.min(tiers.length - 1, Math.floor(tier)));
  const source = tiers[index] ?? {};
  const width = source.beamWidthPixels ?? source.beam_width_pixels ?? 120;
  return {
    tier: index,
    chargeDurationSeconds: Math.max(0.01, (source.chargeDurationMs ?? source.charge_duration_ms ?? 2200) / 1000),
    captureHalfWidth: Math.max(1, width / 2),
    pulseHalfWidth: Math.max(0.5, width * (effectDefinition?.pulseWidthScale ?? 0.32) / 2),
    frontSpeed: Math.max(1, source.frontSpeedPps ?? source.front_speed_pps ?? 1100),
    shockwaveSpeed: Math.max(1, source.rippleSpeedPps ?? source.ripple_speed_pps ?? 360),
    visualRingCycles: Math.max(0, source.nOscillations ?? source.N_oscillations ?? 3),
    maxVisualStrengthPx: Math.max(0, source.maxStrengthPixels ?? source.max_strength_pixels ?? 18),
    spatialFrequency: Math.max(0, source.frequencyMod ?? source.frequency_mod ?? 0.12),
  };
}

export function createSpatialWaveletField(options) {
  const effect = structuredClone(options.effect ?? {});
  const tierConfig = resolveWaveletTier(effect, options.tier);
  const config = {
    ...tierConfig,
    ...waveletBaseConfig(effect),
    shockwaveMaxRadius: (effect.shockwaveMaxRadiusScale ?? 2.8) * tierConfig.captureHalfWidth,
  };
  const lockedOrigin = { x: options.origin.x, y: options.origin.y };
  const lockedTarget = { x: options.target.x, y: options.target.y };
  const field = {
    id: options.id ?? `wavelet-${nextWaveletFieldId++}`,
    kind: 'locked_convergence_wavelet',
    team: options.team ?? 'player',
    state: WAVELET_FIELD_STATES.CHARGING,
    lockedOrigin,
    lockedTarget,
    lockedAngle: Math.atan2(lockedTarget.y - lockedOrigin.y, lockedTarget.x - lockedOrigin.x),
    length: Math.max(1, options.length ?? 520),
    chargeElapsed: 0,
    pulseElapsed: 0,
    previousPulseElapsed: 0,
    previousFrontDistance: 0,
    tier: config.tier,
    config: { ...config, cooldown: options.cooldown ?? 12, frontDamage: options.frontDamage ?? 45 },
    sourceWeaponId: options.sourceWeaponId ?? 'vortex_wavelet_beam',
    sourceCellId: options.sourceCellId ?? null,
    sourceEnemy: options.sourceEnemy ?? null,
    shockwaveHitObjects: new WeakSet(),
    pulseHitVoxels: new Set(),
    cancelled: false,
  };
  field.captureAabb = waveletFieldAabb(field, config.captureHalfWidth);
  field.shockAabb = waveletFieldAabb(field, config.shockwaveMaxRadius);
  return field;
}

export function waveletBeamCoordinates(field, x, y) {
  const ux = Math.cos(field.lockedAngle);
  const uy = Math.sin(field.lockedAngle);
  const nx = -uy;
  const ny = ux;
  const qx = x - field.lockedOrigin.x;
  const qy = y - field.lockedOrigin.y;
  const p = qx * nx + qy * ny;
  return { s: qx * ux + qy * uy, p, r: Math.abs(p), ux, uy, nx, ny };
}

export function waveletFieldAabb(field, padding = 0) {
  const endX = field.lockedOrigin.x + Math.cos(field.lockedAngle) * field.length;
  const endY = field.lockedOrigin.y + Math.sin(field.lockedAngle) * field.length;
  return {
    minX: Math.min(field.lockedOrigin.x, endX) - padding,
    maxX: Math.max(field.lockedOrigin.x, endX) + padding,
    minY: Math.min(field.lockedOrigin.y, endY) - padding,
    maxY: Math.max(field.lockedOrigin.y, endY) + padding,
  };
}

export function stepSpatialFields(game, dt, hooks = {}) {
  game.spatialFields ??= [];
  for (const field of game.spatialFields) {
    if (field.state === WAVELET_FIELD_STATES.CHARGING) stepChargingField(game, field, dt);
    else if (field.state === WAVELET_FIELD_STATES.DISCHARGING) stepDischargingField(game, field, dt, hooks);
  }
  game.spatialFields = game.spatialFields.filter((field) => field.state !== WAVELET_FIELD_STATES.DONE);
  if (game.secondary?.waveletCommitment && !game.spatialFields.some((field) => field.id === game.secondary.waveletCommitment)) {
    game.secondary.waveletCommitment = null;
  }
  return game.spatialFields;
}

export function carrySpatialFields(fields, dx, dy) {
  for (const field of fields ?? []) {
    field.lockedOrigin.x += dx;
    field.lockedOrigin.y += dy;
    field.lockedTarget.x += dx;
    field.lockedTarget.y += dy;
    field.captureAabb = waveletFieldAabb(field, field.config.captureHalfWidth);
    field.shockAabb = waveletFieldAabb(field, field.config.shockwaveMaxRadius);
  }
}

export function activePlayerWaveletField(game) {
  const id = game?.secondary?.waveletCommitment;
  return id ? game.spatialFields?.find((field) => field.id === id) ?? null : null;
}

function stepChargingField(game, field, dt) {
  if (!waveletSourceAlive(game, field)) {
    field.cancelled = true;
    field.state = WAVELET_FIELD_STATES.DONE;
    return;
  }
  field.chargeElapsed = Math.min(field.config.chargeDurationSeconds, field.chargeElapsed + dt);
  const charge = Math.min(1, field.chargeElapsed / field.config.chargeDurationSeconds);
  const ramp = charge ** field.config.chargeRampPower;
  const pulse = 0.35 + 0.65 * Math.sin(Math.PI * 2 * field.config.chargePulseHz * field.chargeElapsed) ** 2;
  for (const object of convergenceTargets(game, field)) {
    if (!objectInsideAabb(object, field.captureAabb)) continue;
    const coordinates = waveletBeamCoordinates(field, object.x, object.y);
    if (!insideCapture(field, object, coordinates)) continue;
    const gaussian = Math.exp(-((coordinates.r / field.config.captureHalfWidth) ** 2));
    const envelope = gaussian * pulse * ramp;
    const side = Math.sign(coordinates.p);
    if (side !== 0) {
      object.vx += -side * coordinates.nx * field.config.chargePullAcceleration * envelope * dt;
      object.vy += -side * coordinates.ny * field.config.chargePullAcceleration * envelope * dt;
    }
    const perpendicularVelocity = object.vx * coordinates.nx + object.vy * coordinates.ny;
    const damping = perpendicularVelocity * field.config.convergenceDamping * gaussian * ramp * dt;
    object.vx -= coordinates.nx * damping;
    object.vy -= coordinates.ny * damping;
  }
  if (field.chargeElapsed < field.config.chargeDurationSeconds) return;
  field.state = WAVELET_FIELD_STATES.DISCHARGING;
  field.pulseElapsed = 0;
  field.previousPulseElapsed = 0;
  field.previousFrontDistance = 0;
  if (field.team === 'player') {
    game.secondary.cooldown = Math.max(game.secondary.cooldown ?? 0, field.config.cooldown);
    applyWeaponInterlock(game, field.config.postFireGlobalLockoutSeconds, field.sourceWeaponId);
  }
}

function stepDischargingField(game, field, dt, hooks) {
  field.previousPulseElapsed = field.pulseElapsed;
  field.pulseElapsed += dt;
  const frontDistance = Math.min(field.length, field.pulseElapsed * field.config.frontSpeed);
  if (frontDistance > field.previousFrontDistance && field.team === 'player') {
    damagePlayerWaveletFront(game, field, field.previousFrontDistance, frontDistance, hooks);
  }
  field.previousFrontDistance = frontDistance;
  applyShockwaveCrossings(game, field);
  const finalShockTime = field.length / field.config.frontSpeed
    + field.config.shockwaveLagSeconds
    + field.config.shockwaveMaxRadius / field.config.shockwaveSpeed;
  if (field.pulseElapsed >= finalShockTime) field.state = WAVELET_FIELD_STATES.DONE;
}

function damagePlayerWaveletFront(game, field, from, to, hooks) {
  const ux = Math.cos(field.lockedAngle);
  const uy = Math.sin(field.lockedAngle);
  const start = { x: field.lockedOrigin.x + ux * from, y: field.lockedOrigin.y + uy * from };
  const trace = traceEnemyVoxelBeam(
    (game.enemies ?? []).filter((enemy) => !enemy.destroyed),
    start,
    field.lockedAngle,
    to - from,
    field.config.pulseHalfWidth,
    field.config.frontPierceVoxels,
    { groundOnly: false },
  );
  for (const hit of trace.hits) {
    const key = `${field.id}:${hit.enemy.id ?? `${hit.enemy.x},${hit.enemy.y}`}:${hit.cell.id}:${hit.voxelIndex?.x}:${hit.voxelIndex?.y}`;
    if (field.pulseHitVoxels.has(key)) continue;
    field.pulseHitVoxels.add(key);
    const result = applyEnemyVoxelDamage(hit.enemy, hit, field.config.frontDamage);
    if (!result.hit) continue;
    game.score.damageDone += Math.round(field.config.frontDamage + result.removed * 3);
    if (result.destroyedNow) hooks.onEnemyDestroyed?.(hit.enemy, field);
  }
}

function applyShockwaveCrossings(game, field) {
  for (const object of shockwaveTargets(game, field)) {
    if (field.shockwaveHitObjects.has(object)) continue;
    if (!objectInsideAabb(object, field.shockAabb)) continue;
    const coordinates = waveletBeamCoordinates(field, object.x, object.y);
    if (coordinates.s < 0 || coordinates.s > field.length || coordinates.r > field.config.shockwaveMaxRadius) continue;
    const arrival = coordinates.s / field.config.frontSpeed
      + field.config.shockwaveLagSeconds
      + coordinates.r / field.config.shockwaveSpeed;
    if (field.previousPulseElapsed >= arrival || field.pulseElapsed < arrival) continue;
    field.shockwaveHitObjects.add(object);
    const side = Math.sign(coordinates.p);
    if (side === 0) continue;
    const falloff = 1 - coordinates.r / field.config.shockwaveMaxRadius;
    object.vx += side * coordinates.nx * field.config.shockwaveImpulse * Math.max(0.2, falloff);
    object.vy += side * coordinates.ny * field.config.shockwaveImpulse * Math.max(0.2, falloff);
  }
}

function convergenceTargets(game, field) {
  if (field.team === 'player') {
    return [
      ...(game.enemies ?? []).filter((enemy) => !enemy.destroyed && !enemy.terrainAnchored),
      ...(game.enemyProjectiles ?? []).filter(waveletProjectileTarget),
    ];
  }
  return [game.vehicle, ...(game.playerProjectiles ?? []).filter(waveletProjectileTarget)].filter(Boolean);
}

function shockwaveTargets(game, field) {
  return convergenceTargets(game, field);
}

function waveletProjectileTarget(projectile) {
  return projectile.lifetime > 0 && projectile.behavior !== 'beam' && projectile.behavior !== 'blast' && !projectile.terrainAnchored;
}

function insideCapture(field, object, coordinates) {
  const radius = object.radius ?? 0;
  if (coordinates.s < -radius || coordinates.s > field.length + radius) return false;
  return coordinates.r <= field.config.captureHalfWidth + radius;
}

function objectInsideAabb(object, aabb) {
  const radius = object.radius ?? 0;
  return object.x + radius >= aabb.minX && object.x - radius <= aabb.maxX
    && object.y + radius >= aabb.minY && object.y - radius <= aabb.maxY;
}

function waveletSourceAlive(game, field) {
  if (field.sourceEnemy) {
    return !field.sourceEnemy.destroyed && field.sourceEnemy.cells?.some((cell) => cell.id === field.sourceCellId && !cell.state?.destroyed);
  }
  if (!field.sourceCellId) return true;
  return game.vehicle?.cells?.some((cell) => cell.id === field.sourceCellId && cell.attached && !cell.state?.destroyed);
}

function waveletBaseConfig(effect) {
  const gameplay = effect.gameplay ?? {};
  return {
    chargePulseHz: effect.chargePulseHz ?? 5,
    chargeRampPower: effect.chargeRampPower ?? 1,
    chargePullAcceleration: gameplay.chargePullAcceleration ?? 190,
    convergenceDamping: effect.convergenceDamping ?? 5,
    shockwaveLagSeconds: effect.shockwaveLagSeconds ?? 0.05,
    shockwaveImpulse: gameplay.shockwaveImpulse ?? 320,
    frontPierceVoxels: gameplay.frontPierceVoxels ?? 24,
    shockwaveDamage: gameplay.shockwaveDamage ?? 0,
    postFireGlobalLockoutSeconds: effect.postFireGlobalLockoutSeconds ?? 0.9,
  };
}
