import { createCell } from './cell.js';
import { coreDistanceMap, createConnection, OPPOSITE } from './connections.js';
import { CANON_STATUSES, CONTENT_SCHEMA_VERSION, isCompatibleSchemaVersion, isNonEmptyString, isPlainObject, isStringArray } from './contentSchema.js';
import { normalizePoseRig, validatePoseRig } from './poseAnimation.js';

export const CONSTRUCT_SCHEMA_VERSION = CONTENT_SCHEMA_VERSION;
export { CANON_STATUSES };
export const CELL_TYPES = ['armor', 'core', 'engine', 'gun', 'utility', 'wheel'];
export const CONNECTION_SIDES = ['top', 'right', 'bottom', 'left', 'above', 'below'];

export function validateConstructDefinition(definition) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(definition)) return { valid: false, errors: ['Construct definition must be an object.'], warnings };

  if (!isCompatibleSchemaVersion(definition.schemaVersion)) {
    errors.push(`Unsupported construct schemaVersion "${definition.schemaVersion ?? 'missing'}". Expected 0.x.`);
  }
  if (!isNonEmptyString(definition.assetId)) errors.push('assetId must be a non-empty string.');
  if (definition.canonStatus != null && !CANON_STATUSES.includes(definition.canonStatus)) {
    errors.push(`canonStatus must be one of: ${CANON_STATUSES.join(', ')}.`);
  }
  if (!Array.isArray(definition.cells)) errors.push('cells must be an array.');
  if (definition.connections != null && !Array.isArray(definition.connections)) errors.push('connections must be an array when provided.');
  if (definition.modules != null && !Array.isArray(definition.modules)) errors.push('modules must be an array when provided.');
  if (definition.tags != null && !isStringArray(definition.tags)) warnings.push('tags should be an array of strings.');
  if (definition.dependencies != null && !isStringArray(definition.dependencies)) warnings.push('dependencies should be an array of strings.');
  if (definition.damageGroups != null && !damageGroupsAreValidShape(definition.damageGroups)) {
    errors.push('damageGroups must be an object of cell id arrays or an array of { id, cells } entries.');
  }
  if (definition.topology != null && !isPlainObject(definition.topology)) {
    errors.push('topology must be an object when provided.');
  }

  const cells = Array.isArray(definition.cells) ? definition.cells : [];
  const cellIds = new Set();
  const occupied = new Set();
  for (const [index, cell] of cells.entries()) {
    const label = `cells[${index}]`;
    if (!isPlainObject(cell)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!isNonEmptyString(cell.id)) {
      errors.push(`${label}.id must be a non-empty string.`);
    } else if (cellIds.has(cell.id)) {
      errors.push(`Duplicate cell id "${cell.id}".`);
    } else {
      cellIds.add(cell.id);
    }
    if (!CELL_TYPES.includes(cell.type)) errors.push(`${label}.type must be one of: ${CELL_TYPES.join(', ')}.`);
    if (!Number.isInteger(cell.gridX)) errors.push(`${label}.gridX must be an integer.`);
    if (!Number.isInteger(cell.gridY)) errors.push(`${label}.gridY must be an integer.`);
    if (cell.gridZ != null && !Number.isInteger(cell.gridZ)) errors.push(`${label}.gridZ must be an integer when provided.`);
    if (Number.isInteger(cell.gridX) && Number.isInteger(cell.gridY) && (cell.gridZ == null || Number.isInteger(cell.gridZ))) {
      const key = `${cell.gridX},${cell.gridY},${cell.gridZ ?? 0}`;
      if (occupied.has(key)) errors.push(`Multiple cells occupy grid position ${key}.`);
      occupied.add(key);
    }
  }

  const coreCount = cells.filter((cell) => cell?.type === 'core').length;
  if (coreCount === 0) errors.push('Construct must include at least one core cell.');

  const connections = Array.isArray(definition.connections) ? definition.connections : [];
  for (const [index, edge] of connections.entries()) {
    const label = `connections[${index}]`;
    if (!isPlainObject(edge)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!cellIds.has(edge.a)) errors.push(`${label}.a references unknown cell "${edge.a ?? 'missing'}".`);
    if (!cellIds.has(edge.b)) errors.push(`${label}.b references unknown cell "${edge.b ?? 'missing'}".`);
    if (!CONNECTION_SIDES.includes(edge.aSide)) errors.push(`${label}.aSide must be one of: ${CONNECTION_SIDES.join(', ')}.`);
    if (edge.bSide != null && !CONNECTION_SIDES.includes(edge.bSide)) {
      errors.push(`${label}.bSide must be one of: ${CONNECTION_SIDES.join(', ')}.`);
    }
    if (edge.type != null && !isNonEmptyString(edge.type)) errors.push(`${label}.type must be a non-empty string when provided.`);
  }

  validateCoreCluster(cells, connections, errors);
  validateDamageGroupReferences(definition.damageGroups, cellIds, errors, warnings);
  validateTopologyMetadata(definition.topology, cellIds, warnings);
  if (cells.length > 0 && connections.length === 0) warnings.push('Construct has no explicit connections; only the core will be structurally connected.');
  validatePoseRig(constructPoseRigDefinition(definition), 'poseRig', cellIds, errors, warnings);

  return { valid: errors.length === 0, errors, warnings };
}

export function instantiateConstruct(definition) {
  const report = validateConstructDefinition(definition);
  if (!report.valid) {
    throw new Error(`Invalid construct "${definition?.assetId ?? 'unknown'}": ${report.errors.join(' ')}`);
  }
  const cells = definition.cells.map((cell) => {
    const runtimeCell = createCell(cell.id, cell.type, cell.gridX, cell.gridY, cell.gridZ ?? cell.layer ?? 0);
    for (const [key, value] of Object.entries(cell)) {
      if (['id', 'type', 'gridX', 'gridY', 'gridZ', 'layer'].includes(key)) continue;
      runtimeCell[key] = structuredClone(value);
    }
    runtimeCell.sourceId = cell.id;
    return runtimeCell;
  });
  const connections = (definition.connections ?? []).map((edge) => createConnection(edge.a, edge.b, edge.aSide, edge.bSide ?? OPPOSITE[edge.aSide], edge.type ?? 'structural'));
  const poseRig = normalizePoseRig(constructPoseRigDefinition(definition));
  const construct = {
    assetId: definition.assetId,
    schemaVersion: definition.schemaVersion,
    canonStatus: definition.canonStatus ?? 'EXPERIMENTAL',
    tags: [...(definition.tags ?? [])],
    presentation: definition.presentation ? structuredClone(definition.presentation) : null,
    modules: structuredClone(definition.modules ?? []),
    poseRig,
    cells,
    connections,
  };
  return annotateConstructRuntimeMetadata(construct, definition);
}

export function annotateConstructRuntimeMetadata(construct, definition = null) {
  if (!construct || !Array.isArray(construct.cells)) return construct;
  const distances = runtimeCoreDistanceMap(construct, definition);
  const coreCellIds = [];
  let maxCoreDistance = 0;
  const coreDistanceByCellId = {};

  for (const cell of construct.cells) {
    cell.sourceId ??= cell.id;
    const distance = distances.get(cell.id);
    if (cell.type === 'core') coreCellIds.push(cell.id);
    if (Number.isFinite(distance)) {
      maxCoreDistance = Math.max(maxCoreDistance, distance);
      coreDistanceByCellId[cell.id] = distance;
      cell.coreDistance = distance;
    } else {
      delete cell.coreDistance;
    }
    cell.topology = {
      ...(isPlainObject(cell.topology) ? cell.topology : {}),
      sourceId: cell.sourceId,
      originalCore: cell.type === 'core',
      coreDistance: Number.isFinite(distance) ? distance : null,
    };
  }

  construct.topology = {
    schemaVersion: '0.1',
    ...(isPlainObject(definition?.topology) ? structuredClone(definition.topology) : {}),
    coreCellIds,
    coreDistanceByCellId,
    maxCoreDistance,
  };
  const damageGroups = buildRuntimeDamageGroups(construct.cells, definition);
  construct.damageGroups = damageGroups.groups;
  construct.damageGroupCellIds = damageGroups.ids;
  return construct;
}

function constructPoseRigDefinition(definition) {
  if (definition?.poseRig) return definition.poseRig;
  if (definition?.cellGroups || definition?.joints || definition?.poses || definition?.poseAnimations || definition?.cellBindings || definition?.poseDynamics || definition?.poseRigImports) {
    return {
      groups: definition.cellGroups,
      joints: definition.joints,
      poses: definition.poses,
      animations: definition.poseAnimations,
      cellBindings: definition.cellBindings,
      dynamics: definition.poseDynamics,
      imports: definition.poseRigImports,
    };
  }
  return null;
}

function runtimeCoreDistanceMap(construct, definition) {
  const computed = coreDistanceMap(construct.cells, construct.connections, { includeDestroyed: true });
  const prebaked = prebakedCoreDistanceBySourceId(definition?.topology);
  const uniqueSourceIds = new Set(construct.cells.map((cell) => cell.sourceId ?? cell.id));
  if (prebaked.size === 0 || uniqueSourceIds.size !== construct.cells.length) return computed;

  const distances = new Map();
  for (const cell of construct.cells) {
    const sourceId = cell.sourceId ?? cell.id;
    const sourceDistance = prebaked.get(sourceId);
    if (Number.isFinite(sourceDistance)) distances.set(cell.id, sourceDistance);
    else if (computed.has(cell.id)) distances.set(cell.id, computed.get(cell.id));
  }
  return distances;
}

function prebakedCoreDistanceBySourceId(topology) {
  if (!isPlainObject(topology)) return new Map();
  const source = topology.coreDistanceByCellId ?? topology.coreDistances;
  const result = new Map();
  if (isPlainObject(source)) {
    for (const [id, distance] of Object.entries(source)) {
      const numeric = Number(distance);
      if (Number.isFinite(numeric) && numeric >= 0) result.set(id, numeric);
    }
  } else if (Array.isArray(source)) {
    for (const entry of source) {
      if (!isPlainObject(entry) || !isNonEmptyString(entry.cellId ?? entry.id)) continue;
      const numeric = Number(entry.distance ?? entry.coreDistance);
      if (Number.isFinite(numeric) && numeric >= 0) result.set(entry.cellId ?? entry.id, numeric);
    }
  }
  return result;
}

function buildRuntimeDamageGroups(cells, definition) {
  const groups = new Map();
  const add = (groupId, cell) => {
    if (!isNonEmptyString(groupId) || !cell) return;
    if (!groups.has(groupId)) groups.set(groupId, new Set());
    groups.get(groupId).add(cell);
  };

  const cellsBySourceId = new Map();
  for (const cell of cells) {
    const sourceId = cell.sourceId ?? cell.id;
    if (!cellsBySourceId.has(sourceId)) cellsBySourceId.set(sourceId, []);
    cellsBySourceId.get(sourceId).push(cell);
  }
  const cellById = new Map(cells.map((cell) => [cell.id, cell]));
  for (const cell of cells) {
    if (isNonEmptyString(cell.role)) add(cell.role, cell);
    if (isNonEmptyString(cell.type)) add(`type:${cell.type}`, cell);
    if (isNonEmptyString(cell.slot)) add(`slot:${cell.slot}`, cell);
    for (const tag of Array.isArray(cell.tags) ? cell.tags : []) add(`tag:${tag}`, cell);
    for (const groupId of cellDamageGroupIds(cell)) add(groupId, cell);
  }

  for (const [groupId, ids] of normalizeDamageGroupEntries(definition?.damageGroups)) {
    for (const id of ids) {
      const sourceCells = cellsBySourceId.get(id);
      if (sourceCells) {
        for (const cell of sourceCells) add(groupId, cell);
      } else {
        add(groupId, cellById.get(id));
      }
    }
  }
  for (const [groupId, ids] of normalizeDamageGroupEntries(definition?.topology?.damageGroups)) {
    for (const id of ids) {
      const sourceCells = cellsBySourceId.get(id);
      if (sourceCells) {
        for (const cell of sourceCells) add(groupId, cell);
      } else {
        add(groupId, cellById.get(id));
      }
    }
  }

  const runtimeGroups = {};
  const runtimeIds = {};
  for (const [groupId, groupCells] of groups) {
    const ordered = [...groupCells].sort((a, b) => a.id.localeCompare(b.id));
    runtimeGroups[groupId] = ordered;
    runtimeIds[groupId] = ordered.map((cell) => cell.id);
  }
  return { groups: runtimeGroups, ids: runtimeIds };
}

function cellDamageGroupIds(cell) {
  const groups = [];
  if (isNonEmptyString(cell.damageGroup)) groups.push(cell.damageGroup);
  if (Array.isArray(cell.damageGroups)) {
    for (const group of cell.damageGroups) {
      if (isNonEmptyString(group)) groups.push(group);
    }
  }
  return groups;
}

function normalizeDamageGroupEntries(groups) {
  const entries = [];
  if (isPlainObject(groups)) {
    for (const [groupId, ids] of Object.entries(groups)) {
      if (Array.isArray(ids)) entries.push([groupId, ids.filter(isNonEmptyString)]);
    }
  } else if (Array.isArray(groups)) {
    for (const entry of groups) {
      if (!isPlainObject(entry) || !isNonEmptyString(entry.id) || !Array.isArray(entry.cells)) continue;
      entries.push([entry.id, entry.cells.filter(isNonEmptyString)]);
    }
  }
  return entries;
}

function damageGroupsAreValidShape(groups) {
  if (isPlainObject(groups)) return Object.values(groups).every((ids) => Array.isArray(ids));
  if (!Array.isArray(groups)) return false;
  return groups.every((entry) => isPlainObject(entry) && isNonEmptyString(entry.id) && Array.isArray(entry.cells));
}

function validateDamageGroupReferences(groups, cellIds, errors, warnings) {
  if (groups == null) return;
  if (!damageGroupsAreValidShape(groups)) return;
  for (const [groupId, ids] of normalizeDamageGroupEntries(groups)) {
    if (!isNonEmptyString(groupId)) {
      warnings.push('damageGroups should use non-empty group ids.');
      continue;
    }
    for (const id of ids) {
      if (!cellIds.has(id)) errors.push(`damageGroups.${groupId} references unknown cell "${id}".`);
    }
  }
}

function validateTopologyMetadata(topology, cellIds, warnings) {
  if (!isPlainObject(topology)) return;
  const prebaked = prebakedCoreDistanceBySourceId(topology);
  for (const id of prebaked.keys()) {
    if (!cellIds.has(id)) warnings.push(`topology core distance references unknown cell "${id}".`);
  }
  for (const [groupId, ids] of normalizeDamageGroupEntries(topology.damageGroups)) {
    if (!isNonEmptyString(groupId)) continue;
    for (const id of ids) {
      if (!cellIds.has(id)) warnings.push(`topology.damageGroups.${groupId} references unknown cell "${id}".`);
    }
  }
}

function validateCoreCluster(cells, connections, errors) {
  const cores = cells.filter((cell) => cell?.type === 'core');
  if (cores.length <= 1) return;
  const coreIds = new Set(cores.map((cell) => cell.id));
  if (!connectedCoreGraph(cores, (a, b) => coreCellsAreAdjacent(a, b))) {
    errors.push('Multiple core cells must form one directly adjacent core cluster in the initial grid.');
  }
  if (!connectedCoreGraph(cores, (a, b) => coreCellsAreStructurallyConnected(a, b, coreIds, connections))) {
    errors.push('Multiple core cells must be connected to each other by explicit structural core-to-core connections.');
  }
}

function connectedCoreGraph(cores, hasEdge) {
  const connected = new Set([cores[0].id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of cores) {
      if (!connected.has(a.id)) continue;
      for (const b of cores) {
        if (connected.has(b.id) || a.id === b.id) continue;
        if (hasEdge(a, b)) {
          connected.add(b.id);
          changed = true;
        }
      }
    }
  }
  return connected.size === cores.length;
}

function coreCellsAreAdjacent(a, b) {
  const dx = Math.abs(a.gridX - b.gridX);
  const dy = Math.abs(a.gridY - b.gridY);
  const dz = Math.abs((a.gridZ ?? 0) - (b.gridZ ?? 0));
  return dx + dy + dz === 1;
}

function coreCellsAreStructurallyConnected(a, b, coreIds, connections) {
  return connections.some((edge) => {
    if (edge?.type != null && edge.type !== 'structural') return false;
    if (!coreIds.has(edge?.a) || !coreIds.has(edge?.b)) return false;
    return (edge.a === a.id && edge.b === b.id) || (edge.a === b.id && edge.b === a.id);
  });
}
