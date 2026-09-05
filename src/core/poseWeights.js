export const POSE_RIG_SCHEMA_VERSION = '0.2';
export const MAX_CELL_BINDING_INFLUENCES = 2;
export const WEIGHT_SUM_TOLERANCE = 0.001;

export function normalizeCellWeights(bindings = null) {
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) return {};
  const normalized = {};
  for (const [cellId, sourceInfluences] of Object.entries(bindings)) {
    const influences = normalizeBindingList(sourceInfluences);
    if (influences.length > 0) normalized[cellId] = influences;
  }
  return normalized;
}

export function validateCellBindings(bindings, path, cellIds, jointIds, errors, warnings) {
  if (bindings == null) return;
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) {
    errors.push(`${path} must be an object keyed by cell id when provided.`);
    return;
  }
  for (const [cellId, sourceInfluences] of Object.entries(bindings)) {
    const label = `${path}.${cellId}`;
    if (!cellIds.has(cellId)) errors.push(`${label} references unknown cell "${cellId}".`);
    const influences = bindingEntries(sourceInfluences);
    if (!Array.isArray(influences)) {
      errors.push(`${label} must be an array of { joint, weight } entries or a weight map.`);
      continue;
    }
    if (influences.length > MAX_CELL_BINDING_INFLUENCES) errors.push(`${label} has ${influences.length} influences; maximum is ${MAX_CELL_BINDING_INFLUENCES}.`);
    const seenJoints = new Set();
    let sum = 0;
    for (const [index, influence] of influences.entries()) {
      const entryLabel = `${label}[${index}]`;
      if (!influence || typeof influence !== 'object' || Array.isArray(influence)) {
        errors.push(`${entryLabel} must be an object.`);
        continue;
      }
      if (!isNonEmptyString(influence.joint)) errors.push(`${entryLabel}.joint must be a non-empty string.`);
      else {
        if (seenJoints.has(influence.joint)) errors.push(`${entryLabel}.joint "${influence.joint}" is duplicated for cell "${cellId}".`);
        seenJoints.add(influence.joint);
        if (!jointIds.has(influence.joint)) errors.push(`${entryLabel}.joint references unknown joint "${influence.joint}".`);
      }
      if (!Number.isFinite(influence.weight) || influence.weight <= 0) errors.push(`${entryLabel}.weight must be a finite positive number.`);
      else sum += influence.weight;
    }
    if (sum > 0 && Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) warnings.push(`${label} weights sum to ${roundWeight(sum)} and will normalize to 1.0 at runtime.`);
  }
}

export function deriveRigidCellBindings(entity, rig) {
  const cells = entity?.cells ?? [];
  const bindings = {};
  for (const joint of rig?.joints ?? []) {
    if (!joint?.id) continue;
    const group = (rig.groups ?? []).find((entry) => entry.id === joint.group);
    for (const cell of selectGroupCells(cells, group)) {
      bindings[cell.id] ??= [{ joint: joint.id, weight: 1 }];
    }
  }
  return bindings;
}

function normalizeBindingList(sourceInfluences) {
  const influences = bindingEntries(sourceInfluences);
  if (!Array.isArray(influences)) return [];
  const valid = influences
    .map((influence) => ({
      joint: String(influence?.joint ?? '').trim(),
      weight: Number(influence?.weight),
    }))
    .filter((influence) => influence.joint && Number.isFinite(influence.weight) && influence.weight > 0);
  const sum = valid.reduce((total, influence) => total + influence.weight, 0);
  if (sum <= 0) return [];
  return valid.map((influence) => ({
    joint: influence.joint,
    weight: roundWeight(influence.weight / sum),
  }));
}

function bindingEntries(sourceInfluences) {
  if (Array.isArray(sourceInfluences)) return sourceInfluences;
  if (sourceInfluences && typeof sourceInfluences === 'object' && !Array.isArray(sourceInfluences)) {
    const weights = sourceInfluences.weights ?? sourceInfluences;
    if (weights && typeof weights === 'object' && !Array.isArray(weights)) {
      return Object.entries(weights).map(([joint, weight]) => ({ joint, weight: Number(weight) }));
    }
  }
  return null;
}

function selectGroupCells(cells, group) {
  if (!group) return [];
  const ids = new Set(Array.isArray(group.cells) ? group.cells : []);
  const selected = new Set();
  for (const cell of cells) {
    if (ids.has(cell.id) || selectorMatches(cell, group.selector)) selected.add(cell);
  }
  return [...selected];
}

function selectorMatches(cell, selector) {
  if (!selector) return false;
  if (selector === 'all') return true;
  if (selector.startsWith('role:')) return cell.role === selector.slice(5);
  if (selector.startsWith('type:')) return cell.type === selector.slice(5);
  if (selector.startsWith('slot:')) return cell.slot === selector.slice(5);
  if (selector.startsWith('tag:')) return cell.tags?.includes(selector.slice(4));
  if (selector.startsWith('cell:')) return cell.id === selector.slice(5);
  return false;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function roundWeight(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
