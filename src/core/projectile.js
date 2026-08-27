export function createProjectile(x, y, vx, vy, options = {}) {
  return {
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
    impulse: options.impulse ?? 240,
    team: options.team ?? 'enemy',
    weapon: options.weapon ?? 'bullet',
    behavior: options.behavior ?? 'ballistic',
    lifetime: options.lifetime ?? 4,
    maxLifetime: options.lifetime ?? 4,
    frames: options.frames ?? 0,
    turnRate: options.turnRate ?? 0,
    acceleration: options.acceleration ?? 0,
    maxSpeed: options.maxSpeed ?? Infinity,
    targetHint: options.targetHint ?? null,
    blastDamage: options.blastDamage ?? 0,
    blastRadius: options.blastRadius ?? 0,
    blastKnockback: options.blastKnockback ?? 0,
    shrapnelCount: options.shrapnelCount ?? 0,
    shrapnelDamageScale: options.shrapnelDamageScale ?? 1,
    pierce: options.pierce ?? 0,
  };
}

export function stepProjectiles(projectiles, dt, targets = []) {
  for (const projectile of projectiles) {
    projectile.previousX = projectile.x;
    projectile.previousY = projectile.y;
    if (projectile.behavior === 'homing') stepHomingProjectile(projectile, targets, dt);
    if (projectile.behavior === 'beam' || projectile.behavior === 'blast') {
      projectile.lifetime -= dt;
      continue;
    }
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.lifetime -= dt;
  }
  return projectiles.filter((projectile) => projectile.lifetime > 0);
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
