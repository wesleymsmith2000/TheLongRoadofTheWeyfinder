import { CELL_LAYER_HEIGHT, CELL_SIZE } from './voxelMask.js';
import { normalizeCellWeights, POSE_RIG_SCHEMA_VERSION, validateCellBindings } from './poseWeights.js';

const TAU = Math.PI * 2;

export const POSE_RIG_ANIMATION_KINDS = ['oscillate', 'poseCycle', 'aimAtTarget'];
export const POSE_RIG_TARGET_PREFIXES = ['group:', 'joint:', 'cell:', 'role:', 'type:', 'slot:', 'tag:'];

export function normalizePoseRig(rig = {}) {
  if (!rig || typeof rig !== 'object') return null;
  return {
    schemaVersion: rig.schemaVersion ?? rig.version ?? POSE_RIG_SCHEMA_VERSION,
    groups: Array.isArray(rig.groups) ? structuredClone(rig.groups) : [],
    joints: Array.isArray(rig.joints) ? structuredClone(rig.joints) : [],
    poses: Array.isArray(rig.poses) ? structuredClone(rig.poses) : [],
    animations: Array.isArray(rig.animations) ? structuredClone(rig.animations) : [],
    cellBindings: normalizeCellWeights(rig.cellBindings),
    dynamics: isPlainObject(rig.dynamics) ? structuredClone(rig.dynamics) : null,
    imports: Array.isArray(rig.imports) ? structuredClone(rig.imports) : [],
  };
}

export function validatePoseRig(rig, path, cellIds, errors, warnings) {
  if (rig == null) return;
  if (!isPlainObject(rig)) {
    errors.push(`${path} must be an object when provided.`);
    return;
  }
  validateGroups(rig.groups, `${path}.groups`, cellIds, errors);
  const groupIds = new Set((rig.groups ?? []).map((group) => group?.id).filter(Boolean));
  const jointIds = validateJoints(rig.joints, `${path}.joints`, groupIds, errors);
  const poseIds = validatePoses(rig.poses, `${path}.poses`, groupIds, jointIds, cellIds, errors);
  validateAnimations(rig.animations, `${path}.animations`, groupIds, jointIds, poseIds, cellIds, errors, warnings);
  validateCellBindings(rig.cellBindings, `${path}.cellBindings`, cellIds, jointIds, errors, warnings);
  validateDynamics(rig.dynamics, `${path}.dynamics`, errors);
  validateImports(rig.imports, `${path}.imports`, errors);
}

export function createWalkerStridePoseRig(entity, options = {}) {
  const cells = entity?.cells ?? [];
  const legCells = cells.filter((cell) => ['supportLeg', 'legArmor', 'legJoint'].includes(cell.role));
  if (legCells.length === 0) return null;
  const supportCells = legCells.filter((cell) => cell.role === 'supportLeg');
  const groupSource = supportCells.length > 0 ? supportCells : legCells;
  const xCenter = average(groupSource.map((cell) => cell.gridX));
  const sideBuckets = new Map();
  for (const cell of groupSource) {
    const side = cell.gridX < xCenter ? 'left' : 'right';
    const bucket = `${side}:${cell.gridY}`;
    if (!sideBuckets.has(bucket)) sideBuckets.set(bucket, []);
    sideBuckets.get(bucket).push(cell);
  }
  const anchors = [...sideBuckets.entries()]
    .map(([key, bucketCells]) => {
      const [side] = key.split(':');
      return {
        side,
        gridX: average(bucketCells.map((cell) => cell.gridX)),
        gridY: average(bucketCells.map((cell) => cell.gridY)),
      };
    })
    .sort((a, b) => a.side.localeCompare(b.side) || a.gridY - b.gridY);
  if (anchors.length === 0) return null;
  const groups = [];
  const animations = [];
  const amplitude = options.amplitude ?? CELL_SIZE * 0.8;
  const frequency = options.frequency ?? 1;
  for (const [index, anchor] of anchors.entries()) {
    const groupId = `${anchor.side}-leg-${index}`;
    const sideSign = anchor.side === 'left' ? -1 : 1;
    const cellIds = legCells
      .filter((cell) => {
        const sameSide = sideSign < 0 ? cell.gridX < xCenter : cell.gridX >= xCenter;
        return sameSide && Math.abs(cell.gridY - anchor.gridY) <= 1.75;
      })
      .map((cell) => cell.id);
    if (cellIds.length === 0) continue;
    groups.push({
      id: groupId,
      cells: [...new Set(cellIds)],
      pivot: [anchor.gridX * CELL_SIZE, anchor.gridY * CELL_SIZE, 0],
      role: 'legAssembly',
    });
    animations.push({
      id: `${groupId}-stride`,
      kind: 'oscillate',
      target: `group:${groupId}`,
      property: 'translateY',
      amplitude,
      frequency,
      phase: (index % 2) * Math.PI + (anchor.side === 'right' ? Math.PI * 0.72 : 0),
      driver: 'phase',
    });
  }
  return normalizePoseRig({ groups, animations });
}

export function evaluatePoseRig(entity, context = {}) {
  const rig = normalizePoseRig(entity?.poseRig ?? entity?.animationRig);
  const transforms = new Map();
  if (!rig) return transforms;
  const groupMap = buildGroupMap(entity, rig);
  const jointMap = buildJointMap(rig, groupMap);
  const jointTransforms = new Map();
  const poseMap = new Map(rig.poses.map((pose) => [pose.id, pose]));
  const addToTarget = (target, transform) => {
    addToJointsForTarget(target, transform, jointMap, jointTransforms);
    for (const cell of cellsForTarget(entity, groupMap, jointMap, target)) {
      const previous = transforms.get(cell.id) ?? baseTransform();
      transforms.set(cell.id, combineTransforms(previous, transform));
    }
  };

  for (const joint of rig.joints) {
    if (!joint.group || !joint.defaultTransform) continue;
    addToTarget(`group:${joint.group}`, transformFromDescriptor(joint.defaultTransform, groupMap.get(joint.group)));
  }
  for (const animation of rig.animations) {
    if (!animation?.kind) continue;
    if (animation.kind === 'oscillate') {
      addToTarget(animation.target, oscillatingTransform(animation, context, groupMap));
    } else if (animation.kind === 'poseCycle') {
      for (const entry of poseCycleTransforms(animation, poseMap, context, groupMap)) addToTarget(entry.target, entry.transform);
    } else if (animation.kind === 'aimAtTarget') {
      addToTarget(animation.target, aimAtTargetTransform(entity, animation, context, groupMap));
    }
  }
  applyWeightedCellBindings(entity, rig, jointMap, jointTransforms, transforms);
  return transforms;
}

export function applyCellPoseTransform(cell, point, transforms) {
  const transform = transforms?.get(cell.id);
  if (!transform) return { ...point, z: 0, rotation: 0 };
  const pivot = transform.pivot ?? [point.x, point.y, 0];
  const angle = transform.rotation ?? 0;
  let x = point.x;
  let y = point.y;
  if (Math.abs(angle) > 0.000001) {
    const dx = point.x - pivot[0];
    const dy = point.y - pivot[1];
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    x = pivot[0] + dx * cos - dy * sin;
    y = pivot[1] + dx * sin + dy * cos;
  }
  return {
    x: x + (transform.x ?? 0),
    y: y + (transform.y ?? 0),
    z: transform.z ?? 0,
    rotation: angle,
  };
}

function validateGroups(groups, path, cellIds, errors) {
  if (groups == null) return;
  if (!Array.isArray(groups)) {
    errors.push(`${path} must be an array when provided.`);
    return;
  }
  const ids = new Set();
  for (const [index, group] of groups.entries()) {
    const label = `${path}[${index}]`;
    if (!isPlainObject(group)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!isNonEmptyString(group.id)) errors.push(`${label}.id must be a non-empty string.`);
    else if (ids.has(group.id)) errors.push(`${label}.id "${group.id}" is duplicated.`);
    else ids.add(group.id);
    if (group.selector != null && !isValidSelector(group.selector)) errors.push(`${label}.selector must start with one of: ${POSE_RIG_TARGET_PREFIXES.join(', ')}.`);
    if (group.cells != null) {
      if (!Array.isArray(group.cells)) errors.push(`${label}.cells must be an array when provided.`);
      else {
        for (const cellId of group.cells) {
          if (!cellIds.has(cellId)) errors.push(`${label}.cells references unknown cell "${cellId}".`);
        }
      }
    }
    validateVector(group.pivot, `${label}.pivot`, errors);
  }
}

function validateJoints(joints, path, groupIds, errors) {
  const jointIds = new Set();
  if (joints == null) return jointIds;
  if (!Array.isArray(joints)) {
    errors.push(`${path} must be an array when provided.`);
    return jointIds;
  }
  const parentByJoint = new Map();
  for (const [index, joint] of joints.entries()) {
    const label = `${path}[${index}]`;
    if (!isPlainObject(joint)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!isNonEmptyString(joint.id)) errors.push(`${label}.id must be a non-empty string.`);
    else if (jointIds.has(joint.id)) errors.push(`${label}.id "${joint.id}" is duplicated.`);
    else jointIds.add(joint.id);
    if (joint.group != null && !groupIds.has(joint.group)) errors.push(`${label}.group references unknown group "${joint.group}".`);
    if (joint.parent != null && !isNonEmptyString(joint.parent)) errors.push(`${label}.parent must be a non-empty string when provided.`);
    if (isNonEmptyString(joint.id) && isNonEmptyString(joint.parent)) parentByJoint.set(joint.id, joint.parent);
    if (joint.kind != null && !['fixed', 'slider', 'hinge'].includes(joint.kind)) errors.push(`${label}.kind must be fixed, slider, or hinge.`);
    validateVector(joint.axis, `${label}.axis`, errors);
    validateVector(joint.pivot, `${label}.pivot`, errors);
    validateTransform(joint.bindTransform, `${label}.bindTransform`, errors);
    validateTransform(joint.defaultTransform, `${label}.defaultTransform`, errors);
  }
  for (const [index, joint] of joints.entries()) {
    if (!isPlainObject(joint) || !isNonEmptyString(joint.parent)) continue;
    if (!jointIds.has(joint.parent)) errors.push(`${path}[${index}].parent references unknown joint "${joint.parent}".`);
  }
  validateAcyclicJointHierarchy(parentByJoint, path, errors);
  return jointIds;
}

function validatePoses(poses, path, groupIds, jointIds, cellIds, errors) {
  const poseIds = new Set();
  if (poses == null) return poseIds;
  if (!Array.isArray(poses)) {
    errors.push(`${path} must be an array when provided.`);
    return poseIds;
  }
  for (const [index, pose] of poses.entries()) {
    const label = `${path}[${index}]`;
    if (!isPlainObject(pose)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!isNonEmptyString(pose.id)) errors.push(`${label}.id must be a non-empty string.`);
    else poseIds.add(pose.id);
    if (!Array.isArray(pose.transforms)) errors.push(`${label}.transforms must be an array.`);
    else validateTargetedTransforms(pose.transforms, `${label}.transforms`, groupIds, jointIds, cellIds, errors);
  }
  return poseIds;
}

function validateAnimations(animations, path, groupIds, jointIds, poseIds, cellIds, errors, warnings) {
  if (animations == null) return;
  if (!Array.isArray(animations)) {
    errors.push(`${path} must be an array when provided.`);
    return;
  }
  for (const [index, animation] of animations.entries()) {
    const label = `${path}[${index}]`;
    if (!isPlainObject(animation)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!isNonEmptyString(animation.id)) errors.push(`${label}.id must be a non-empty string.`);
    if (!POSE_RIG_ANIMATION_KINDS.includes(animation.kind)) errors.push(`${label}.kind must be one of: ${POSE_RIG_ANIMATION_KINDS.join(', ')}.`);
    if (animation.target != null) validateTarget(animation.target, `${label}.target`, groupIds, jointIds, cellIds, errors);
    if (animation.keyframes != null) validateKeyframes(animation.keyframes, `${label}.keyframes`, poseIds, errors);
    if (animation.driver != null && !isNonEmptyString(animation.driver)) errors.push(`${label}.driver must be a non-empty string when provided.`);
    if (animation.kind === 'poseCycle' && !Array.isArray(animation.keyframes)) errors.push(`${label}.keyframes must be an array for poseCycle animations.`);
    if (animation.kind === 'aimAtTarget' && !animation.target) warnings.push(`${label}.target should identify the group or cells that rotate.`);
  }
}

function validateTargetedTransforms(transforms, path, groupIds, jointIds, cellIds, errors) {
  for (const [index, transform] of transforms.entries()) {
    const label = `${path}[${index}]`;
    if (!isPlainObject(transform)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    validateTarget(transform.target, `${label}.target`, groupIds, jointIds, cellIds, errors);
    validateTransform(transform, label, errors);
  }
}

function validateKeyframes(keyframes, path, poseIds, errors) {
  if (!Array.isArray(keyframes)) {
    errors.push(`${path} must be an array when provided.`);
    return;
  }
  for (const [index, keyframe] of keyframes.entries()) {
    const label = `${path}[${index}]`;
    if (!isPlainObject(keyframe)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!Number.isFinite(keyframe.at)) errors.push(`${label}.at must be a finite number.`);
    if (!poseIds.has(keyframe.pose)) errors.push(`${label}.pose references unknown pose "${keyframe.pose}".`);
  }
}

function validateTarget(target, path, groupIds, jointIds, cellIds, errors) {
  if (!isValidSelector(target)) {
    errors.push(`${path} must start with one of: ${POSE_RIG_TARGET_PREFIXES.join(', ')}.`);
    return;
  }
  if (target.startsWith('group:') && !groupIds.has(target.slice(6))) errors.push(`${path} references unknown group "${target.slice(6)}".`);
  if (target.startsWith('joint:') && !jointIds.has(target.slice(6))) errors.push(`${path} references unknown joint "${target.slice(6)}".`);
  if (target.startsWith('cell:') && !cellIds.has(target.slice(5))) errors.push(`${path} references unknown cell "${target.slice(5)}".`);
}

function validateTransform(transform, path, errors) {
  if (transform == null) return;
  if (!isPlainObject(transform)) {
    errors.push(`${path} must be an object when provided.`);
    return;
  }
  validateVector(transform.translate, `${path}.translate`, errors);
  validateVector(transform.pivot, `${path}.pivot`, errors);
  for (const key of ['rotation', 'x', 'y', 'z', 'translateX', 'translateY', 'translateZ', 'amplitude', 'frequency', 'phase']) {
    if (transform[key] != null && !Number.isFinite(transform[key])) errors.push(`${path}.${key} must be a finite number.`);
  }
}

function validateDynamics(dynamics, path, errors) {
  if (dynamics == null) return;
  if (!isPlainObject(dynamics)) {
    errors.push(`${path} must be an object when provided.`);
    return;
  }
  for (const key of ['iterations', 'topologyStiffness', 'overlapStiffness', 'minimumSpacing', 'maxCorrection']) {
    if (dynamics[key] != null && !Number.isFinite(dynamics[key])) errors.push(`${path}.${key} must be a finite number.`);
  }
}

function validateImports(imports, path, errors) {
  if (imports == null) return;
  if (!Array.isArray(imports)) {
    errors.push(`${path} must be an array when provided.`);
    return;
  }
  for (const [index, entry] of imports.entries()) {
    const label = `${path}[${index}]`;
    if (!isPlainObject(entry)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (entry.source != null && !isNonEmptyString(entry.source)) errors.push(`${label}.source must be a non-empty string when provided.`);
    if (entry.mode != null && !isNonEmptyString(entry.mode)) errors.push(`${label}.mode must be a non-empty string when provided.`);
    if (entry.assetId != null && !isNonEmptyString(entry.assetId)) errors.push(`${label}.assetId must be a non-empty string when provided.`);
  }
}

function validateAcyclicJointHierarchy(parentByJoint, path, errors) {
  const visited = new Set();
  const visiting = new Set();
  const visit = (jointId) => {
    if (visited.has(jointId)) return false;
    if (visiting.has(jointId)) return true;
    visiting.add(jointId);
    const parent = parentByJoint.get(jointId);
    const cyclic = parent ? visit(parent) : false;
    visiting.delete(jointId);
    visited.add(jointId);
    return cyclic;
  };
  for (const jointId of parentByJoint.keys()) {
    if (visit(jointId)) {
      errors.push(`${path} contains a cyclic joint parent hierarchy involving "${jointId}".`);
      return;
    }
  }
}

function validateVector(vector, path, errors) {
  if (vector == null) return;
  if (!Array.isArray(vector) || vector.length < 2 || vector.length > 3 || !vector.every(Number.isFinite)) {
    errors.push(`${path} must be a [x, y] or [x, y, z] number array when provided.`);
  }
}

function buildGroupMap(entity, rig) {
  const cells = entity?.cells ?? [];
  const groups = new Map();
  for (const group of rig.groups) {
    if (!group?.id) continue;
    const groupCells = new Set();
    for (const cellId of group.cells ?? []) {
      if (cells.some((cell) => cell.id === cellId)) groupCells.add(cellId);
    }
    for (const cell of selectCells(cells, group.selector)) groupCells.add(cell.id);
    const resolvedCells = cells.filter((cell) => groupCells.has(cell.id));
    groups.set(group.id, {
      ...group,
      cells: resolvedCells,
      pivot: group.pivot ?? groupPivot(resolvedCells),
    });
  }
  return groups;
}

function buildJointMap(rig, groupMap) {
  const joints = new Map();
  for (const joint of rig.joints) {
    if (!joint?.id) continue;
    const group = joint.group ? groupMap.get(joint.group) : null;
    joints.set(joint.id, {
      ...joint,
      group,
      pivot: joint.pivot ?? joint.bindTransform?.pivot ?? joint.defaultTransform?.pivot ?? group?.pivot ?? [0, 0, 0],
    });
  }
  return joints;
}

function cellsForTarget(entity, groupMap, jointMap, target) {
  if (!target) return [];
  const cells = entity?.cells ?? [];
  if (target.startsWith('group:')) return groupMap.get(target.slice(6))?.cells ?? [];
  if (target.startsWith('joint:')) return jointMap.get(target.slice(6))?.group?.cells ?? [];
  if (target.startsWith('cell:')) return cells.filter((cell) => cell.id === target.slice(5));
  return selectCells(cells, target);
}

function addToJointsForTarget(target, transform, jointMap, jointTransforms) {
  if (!target) return;
  if (target.startsWith('joint:')) {
    addToJoint(target.slice(6), transform, jointTransforms);
    return;
  }
  if (target.startsWith('group:')) {
    const groupId = target.slice(6);
    for (const joint of jointMap.values()) {
      if (joint.group?.id === groupId) addToJoint(joint.id, transform, jointTransforms);
    }
  }
}

function addToJoint(jointId, transform, jointTransforms) {
  const previous = jointTransforms.get(jointId) ?? baseTransform(transform?.pivot ?? null);
  jointTransforms.set(jointId, combineTransforms(previous, transform));
}

function applyWeightedCellBindings(entity, rig, jointMap, jointTransforms, cellTransforms) {
  const bindings = rig.cellBindings ?? {};
  if (Object.keys(bindings).length === 0) return;
  const cellsById = new Map((entity?.cells ?? []).map((cell) => [cell.id, cell]));
  for (const [cellId, influences] of Object.entries(bindings)) {
    const cell = cellsById.get(cellId);
    if (!cell || !Array.isArray(influences) || influences.length === 0) continue;
    const rest = cellRestPoint(cell);
    const blended = blendInfluencedCellPose(rest, influences, jointMap, jointTransforms);
    cellTransforms.set(cellId, {
      x: blended.x - rest.x,
      y: blended.y - rest.y,
      z: blended.z - rest.z,
      rotation: blended.rotation,
      pivot: [rest.x, rest.y, rest.z],
    });
  }
}

function blendInfluencedCellPose(rest, influences, jointMap, jointTransforms) {
  let x = 0;
  let y = 0;
  let z = 0;
  let sin = 0;
  let cos = 0;
  let weightSum = 0;
  for (const influence of influences) {
    const joint = jointMap.get(influence.joint);
    const transform = jointTransforms.get(influence.joint) ?? baseTransform(joint?.pivot ?? null);
    const weight = Number(influence.weight);
    if (!joint || !Number.isFinite(weight) || weight <= 0) continue;
    const target = transformPoint(rest, transform, joint.pivot);
    x += target.x * weight;
    y += target.y * weight;
    z += target.z * weight;
    sin += Math.sin(target.rotation) * weight;
    cos += Math.cos(target.rotation) * weight;
    weightSum += weight;
  }
  if (weightSum <= 0) return { ...rest, rotation: 0 };
  return {
    x: x / weightSum,
    y: y / weightSum,
    z: z / weightSum,
    rotation: Math.atan2(sin / weightSum, cos / weightSum),
  };
}

function transformPoint(point, transform, fallbackPivot) {
  const pivot = transform.pivot ?? fallbackPivot ?? [point.x, point.y, point.z ?? 0];
  const angle = transform.rotation ?? 0;
  let x = point.x;
  let y = point.y;
  if (Math.abs(angle) > 0.000001) {
    const dx = point.x - pivot[0];
    const dy = point.y - pivot[1];
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    x = pivot[0] + dx * cos - dy * sin;
    y = pivot[1] + dx * sin + dy * cos;
  }
  return {
    x: x + (transform.x ?? 0),
    y: y + (transform.y ?? 0),
    z: (point.z ?? 0) + (transform.z ?? 0),
    rotation: angle,
  };
}

function cellRestPoint(cell) {
  return {
    x: cell.gridX * CELL_SIZE,
    y: cell.gridY * CELL_SIZE,
    z: (cell.gridZ ?? cell.layer ?? 0) * CELL_LAYER_HEIGHT,
  };
}

function selectCells(cells, selector) {
  if (!selector) return [];
  if (selector === 'all') return cells;
  if (selector.startsWith('role:')) return cells.filter((cell) => cell.role === selector.slice(5));
  if (selector.startsWith('type:')) return cells.filter((cell) => cell.type === selector.slice(5));
  if (selector.startsWith('slot:')) return cells.filter((cell) => cell.slot === selector.slice(5));
  if (selector.startsWith('tag:')) return cells.filter((cell) => cell.tags?.includes(selector.slice(4)));
  if (selector.startsWith('cell:')) return cells.filter((cell) => cell.id === selector.slice(5));
  return [];
}

function oscillatingTransform(animation, context, groupMap) {
  const value = Math.sin(driverValue(animation, context) * TAU * (animation.frequency ?? 1) + (animation.phase ?? 0)) * (animation.amplitude ?? 0);
  const group = animation.target?.startsWith('group:') ? groupMap.get(animation.target.slice(6)) : null;
  const transform = baseTransform(group?.pivot ?? animation.pivot);
  if (animation.axis) {
    transform.x += (animation.axis[0] ?? 0) * value;
    transform.y += (animation.axis[1] ?? 0) * value;
    transform.z += (animation.axis[2] ?? 0) * value;
    return transform;
  }
  if (animation.property === 'translateX') transform.x += value;
  else if (animation.property === 'translateZ') transform.z += value;
  else transform.y += value;
  return transform;
}

function poseCycleTransforms(animation, poseMap, context, groupMap) {
  const keyframes = [...(animation.keyframes ?? [])].sort((a, b) => a.at - b.at);
  if (keyframes.length === 0) return [];
  const cursor = normalizedCursor(driverValue(animation, context) * (animation.frequency ?? 1), Boolean(animation.loop ?? true));
  const previous = [...keyframes].reverse().find((keyframe) => keyframe.at <= cursor) ?? keyframes[keyframes.length - 1];
  const next = keyframes.find((keyframe) => keyframe.at >= cursor && keyframe !== previous) ?? keyframes[0];
  const span = next.at >= previous.at ? next.at - previous.at : 1 - previous.at + next.at;
  const localT = span <= 0 ? 0 : ((cursor - previous.at + 1) % 1) / span;
  const previousTransforms = poseTransformsByTarget(poseMap.get(previous.pose), groupMap);
  const nextTransforms = poseTransformsByTarget(poseMap.get(next.pose), groupMap);
  const targets = new Set([...previousTransforms.keys(), ...nextTransforms.keys()]);
  return [...targets].map((target) => ({
    target,
    transform: lerpTransform(previousTransforms.get(target), nextTransforms.get(target), localT),
  }));
}

function aimAtTargetTransform(entity, animation, context, groupMap) {
  const target = context.targetLocal ?? worldToOwnerLocal(entity, context.target);
  const group = animation.target?.startsWith('group:') ? groupMap.get(animation.target.slice(6)) : null;
  const pivot = animation.pivot ?? group?.pivot ?? [0, 0, 0];
  const transform = baseTransform(pivot);
  if (!target) return transform;
  transform.rotation = Math.atan2(target.y - pivot[1], target.x - pivot[0]) + (animation.rotationOffset ?? 0);
  return transform;
}

function poseTransformsByTarget(pose, groupMap) {
  const transforms = new Map();
  for (const descriptor of pose?.transforms ?? []) {
    const group = descriptor.target?.startsWith('group:') ? groupMap.get(descriptor.target.slice(6)) : null;
    transforms.set(descriptor.target, transformFromDescriptor(descriptor, group));
  }
  return transforms;
}

function transformFromDescriptor(descriptor = {}, group = null) {
  const translate = descriptor.translate ?? [descriptor.translateX ?? descriptor.x ?? 0, descriptor.translateY ?? descriptor.y ?? 0, descriptor.translateZ ?? descriptor.z ?? 0];
  return {
    x: translate[0] ?? 0,
    y: translate[1] ?? 0,
    z: translate[2] ?? 0,
    rotation: descriptor.rotation ?? 0,
    pivot: descriptor.pivot ?? group?.pivot ?? null,
  };
}

function combineTransforms(a, b) {
  return {
    x: (a.x ?? 0) + (b.x ?? 0),
    y: (a.y ?? 0) + (b.y ?? 0),
    z: (a.z ?? 0) + (b.z ?? 0),
    rotation: (a.rotation ?? 0) + (b.rotation ?? 0),
    pivot: b.pivot ?? a.pivot ?? null,
  };
}

function lerpTransform(a = baseTransform(), b = baseTransform(), t = 0) {
  const start = a ?? baseTransform();
  const end = b ?? baseTransform();
  return {
    x: lerp(start.x ?? 0, end.x ?? 0, t),
    y: lerp(start.y ?? 0, end.y ?? 0, t),
    z: lerp(start.z ?? 0, end.z ?? 0, t),
    rotation: lerpAngle(start.rotation ?? 0, end.rotation ?? 0, t),
    pivot: end.pivot ?? start.pivot ?? null,
  };
}

function baseTransform(pivot = null) {
  return { x: 0, y: 0, z: 0, rotation: 0, pivot };
}

function groupPivot(cells) {
  if (!cells?.length) return [0, 0, 0];
  return [
    average(cells.map((cell) => cell.gridX * CELL_SIZE)),
    average(cells.map((cell) => cell.gridY * CELL_SIZE)),
    average(cells.map((cell) => (cell.gridZ ?? cell.layer ?? 0) * CELL_LAYER_HEIGHT)),
  ];
}

function driverValue(animation, context) {
  const driver = animation.driver ?? 'time';
  if (driver === 'movementSpeed') return (context.movementSpeed ?? 0) * (context.time ?? 0) / CELL_SIZE;
  return Number.isFinite(context[driver]) ? context[driver] : context.time ?? 0;
}

function normalizedCursor(value, loop) {
  if (!loop) return Math.max(0, Math.min(1, value));
  return ((value % 1) + 1) % 1;
}

function worldToOwnerLocal(owner, target) {
  if (!owner || !target) return null;
  const scale = Math.max(0.001, owner.visualScale ?? 1);
  const dx = (target.x - owner.x) / scale;
  const dy = (target.y - owner.y) / scale;
  const rotation = Number.isFinite(owner.collisionRotation) ? owner.collisionRotation : 0;
  if (Math.abs(rotation) <= 0.000001) return { x: dx, y: dy };
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: dx * cos + dy * sin,
    y: -dx * sin + dy * cos,
  };
}

function isValidSelector(selector) {
  return selector === 'all' || (typeof selector === 'string' && POSE_RIG_TARGET_PREFIXES.some((prefix) => selector.startsWith(prefix)));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function average(values) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function lerpAngle(a, b, t) {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + delta * Math.max(0, Math.min(1, t));
}
