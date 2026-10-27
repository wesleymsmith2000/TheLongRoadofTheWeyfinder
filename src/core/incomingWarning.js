export const SPAWN_WARNING_LEAD = 2.4;
export function createIncomingMarker(enemy, type, lead = SPAWN_WARNING_LEAD) {
  return { x: enemy.x, y: enemy.y, type, age: 0, lifetime: lead + 0.6 };
}
