import { roadOffsetToWorld, worldToRoadOffset } from './camera.js';
import { clamp } from './math.js';
import { createProjectile } from './projectile.js';
import { scaleSpriteDescriptor } from './projectileVisualScale.js';

export function normalizeRunMode(mode = 'normal') {
  return mode === 'lite' ? 'arcade' : mode ?? 'normal';
}

export function arcadeForwardVector(game) {
  return { x: Math.sin(game.road.heading), y: -Math.cos(game.road.heading) };
}

export function arcadeForwardHeading(game) {
  const forward = arcadeForwardVector(game);
  return Math.atan2(forward.y, forward.x);
}

// The camera places the road origin at 58% of screen height. The drive lane
// occupies only part of that view; enemies stage against the visible edge.
export function arcadePlayBounds(road) {
  if (!(road.viewWidth > 0 && road.viewHeight > 0)) {
    return { ahead: road.halfHeight, behind: road.halfHeight };
  }
  function extent(dx, dy) {
    const xLimit = Math.abs(dx) > 1e-6 ? road.viewWidth * 0.5 / Math.abs(dx) : Infinity;
    const yLimit = Math.abs(dy) > 1e-6 ? road.viewHeight * (dy < 0 ? 0.58 : 0.42) / Math.abs(dy) : Infinity;
    return Math.min(xLimit, yLimit);
  }
  const dx = Math.sin(road.heading);
  const dy = -Math.cos(road.heading);
  return { ahead: extent(dx, dy), behind: extent(-dx, -dy) };
}

export function arcadeBlastRadius(game, radius) {
  return radius * (game.runMode === 'arcade' ? 1.5 : 1);
}

export function arcadeEnemyFireRateScale(game) {
  return game.runMode === 'arcade' ? 0.5 : 1;
}

export function arcadeProjectileDamageScale(game) {
  return game.runMode === 'arcade' ? 1.5 : 1;
}

function enlargedArcadeShot(projectile) {
  const weapon = String(projectile.weapon ?? '');
  return projectile.behavior !== 'beam' && projectile.behavior !== 'blast' &&
    (/bullet|^main\.basic$|^diver-gun$|^boss-nodule$/.test(weapon) || (projectile.team === 'player' && /flechette|shrapnel/.test(weapon)));
}

// All combat spawn paths share this boundary, including bespoke boss attacks.
// Derived blast visuals use the already scaled payload's radius.
export function applyArcadeProjectileScaling(game, projectile) {
  if (game.runMode !== 'arcade' || projectile.arcadeScaled) return projectile;
  projectile.arcadeScaled = true;
  const damageScale = projectile.arcadeDamageScaled ? 1 : (projectile.team === 'player' ? 1 : 2) * arcadeProjectileDamageScale(game);
  projectile.damage *= damageScale;
  projectile.blastDamage *= damageScale;
  projectile.arcadeDamageScaled = true;
  if (enlargedArcadeShot(projectile)) {
    projectile.radius *= 1.5;
    projectile.maxRadius *= 1.5;
    projectile.vx *= 1.5;
    projectile.vy *= 1.5;
    projectile.acceleration *= 1.5;
    projectile.maxSpeed *= 1.5;
    projectile.sprite = scaleSpriteDescriptor(projectile.sprite, 1.5);
  }
  projectile.blastRadius = arcadeBlastRadius(game, projectile.blastRadius ?? 0);
  if (projectile.blastOnExpire) {
    projectile.blastOnExpire = {
      ...projectile.blastOnExpire,
      radius: arcadeBlastRadius(game, projectile.blastOnExpire.radius),
      damage: projectile.blastOnExpire.damage * damageScale,
    };
  }
  return projectile;
}

export function createCombatProjectile(game, x, y, vx, vy, options) {
  const projectile = applyArcadeProjectileScaling(game, createProjectile(x, y, vx, vy, options));
  if (projectile.behavior === 'blast' && !options?.blastRadiusScaled) {
    projectile.maxRadius = arcadeBlastRadius(game, projectile.maxRadius);
  }
  return projectile;
}

export function arcadeFrontBiasWeight(enemy) {
  if (enemy.diver || enemy.hopperRescue || enemy.destroyed || enemy.staticObstacle || enemy.terrainAnchored || enemy.internalDestruction ||
      enemy.zeppelinWalkerRout || enemy.escapePod || enemy.kind === 'escapePodBoat' ||
      enemy.walkerFallAnimation || enemy.carRuntime?.spinout || (enemy.dizzyTimer ?? 0) > 0 ||
      enemy.phantomOverload || enemy.phasedOut || enemy.octopusEvade || enemy.octopusRetreat ||
      enemy.charge?.state === 'charging' || enemy.mothBomber?.phase === 'dive' ||
      (enemy.mothBomber?.edgeTurnTimer ?? 0) > 0 || enemy.roadBossCar?.phase === 'strafe' ||
      ['strafe', 'turn'].includes(enemy.zeppelin?.phase) || enemy.inchworm?.role === 'segment' ||
      (enemy.archetypeId === 'hopping_stream_mob.digitized_stream' && (enemy.elevation?.z ?? 0) > 0)) return 0;
  return 1;
}

export function isArcadeBoss(enemy) {
  return ['boss', 'roadBossCar', 'pirateBoss', 'zeppelinBoss'].includes(enemy.kind);
}

function bossLateralLimit(game, enemy) {
  return Math.max(12, game.road.halfWidth - Math.min(game.road.halfWidth * 0.25, (enemy.radius ?? 0) * 0.35 + 12));
}

export function containArcadeBoss(game, enemy) {
  if (game.runMode !== 'arcade' || !isArcadeBoss(enemy)) return;
  if (arcadeFrontBiasWeight(enemy) === 0 || enemy.arcadeEntryCrossing || enemy.arcadeBehindEntry) {
    enemy.arcadeBossEnteredLane = false;
    return;
  }
  const position = worldToRoadOffset(enemy, game.road);
  const limit = bossLateralLimit(game, enemy);
  if (Math.abs(position.x) <= limit) enemy.arcadeBossEnteredLane = true;
  if (!enemy.arcadeBossEnteredLane || Math.abs(position.x) <= limit) return;
  const point = roadOffsetToWorld({ x: clamp(position.x, -limit, limit), y: position.y }, game.road);
  enemy.x = point.x;
  enemy.y = point.y;
  const right = { x: Math.cos(game.road.heading), y: Math.sin(game.road.heading) };
  const lateral = enemy.vx * right.x + enemy.vy * right.y;
  if (lateral * position.x > 0) { enemy.vx -= right.x * lateral; enemy.vy -= right.y * lateral; }
}

export function applyArcadeEnemyFrontBias(game, enemy, dt) {
  if (game.runMode !== 'arcade') return;
  const weight = arcadeFrontBiasWeight(enemy);
  if (weight === 0) return;
  const position = worldToRoadOffset(enemy, game.road);
  const height = arcadePlayBounds(game.road).ahead;
  if (enemy.arcadeEntryCrossing || enemy.arcadeBehindEntry) {
    enemy.arcadeEntryGraceRemaining = Math.max(0, (enemy.arcadeEntryGraceRemaining ?? 2.5) - dt);
    if (enemy.arcadeEntryGraceRemaining === 0) {
      enemy.arcadeEntryCrossing = 0;
      enemy.arcadeBehindEntry = false;
    }
  }
  // A side entry owns its first crossing; later passes regain front preference.
  if (enemy.arcadeEntryCrossing) {
    if (Math.abs(position.x) > game.road.halfWidth * 0.1 && Math.sign(position.x) === enemy.arcadeEntryCrossing) return;
    enemy.arcadeEntryCrossing = 0;
  }
  if (enemy.arcadeBehindEntry) {
    if (position.y > worldToRoadOffset(game.vehicle, game.road).y) return;
    enemy.arcadeBehindEntry = false;
  }
  const boss = isArcadeBoss(enemy);
  if (boss) {
    const limit = bossLateralLimit(game, enemy);
    const playerX = worldToRoadOffset(game.vehicle, game.road).x;
    const targetX = clamp(playerX * 0.65 + Math.sin((game.time ?? 0) * 0.55) * limit * 0.2, -limit, limit);
    const right = { x: Math.cos(game.road.heading), y: Math.sin(game.road.heading) };
    const lateral = enemy.vx * right.x + enemy.vy * right.y;
    const desired = clamp((targetX - position.x) * 2.8, -180, 180);
    const correction = (desired - lateral) * (1 - Math.exp(-8 * dt));
    enemy.vx += right.x * correction;
    enemy.vy += right.y * correction;
  }
  if (position.y >= -(boss ? 0.9 : 0.85) * height && position.y <= -(boss ? 0.66 : 0.55) * height) return;
  const forward = arcadeForwardVector(game);
  const current = enemy.vx * forward.x + enemy.vy * forward.y;
  const desired = clamp((position.y + (boss ? 0.8 : 0.72) * height) * 3.6, -100, 260);
  const correction = (desired - current) * (1 - Math.exp(-(boss ? 8 : 4) * dt)) * weight;
  enemy.vx += forward.x * correction;
  enemy.vy += forward.y * correction;
}
