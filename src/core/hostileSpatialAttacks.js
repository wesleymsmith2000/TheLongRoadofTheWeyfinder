import { normalizeHostileAttack, validateHostileAttack } from './hostileAttackDefinition.js';
import { createCombatProjectile, arcadePlayBounds } from './arcadeMode.js';
import { createSpatialWaveletField, waveletBeamCoordinates } from './spatialWaveletBeam.js';
import { roadOffsetToWorld } from './camera.js';
import { waveletReleaseContains } from './waveletGeometry.js';
import { applyVehicleDamage } from './vehicle.js';
import { applyEnemyBlastDamage, enemyVoxelWorldCenter } from './enemy.js';
import { localToWorld } from './math.js';
import { CELL_SIZE, VOXEL_SIZE } from './voxelMask.js';

export function hostileHazardPoint(game, point) {
  const bounds = arcadePlayBounds(game.road);
  const width = (game.road.viewWidth ?? game.road.halfWidth * 2) / 2;
  const margin = point.margin ?? 80;
  let x = point.laneOffset ?? 0, y = point.roadY ?? 0;
  if (point.edge === 'left') x = -width - margin;
  if (point.edge === 'right') x = width + margin;
  if (point.edge === 'ahead') y = -bounds.ahead - margin;
  if (point.edge === 'behind') y = bounds.behind + margin;
  return roadOffsetToWorld({ x, y }, game.road);
}

export function startHostileAttack(game, definition, origin, target, options = {}) {
  const report = validateHostileAttack(definition);
  if (!report.valid) throw new Error(report.errors.join(' '));
  const config = normalizeHostileAttack(definition);
  game.hostileAttacks ??= [];
  if (config.kind === 'gravity_bomb') {
    const flight = config.flightSeconds, gravity = 120;
    const shell = createCombatProjectile(game, origin.x, origin.y, (target.x - origin.x) / flight, (target.y - origin.y) / flight, {
      team: 'enemy', weapon: 'gravity-bomb', behavior: 'arc', radius: 5, damage: 0, impulse: 0,
      color: '#842252', lifetime: flight + 0.5, gravity, verticalVelocity: gravity * flight / 2,
      maxArcHeight: gravity * flight * flight / 8, arcFlightTime: flight,
      targetHint: { ...target }, detonateAtTarget: true, gravityBomb: config,
    });
    game.enemyProjectiles.push(shell);
    return shell;
  }
  const length = definition.length ?? Math.max(config.length, Math.hypot(target.x - origin.x, target.y - origin.y) + config.halfWidth);
  const field = createSpatialWaveletField({ origin, target, team: 'enemy', length,
    id: `hostile-wavelet-${game.hostileAttackSerial = (game.hostileAttackSerial ?? 0) + 1}`,
    effect: { tiers: [{ chargeDurationMs: config.chargeSeconds * 1000, beamWidthPixels: config.halfWidth * 2, frontSpeedPps: config.frontSpeed, rippleSpeedPps: 200, maxStrengthPixels: 24 }],
      visual: { distortionEnabled: true }, shockwaveMaxRadiusScale: 1.2 },
  });
  Object.assign(field, { state: 'WARNING', warningElapsed: 0, hostileConfig: config, sourceEnemy: options.sourceEnemy ?? null,
    sourceCellId: options.sourceCellId ?? null, hitCells: new Set(), visualStyle: 'hostile', originPull: true });
  field.config.sweptBandsOnly = true;
  game.hostileAttacks.push(field);
  return field;
}

export function stepHostileAttacks(game, dt, hooks = {}) {
  // Bombs become terrain-anchored vortices only on an actual ground landing.
  for (const list of [game.enemyProjectiles ?? [], game.playerProjectiles ?? []]) {
    for (const shell of list) {
      if (!shell.gravityBomb || shell.gravityBombConsumed || (!shell.arcLanded && shell.lifetime > 0)) continue;
      shell.gravityBombConsumed = true;
      shell.lifetime = 0; shell.readyToExplode = false; shell.detonated = true;
      if (!shell.arcLanded) continue;
      const config = normalizeHostileAttack(shell.gravityBomb);
      (game.hostileAttacks ??= []).push({ kind: 'gravity_vortex', state: 'CHARGING', x: shell.x, y: shell.y,
        chargeElapsed: 0, pulseElapsed: 0, hostileConfig: config, exploded: false });
    }
  }
  game.enemyProjectiles = (game.enemyProjectiles ?? []).filter(p => !p.gravityBombConsumed);
  game.playerProjectiles = (game.playerProjectiles ?? []).filter(p => !p.gravityBombConsumed);
  for (const attack of game.hostileAttacks ?? []) {
    if (attack.state !== 'DISCHARGING' && attack.sourceEnemy && (attack.sourceEnemy.destroyed ||
        (attack.sourceCellId && !attack.sourceEnemy.cells.some(cell => cell.id === attack.sourceCellId && !cell.state.destroyed)))) {
      attack.state = 'DONE'; continue;
    }
    if (attack.sourceEnemy && attack.sourceCellId && ['WARNING', 'CHARGING'].includes(attack.state)) {
      const cell = attack.sourceEnemy.cells.find(cell => cell.id === attack.sourceCellId);
      const point = enemyVoxelWorldCenter(attack.sourceEnemy, cell, 1.5, 1.5);
      const dx = point.x - attack.lockedOrigin.x, dy = point.y - attack.lockedOrigin.y;
      attack.lockedOrigin.x = point.x; attack.lockedOrigin.y = point.y;
      attack.lockedTarget.x += dx; attack.lockedTarget.y += dy;
    }
    advanceAttack(game, attack, Math.max(0, dt), hooks);
  }
  game.hostileAttacks = (game.hostileAttacks ?? []).filter(attack => attack.state !== 'DONE');
}

function advanceAttack(game, attack, dt, hooks) {
  const c = attack.hostileConfig;
  if (attack.state === 'WARNING') {
    const advance = Math.min(dt, Math.max(0, c.warningSeconds - attack.warningElapsed));
    attack.warningElapsed += advance; dt -= advance;
    if (attack.warningElapsed + 1e-9 < c.warningSeconds) return;
    attack.state = 'CHARGING';
  }
  if (attack.state === 'CHARGING') {
    const advance = Math.min(dt, Math.max(0, c.chargeSeconds - attack.chargeElapsed));
    attack.chargeElapsed += advance; dt -= advance;
    const ramp = attack.chargeElapsed / c.chargeSeconds;
    const targets = attack.kind === 'gravity_vortex' ? movableTargets(game)
      : movableTargets(game).filter(object => object === game.vehicle || (game.playerProjectiles ?? []).includes(object));
    for (const object of targets) {
      let inside = false, origin;
      if (attack.kind === 'gravity_vortex') {
        origin = attack;
        inside = Math.hypot(object.x - origin.x, object.y - origin.y) <= c.radius;
      } else {
        origin = attack.lockedOrigin;
        const p = waveletBeamCoordinates(attack, object.x, object.y);
        inside = p.s >= 0 && p.s <= attack.length && Math.abs(p.p) <= c.halfWidth;
      }
      if (inside) pullToPoint(object, origin, c.pullAcceleration * ramp, advance);
    }
    if (attack.chargeElapsed + 1e-9 < c.chargeSeconds) return;
    attack.state = 'DISCHARGING';
    hooks.onDischarge?.(attack);
    if (attack.kind === 'gravity_vortex') explodeGravityVortex(game, attack, hooks);
  }
  if (attack.state !== 'DISCHARGING') return;
  if (attack.kind === 'gravity_vortex') {
    attack.pulseElapsed += dt;
    if (attack.pulseElapsed >= 0.65) attack.state = 'DONE';
    return;
  }
  attack.previousPulseElapsed = attack.pulseElapsed;
  attack.pulseElapsed += dt;
  if (!game.performanceDiagnostics?.disableCollisions) damageFlameFront(game, attack);
  if (attack.pulseElapsed >= attack.length / c.frontSpeed + 0.65) attack.state = 'DONE';
}

function movableTargets(game) {
  return [...new Set([game.vehicle, ...(game.vehicle?.detachedPieces ?? []), ...(game.enemies ?? []), ...(game.playerProjectiles ?? []), ...(game.enemyProjectiles ?? []), ...(game.scrapPickups ?? [])])]
    .filter(object => object && !object.destroyed && !object.terrainAnchored && !object.staticObstacle &&
      object.behavior !== 'beam' && object.behavior !== 'blast' && (object.lifetime == null || object.lifetime > 0));
}

function pullToPoint(object, point, acceleration, dt) {
  const dx = point.x - object.x, dy = point.y - object.y, length = Math.hypot(dx, dy);
  if (length < 0.001) return;
  // Slow near the origin instead of accelerating through it to infinity.
  const amount = acceleration * Math.min(1, length / 32) * dt;
  object.vx = (object.vx ?? 0) + dx / length * amount;
  object.vy = (object.vy ?? 0) + dy / length * amount;
  if (object.behavior) object.angle = Math.atan2(object.vy, object.vx);
}

function damageFlameFront(game, attack) {
  const c = attack.hostileConfig;
  for (const cell of game.vehicle.cells ?? []) {
    if (!cell.attached || cell.state.destroyed || attack.hitCells.has(cell)) continue;
    const point = localToWorld({ x: cell.gridX * CELL_SIZE, y: cell.gridY * CELL_SIZE }, game.vehicle);
    const { s, p } = waveletBeamCoordinates(attack, point.x, point.y);
    if (!waveletReleaseContains(attack, s, p, attack.previousPulseElapsed, attack.pulseElapsed, CELL_SIZE * 0.5)) continue;
    attack.hitCells.add(cell);
    applyVehicleDamage(game.vehicle, point, CELL_SIZE * 0.55, c.damage, 0);
  }
  if (attack.hitCells.size && !attack.knockedBack) {
    attack.knockedBack = true;
    game.vehicle.vx += Math.cos(attack.lockedAngle) * c.knockback;
    game.vehicle.vy += Math.sin(attack.lockedAngle) * c.knockback;
    game.vehicle.knockbackSerial = (game.vehicle.knockbackSerial ?? 0) + 1;
  }
}

function explodeGravityVortex(game, attack, hooks) {
  if (attack.exploded) return;
  attack.exploded = true;
  const c = attack.hostileConfig;
  for (const object of movableTargets(game)) {
    const dx = object.x - attack.x, dy = object.y - attack.y, distance = Math.hypot(dx, dy);
    if (distance > c.explosionRadius) continue;
    // A centered victim gets a deterministic road-forward kick.
    const angle = distance < 0.001 ? (game.road?.heading ?? 0) - Math.PI / 2 : Math.atan2(dy, dx);
    const force = c.knockback * Math.max(0.2, 1 - distance / c.explosionRadius);
    const outwardX = Math.cos(angle), outwardY = Math.sin(angle);
    const inwardVelocity = Math.min(0, (object.vx ?? 0) * outwardX + (object.vy ?? 0) * outwardY);
    object.vx = (object.vx ?? 0) + outwardX * (force - inwardVelocity);
    object.vy = (object.vy ?? 0) + outwardY * (force - inwardVelocity);
    if (object.behavior) object.angle = Math.atan2(object.vy, object.vx);
    if (object === game.vehicle) object.knockbackSerial = (object.knockbackSerial ?? 0) + 1;
  }
  if (game.performanceDiagnostics?.disableCollisions) return;
  applyVehicleDamage(game.vehicle, attack, c.explosionRadius, c.damage, 0);
  for (const enemy of game.enemies ?? []) {
    if (enemy.destroyed || enemy.phasedOut || Math.hypot(enemy.x - attack.x, enemy.y - attack.y) > c.explosionRadius + enemy.radius) continue;
    const hit = applyEnemyBlastDamage(enemy, attack, { maxVoxelDistance: c.explosionRadius / VOXEL_SIZE, closeVoxelDistance: 3, closePenetration: 1, farPenetration: 1, damage: c.damage });
    if (hit.destroyedNow) hooks.onEnemyDestroyed?.(enemy);
  }
}

export function carryHostileAttacks(attacks, dx, dy) {
  for (const attack of attacks ?? []) {
    if (attack.kind === 'gravity_vortex') continue; // Anchored to the ground after impact.
    for (const point of [attack.lockedOrigin, attack.lockedTarget]) { point.x += dx; point.y += dy; }
  }
}
