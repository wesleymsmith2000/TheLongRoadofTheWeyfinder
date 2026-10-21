import { worldToRoadOffset } from './camera.js';
import { clamp } from './math.js';
import { createProjectile } from './projectile.js';

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

export function arcadeBlastRadius(game, radius) {
  return radius * (game.runMode === 'arcade' ? 1.5 : 1);
}

export function arcadeEnemyFireRateScale(game) {
  return game.runMode === 'arcade' ? 0.5 : 1;
}

// All combat spawn paths share this boundary, including bespoke boss attacks.
// Derived blast visuals use the already scaled payload's radius.
export function applyArcadeProjectileScaling(game, projectile) {
  if (game.runMode !== 'arcade' || projectile.arcadeScaled) return projectile;
  projectile.arcadeScaled = true;
  const damageScale = projectile.team === 'player' ? 1 : 2;
  projectile.damage *= damageScale;
  projectile.blastDamage *= damageScale;
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
  if (enemy.destroyed || enemy.staticObstacle || enemy.terrainAnchored || enemy.internalDestruction ||
      enemy.zeppelinWalkerRout || enemy.escapePod || enemy.kind === 'escapePodBoat' ||
      enemy.walkerFallAnimation || enemy.carRuntime?.spinout || (enemy.dizzyTimer ?? 0) > 0 ||
      enemy.phantomOverload || enemy.phasedOut || enemy.octopusEvade || enemy.octopusRetreat ||
      enemy.charge?.state === 'charging' || enemy.mothBomber?.phase === 'dive' ||
      (enemy.mothBomber?.edgeTurnTimer ?? 0) > 0 || enemy.roadBossCar?.phase === 'strafe' ||
      ['strafe', 'turn'].includes(enemy.zeppelin?.phase) || enemy.inchworm?.role === 'segment' ||
      (enemy.archetypeId === 'hopping_stream_mob.digitized_stream' && (enemy.elevation?.z ?? 0) > 0)) return 0;
  return 1;
}

export function applyArcadeEnemyFrontBias(game, enemy, dt) {
  if (game.runMode !== 'arcade') return;
  const weight = arcadeFrontBiasWeight(enemy);
  if (weight === 0) return;
  const player = worldToRoadOffset(game.vehicle, game.road);
  const position = worldToRoadOffset(enemy, game.road);
  const relativeY = position.y - player.y;
  const height = game.road.halfHeight;
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
    if (relativeY > 0) return;
    enemy.arcadeBehindEntry = false;
  }
  if (relativeY >= -0.65 * height && relativeY <= -0.15 * height) return;
  const forward = arcadeForwardVector(game);
  const current = enemy.vx * forward.x + enemy.vy * forward.y;
  const playerSpeed = game.vehicle.vx * forward.x + game.vehicle.vy * forward.y;
  const desired = playerSpeed + clamp((relativeY + 0.35 * height) * 2.4, -100, 260);
  const correction = (desired - current) * (1 - Math.exp(-4 * dt)) * weight;
  enemy.vx += forward.x * correction;
  enemy.vy += forward.y * correction;
}
