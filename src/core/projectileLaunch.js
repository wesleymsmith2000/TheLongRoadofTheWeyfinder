const EPSILON = 1e-9;

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
