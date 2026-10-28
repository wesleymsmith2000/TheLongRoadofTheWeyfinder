// Render-only displacement. The simulation remains independent of Canvas.
import { waveletRippleHalfWidth } from '../core/waveletGeometry.js';
export function waveletDisplacement(field, along, perpendicular, time) {
  const config = field.config;
  const charging = field.state === 'CHARGING';
  const width = charging ? config.captureHalfWidth : config.shockwaveMaxRadius;
  const edge = Math.max(0, 1 - (perpendicular / width) ** 2);
  if (along < 0 || along > field.length || edge === 0) return 0;
  if (charging) {
    const charge = Math.min(1, field.chargeElapsed / config.chargeDurationSeconds);
    return Math.sin(along * config.spatialFrequency + (field.originPull ? 1 : -1) * time * 12)
      * config.maxVisualStrengthPx * charge ** 1.3 * edge;
  }
  const age = field.pulseElapsed - along / config.frontSpeed - config.shockwaveLagSeconds;
  if (age < 0 || Math.abs(perpendicular) > waveletRippleHalfWidth(field, along, field.pulseElapsed)) return 0;
  const distance = Math.abs(perpendicular) - age * config.shockwaveSpeed;
  return Math.sin(distance * config.spatialFrequency) * Math.exp(-Math.abs(distance) / 24)
    * config.maxVisualStrengthPx * edge;
}

export function drawWaveletDistortion(ctx, canvas, buffer, fields = [], time = 0) {
  const active = fields.filter(field => field.config.distortionEnabled && ['CHARGING', 'DISCHARGING'].includes(field.state));
  if (active.length === 0) return;
  if (buffer.width !== canvas.width || buffer.height !== canvas.height) {
    buffer.width = canvas.width;
    buffer.height = canvas.height;
  }
  const snapshot = buffer.getContext('2d');
  snapshot.clearRect(0, 0, buffer.width, buffer.height);
  snapshot.drawImage(canvas, 0, 0);
  // One scene snapshot, bounded mesh, no pixel readbacks or per-frame allocation.
  for (const field of active) {
    const width = field.state === 'CHARGING' ? field.config.captureHalfWidth : field.config.shockwaveMaxRadius;
    const slices = 32;
    const bands = 6;
    const length = field.length / slices;
    const bandWidth = width * 2 / bands;
    ctx.save();
    ctx.translate(field.lockedOrigin.x, field.lockedOrigin.y);
    ctx.rotate(field.lockedAngle);
    const transform = ctx.getTransform();
    for (let slice = 0; slice < slices; slice++) for (let band = 0; band < bands; band++) {
      const along = slice * length;
      const perpendicular = -width + band * bandWidth;
      const offset = waveletDisplacement(field, along + length / 2, perpendicular + bandWidth / 2, time);
      if (Math.abs(offset) < 0.05) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(along, perpendicular, length + 0.25, bandWidth + 0.25);
      ctx.clip();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(buffer, (field.originPull ? transform.a : transform.c) * offset, (field.originPull ? transform.b : transform.d) * offset);
      ctx.restore();
    }
    ctx.restore();
  }
}
