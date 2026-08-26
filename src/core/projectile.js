export function createProjectile(x, y, vx, vy, options = {}) {
  return {
    x,
    y,
    vx,
    vy,
    radius: options.radius ?? 4,
    damage: options.damage ?? 7,
    impulse: options.impulse ?? 240,
    team: options.team ?? 'enemy',
    lifetime: options.lifetime ?? 4,
  };
}

export function stepProjectiles(projectiles, dt) {
  for (const projectile of projectiles) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.lifetime -= dt;
  }
  return projectiles.filter((projectile) => projectile.lifetime > 0);
}
