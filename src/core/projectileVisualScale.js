export function projectileUpgradeVisualScale(levels) {
  return 1 + Math.max(0, Number(levels) || 0) * 0.005;
}

export function scaleProjectileVisuals(projectile, scale) {
  if (!projectile || scale === 1) return projectile;
  const scaled = {
    ...projectile,
    sprite: scaleSpriteDescriptor(projectile.sprite, scale),
    shape: scaleProjectileShape(projectile.shape, scale),
  };
  if (projectile.emitsProjectiles) scaled.emitsProjectiles = scaleProjectileVisualPayload(projectile.emitsProjectiles, scale);
  if (projectile.detonationBurst) scaled.detonationBurst = scaleDetonationBurstVisuals(projectile.detonationBurst, scale);
  return scaled;
}

export function scaleSpriteDescriptor(sprite, scale) {
  if (!sprite || scale === 1) return sprite ?? null;
  return {
    ...sprite,
    displaySize: Array.isArray(sprite.displaySize) ? sprite.displaySize.map((value) => value * scale) : sprite.displaySize,
  };
}

function scaleProjectileVisualPayload(payload, scale) {
  if (!payload) return payload;
  return {
    ...payload,
    sprite: scaleSpriteDescriptor(payload.sprite, scale),
    shape: scaleProjectileShape(payload.shape, scale),
  };
}

function scaleDetonationBurstVisuals(burst, scale) {
  if (!burst) return burst;
  const groups = Array.isArray(burst.groups) ? burst.groups : null;
  return {
    ...burst,
    sprite: scaleSpriteDescriptor(burst.sprite, scale),
    groups: groups ? groups.map((group) => scaleProjectileVisualPayload(group, scale)) : burst.groups,
  };
}

function scaleProjectileShape(shape, scale) {
  if (!shape || scale === 1) return shape ?? null;
  return {
    ...shape,
    bodyLength: Number.isFinite(shape.bodyLength) ? shape.bodyLength * scale : shape.bodyLength,
    coneLength: Number.isFinite(shape.coneLength) ? shape.coneLength * scale : shape.coneLength,
    halfWidth: Number.isFinite(shape.halfWidth) ? shape.halfWidth * scale : shape.halfWidth,
  };
}
