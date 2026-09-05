import { CELL_SIZE } from '../core/voxelMask.js';
import { POSE_RIG_ANIMATION_KINDS, normalizePoseRig, createWalkerStridePoseRig } from '../core/poseAnimation.js';
import { MAX_CELL_BINDING_INFLUENCES, POSE_RIG_SCHEMA_VERSION, normalizeCellWeights } from '../core/poseWeights.js';

export const POSE_RIG_JOINT_KINDS = ['fixed', 'slider', 'hinge'];
export const POSE_RIG_TRANSFORM_PROPERTIES = ['translateY', 'translateX', 'translateZ'];
export const POSE_RIG_DRIVERS = ['time', 'phase', 'movementSpeed'];
export { MAX_CELL_BINDING_INFLUENCES };

export function emptyPoseRig() {
  return { schemaVersion: POSE_RIG_SCHEMA_VERSION, groups: [], joints: [], poses: [], animations: [], cellBindings: {} };
}

export function poseRigFromConstructDefinition(definition = {}) {
  const aliases = definition.cellGroups || definition.joints || definition.poses || definition.poseAnimations;
  const source = definition.poseRig ?? (aliases ? {
    groups: definition.cellGroups,
    joints: definition.joints,
    poses: definition.poses,
    animations: definition.poseAnimations,
  } : null);
  return normalizePoseRigDraft(source);
}

export function normalizePoseRigDraft(rig = {}) {
  return normalizePoseRig(rig) ?? emptyPoseRig();
}

export function hasPoseRigContent(rig) {
  const normalized = normalizePoseRigDraft(rig);
  return Boolean(normalized.groups.length || normalized.joints.length || normalized.poses.length || normalized.animations.length || Object.keys(normalized.cellBindings ?? {}).length);
}

export function poseRigSummary(rig) {
  const normalized = normalizePoseRigDraft(rig);
  return `${normalized.groups.length} groups, ${normalized.joints.length} joints, ${normalized.poses.length} poses, ${normalized.animations.length} animations, ${Object.keys(normalized.cellBindings ?? {}).length} weighted cells`;
}

export function createCellBindingDescriptor({ cellId, influences } = {}) {
  const id = cleanText(cellId);
  if (!id) return null;
  return {
    cellId: id,
    influences: normalizeCellWeights({ [id]: influences })[id] ?? [],
  };
}

export function createGroupDescriptor({ id, selector, cells, pivot, role } = {}) {
  const group = {
    id: normalizeIdentifier(id, 'group'),
    cells: parseIdList(cells),
    pivot: parseVector(pivot),
  };
  const cleanSelector = cleanText(selector);
  const cleanRole = cleanText(role);
  if (cleanSelector) group.selector = cleanSelector;
  if (cleanRole) group.role = cleanRole;
  if (group.cells.length === 0) delete group.cells;
  return group;
}

export function createJointDescriptor({ id, group, kind, axis, defaultTranslate } = {}) {
  const joint = {
    id: normalizeIdentifier(id, 'joint'),
    kind: POSE_RIG_JOINT_KINDS.includes(kind) ? kind : 'fixed',
    axis: parseVector(axis),
    defaultTransform: { translate: parseVector(defaultTranslate) },
  };
  const cleanGroup = cleanText(group);
  if (cleanGroup) joint.group = cleanGroup;
  if (!joint.defaultTransform.translate.some((value) => value !== 0)) delete joint.defaultTransform;
  return joint;
}

export function createPoseDescriptor({ id, transforms } = {}) {
  return {
    id: normalizeIdentifier(id, 'pose'),
    transforms: Array.isArray(transforms) ? structuredClone(transforms) : [],
  };
}

export function createPoseTransformDescriptor({ target, translate, rotation, pivot } = {}) {
  const transform = {
    target: cleanText(target),
    translate: parseVector(translate),
    rotation: parseFiniteNumber(rotation, 0),
    pivot: parseVector(pivot),
  };
  if (!transform.rotation) delete transform.rotation;
  if (!transform.pivot.some((value) => value !== 0)) delete transform.pivot;
  return transform;
}

export function createAnimationDescriptor({ id, kind, target, property, amplitude, frequency, phase, driver, rotationOffset, keyframes } = {}) {
  const animation = {
    id: normalizeIdentifier(id, 'animation'),
    kind: POSE_RIG_ANIMATION_KINDS.includes(kind) ? kind : 'oscillate',
    driver: cleanText(driver) || 'time',
    frequency: parseFiniteNumber(frequency, 1),
  };
  const cleanTarget = cleanText(target);
  if (cleanTarget) animation.target = cleanTarget;
  if (animation.kind === 'oscillate') {
    animation.property = POSE_RIG_TRANSFORM_PROPERTIES.includes(property) ? property : 'translateY';
    animation.amplitude = parseFiniteNumber(amplitude, CELL_SIZE * 0.5);
    animation.phase = parseFiniteNumber(phase, 0);
  } else if (animation.kind === 'aimAtTarget') {
    animation.rotationOffset = parseFiniteNumber(rotationOffset, 0);
  } else if (animation.kind === 'poseCycle') {
    animation.loop = true;
    animation.keyframes = parseKeyframes(keyframes);
  }
  return animation;
}

export function createWalkerStrideRigForConstruct(definition, options = {}) {
  return normalizePoseRigDraft(
    createWalkerStridePoseRig(definition, {
      amplitude: parseFiniteNumber(options.amplitude, CELL_SIZE * 0.8),
      frequency: parseFiniteNumber(options.frequency, 1),
    }),
  );
}

export function createCannonAimRigForConstruct(definition) {
  const core = definition?.cells?.find((cell) => cell.type === 'core') ?? definition?.cells?.[0];
  return normalizePoseRigDraft({
    groups: [
      {
        id: 'mainCannon',
        selector: 'all',
        pivot: core ? [core.gridX * CELL_SIZE, core.gridY * CELL_SIZE, 0] : [0, 0, 0],
        role: 'rotatingCannon',
      },
    ],
    joints: [{ id: 'mainCannonHinge', group: 'mainCannon', kind: 'hinge', axis: [0, 0, 1] }],
    animations: [{ id: 'trackTarget', kind: 'aimAtTarget', target: 'group:mainCannon', rotationOffset: 0 }],
  });
}

export function parseIdList(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  return cleanText(value).split(/[\s,]+/).map(cleanText).filter(Boolean);
}

export function parseVector(value, fallback = [0, 0, 0]) {
  if (Array.isArray(value)) {
    const vector = value.slice(0, 3).map((entry, index) => parseFiniteNumber(entry, fallback[index] ?? 0));
    while (vector.length < 3) vector.push(0);
    return vector;
  }
  const parts = cleanText(value).split(/[\s,]+/).filter(Boolean);
  if (parts.length === 0) return [...fallback];
  return [0, 1, 2].map((index) => parseFiniteNumber(parts[index], fallback[index] ?? 0));
}

export function parseKeyframes(value) {
  if (Array.isArray(value)) return structuredClone(value);
  const text = cleanText(value);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return text
      .split('\n')
      .map((line) => {
        const [at, pose] = line.split(/[:,]/).map(cleanText);
        return pose ? { at: parseFiniteNumber(at, 0), pose } : null;
      })
      .filter(Boolean);
  }
}

function normalizeIdentifier(value, fallback) {
  return cleanText(value).replace(/\s+/g, '-') || fallback;
}

function cleanText(value) {
  return String(value ?? '').trim();
}

function parseFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
