export function createProjectile(x, y, vx, vy, options = {}) {
  const projectile = {
    x,
    y,
    vx,
    vy,
    previousX: x,
    previousY: y,
    angle: options.angle ?? Math.atan2(vy, vx),
    length: options.length ?? 0,
    radius: options.radius ?? 4,
    maxRadius: options.maxRadius ?? options.radius ?? 4,
    damage: options.damage ?? 7,
    color: options.color ?? null,
    alpha: options.alpha ?? null,
    impulse: options.impulse ?? 240,
    team: options.team ?? 'enemy',
    weapon: options.weapon ?? 'bullet',
    behavior: options.behavior ?? 'ballistic',
    lifetime: options.lifetime ?? 4,
    maxLifetime: options.lifetime ?? 4,
    sprite: options.sprite ? structuredClone(options.sprite) : null,
    landingMarkerSprite: options.landingMarkerSprite ? structuredClone(options.landingMarkerSprite) : null,
    z: options.z ?? options.altitude ?? 0,
    vz: options.vz ?? options.verticalVelocity ?? 0,
    gravity: options.gravity ?? 0,
    maxArcHeight: Math.max(1, options.maxArcHeight ?? options.arcHeight ?? options.altitude ?? 1),
    shadowRadius: options.shadowRadius ?? options.radius ?? 4,
    arcLanded: false,
    frames: options.frames ?? 0,
    turnRate: options.turnRate ?? 0,
    acceleration: options.acceleration ?? 0,
    maxSpeed: options.maxSpeed ?? Infinity,
    targetHint: options.targetHint ?? null,
    detonateDistance: options.detonateDistance ?? null,
    detonateAtTarget: Boolean(options.detonateAtTarget),
    zCollision: Boolean(options.zCollision),
    blastDamage: options.blastDamage ?? 0,
    blastRadius: options.blastRadius ?? 0,
    blastKnockback: options.blastKnockback ?? 0,
    shrapnelCount: options.shrapnelCount ?? 0,
    shrapnelDamageScale: options.shrapnelDamageScale ?? 1,
    pierce: options.pierce ?? 0,
    pierceDamageScale: options.pierceDamageScale ?? 0.7,
    pierceDamageFalloff: options.pierceDamageFalloff ?? 0.68,
    delayBeforeAcceleration: options.delayBeforeAcceleration ?? 0,
    accelerationDuration: options.accelerationDuration ?? Infinity,
    accelerationElapsed: 0,
    accelerationLocked: false,
    accelerationAngle: options.accelerationAngle ?? null,
    accelerationTarget: options.accelerationTarget ?? null,
    accelerationJitter: options.accelerationJitter ?? 0,
    delayedAcceleration: (options.delayBeforeAcceleration ?? 0) > 0 || Boolean(options.accelerationTarget) || Boolean(options.explodeAfterAcceleration),
    stopBeforeAcceleration: Boolean(options.stopBeforeAcceleration),
    explodeAfterAcceleration: Boolean(options.explodeAfterAcceleration),
    blastOnExpire: options.blastOnExpire ?? null,
    readyToExplode: false,
    vanishOffscreen: Boolean(options.vanishOffscreen),
    absorbsPlayerProjectiles: Boolean(options.absorbsPlayerProjectiles),
    absorbHp: options.absorbHp ?? 0,
    maxAbsorbHp: options.absorbHp ?? 0,
    sourceEnemy: options.sourceEnemy ?? null,
    sourceCellId: options.sourceCellId ?? null,
    sourceOffset: options.sourceOffset ?? null,
    emitsProjectiles: options.emitsProjectiles ? structuredClone(options.emitsProjectiles) : null,
    detonationBurst: options.detonationBurst ? structuredClone(options.detonationBurst) : null,
    emitTimer: options.emitsProjectiles?.interval ?? 0,
    emitIndex: 0,
    forceMode: options.forceMode ?? null,
    affects: options.affects ?? null,
  };
  if (options.destructible && options.shape?.kind === 'cylinderCone') {
    projectile.shape = options.shape;
    projectile.hull = createRocketHull(options.shape);
  }
  if (options.contrail) projectile.contrail = options.contrail;
  return projectile;
}

export function stepProjectiles(projectiles, dt, targets = []) {
  for (const projectile of projectiles) {
    if (projectile.lifetime <= 0 && !projectile.readyToExplode) continue;
    projectile.previousX = projectile.x;
    projectile.previousY = projectile.y;
    if (projectile.delayedAcceleration) stepDelayedAcceleration(projectile, targets, dt);
    else if (projectile.behavior === 'homing') stepHomingProjectile(projectile, targets, dt);
    if (projectile.behavior === 'beam' || projectile.behavior === 'blast') {
      projectile.lifetime -= dt;
      continue;
    }
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    if (projectile.behavior === 'arc') stepArcProjectile(projectile, dt);
    projectile.lifetime -= dt;
    if (projectile.lifetime <= 0 && projectile.detonateAtTarget) projectile.readyToExplode = true;
  }
  return projectiles.filter((projectile) => projectile.lifetime > 0 || projectile.readyToExplode);
}

function stepArcProjectile(projectile, dt) {
  if (projectile.arcLanded) return;
  projectile.z += projectile.vz * dt - 0.5 * projectile.gravity * dt * dt;
  projectile.vz -= projectile.gravity * dt;
  projectile.maxArcHeight = Math.max(projectile.maxArcHeight, projectile.z, 1);
  if (projectile.z > 0) return;
  projectile.z = 0;
  projectile.vz = 0;
  if (projectile.detonateAtTarget && projectile.targetHint) {
    projectile.x = projectile.targetHint.x;
    projectile.y = projectile.targetHint.y;
  }
  projectile.arcLanded = true;
  projectile.readyToExplode = true;
}

function stepDelayedAcceleration(projectile, targets, dt) {
  if (projectile.delayBeforeAcceleration > 0) {
    projectile.delayBeforeAcceleration -= dt;
    if (projectile.delayBeforeAcceleration > 0) return;
  }
  if (!projectile.accelerationLocked) {
    const target = projectile.accelerationTarget ?? nearestTarget(projectile, targets);
    const baseAngle = target ? Math.atan2(target.y - projectile.y, target.x - projectile.x) : projectile.angle;
    projectile.accelerationAngle = baseAngle + (projectile.accelerationJitter ?? 0);
    projectile.accelerationLocked = true;
    if (projectile.stopBeforeAcceleration) {
      projectile.vx = 0;
      projectile.vy = 0;
    }
  }
  projectile.accelerationElapsed += dt;
  if (projectile.accelerationElapsed > projectile.accelerationDuration) {
    if (projectile.explodeAfterAcceleration) projectile.readyToExplode = true;
    return;
  }
  projectile.vx += Math.cos(projectile.accelerationAngle) * projectile.acceleration * dt;
  projectile.vy += Math.sin(projectile.accelerationAngle) * projectile.acceleration * dt;
  const speed = Math.hypot(projectile.vx, projectile.vy);
  if (speed > projectile.maxSpeed) {
    projectile.vx = (projectile.vx / speed) * projectile.maxSpeed;
    projectile.vy = (projectile.vy / speed) * projectile.maxSpeed;
  }
  projectile.angle = Math.atan2(projectile.vy, projectile.vx);
}

function stepHomingProjectile(projectile, targets, dt) {
  const target = nearestTarget(projectile, targets);
  if (target) {
    const desired = Math.atan2(target.y - projectile.y, target.x - projectile.x);
    const delta = Math.atan2(Math.sin(desired - projectile.angle), Math.cos(desired - projectile.angle));
    projectile.angle += Math.max(-projectile.turnRate * dt, Math.min(projectile.turnRate * dt, delta));
  }
  const speed = Math.hypot(projectile.vx, projectile.vy);
  const nextSpeed = Math.min(projectile.maxSpeed, speed + projectile.acceleration * dt);
  projectile.vx = Math.cos(projectile.angle) * nextSpeed;
  projectile.vy = Math.sin(projectile.angle) * nextSpeed;
}

function nearestTarget(projectile, targets) {
  const reference = projectile.targetHint ?? projectile;
  return targets.reduce((nearest, target) => {
    if (target.destroyed) return nearest;
    if (!nearest) return target;
    return distanceSquared(reference, target) < distanceSquared(reference, nearest) ? target : nearest;
  }, null);
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function applyRocketHullDamage(rocket, impactProjectile) {
  if (!rocket.hull) return { hit: false, removed: 0, destroyed: false };
  const local = worldToProjectileLocal(rocket, impactProjectile);
  const radius = Math.max(0.5, impactProjectile.radius * 2.2);
  let hit = false;
  let removed = 0;
  for (const section of rocket.hull.sections) {
    for (const voxel of section.voxels) {
      if (voxel.hp <= 0) continue;
      const distance = Math.hypot(local.x - voxel.x, local.y - voxel.y);
      if (distance > radius) continue;
      hit = true;
      const before = voxel.hp;
      const falloff = Math.max(0.25, 1 - distance / radius);
      voxel.hp = Math.max(0, voxel.hp - impactProjectile.damage * falloff);
      if (before > 0 && voxel.hp <= 0) removed += 1;
    }
  }
  const destroyed = rocket.hull.sections.some((section) => section.voxels.every((voxel) => voxel.hp <= 0));
  return { hit, removed, destroyed };
}

function createRocketHull(shape) {
  const armorVoxelHp = shape.armorVoxelHp ?? 10;
  const halfWidth = shape.halfWidth ?? 3;
  const bodyLength = shape.bodyLength ?? 12;
  const coneLength = shape.coneLength ?? 5;
  const bodyColumns = shape.bodyVoxels?.columns ?? 6;
  const bodyRows = shape.bodyVoxels?.rows ?? 3;
  const coneColumns = shape.coneVoxels?.columns ?? 3;
  const coneRows = shape.coneVoxels?.rows ?? 3;
  const bodyStart = -bodyLength / 2;
  const bodyEnd = bodyLength / 2;
  const coneStart = bodyEnd;
  const coneEnd = coneStart + coneLength;
  return {
    kind: shape.kind,
    bodyLength,
    coneLength,
    halfWidth,
    sections: [
      createRocketSection('cylinder', bodyStart, bodyEnd, halfWidth, bodyColumns, bodyRows, armorVoxelHp, () => true),
      createRocketSection('cone', coneStart, coneEnd, halfWidth, coneColumns, coneRows, armorVoxelHp, (x, y) => {
        const taper = 1 - (x - coneStart) / Math.max(0.001, coneLength);
        return Math.abs(y) <= Math.max(halfWidth * 0.18, halfWidth * taper);
      }),
    ],
  };
}

function createRocketSection(id, xMin, xMax, halfWidth, columns, rows, hp, includes) {
  const voxels = [];
  const width = halfWidth * 2;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = xMin + ((column + 0.5) / columns) * (xMax - xMin);
      const y = -halfWidth + ((row + 0.5) / rows) * width;
      if (!includes(x, y)) continue;
      voxels.push({ x, y, hp, maxHp: hp });
    }
  }
  return { id, xMin, xMax, halfWidth, voxels };
}

function worldToProjectileLocal(projectile, point) {
  const dx = point.x - projectile.x;
  const dy = point.y - projectile.y;
  const cos = Math.cos(projectile.angle);
  const sin = Math.sin(projectile.angle);
  return {
    x: dx * cos + dy * sin,
    y: -dx * sin + dy * cos,
  };
}
