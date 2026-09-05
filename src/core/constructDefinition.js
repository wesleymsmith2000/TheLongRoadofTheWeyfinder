import { createCell } from './cell.js';
import { createConnection, OPPOSITE } from './connections.js';
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
  if (coreCount > 1) warnings.push('Construct has more than one core cell; current runtime uses the first surviving core.');

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
    return runtimeCell;
  });
  const connections = (definition.connections ?? []).map((edge) => createConnection(edge.a, edge.b, edge.aSide, edge.bSide ?? OPPOSITE[edge.aSide], edge.type ?? 'structural'));
  const poseRig = normalizePoseRig(constructPoseRigDefinition(definition));
  return {
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
