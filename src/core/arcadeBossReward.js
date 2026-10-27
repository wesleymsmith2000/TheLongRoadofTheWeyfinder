import { arcadeSlotFlags } from './arcadeLoadout.js';
import { createCell } from './cell.js';
import { connectedFromCore, createConnection } from './connections.js';
import { recalculateVehicle } from './vehicle.js';

// Grow hardpoints only when the existing primary/secondary bays are exhausted.
export function awardArcadeBossSlot(game) {
  const before = game.weaponBay.unlockedSlots;
  const startingSlots = game.weaponBay.arcadeStartingSlots ?? 5;
  const needed = startingSlots + game.bossLevelsCompleted;
  const newCells = [];
  while (game.vehicleDefinition.cells.filter(cell => cell.type === 'gun').length * 2 < needed) {
    newCells.push(addGunCell(game));
  }
  const after = arcadeSlotFlags(game.vehicleDefinition, game.bossLevelsCompleted, startingSlots);
  game.weaponBay.unlockedSlots = after;
  const unlocked = Object.entries(after).flatMap(([cellId, slots]) => ['primary', 'secondary'].filter(kind => slots[kind][0] && !before[cellId]?.[kind]?.[0]).map(kind => ({ cellId, kind })));
  game.bossReward = { bossClear: game.bossLevelsCompleted, unlocked, newCells };
  recalculateVehicle(game.vehicle);
  return game.bossReward;
}

function addGunCell(game) {
  const definition = game.vehicleDefinition;
  let index = 1;
  while (definition.cells.some(cell => cell.id === `boss-gun-${index}`)) index++;
  const id = `boss-gun-${index}`;
  const connected = connectedFromCore(game.vehicle.cells.filter(cell => cell.attached), game.vehicle.connections);
  // Refit hull armor first: its explicit structural edges stay intact.
  const armor = definition.cells.find(cell => cell.type === 'armor' && connected.has(cell.id) && game.vehicle.cells.some(runtime => runtime.id === cell.id && runtime.attached && !runtime.state.destroyed));
  if (armor) {
    armor.type = 'gun';
    // Keep existing hardpoint ordering stable for progression and save reloads.
    definition.cells = [...definition.cells.filter(cell => cell !== armor), armor];
    const runtimeIndex = game.vehicle.cells.findIndex(cell => cell.id === armor.id);
    game.vehicle.cells.splice(runtimeIndex, 1);
    game.vehicle.cells.push(createCell(armor.id, 'gun', armor.gridX, armor.gridY, armor.gridZ ?? 0));
  } else {
    const occupied = new Set(definition.cells.map(cell => `${cell.gridX},${cell.gridY},${cell.gridZ ?? 0}`));
    let placement;
    for (const anchor of definition.cells) {
      if (!connected.has(anchor.id) || !game.vehicle.cells.some(cell => cell.id === anchor.id && cell.attached && !cell.state.destroyed)) continue;
      for (const [dx, dy, side, opposite] of [[0, -1, 'top', 'bottom'], [-1, 0, 'left', 'right'], [1, 0, 'right', 'left'], [0, 1, 'bottom', 'top']]) {
        const gridX = anchor.gridX + dx, gridY = anchor.gridY + dy, gridZ = anchor.gridZ ?? 0;
        if (!occupied.has(`${gridX},${gridY},${gridZ}`)) { placement = { anchor, gridX, gridY, gridZ, side, opposite }; break; }
      }
      if (placement) break;
    }
    const { anchor, gridX, gridY, gridZ, side, opposite } = placement;
    definition.cells.push({ id, type: 'gun', gridX, gridY, ...(gridZ ? { gridZ } : {}) });
    const edge = createConnection(anchor.id, id, side, opposite);
    definition.connections.push({ ...edge });
    game.vehicle.connections.push({ ...edge });
    game.vehicle.cells.push(createCell(id, 'gun', gridX, gridY, gridZ));
  }
  const cellId = armor?.id ?? id;
  definition.gunLoadouts ??= [];
  definition.gunLoadouts.push({ cellId, primary: [null], secondary: [null] });
  return cellId;
}
