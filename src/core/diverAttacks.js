import { createCombatProjectile, arcadePlayBounds } from './arcadeMode.js';
import { runtimeWeaponDefinition } from './weaponDefinition.js';
import { scaleSpriteDescriptor } from './projectileVisualScale.js';
import { CELL_SIZE } from './voxelMask.js';
import bladeAsset from '../../content/weapons/blade_launcher.json' with { type: 'json' };
import mortarAsset from '../../content/weapons/mortar.json' with { type: 'json' };
import cannonAsset from '../../content/weapons/cannon.json' with { type: 'json' };
import flechette from '../../content/patterns/enemy_tracking_flechette_strafe.json' with { type: 'json' };

const blade = runtimeWeaponDefinition(bladeAsset);
const mortar = runtimeWeaponDefinition(mortarAsset);
const cannon = runtimeWeaponDefinition(cannonAsset);

export function diverContactStats() {
  return {
    // Match Arcade primary (x3) / secondary (x1.5) projectile damage.
    roadDamage: mortar.blastDamage * 3,
    roadImpulse: mortar.blastKnockback * 1.05 ** 5,
    kickDamage: cannon.blastDamage * 2 * 1.05 * 1.5,
    kickImpulse: cannon.blastKnockback * 1.05 ** 5,
  };
}

export function fireDiverFlechette(game, enemy, angle = enemy.visualHeading) {
  const speed = flechette.emitter.speed;
  const shot = createCombatProjectile(game, enemy.x, enemy.y, Math.cos(angle) * speed, Math.sin(angle) * speed, {
    ...flechette.emitter.projectile, team: 'enemy', weapon: 'diver-tracking-flechette', behavior: 'homing', angle,
    damage: flechette.emitter.projectile.damage * (enemy.combatScale?.damage ?? 1),
    delayBeforeAcceleration: 0, stopBeforeAcceleration: false, acceleration: 220,
    turnRate: 2.2, maxSpeed: 440, targetHint: game.vehicle, tracksHomingTargetHint: true,
    sourceEnemy: enemy, lifetime: 4.2,
  });
  game.enemyProjectiles.push(shot);
  return shot;
}

export function fireDiverBlade(game, enemy, angle, level = 0) {
  const shot = createCombatProjectile(game, enemy.x, enemy.y, Math.cos(angle) * 160, Math.sin(angle) * 160, {
    ...blade, team: 'enemy', weapon: 'diver-blade', sourceEnemy: enemy, angle,
    damage: blade.damage * 1.05 ** level, radius: blade.radius * 1.25,
    sprite: scaleSpriteDescriptor(blade.sprite, 1.25 * (1 + 6 * level * 0.005)),
    pierce: blade.pierce + level, maxRicochets: blade.maxRicochets + level,
    ricochetFactor: blade.ricochetFactor * 1.05 ** level,
    projectileDeflectionProbability: Math.min(0.98, 1 - 0.67 * 0.95 ** level),
    absorbsEnemyProjectiles: false, absorbsPlayerProjectiles: true,
    absorbHp: blade.damage * 1.05 ** level * 3, lifetime: 4,
  });
  shot.diverBlade = true;
  game.enemyProjectiles.push(shot);
  return shot;
}

export function fireDiverMortar(game, enemy, target) {
  const flight = 1.7, gravity = 96;
  const shot = createCombatProjectile(game, enemy.x, enemy.y, (target.x - enemy.x) / flight, (target.y - enemy.y) / flight, {
    team: 'enemy', weapon: 'diver-mortar', behavior: 'arc', damage: 0, radius: 2.2,
    verticalVelocity: gravity * flight / 2, gravity, targetHint: { ...target },
    detonateAtTarget: true, lifetime: flight + 0.5, sourceEnemy: enemy,
    sprite: { assetId: 'sprite.weapon.mortar_enemy_shell', displaySize: [10.5, 14.7], anchor: [0.5, 0.6] },
    landingMarkerSprite: { assetId: 'sprite.weapon.mortar_enemy_marker', displaySize: [58, 24], anchor: [0.5, 0.5] },
    blastOnExpire: { radius: CELL_SIZE * 5, damage: 12 * (enemy.combatScale?.damage ?? 1), impulse: 55 },
  });
  game.enemyProjectiles.push(shot);
  return shot;
}

export function startDiverSpiral(enemy, kind) {
  const burst = { kind, age: 0, fired: 0, count: kind === 'mortar' ? 7 : kind === 'snake' ? 3 : 12, duration: kind === 'mortar' ? 3 : kind === 'snake' ? 1 : 1.5, heading: enemy.visualHeading ?? 0 };
  enemy.diver.flavorBursts ??= [];
  enemy.diver.flavorBursts.push(burst);
}

export function stepDiverBurst(game, enemy, dt) {
  if (enemy.destroyed) return;
  if (!enemy.cells.some(cell => cell.type === 'gun' && !cell.state.destroyed && cell.state.deviceIntegrity > 0.1)) {
    enemy.diver.flavorBursts = [];
    return;
  }
  for (const burst of enemy.diver.flavorBursts ?? []) {
    if (enemy.phasedOut) continue;
    burst.age += dt;
    while (burst.fired < burst.count && burst.age + 1e-9 >= burst.fired * burst.duration / (burst.count - 1)) {
      const angle = burst.kind === 'snake' ? Math.atan2(game.vehicle.y - enemy.y, game.vehicle.x - enemy.x) : burst.fired / burst.count * Math.PI * 4 + burst.heading;
      if (burst.kind === 'mortar') {
        const cells = game.vehicle.cells.filter(cell => cell.attached && !cell.state.destroyed);
        const width = cells.length ? (Math.max(...cells.map(cell => cell.gridX)) - Math.min(...cells.map(cell => cell.gridX)) + 1) * CELL_SIZE : CELL_SIZE;
        const offsetAngle = game.rng.range(0, Math.PI * 2), distance = Math.sqrt(game.rng.next()) * width;
        fireDiverMortar(game, enemy, { x: game.vehicle.x + Math.cos(offsetAngle) * distance, y: game.vehicle.y + Math.sin(offsetAngle) * distance });
      } else if (burst.kind === 'flechette') fireDiverFlechette(game, enemy, angle);
      else fireDiverBlade(game, enemy, angle);
      burst.fired++;
    }
  }
  enemy.diver.flavorBursts = (enemy.diver.flavorBursts ?? []).filter(burst => burst.fired < burst.count);
}

export function ensureDiverOrbitBlades(game, enemy) {
  if (enemy.diver.bladeCycle) return;
  enemy.diver.bladeCycle = true;
  enemy.diver.bladeOrbitAge = 0;
  for (let index = 0; index < 2; index++) {
    const shot = fireDiverBlade(game, enemy, index * Math.PI, 20);
    shot.diverOrbitOwner = enemy;
    shot.diverOrbitIndex = index;
    shot.lifetime = shot.maxLifetime = 60;
    shot.vx = shot.vy = 0;
    shot.impulse = 42;
  }
}

export function syncDiverOrbitBlades(game) {
  for (const shot of game.enemyProjectiles) {
    const owner = shot.diverOrbitOwner;
    if (!owner || shot.lifetime <= 0 || shot.team !== 'enemy') continue;
    if (owner.destroyed || !['dive', 'ricochet'].includes(owner.diver.phase)) { shot.lifetime = 0; continue; }
    const angle = (owner.diver.bladeOrbitAge ?? 0) * 5 + shot.diverOrbitIndex * Math.PI;
    const radius = owner.radius + shot.radius + CELL_SIZE * 1.5;
    shot.x = owner.x + Math.cos(angle) * radius;
    shot.y = owner.y + Math.sin(angle) * radius;
    shot.z = game.vehicle.elevation?.z ?? 0;
    shot.angle = angle + Math.PI / 2;
  }
}

export function releaseDiverBlades(game, enemy, hitBlade = null) {
  for (const shot of game.enemyProjectiles) {
    if (shot.diverOrbitOwner !== enemy || shot.lifetime <= 0) continue;
    shot.diverOrbitOwner = null;
    if (shot === hitBlade) { shot.lifetime = 0; continue; }
    const angle = Math.atan2(game.vehicle.y - shot.y, game.vehicle.x - shot.x);
    shot.angle = angle; shot.vx = Math.cos(angle) * 250; shot.vy = Math.sin(angle) * 250;
    shot.lifetime = shot.maxLifetime = 4;
    shot.deflectionGraceUntil = game.time + 0.05;
  }
  enemy.diver.phase = 'regroup';
  enemy.diver.phaseAge = 0;
  enemy.diver.speed = enemy.diver.profile.climbSpeed;
  enemy.diver.burrowed = false;
  enemy.phasedOut = false;
}

export function diverVisibleLimits(game, enemy) {
  const bounds = arcadePlayBounds(game.road);
  return { left: -(game.road.viewWidth ?? game.road.halfWidth * 2) * 0.5 + enemy.radius, right: (game.road.viewWidth ?? game.road.halfWidth * 2) * 0.5 - enemy.radius, top: -bounds.ahead + enemy.radius, bottom: bounds.behind - enemy.radius };
}
