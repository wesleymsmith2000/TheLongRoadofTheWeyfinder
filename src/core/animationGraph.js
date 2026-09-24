import { CONTENT_SCHEMA_VERSION, isCompatibleSchemaVersion, isNonEmptyString, isPlainObject, isStringArray } from './contentSchema.js';

export const ANIMATION_GRAPH_SCHEMA_VERSION = CONTENT_SCHEMA_VERSION;
export const ANIMATION_INTERRUPT_POLICIES = Object.freeze(['IMMEDIATE', 'AT_NEXT_ANCHOR', 'FINISH_TRANSITION', 'REQUIRE_TAG']);

export function normalizeAnimationGraph(definition = {}) {
  return {
    schemaVersion: definition.schemaVersion ?? ANIMATION_GRAPH_SCHEMA_VERSION,
    initialState: definition.initialState ?? definition.states?.[0]?.id ?? null,
    seedOffset: Math.trunc(Number(definition.seedOffset) || 0),
    states: (definition.states ?? []).map((state) => ({
      ...structuredClone(state),
      tags: Array.isArray(state?.tags) ? [...state.tags] : [],
      dwell: normalizeRange(state?.dwell, 0),
      next: (state?.next ?? []).map((choice) => ({ ...structuredClone(choice), weight: positiveNumber(choice?.weight, 1) })),
    })),
    transitions: (definition.transitions ?? []).map((transition, index) => normalizeTransition(transition, index)),
  };
}

export function validateAnimationGraph(definition, options = {}) {
  const errors = [];
  const warnings = [];
  if (definition == null) return { valid: true, errors, warnings, definition: null };
  if (!isPlainObject(definition)) return { valid: false, errors: ['animationGraph must be an object.'], warnings };
  const graph = normalizeAnimationGraph(definition);
  if (!isCompatibleSchemaVersion(graph.schemaVersion)) errors.push(`animationGraph.schemaVersion "${graph.schemaVersion}" must be compatible with 0.x.`);
  if (!Array.isArray(definition.states) || definition.states.length === 0) errors.push('animationGraph.states must be a non-empty array.');
  if (!Array.isArray(definition.transitions)) errors.push('animationGraph.transitions must be an array.');

  const poseIds = new Set(options.poseRig?.poses?.map((pose) => pose.id) ?? []);
  const clipIds = new Set(options.poseRig?.clips?.map((clip) => clip.id) ?? []);
  const stateIds = new Set();
  for (const [index, state] of graph.states.entries()) {
    const label = `animationGraph.states[${index}]`;
    if (!isNonEmptyString(state.id)) errors.push(`${label}.id must be a non-empty string.`);
    else if (stateIds.has(state.id)) errors.push(`${label}.id "${state.id}" is duplicated.`);
    else stateIds.add(state.id);
    if (state.tags != null && !isStringArray(state.tags)) errors.push(`${label}.tags must be an array of strings.`);
    if (state.rig?.pose != null && !poseIds.has(state.rig.pose)) errors.push(`${label}.rig.pose references unknown pose "${state.rig.pose}".`);
    validateRange(state.dwell, `${label}.dwell`, errors, { allowZero: true });
    for (const [choiceIndex, choice] of state.next.entries()) {
      if (!isNonEmptyString(choice.state)) errors.push(`${label}.next[${choiceIndex}].state must be a non-empty string.`);
      if (!(choice.weight > 0)) errors.push(`${label}.next[${choiceIndex}].weight must be positive.`);
    }
  }
  if (!stateIds.has(graph.initialState)) errors.push(`animationGraph.initialState references unknown state "${graph.initialState ?? 'missing'}".`);
  for (const [stateIndex, state] of graph.states.entries()) {
    for (const [choiceIndex, choice] of state.next.entries()) {
      if (!stateIds.has(choice.state)) errors.push(`animationGraph.states[${stateIndex}].next[${choiceIndex}] references unknown state "${choice.state}".`);
    }
  }

  const transitionIds = new Set();
  const selectableEdges = new Set();
  for (const [index, transition] of graph.transitions.entries()) {
    const label = `animationGraph.transitions[${index}]`;
    if (!isNonEmptyString(transition.id)) errors.push(`${label}.id must be a non-empty string.`);
    else if (transitionIds.has(transition.id)) errors.push(`${label}.id "${transition.id}" is duplicated.`);
    else transitionIds.add(transition.id);
    if (!stateIds.has(transition.from)) errors.push(`${label}.from references unknown state "${transition.from ?? 'missing'}".`);
    if (!stateIds.has(transition.to)) errors.push(`${label}.to references unknown state "${transition.to ?? 'missing'}".`);
    validateRange(transition.duration, `${label}.duration`, errors);
    if (!ANIMATION_INTERRUPT_POLICIES.includes(transition.interruptPolicy)) {
      errors.push(`${label}.interruptPolicy must be one of: ${ANIMATION_INTERRUPT_POLICIES.join(', ')}.`);
    }
    validateRigChannel(transition.channels?.rig, `${label}.channels.rig`, clipIds, errors);
    for (const [variantIndex, variant] of transition.variants.entries()) {
      const variantLabel = `${label}.variants[${variantIndex}]`;
      if (!isNonEmptyString(variant.id)) errors.push(`${variantLabel}.id must be a non-empty string.`);
      if (!(variant.weight > 0)) errors.push(`${variantLabel}.weight must be positive.`);
      validateRigChannel(variant.channels?.rig, `${variantLabel}.channels.rig`, clipIds, errors);
    }
    validateTimelineEntries(transition.interruptAnchors, `${label}.interruptAnchors`, errors, true);
    validateTimelineEntries(transition.markers, `${label}.markers`, errors, false);
    selectableEdges.add(`${transition.from}:${transition.to}`);
  }

  const reachable = reachableStates(graph);
  for (const state of graph.states) {
    if (!reachable.has(state.id)) warnings.push(`animationGraph state "${state.id}" is unreachable from initialState.`);
    for (const choice of state.next) {
      if (!selectableEdges.has(`${state.id}:${choice.state}`)) warnings.push(`animationGraph autonomous choice ${state.id} -> ${choice.state} has no authored transition and will use a synthetic blend.`);
    }
  }
  return { valid: errors.length === 0, errors, warnings, definition: graph };
}

export function createAnimationController(definition, options = {}) {
  const report = validateAnimationGraph(definition, options);
  if (!report.valid) throw new Error(`Invalid animation graph: ${report.errors.join(' ')}`);
  const graph = report.definition;
  const index = indexAnimationGraph(graph);
  const controller = {
    schemaVersion: ANIMATION_GRAPH_SCHEMA_VERSION,
    currentStateId: graph.initialState,
    currentTransitionId: null,
    currentVariantId: null,
    transitionTime: 0,
    transitionDuration: 0,
    transitionProgress: 0,
    transitionFromStateId: null,
    transitionToStateId: null,
    transitionChannels: null,
    dwellElapsed: 0,
    dwellTarget: 0,
    queuedRequests: [],
    waitingRequest: null,
    snapshot: null,
    snapshotVelocity: null,
    inertialBlend: null,
    rngState: deriveSeed(options.seed ?? 1, options.entityId ?? '', graph.seedOffset),
    decisionIndex: 0,
    requestSequence: 0,
    emittedMarkers: [],
    diagnostics: [...report.warnings],
  };
  installControllerIndex(controller, graph, index);
  controller.dwellTarget = sampleRange(controller, index.states.get(controller.currentStateId)?.dwell, 0);
  return controller;
}

export function ensureAnimationController(entity, options = {}) {
  if (!entity?.animationGraph) return null;
  if (entity.animationController?._graph) return entity.animationController;
  entity.animationController = createAnimationController(entity.animationGraph, {
    ...options,
    poseRig: entity.poseRig,
    entityId: options.entityId ?? entity.id ?? entity.assetId ?? entity.archetypeId ?? '',
  });
  return entity.animationController;
}

export function requestAnimationState(entity, semanticOrStateId, options = {}) {
  const controller = ensureAnimationController(entity, options);
  if (!controller) return { ok: false, reason: 'animation-graph-unavailable' };
  const stateId = resolveAnimationStateId(entity, semanticOrStateId);
  if (!controller._index.states.has(stateId)) return { ok: false, reason: 'unknown-state', stateId };
  const request = {
    id: `request-${++controller.requestSequence}`,
    semantic: semanticOrStateId,
    stateId,
    priority: Number.isFinite(options.priority) ? options.priority : 0,
    interruptPolicy: ANIMATION_INTERRUPT_POLICIES.includes(options.interruptPolicy) ? options.interruptPolicy : null,
    requiredAnchorTags: Array.isArray(options.requiredAnchorTags) ? [...new Set(options.requiredAnchorTags)] : [],
    fallbackPolicy: ANIMATION_INTERRUPT_POLICIES.includes(options.fallbackPolicy) ? options.fallbackPolicy : 'FINISH_TRANSITION',
  };
  controller.queuedRequests.push(request);
  controller.queuedRequests.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  return { ok: true, request: structuredClone(request) };
}

export function stepAnimationGraph(entity, dt, options = {}) {
  const controller = ensureAnimationController(entity, options);
  if (!controller) return null;
  dt = Math.max(0, Math.min(Number(dt) || 0, 0.1));
  processAnimationRequests(entity, controller);
  if (controller.currentTransitionId) advanceTransition(entity, controller, dt);
  else advanceDwell(entity, controller, dt);
  if (controller.inertialBlend) {
    controller.inertialBlend.elapsed += dt;
    if (controller.inertialBlend.elapsed >= controller.inertialBlend.duration) {
      controller.inertialBlend = null;
      controller.snapshot = null;
      controller.snapshotVelocity = null;
    }
  }
  processAnimationRequests(entity, controller);
  return animationControllerView(entity);
}

export function animationControllerView(entity) {
  const controller = entity?.animationController;
  if (!controller) return null;
  return {
    currentStateId: controller.currentStateId,
    currentTransitionId: controller.currentTransitionId,
    currentVariantId: controller.currentVariantId,
    transitionTime: controller.transitionTime,
    transitionDuration: controller.transitionDuration,
    transitionProgress: controller.transitionProgress,
    transitionFromStateId: controller.transitionFromStateId,
    transitionToStateId: controller.transitionToStateId,
    dwellElapsed: controller.dwellElapsed,
    dwellTarget: controller.dwellTarget,
    waitingRequest: controller.waitingRequest ? structuredClone(controller.waitingRequest) : null,
    queuedRequests: controller.queuedRequests.map((request) => structuredClone(request)),
    inertialBlend: controller.inertialBlend ? { ...controller.inertialBlend } : null,
    rngState: controller.rngState,
    decisionIndex: controller.decisionIndex,
  };
}

export function consumeAnimationMarkers(entity) {
  const controller = entity?.animationController;
  if (!controller?.emittedMarkers.length) return [];
  return controller.emittedMarkers.splice(0).map((marker) => structuredClone(marker));
}

export function serializeAnimationController(controller) {
  if (!controller) return null;
  const data = {};
  for (const [key, value] of Object.entries(controller)) data[key] = structuredClone(value);
  return data;
}

export function hydrateAnimationController(definition, saved, options = {}) {
  const controller = createAnimationController(definition, options);
  if (!isPlainObject(saved)) return controller;
  for (const key of Object.keys(controller)) {
    if (key.startsWith('_') || saved[key] == null) continue;
    controller[key] = structuredClone(saved[key]);
  }
  if (!controller._index.states.has(controller.currentStateId)) controller.currentStateId = controller._graph.initialState;
  if (controller.currentTransitionId?.startsWith('synthetic:')) installSyntheticTransition(controller);
  if (controller.currentTransitionId && !controller._index.transitions.has(controller.currentTransitionId)) clearTransition(controller);
  return controller;
}

export function animationGraphRigOutput(entity) {
  const controller = entity?.animationController;
  if (!controller) return null;
  const fromState = controller._index.states.get(controller.transitionFromStateId ?? controller.currentStateId);
  const toState = controller._index.states.get(controller.transitionToStateId ?? controller.currentStateId);
  return {
    fromPose: fromState?.rig?.pose ?? null,
    toPose: toState?.rig?.pose ?? null,
    clip: controller.transitionChannels?.rig?.clip ?? null,
    progress: controller.currentTransitionId ? controller.transitionProgress : 1,
    snapshot: controller.snapshot,
    snapshotVelocity: controller.snapshotVelocity,
    inertialBlend: controller.inertialBlend,
  };
}

export function captureAnimationPose(entity, transforms, time = 0) {
  if (!entity?.animationController || !(transforms instanceof Map)) return;
  const previous = entity._animationGraphPoseSample;
  const snapshot = transformsToRecord(transforms);
  let velocity = null;
  if (previous && time > previous.time) velocity = poseVelocity(previous.transforms, snapshot, time - previous.time);
  entity._animationGraphPoseSample = { transforms: snapshot, time };
  entity._animationGraphPoseVelocity = velocity;
}

function processAnimationRequests(entity, controller) {
  if (controller.waitingRequest || controller.queuedRequests.length === 0) return;
  const request = controller.queuedRequests.shift();
  if (!controller.currentTransitionId) {
    if (request.stateId === controller.currentStateId) return;
    if (request.interruptPolicy === 'REQUIRE_TAG' && !stateHasTags(controller, controller.currentStateId, request.requiredAnchorTags)) {
      const bridge = transitionWithAnchorTags(controller, controller.currentStateId, request.requiredAnchorTags);
      if (bridge) {
        controller.waitingRequest = request;
        beginTransition(entity, controller, bridge.to, { transition: bridge });
      } else {
        controller.waitingRequest = request;
      }
      return;
    }
    beginTransition(entity, controller, request.stateId);
    return;
  }

  const transition = controller._index.transitions.get(controller.currentTransitionId);
  const policy = request.interruptPolicy ?? transition?.interruptPolicy ?? 'IMMEDIATE';
  if (policy === 'IMMEDIATE') {
    beginTransition(entity, controller, request.stateId, { interrupted: true });
  } else if (policy === 'FINISH_TRANSITION') {
    controller.waitingRequest = request;
  } else if (policy === 'AT_NEXT_ANCHOR') {
    controller.waitingRequest = { ...request, requiredAnchorTags: [] };
  } else if (policy === 'REQUIRE_TAG') {
    controller.waitingRequest = request;
  }
}

function advanceTransition(entity, controller, dt) {
  const transition = controller._index.transitions.get(controller.currentTransitionId);
  const previousProgress = controller.transitionProgress;
  controller.transitionTime = Math.min(controller.transitionDuration, controller.transitionTime + dt);
  controller.transitionProgress = controller.transitionDuration > 0 ? controller.transitionTime / controller.transitionDuration : 1;
  emitCrossedMarkers(controller, transition, previousProgress, controller.transitionProgress);

  if (controller.waitingRequest) {
    const anchor = crossedCompatibleAnchor(transition, previousProgress, controller.transitionProgress, controller.waitingRequest.requiredAnchorTags);
    if (anchor) {
      const request = controller.waitingRequest;
      controller.waitingRequest = null;
      controller.emittedMarkers.push({ type: 'interruptAnchor', id: anchor.id, tags: [...anchor.tags], at: anchor.at });
      beginTransition(entity, controller, request.stateId, { interrupted: true, anchor });
      return;
    }
  }

  if (controller.transitionProgress < 1) return;
  const arrived = controller.transitionToStateId;
  clearTransition(controller);
  controller.currentStateId = arrived;
  controller.dwellElapsed = 0;
  controller.dwellTarget = sampleRange(controller, controller._index.states.get(arrived)?.dwell, 0);
  if (controller.waitingRequest) {
    const request = controller.waitingRequest;
    controller.waitingRequest = null;
    controller.queuedRequests.unshift(request);
  }
}

function advanceDwell(entity, controller, dt) {
  controller.dwellElapsed += dt;
  if (controller.dwellElapsed < controller.dwellTarget || controller.queuedRequests.length > 0 || controller.waitingRequest) return;
  const state = controller._index.states.get(controller.currentStateId);
  if (!state?.next?.length) return;
  const choice = weightedChoice(controller, state.next);
  if (choice?.state && choice.state !== controller.currentStateId) beginTransition(entity, controller, choice.state);
  else {
    controller.dwellElapsed = 0;
    controller.dwellTarget = sampleRange(controller, state.dwell, 0);
  }
}

function beginTransition(entity, controller, targetStateId, options = {}) {
  const logicalFrom = controller.currentTransitionId ? controller.transitionToStateId ?? controller.currentStateId : controller.currentStateId;
  const transition = options.transition ?? chooseTransition(controller, logicalFrom, targetStateId)
    ?? chooseTransition(controller, controller.currentStateId, targetStateId);
  const variant = transition?.variants?.length ? weightedChoice(controller, transition.variants) : null;
  if (options.interrupted) captureInterruptionSnapshot(entity, controller, transition);
  controller.currentTransitionId = transition?.id ?? `synthetic:${logicalFrom}:${targetStateId}`;
  controller.currentVariantId = variant?.id ?? null;
  controller.transitionFromStateId = logicalFrom;
  controller.transitionToStateId = targetStateId;
  controller.transitionTime = 0;
  controller.transitionProgress = 0;
  controller.transitionDuration = sampleRange(controller, variant?.duration ?? transition?.duration, transition ? 0.2 : 0.16);
  controller.transitionChannels = structuredClone(variant?.channels ?? transition?.channels ?? {});
  controller.dwellElapsed = 0;
  if (!transition) installSyntheticTransition(controller);
}

function captureInterruptionSnapshot(entity, controller, transition) {
  const snapshot = entity?._animationGraphPoseSample?.transforms;
  if (!snapshot) return;
  controller.snapshot = structuredClone(snapshot);
  controller.snapshotVelocity = entity._animationGraphPoseVelocity ? structuredClone(entity._animationGraphPoseVelocity) : null;
  controller.inertialBlend = {
    elapsed: 0,
    duration: clamp(transition?.inertialDuration ?? 0.2, 0.05, 0.5),
  };
}

function installSyntheticTransition(controller) {
  const id = controller.currentTransitionId;
  if (controller._index.transitions.has(id)) return;
  controller._index.transitions.set(id, {
    id,
    from: controller.transitionFromStateId,
    to: controller.transitionToStateId,
    duration: { min: controller.transitionDuration, max: controller.transitionDuration },
    channels: {},
    variants: [],
    interruptPolicy: 'IMMEDIATE',
    interruptAnchors: [],
    markers: [],
    synthetic: true,
  });
}

function clearTransition(controller) {
  if (controller.currentTransitionId?.startsWith('synthetic:')) controller._index.transitions.delete(controller.currentTransitionId);
  controller.currentTransitionId = null;
  controller.currentVariantId = null;
  controller.transitionTime = 0;
  controller.transitionDuration = 0;
  controller.transitionProgress = 0;
  controller.transitionFromStateId = null;
  controller.transitionToStateId = null;
  controller.transitionChannels = null;
}

function emitCrossedMarkers(controller, transition, previous, current) {
  for (const marker of transition?.markers ?? []) {
    if (marker.at > previous && marker.at <= current) {
      controller.emittedMarkers.push({ type: 'marker', transitionId: transition.id, id: marker.id, tags: [...marker.tags], at: marker.at });
    }
  }
}

function crossedCompatibleAnchor(transition, previous, current, requiredTags = []) {
  return (transition?.interruptAnchors ?? []).find((anchor) =>
    anchor.at > previous && anchor.at <= current && requiredTags.every((tag) => anchor.tags.includes(tag)));
}

function stateHasTags(controller, stateId, tags) {
  if (!tags?.length) return true;
  const stateTags = controller._index.states.get(stateId)?.tags ?? [];
  return tags.every((tag) => stateTags.includes(tag));
}

function transitionWithAnchorTags(controller, fromStateId, tags) {
  return (controller._index.outgoing.get(fromStateId) ?? []).find((transition) =>
    transition.interruptAnchors.some((anchor) => tags.every((tag) => anchor.tags.includes(tag))));
}

function chooseTransition(controller, from, to) {
  const candidates = controller._index.byEdge.get(`${from}:${to}`) ?? [];
  return candidates.length ? weightedChoice(controller, candidates) : null;
}

function weightedChoice(controller, choices) {
  const total = choices.reduce((sum, choice) => sum + positiveNumber(choice.weight, 1), 0);
  let cursor = nextRandom(controller) * total;
  for (const choice of choices) {
    cursor -= positiveNumber(choice.weight, 1);
    if (cursor <= 0) return choice;
  }
  return choices[choices.length - 1] ?? null;
}

function sampleRange(controller, range, fallback) {
  const normalized = normalizeRange(range, fallback);
  if (normalized.max <= normalized.min) return normalized.min;
  return normalized.min + (normalized.max - normalized.min) * nextRandom(controller);
}

function nextRandom(controller) {
  controller.rngState = (Math.imul(1664525, controller.rngState) + 1013904223) >>> 0;
  controller.decisionIndex += 1;
  return controller.rngState / 0x100000000;
}

function indexAnimationGraph(graph) {
  const states = new Map(graph.states.map((state) => [state.id, state]));
  const transitions = new Map(graph.transitions.map((transition) => [transition.id, transition]));
  const byEdge = new Map();
  const outgoing = new Map(graph.states.map((state) => [state.id, []]));
  for (const transition of graph.transitions) {
    const key = `${transition.from}:${transition.to}`;
    if (!byEdge.has(key)) byEdge.set(key, []);
    byEdge.get(key).push(transition);
    outgoing.get(transition.from)?.push(transition);
  }
  return { states, transitions, byEdge, outgoing };
}

function installControllerIndex(controller, graph, index = indexAnimationGraph(graph)) {
  Object.defineProperty(controller, '_graph', { value: graph, writable: true, configurable: true, enumerable: false });
  Object.defineProperty(controller, '_index', { value: index, writable: true, configurable: true, enumerable: false });
}

function normalizeTransition(transition, index) {
  return {
    ...structuredClone(transition),
    id: transition?.id ?? `transition-${index + 1}`,
    duration: normalizeRange(transition?.duration, 0.2),
    weight: positiveNumber(transition?.weight, 1),
    channels: normalizeChannels(transition?.channels),
    interruptPolicy: ANIMATION_INTERRUPT_POLICIES.includes(transition?.interruptPolicy) ? transition.interruptPolicy : 'IMMEDIATE',
    interruptAnchors: normalizeTimelineEntries(transition?.interruptAnchors),
    markers: normalizeTimelineEntries(transition?.markers),
    variants: (transition?.variants ?? []).map((variant, variantIndex) => ({
      ...structuredClone(variant),
      id: variant?.id ?? `variant-${variantIndex + 1}`,
      weight: positiveNumber(variant?.weight, 1),
      duration: variant?.duration == null ? null : normalizeRange(variant.duration, 0.2),
      channels: normalizeChannels(variant?.channels),
    })),
  };
}

function normalizeChannels(channels) {
  if (!isPlainObject(channels)) return {};
  return channels.rig ? { rig: structuredClone(channels.rig) } : {};
}

function normalizeTimelineEntries(entries) {
  return (entries ?? []).map((entry, index) => ({
    ...structuredClone(entry),
    id: entry?.id ?? `entry-${index + 1}`,
    at: clamp(Number(entry?.at) || 0, 0, 1),
    tags: Array.isArray(entry?.tags) ? [...entry.tags] : [],
  })).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

function validateTimelineEntries(entries, label, errors, anchors) {
  const ids = new Set();
  for (const [index, entry] of entries.entries()) {
    const entryLabel = `${label}[${index}]`;
    if (!isNonEmptyString(entry.id)) errors.push(`${entryLabel}.id must be a non-empty string.`);
    else if (ids.has(entry.id)) errors.push(`${entryLabel}.id "${entry.id}" is duplicated.`);
    else ids.add(entry.id);
    if (!Number.isFinite(entry.at) || entry.at < 0 || entry.at > 1) errors.push(`${entryLabel}.at must be between 0 and 1.`);
    if (entry.tags != null && !isStringArray(entry.tags)) errors.push(`${entryLabel}.tags must be an array of strings.`);
    if (anchors && entry.tags.length === 0) errors.push(`${entryLabel} must include at least one semantic tag.`);
  }
}

function validateRigChannel(channel, label, clipIds, errors) {
  if (channel == null) return;
  if (!isPlainObject(channel)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (!isNonEmptyString(channel.clip) || !clipIds.has(channel.clip)) errors.push(`${label}.clip references unknown clip "${channel.clip ?? 'missing'}".`);
}

function validateRange(range, label, errors, options = {}) {
  if (!isPlainObject(range)) {
    errors.push(`${label} must be a number or { min, max } range.`);
    return;
  }
  const minimum = options.allowZero ? 0 : Number.EPSILON;
  if (!Number.isFinite(range.min) || range.min < minimum) errors.push(`${label}.min must be ${options.allowZero ? 'nonnegative' : 'positive'}.`);
  if (!Number.isFinite(range.max) || range.max < range.min) errors.push(`${label}.max must be at least min.`);
}

function normalizeRange(value, fallback) {
  if (Number.isFinite(value)) return { min: Math.max(0, value), max: Math.max(0, value) };
  if (!isPlainObject(value)) return { min: fallback, max: fallback };
  const min = Math.max(0, Number(value.min) || 0);
  const max = Math.max(min, Number(value.max) || min);
  return { min, max };
}

function reachableStates(graph) {
  const outgoing = new Map(graph.states.map((state) => [state.id, []]));
  for (const transition of graph.transitions) outgoing.get(transition.from)?.push(transition.to);
  const reached = new Set(graph.initialState ? [graph.initialState] : []);
  const queue = [...reached];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const stateId of outgoing.get(queue[cursor]) ?? []) {
      if (reached.has(stateId)) continue;
      reached.add(stateId);
      queue.push(stateId);
    }
  }
  return reached;
}

function resolveAnimationStateId(entity, semanticOrStateId) {
  return entity.animationStateMap?.[semanticOrStateId] ?? semanticOrStateId;
}

function transformsToRecord(transforms) {
  return Object.fromEntries([...transforms].map(([id, transform]) => [id, structuredClone(transform)]));
}

function poseVelocity(previous, current, dt) {
  const result = {};
  for (const id of new Set([...Object.keys(previous), ...Object.keys(current)])) {
    const a = previous[id] ?? {};
    const b = current[id] ?? {};
    result[id] = {
      x: ((b.x ?? 0) - (a.x ?? 0)) / dt,
      y: ((b.y ?? 0) - (a.y ?? 0)) / dt,
      z: ((b.z ?? 0) - (a.z ?? 0)) / dt,
      rotation: shortestAngle((b.rotation ?? 0) - (a.rotation ?? 0)) / dt,
    };
  }
  return result;
}

function deriveSeed(seed, text, offset) {
  let state = (Number(seed) || 1) >>> 0;
  for (const character of String(text ?? '')) state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
  return (state + (offset >>> 0)) >>> 0 || 1;
}

function shortestAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function positiveNumber(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}
