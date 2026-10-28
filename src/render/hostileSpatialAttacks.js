export function hostileChargeParticle(attack, index, time) {
  const charge = Math.min(1, attack.chargeElapsed / attack.hostileConfig.chargeSeconds);
  const phase = (time * (0.35 + charge * 0.4) + index * 0.61803398875) % 1;
  const remaining = (1 - phase) ** 1.45;
  return { phase, charge, remaining, alpha: (0.25 + charge * 0.65) * Math.sin(phase * Math.PI),
    color: index % 3 === 0 ? '#db244b' : index % 3 === 1 ? '#8b256e' : '#260719' };
}

export function drawHostileAttacks(ctx, attacks = [], time = 0) {
  for (const attack of attacks) {
    ctx.save();
    if (attack.kind === 'gravity_vortex') drawGravityVortex(ctx, attack, time);
    else {
      ctx.translate(attack.lockedOrigin.x, attack.lockedOrigin.y); ctx.rotate(attack.lockedAngle);
      if (attack.state === 'WARNING') drawWarning(ctx, attack, time);
      else if (attack.state === 'CHARGING') drawHostileCharge(ctx, attack, time);
      else if (attack.state === 'DISCHARGING') drawFlameRelease(ctx, attack, time);
    }
    ctx.restore();
  }
}

function drawWarning(ctx, attack, time) {
  const width = attack.hostileConfig.halfWidth, progress = attack.warningElapsed / attack.hostileConfig.warningSeconds;
  ctx.fillStyle = `rgba(25, 0, 16, ${0.28 + progress * 0.22})`;
  ctx.fillRect(0, -width, attack.length, width * 2);
  ctx.strokeStyle = '#bd2859'; ctx.lineWidth = 2 + progress * 2;
  ctx.globalAlpha = 0.55 + Math.sin(time * 12) ** 2 * 0.4;
  ctx.setLineDash([18, 10]); ctx.strokeRect(0, -width, attack.length, width * 2); ctx.setLineDash([]);
  ctx.strokeStyle = '#8b398b'; ctx.lineWidth = 2;
  for (let x = 24; x < attack.length; x += 70) {
    ctx.beginPath(); ctx.moveTo(x + 12, -14); ctx.lineTo(x, 0); ctx.lineTo(x + 12, 14); ctx.stroke();
  }
  ctx.fillStyle = '#f294ba'; ctx.font = 'bold 11px sans-serif';
  ctx.fillText(`GRAVITY FLAME · ${Math.max(0, attack.hostileConfig.warningSeconds - attack.warningElapsed).toFixed(1)}s`, Math.min(attack.length * 0.55, 400), -width - 10);
}

function drawHostileCharge(ctx, attack, time) {
  const charge = Math.min(1, attack.chargeElapsed / attack.hostileConfig.chargeSeconds);
  const width = attack.hostileConfig.halfWidth;
  // Source-over darkening is intentional; additive light alone cannot blacken the scene.
  const shade = ctx.createLinearGradient(0, -width, 0, width);
  shade.addColorStop(0, 'rgba(30,0,25,0)'); shade.addColorStop(0.3, `rgba(27,0,21,${0.15 + charge * 0.63})`);
  shade.addColorStop(0.5, `rgba(9,0,8,${0.2 + charge * 0.7})`); shade.addColorStop(0.7, `rgba(35,0,24,${0.15 + charge * 0.63})`); shade.addColorStop(1, 'rgba(30,0,25,0)');
  ctx.fillStyle = shade; ctx.fillRect(0, -width, attack.length, width * 2);
  for (let i = 0; i < 32 + Math.floor(charge * 48); i++) {
    const p = hostileChargeParticle(attack, i, time);
    const x = attack.length * p.remaining;
    const y = (i % 2 ? -1 : 1) * width * ((i * 0.75487766) % 1) * p.remaining;
    ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(x, y, 1 + charge * 2.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 0.4 + charge * 0.6; ctx.strokeStyle = '#8c164e'; ctx.lineWidth = 2;
  const phase = (time * 0.7) % 1;
  for (let i = 0; i < 7; i++) {
    const x = ((i + 1 - phase) / 7) * attack.length;
    const taper = x / attack.length;
    ctx.beginPath(); ctx.ellipse(x, 0, 7 + charge * 4, width * taper, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  }
}

function drawFlameRelease(ctx, attack, time) {
  const c = attack.hostileConfig;
  const front = Math.min(attack.length, attack.pulseElapsed * c.frontSpeed);
  const width = attack.config.pulseHalfWidth * 1.8;
  const fade = Math.min(1, Math.max(0, (attack.length / c.frontSpeed + 0.65 - attack.pulseElapsed) / 0.65));
  ctx.globalAlpha = fade;
  // A bright red fireball front, dark purple core and ragged flame wake.
  const glow = ctx.createRadialGradient(front, 0, 2, front, 0, width * 1.8);
  glow.addColorStop(0, '#fff0b7'); glow.addColorStop(0.2, '#f74b38'); glow.addColorStop(0.5, '#a31c54'); glow.addColorStop(1, 'rgba(59,0,37,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(front, 0, width * 1.2, width * 1.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2c031f'; ctx.beginPath(); ctx.ellipse(front - 12, 0, width * 0.45, width * 0.64, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 17; i++) {
    const p = i / 16 * 2 - 1, wobble = Math.sin(i * 2.7 + time * 21);
    ctx.strokeStyle = i % 2 ? '#ec3547' : '#a42d83'; ctx.lineWidth = 3 + (1 - Math.abs(p)) * 4;
    ctx.beginPath(); ctx.moveTo(front + wobble * 8, p * width);
    ctx.quadraticCurveTo(front - 30, p * width + wobble * 9, Math.max(0, front - 60 - (wobble + 1) * 35), p * width * 0.6); ctx.stroke();
  }
  ctx.strokeStyle = '#d93970'; ctx.lineWidth = 2;
  for (let i = 0; i < attack.config.visualRingCycles; i++) {
    const age = attack.pulseElapsed - i * 0.075;
    if (age <= 0) continue;
    const x = Math.min(attack.length, age * c.frontSpeed), radius = Math.min(c.halfWidth * 1.2, age * 200);
    ctx.globalAlpha = fade * 0.45; ctx.beginPath(); ctx.ellipse(x, 0, 9, radius, 0, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawGravityVortex(ctx, attack, time) {
  const c = attack.hostileConfig;
  ctx.translate(attack.x, attack.y);
  if (attack.state === 'DISCHARGING') {
    const progress = Math.min(1, attack.pulseElapsed / 0.65);
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = '#ff5873'; ctx.lineWidth = 18 * (1 - progress) + 2;
    ctx.beginPath(); ctx.arc(0, 0, c.explosionRadius * Math.min(1, progress * 2), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#a93691'; ctx.globalAlpha *= 0.22;
    ctx.beginPath(); ctx.arc(0, 0, c.explosionRadius * progress, 0, Math.PI * 2); ctx.fill();
    return;
  }
  const charge = Math.min(1, attack.chargeElapsed / c.chargeSeconds);
  const dark = ctx.createRadialGradient(0, 0, 0, 0, 0, c.radius);
  dark.addColorStop(0, `rgba(8,0,9,${0.55 + charge * 0.4})`); dark.addColorStop(0.6, 'rgba(40,0,28,0.48)'); dark.addColorStop(1, 'rgba(62,0,40,0)');
  ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0, 0, c.radius, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 96; i++) {
    const p = hostileChargeParticle(attack, i, time), radius = c.radius * p.remaining;
    const angle = i * 2.39996323 + p.phase * 4;
    ctx.fillStyle = p.color; ctx.globalAlpha = p.alpha;
    ctx.beginPath(); ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius, 1 + charge * 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#9c276e'; ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const radius = c.radius * (1 - ((time * 0.6 + i / 5) % 1));
    ctx.globalAlpha = 0.18 + charge * 0.28; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.fillStyle = '#12000e';
  ctx.beginPath(); ctx.arc(0, 0, 6 + charge * 19, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#dc3a78'; ctx.lineWidth = 1 + charge * 2; ctx.stroke();
}

export function drawGravityBombMarkers(ctx, projectiles, time) {
  for (const shell of projectiles ?? []) {
    if (!shell.gravityBomb || !shell.targetHint || shell.arcLanded) continue;
    const point = shell.targetHint;
    ctx.save(); ctx.strokeStyle = '#d3428b'; ctx.fillStyle = 'rgba(33,0,27,0.28)';
    ctx.lineWidth = 2; ctx.setLineDash([8, 7]);
    ctx.beginPath(); ctx.arc(point.x, point.y, shell.gravityBomb.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 0.6 + Math.sin(time * 10) ** 2 * 0.4;
    ctx.beginPath(); ctx.arc(point.x, point.y, 12, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
}

export function drawGravityDistortion(ctx, canvas, buffer, attacks = [], time = 0) {
  const vortices = attacks.filter(attack => attack.kind === 'gravity_vortex' && attack.state === 'CHARGING');
  if (!vortices.length) return;
  if (buffer.width !== canvas.width || buffer.height !== canvas.height) { buffer.width = canvas.width; buffer.height = canvas.height; }
  const snapshot = buffer.getContext('2d'); snapshot.clearRect(0, 0, buffer.width, buffer.height); snapshot.drawImage(canvas, 0, 0);
  for (const vortex of vortices) {
    const radius = vortex.hostileConfig.radius, cell = radius * 2 / 12;
    const strength = 3 + vortex.chargeElapsed / vortex.hostileConfig.chargeSeconds * 10;
    const transform = ctx.getTransform();
    for (let row = 0; row < 12; row++) for (let col = 0; col < 12; col++) {
      const x = -radius + (col + 0.5) * cell, y = -radius + (row + 0.5) * cell, distance = Math.hypot(x, y);
      if (distance < 1 || distance > radius) continue;
      // Positive time phase moves each radial ripple inward toward the origin.
      const offset = Math.sin(distance * 0.12 + time * 11) * strength * (1 - distance / radius);
      const dx = x / distance * offset, dy = y / distance * offset;
      ctx.save(); ctx.beginPath(); ctx.rect(vortex.x + x - cell / 2, vortex.y + y - cell / 2, cell + 0.3, cell + 0.3); ctx.clip();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(buffer, transform.a * dx + transform.c * dy, transform.b * dx + transform.d * dy); ctx.restore();
    }
  }
}
