// Shared collision/render geometry in beam-local coordinates (s along, p across).
export function waveletReleaseBands(field, elapsed) {
  const c = field.config;
  const bands = [{ age: elapsed, halfWidth: c.pulseHalfWidth * 1.8,
    thickness: Math.max(3, c.pulseHalfWidth * 1.1), kind: 'front' }];
  for (let cycle = 0; cycle < Math.max(1, c.visualRingCycles); cycle++) {
    const age = elapsed - cycle * 0.075;
    if (age <= 0) continue;
    bands.push({ age, halfWidth: Math.min(c.shockwaveMaxRadius, age * c.shockwaveSpeed),
      thickness: Math.max(1, 3 - cycle * 0.35), kind: 'ring', cycle });
  }
  return bands.filter(band => band.age >= 0).map(band => ({
    ...band, along: Math.min(field.length, band.age * c.frontSpeed),
  }));
}

export function waveletRippleHalfWidth(field, along, elapsed) {
  if (along < 0 || along > field.length) return -1;
  const age = elapsed - along / field.config.frontSpeed - field.config.shockwaveLagSeconds;
  return age < 0 ? -1 : Math.min(field.config.shockwaveMaxRadius, age * field.config.shockwaveSpeed);
}

export function waveletReleaseContains(field, along, perpendicular, from, to, margin = 0, bands = null) {
  const r = Math.abs(perpendicular);
  const rippleWidth = field.config.sweptBandsOnly ? -1 : waveletRippleHalfWidth(field, along, to);
  if (rippleWidth >= 0 && r <= rippleWidth + margin) return true;
  // Sweep every visible front/ring between frames, including its drawn stroke.
  for (const band of bands ?? waveletReleaseBands(field, to)) {
    const delay = band.kind === 'ring' ? band.cycle * 0.075 : 0;
    const previousAge = Math.max(0, from - delay);
    const previousAlong = Math.min(field.length, previousAge * field.config.frontSpeed);
    const padding = band.thickness / 2 + margin;
    if (along < previousAlong - padding || along > band.along + padding) continue;
    const contactAge = Math.min(band.age, Math.max(previousAge, along / field.config.frontSpeed));
    const halfWidth = band.kind === 'front' ? band.halfWidth : Math.min(field.config.shockwaveMaxRadius, contactAge * field.config.shockwaveSpeed);
    if (r <= halfWidth + margin) return true;
  }
  return false;
}
