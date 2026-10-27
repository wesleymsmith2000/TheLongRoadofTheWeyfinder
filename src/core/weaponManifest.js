import { firingGunLoadouts } from './arcadeLoadout.js';
import { normalizeUtilityLoadouts } from './weaponLoadout.js';
import { weaponCooldown } from './weaponCooldown.js';
import { emergencyPrimaryState } from './emergencyWeapon.js';

// Strongest remaining structural path to the core; never infer grid adjacency.
function supportStrengths(vehicle) {
  const cells = new Map(vehicle.cells.filter(cell => cell.attached && !cell.state.destroyed).map(cell => [cell.id, cell]));
  const strength = new Map([...cells.values()].filter(cell => cell.type === 'core').map(cell => [cell.id, 1]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of vehicle.connections ?? []) {
      if (edge.type !== 'structural' || edge.valid === false) continue;
      const a = cells.get(edge.a), b = cells.get(edge.b);
      if (!a || !b) continue;
      const grip = Math.min(a.state.anchorIntegrity?.[edge.aSide] ?? a.state.structureIntegrity,
        b.state.anchorIntegrity?.[edge.bSide] ?? b.state.structureIntegrity,
        a.state.structureIntegrity, b.state.structureIntegrity);
      for (const [from, to] of [[a.id, b.id], [b.id, a.id]]) {
        const candidate = Math.min(strength.get(from) ?? 0, grip);
        if (candidate > (strength.get(to) ?? 0)) { strength.set(to, candidate); changed = true; }
      }
    }
  }
  return strength;
}

export function weaponManifest(game) {
  const vehicle = game.vehicle;
  const cells = new Map(vehicle.cells.map(cell => [cell.id, cell]));
  const support = supportStrengths(vehicle);
  const result = [];
  function add(cellId, kind, ids) {
    ids.forEach((weaponId, index) => {
      if (!weaponId) return;
      const cell = cells.get(cellId);
      const integrity = cell ? Math.min(cell.state.structureIntegrity, cell.state.wiringIntegrity, cell.state.deviceIntegrity) : 0;
      const lost = !cell?.attached || cell.state.destroyed || integrity <= 0.1 || cell.state.deviceIntegrity <= 0.15;
      const status = lost ? 'lost' : integrity < 0.5 || (support.get(cellId) ?? 0) < 0.7 ? 'danger' : 'good';
      const entry = { key: `${cellId}:${kind}:${index}`, cellId, kind, slotIndex: index, weaponId, integrity, status };
      result.push({ ...entry, cooldown: weaponCooldown(game, entry) });
    });
  }
  for (const loadout of firingGunLoadouts(game)) {
    add(loadout.cellId, 'primary', loadout.primary);
    add(loadout.cellId, 'secondary', loadout.secondary);
  }
  for (const loadout of normalizeUtilityLoadouts(game.vehicleDefinition)) add(loadout.cellId, 'utility', loadout.slots);
  const emergency = emergencyPrimaryState(game);
  if (emergency.enabled && emergency.cell) {
    add(emergency.cell.id, 'emergency', [emergency.weaponId]);
    const entry = result.at(-1);
    entry.emergency = true;
    entry.standby = !emergency.active && entry.status !== 'lost';
    entry.cooldown = weaponCooldown(game, entry);
  }
  return result;
}
