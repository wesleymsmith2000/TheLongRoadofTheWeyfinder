const EPSILON = 1e-9;

/** Spawn-only, axial inheritance with a 50% asymptotic relative-speed floor. */
export function arcadeProjectileVelocity(shooterVelocity, aimDirection, baseProjectileSpeed) {
  const length = Math.hypot(aimDirection?.x ?? 0, aimDirection?.y ?? 0);
  if (length <= EPSILON || baseProjectileSpeed <= 0) return { x: 0, y: 0 };
  const dx = aimDirection.x / length;
  const dy = aimDirection.y / length;
  const forwardSpeed = Math.max(0, (shooterVelocity?.x ?? 0) * dx + (shooterVelocity?.y ?? 0) * dy);
  const relativeSpeed = baseProjectileSpeed * (0.5 + 0.5 * Math.exp(-forwardSpeed / baseProjectileSpeed));
  const worldSpeed = forwardSpeed + relativeSpeed;
  return { x: dx * worldSpeed, y: dy * worldSpeed };
}

/**
 * Inherit shooter velocity at spawn without allowing backward shooter motion
 * to stop or reverse a projectile along its authored firing axis.
 */
export function forwardSafeInheritedVelocity(shooterVelocity, baseProjectileVelocity) {
  const vx0 = baseProjectileVelocity?.x ?? 0;
  const vy0 = baseProjectileVelocity?.y ?? 0;
  const baseSpeed = Math.hypot(vx0, vy0);

  if (baseSpeed <= EPSILON) return { x: vx0, y: vy0 };

  const directionX = vx0 / baseSpeed;
  const directionY = vy0 / baseSpeed;
  const shooterX = shooterVelocity?.x ?? 0;
  const shooterY = shooterVelocity?.y ?? 0;
  const parallel = shooterX * directionX + shooterY * directionY;
  const perpendicularX = shooterX - parallel * directionX;
  const perpendicularY = shooterY - parallel * directionY;
  let inheritedParallel = parallel;

  if (parallel < 0) {
    const forwardFloor = Math.min(baseSpeed, Math.sqrt(baseSpeed));
    const removableForwardSpeed = baseSpeed - forwardFloor;
    inheritedParallel =
      removableForwardSpeed > EPSILON
        ? -removableForwardSpeed * (1 - Math.exp(parallel / removableForwardSpeed))
        : 0;
  }

  return {
    x: vx0 + perpendicularX + inheritedParallel * directionX,
    y: vy0 + perpendicularY + inheritedParallel * directionY,
  };
}
