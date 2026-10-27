// Shared by sustained particle beams and the wavelet's full-burst damage floor.
export function beamFrameDamageScale(frame, frames) {
  const centerDistance = Math.abs(frame - (frames - 1) / 2);
  if (centerDistance <= 1) return 3;
  return 1 + (1 - centerDistance / ((frames - 1) / 2)) * 2;
}

export function beamBurstDamage(damage, frames) {
  let total = 0;
  for (let frame = 0; frame < frames; frame++) total += damage * beamFrameDamageScale(frame, frames);
  return total;
}
