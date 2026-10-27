export function waveletChargeAppearance(field) {
  const charge = Math.max(0, Math.min(1, field.chargeElapsed / field.config.chargeDurationSeconds));
  return { charge, opacity: 0.005 + charge * 0.325, particleCount: 12 + Math.floor(charge * 60) };
}

export function waveletChargeParticle(field, index, time) {
  const { charge } = waveletChargeAppearance(field);
  const phase = (time * (0.45 + charge * 0.55) + index * 0.61803398875) % 1;
  const side = index % 2 === 0 ? -1 : 1;
  const outer = field.config.captureHalfWidth * 1.12 + 5;
  return {
    along: ((index * 0.754877666 + 0.03) % 1) * field.length,
    perpendicular: side * outer * (1 - phase) ** 1.7,
    opacity: (0.12 + charge * 0.65) * Math.sin(phase * Math.PI),
    radius: 0.7 + charge * 1.1,
  };
}

export function drawWaveletCharge(ctx, field, time) {
  const { charge, opacity, particleCount } = waveletChargeAppearance(field);
  ctx.save();
  ctx.translate(field.lockedOrigin.x, field.lockedOrigin.y);
  ctx.rotate(field.lockedAngle);
  // One soft elliptical light volume, with a 33% peak at full charge.
  ctx.save();
  ctx.translate(field.length * 0.5, 0);
  ctx.scale(field.length * 0.5, field.config.captureHalfWidth * (0.55 + charge * 0.25));
  const fog = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  fog.addColorStop(0, '#65ffe0');
  fog.addColorStop(0.45, 'rgba(67, 240, 208, 0.65)');
  fog.addColorStop(1, 'rgba(40, 213, 190, 0)');
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = opacity;
  ctx.fillStyle = fog;
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#6fffe0';
  ctx.globalCompositeOperation = 'lighter';
  for (let index = 0; index < particleCount; index++) {
    const particle = waveletChargeParticle(field, index, time);
    ctx.globalAlpha = particle.opacity;
    ctx.beginPath();
    ctx.arc(particle.along, particle.perpendicular, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
