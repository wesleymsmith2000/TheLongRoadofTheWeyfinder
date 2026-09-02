import { instantiateConstruct, validateConstructDefinition } from './constructDefinition.js';
import { createConnection, OPPOSITE } from './connections.js';
import { equipmentLimit, PLAYER_EQUIPMENT_TYPES } from './playerAccount.js';
import { normalizeGunLoadouts, setGunLoadoutSlot } from './weaponLoadout.js';

export const VEHICLE_EDITOR_GRID_RADIUS = 8;

export function createVehicleFromConstructDefinition(definition) {
  const construct = instantiateConstruct(definition);
  const vehicle = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    heading: 0,
    angularVelocity: 0,
    turretHeading: -Math.PI / 2,
    manualAimGrace: 0,
    assetId: construct.assetId,
    presentation: construct.presentation,
    cells: construct.cells,
    connections: construct.connections,
    detachedPieces: [],
    totalMass: 1,
    centerOfMass: { x: 0, y: 0 },
    momentOfInertia: 1,
    lastHitCellId: null,
    alive: true,
  };
  return vehicle;
}

export function vehicleToConstructDefinition(vehicle, baseDefinition) {
  return {
    ...baseDefinition,
    cells: vehicle.cells.map((cell) => ({ id: cell.id, type: cell.type, gridX: cell.gridX, gridY: cell.gridY })),
    connections: vehicle.connections.map((edge) => ({ a: edge.a, b: edge.b, aSide: edge.aSide, bSide: edge.bSide, type: edge.type })),
    gunLoadouts: normalizeGunLoadouts(baseDefinition),
    modules: baseDefinition.modules ?? [],
  };
}

export function addEditableVehicleCell(definition, account, type, gridX, gridY) {
  if (!PLAYER_EQUIPMENT_TYPES.includes(type)) return { changed: false, reason: 'This equipment type is not available.' };
  if (definition.cells.some((cell) => cell.gridX === gridX && cell.gridY === gridY)) return { changed: false, reason: 'Grid position is already occupied.' };
  if (!withinEditorGrid(gridX, gridY)) return { changed: false, reason: 'Grid position is outside the current editor bounds.' };
  const used = definition.cells.filter((cell) => cell.type === type).length;
  if (used >= equipmentLimit(account, type)) return { changed: false, reason: `No ${type} equipment remaining.` };
  const next = cloneDefinition(definition);
  next.cells.push({ id: uniqueCellId(next, type, gridX, gridY), type, gridX, gridY });
  next.gunLoadouts = normalizeGunLoadouts(next);
  return { changed: true, definition: next };
}

export function removeEditableVehicleCell(definition, cellId) {
  const cell = definition.cells.find((candidate) => candidate.id === cellId);
  if (!cell) return { changed: false, reason: 'Cell does not exist.' };
  if (cell.type === 'core') return { changed: false, reason: 'The Core cannot be removed.' };
  const next = cloneDefinition(definition);
  next.cells = next.cells.filter((candidate) => candidate.id !== cellId);
  next.connections = (next.connections ?? []).filter((edge) => edge.a !== cellId && edge.b !== cellId);
  next.gunLoadouts = normalizeGunLoadouts(next);
  return { changed: true, definition: next };
}

export { normalizeGunLoadouts, setGunLoadoutSlot };

export function connectEditableVehicleCells(definition, aId, bId) {
  if (aId === bId) return { changed: false, reason: 'Choose two different cells.' };
  const a = definition.cells.find((cell) => cell.id === aId);
  const b = definition.cells.find((cell) => cell.id === bId);
  if (!a || !b) return { changed: false, reason: 'Both cells must exist.' };
  const aSide = adjacentSide(a, b);
  if (!aSide) return { changed: false, reason: 'Cells must be directly adjacent to connect.' };
  if ((definition.connections ?? []).some((edge) => sameConnection(edge, aId, bId))) {
    return { changed: false, reason: 'Those cells are already connected.' };
  }
  const next = cloneDefinition(definition);
  next.connections ??= [];
  next.connections.push(createConnection(aId, bId, aSide, OPPOSITE[aSide]));
  return { changed: true, definition: next };
}

export function editableVehicleReport(definition, account) {
  const report = validateConstructDefinition(definition);
  const usage = Object.fromEntries(
    PLAYER_EQUIPMENT_TYPES.map((type) => {
      const used = definition.cells.filter((cell) => cell.type === type).length;
      return [type, { used, limit: equipmentLimit(account, type), remaining: Math.max(0, equipmentLimit(account, type) - used) }];
    }),
  );
  if (definition.cells.filter((cell) => cell.type === 'core').length !== 1) {
    report.errors.push('Player vehicle must contain exactly one core.');
    report.valid = false;
  }
  return { ...report, usage };
}

function withinEditorGrid(gridX, gridY) {
  return Math.abs(gridX) <= VEHICLE_EDITOR_GRID_RADIUS && Math.abs(gridY) <= VEHICLE_EDITOR_GRID_RADIUS;
}

function adjacentSide(a, b) {
  const dx = b.gridX - a.gridX;
  const dy = b.gridY - a.gridY;
  if (dx === 1 && dy === 0) return 'right';
  if (dx === -1 && dy === 0) return 'left';
  if (dx === 0 && dy === 1) return 'bottom';
  if (dx === 0 && dy === -1) return 'top';
  return null;
}

function sameConnection(edge, a, b) {
  return (edge.a === a && edge.b === b) || (edge.a === b && edge.b === a);
}

function uniqueCellId(definition, type, gridX, gridY) {
  const base = `${type}-${gridX}-${gridY}`.replaceAll('-', 'm');
  const ids = new Set(definition.cells.map((cell) => cell.id));
  let id = base;
  let suffix = 2;
  while (ids.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function cloneDefinition(definition) {
  return JSON.parse(JSON.stringify(definition));
}
