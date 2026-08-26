export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function rotatePoint(x, y, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: x * c - y * s, y: x * s + y * c };
}

export function worldToLocal(point, body) {
  const dx = point.x - body.x;
  const dy = point.y - body.y;
  return rotatePoint(dx, dy, -body.heading);
}

export function localToWorld(point, body) {
  const rotated = rotatePoint(point.x, point.y, body.heading);
  return { x: body.x + rotated.x, y: body.y + rotated.y };
}

export function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}
