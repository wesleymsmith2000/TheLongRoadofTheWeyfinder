export const ANIMATION_INTERRUPT_POLICIES = ['IMMEDIATE', 'AT_NEXT_ANCHOR', 'FINISH_TRANSITION', 'REQUIRE_TAG'];
export const ANIMATION_TEXTURE_TRANSITIONS = ['STEP', 'CROSSFADE', 'DITHER'];
export const ANIMATION_ADDITIVE_KINDS = ['sine', 'smoothNoise'];

export function emptyAnimationGraph() {
  return {
    schemaVersion: '0.1',
    initialState: 'idle',
    seedOffset: 0,
    states: [createAnimationState({ id: 'idle', tags: ['stable'] })],
    transitions: [],
    materialStates: [],
    materialClips: [],
    textureStates: [],
    textureClips: [],
    additiveMotion: [],
  };
}

export function createAnimationState(options = {}) {
  const state = {
    id: identifier(options.id, 'state'),
    tags: list(options.tags),
    rig: { pose: text(options.pose) || null },
    material: { state: text(options.materialState) || null },
    texture: { state: text(options.textureState) || null },
    dwell: { min: nonNegative(options.dwellMin, 0.8), max: nonNegative(options.dwellMax, 2.4) },
    next: normalizeWeightedNext(options.next),
    editorPosition: vector2(options.editorPosition ?? [options.x, options.y]),
  };
  if (!state.rig.pose) delete state.rig;
  if (!state.material.state) delete state.material;
  if (!state.texture.state) delete state.texture;
  return state;
}

export function createAnimationTransition(options = {}) {
  return {
    id: identifier(options.id, 'transition'),
    from: text(options.from),
    to: text(options.to),
    duration: normalizeDuration(options.duration ?? { min: options.durationMin, max: options.durationMax }),
    channels: normalizeChannels(options.channels ?? {
      rig: options.rigClip ? { clip: options.rigClip } : null,
      material: options.materialClip ? { clip: options.materialClip } : null,
      texture: options.textureClip ? { clip: options.textureClip, mode: options.textureMode } : null,
    }),
    interruptPolicy: ANIMATION_INTERRUPT_POLICIES.includes(options.interruptPolicy) ? options.interruptPolicy : 'IMMEDIATE',
    requiredAnchorTags: list(options.requiredAnchorTags),
    interruptAnchors: normalizeTimelineEntries(options.interruptAnchors),
    markers: normalizeTimelineEntries(options.markers),
    variants: normalizeVariants(options.variants),
  };
}

export function normalizeAnimationGraph(graph = {}) {
  const source = graph && typeof graph === 'object' && !Array.isArray(graph) ? graph : {};
  return {
    schemaVersion: text(source.schemaVersion) || '0.1',
    initialState: text(source.initialState),
    seedOffset: Math.trunc(finite(source.seedOffset, 0)),
    states: Array.isArray(source.states) ? source.states.map(normalizeState) : [],
    transitions: Array.isArray(source.transitions) ? source.transitions.map(normalizeTransition) : [],
    materialStates: Array.isArray(source.materialStates) ? source.materialStates.map(normalizeNamedDefinition) : [],
    materialClips: Array.isArray(source.materialClips) ? source.materialClips.map(normalizeNamedDefinition) : [],
    textureStates: Array.isArray(source.textureStates) ? source.textureStates.map(normalizeNamedDefinition) : [],
    textureClips: Array.isArray(source.textureClips) ? source.textureClips.map(normalizeNamedDefinition) : [],
    additiveMotion: Array.isArray(source.additiveMotion) ? source.additiveMotion.map(normalizeAdditiveMotion) : [],
  };
}

export function validateAnimationGraph(graph, poseRig = {}) {
  const errors = [];
  const warnings = [];
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) return { valid: false, errors: ['animationGraph must be an object.'], warnings };
  const normalized = normalizeAnimationGraph(graph);
  const stateIds = uniqueIds(normalized.states, 'animationGraph.states', errors);
  const materialStateIds = uniqueIds(normalized.materialStates, 'animationGraph.materialStates', errors);
  const materialClipIds = uniqueIds(normalized.materialClips, 'animationGraph.materialClips', errors);
  const textureStateIds = uniqueIds(normalized.textureStates, 'animationGraph.textureStates', errors);
  const textureClipIds = uniqueIds(normalized.textureClips, 'animationGraph.textureClips', errors);
  const poseIds = new Set((poseRig?.poses ?? []).map((pose) => pose.id));
  const rigClipIds = new Set([...(poseRig?.clips ?? []), ...(poseRig?.animations ?? [])].map((clip) => clip.id));

  if (!normalized.initialState) errors.push('animationGraph.initialState is required.');
  else if (!stateIds.has(normalized.initialState)) errors.push(`animationGraph.initialState references unknown state "${normalized.initialState}".`);
  normalized.states.forEach((state, index) => {
    const label = `animationGraph.states[${index}]`;
    if (state.rig?.pose && !poseIds.has(state.rig.pose)) errors.push(`${label}.rig.pose references unknown pose "${state.rig.pose}".`);
    if (state.material?.state && !materialStateIds.has(state.material.state)) errors.push(`${label}.material.state references unknown material state "${state.material.state}".`);
    if (state.texture?.state && !textureStateIds.has(state.texture.state)) errors.push(`${label}.texture.state references unknown texture state "${state.texture.state}".`);
    if (state.dwell.min < 0 || state.dwell.max < state.dwell.min) errors.push(`${label}.dwell must have 0 <= min <= max.`);
    for (const [nextIndex, next] of state.next.entries()) {
      if (!stateIds.has(next.state)) errors.push(`${label}.next[${nextIndex}] references unknown state "${next.state}".`);
      if (!(next.weight > 0)) errors.push(`${label}.next[${nextIndex}].weight must be positive.`);
    }
  });

  const transitionIds = uniqueIds(normalized.transitions, 'animationGraph.transitions', errors);
  normalized.transitions.forEach((transition, index) => {
    const label = `animationGraph.transitions[${index}]`;
    if (!stateIds.has(transition.from)) errors.push(`${label}.from references unknown state "${transition.from || 'missing'}".`);
    if (!stateIds.has(transition.to)) errors.push(`${label}.to references unknown state "${transition.to || 'missing'}".`);
    if (!(transition.duration.min > 0) || transition.duration.max < transition.duration.min) errors.push(`${label}.duration must have 0 < min <= max.`);
    if (!ANIMATION_INTERRUPT_POLICIES.includes(transition.interruptPolicy)) errors.push(`${label}.interruptPolicy is not supported.`);
    validateChannels(transition.channels, label, { rigClipIds, materialClipIds, textureClipIds }, errors);
    validateTimeline(transition.interruptAnchors, `${label}.interruptAnchors`, errors, warnings);
    validateTimeline(transition.markers, `${label}.markers`, errors, warnings);
    transition.variants.forEach((variant, variantIndex) => {
      if (!(variant.weight > 0)) errors.push(`${label}.variants[${variantIndex}].weight must be positive.`);
      validateChannels(variant.channels, `${label}.variants[${variantIndex}]`, { rigClipIds, materialClipIds, textureClipIds }, errors);
    });
    if (transition.interruptPolicy === 'REQUIRE_TAG' && transition.requiredAnchorTags.length === 0) warnings.push(`${label} requires anchor tags but none are authored.`);
  });

  normalized.additiveMotion.forEach((motion, index) => {
    const label = `animationGraph.additiveMotion[${index}]`;
    if (!ANIMATION_ADDITIVE_KINDS.includes(motion.kind)) errors.push(`${label}.kind is not supported.`);
    if (!validSelector(motion.target)) errors.push(`${label}.target must use a supported selector.`);
    if (!Number.isFinite(motion.amplitude) || !Number.isFinite(motion.frequency) || motion.frequency < 0) errors.push(`${label} amplitude/frequency must be finite and frequency non-negative.`);
  });

  if (stateIds.has(normalized.initialState)) {
    const reachable = reachableStates(normalized);
    for (const state of normalized.states) {
      if (!reachable.has(state.id)) warnings.push(`Animation state "${state.id}" is unreachable from initialState.`);
      if (state.next.length > 0 && !normalized.transitions.some((transition) => transition.from === state.id)) warnings.push(`Autonomous state "${state.id}" has choices but no authored outgoing transition.`);
    }
  }
  if (transitionIds.size === 0 && normalized.states.length > 1) warnings.push('Animation graph has multiple states but no transitions.');
  return { valid: errors.length === 0, errors, warnings, graph: normalized };
}

export function createAnimationGraphExample() {
  return normalizeAnimationGraph({
    schemaVersion: '0.1',
    initialState: 'idle-center',
    seedOffset: 14,
    states: [
      createAnimationState({ id: 'idle-center', tags: ['stable', 'balanced'], pose: 'pose.idle_center', dwellMin: 0.8, dwellMax: 2.4, x: 0, y: 0, next: [{ state: 'idle-left', weight: 3 }, { state: 'stretch', weight: 1 }] }),
      createAnimationState({ id: 'idle-left', tags: ['stable'], pose: 'pose.idle_left', dwellMin: 0.6, dwellMax: 1.4, x: -1, y: 1, next: [{ state: 'idle-center', weight: 1 }] }),
      createAnimationState({ id: 'stretch', tags: ['balanced'], pose: 'pose.stretch', materialState: 'material.stretch', textureState: 'texture.stretched', dwellMin: 0.2, dwellMax: 0.5, x: 1, y: 1, next: [{ state: 'idle-center', weight: 1 }] }),
      createAnimationState({ id: 'alert', tags: ['weapon-ready'], pose: 'pose.alert', materialState: 'material.alert', textureState: 'texture.eyes_open', dwellMin: 0.4, dwellMax: 1.2, x: 2, y: 0 }),
    ],
    materialStates: [
      { id: 'material.stretch', overrides: { emissive: { intensity: 0.25 } } },
      { id: 'material.alert', overrides: { albedo: '#8fa6ff', emissive: { color: '#bff5ff', intensity: 0.75 } } },
    ],
    materialClips: [{ id: 'material.stretch_skin', tracks: [{ path: 'emissive.intensity', keys: [{ at: 0, value: 0 }, { at: 1, value: 0.25 }] }] }],
    textureStates: [
      { id: 'texture.stretched', texture: { pattern: 'weave', strength: 0.8 } },
      { id: 'texture.eyes_open', texture: { atlasAssetId: 'image.construct.eyes_open' } },
    ],
    textureClips: [{ id: 'texture.stretch_surface', mode: 'DITHER', from: 'texture.eyes_open', to: 'texture.stretched' }],
    transitions: [
      createAnimationTransition({ id: 'idle-to-left', from: 'idle-center', to: 'idle-left', duration: { min: 0.3, max: 0.5 }, rigClip: 'look_left', interruptPolicy: 'IMMEDIATE' }),
      createAnimationTransition({ id: 'left-to-idle', from: 'idle-left', to: 'idle-center', duration: { min: 0.3, max: 0.5 }, rigClip: 'look_center', interruptPolicy: 'IMMEDIATE' }),
      createAnimationTransition({
        id: 'idle-to-stretch', from: 'idle-center', to: 'stretch', duration: { min: 0.72, max: 0.96 },
        channels: { rig: { clip: 'rig.stretch_forward' }, material: { clip: 'material.stretch_skin' }, texture: { clip: 'texture.stretch_surface', mode: 'DITHER' } },
        interruptPolicy: 'AT_NEXT_ANCHOR',
        interruptAnchors: [{ id: 'balanced-midway', at: 0.48, tags: ['balanced'] }, { id: 'foot-planted', at: 0.76, tags: ['balanced', 'grounded'] }],
        markers: [{ id: 'cloth-snap', at: 0.62, tags: ['sound', 'cloth'] }],
        variants: [{ id: 'forward', weight: 3, channels: { rig: { clip: 'rig.stretch_forward' } } }, { id: 'twitch', weight: 1, channels: { rig: { clip: 'rig.stretch_twitch' } } }],
      }),
      createAnimationTransition({ id: 'interrupt-to-alert', from: 'stretch', to: 'alert', duration: { min: 0.18, max: 0.28 }, rigClip: 'rig.alert', interruptPolicy: 'IMMEDIATE' }),
    ],
    additiveMotion: [{ id: 'breathing', target: 'group:body', kind: 'smoothNoise', property: 'translateY', amplitude: 1.8, frequency: 0.28, seedOffset: 14 }],
  });
}

export function animationGraphSummary(graph) {
  const normalized = normalizeAnimationGraph(graph);
  const anchors = normalized.transitions.reduce((total, transition) => total + transition.interruptAnchors.length, 0);
  const variants = normalized.transitions.reduce((total, transition) => total + transition.variants.length, 0);
  return `${normalized.states.length} states, ${normalized.transitions.length} transitions, ${anchors} interrupt anchors, ${variants} variants`;
}

function normalizeState(state = {}) {
  const normalized = {
    id: text(state.id), tags: list(state.tags), dwell: normalizeDwell(state.dwell),
    next: normalizeWeightedNext(state.next), editorPosition: vector2(state.editorPosition),
  };
  if (state.rig?.pose) normalized.rig = { pose: text(state.rig.pose) };
  if (state.material?.state) normalized.material = { state: text(state.material.state) };
  if (state.texture?.state) normalized.texture = { state: text(state.texture.state) };
  return normalized;
}

function normalizeTransition(transition = {}) {
  return createAnimationTransition(transition);
}

function normalizeNamedDefinition(definition = {}) {
  return structuredClone({ ...definition, id: text(definition.id) });
}

function normalizeAdditiveMotion(motion = {}) {
  return {
    id: text(motion.id), target: text(motion.target), kind: text(motion.kind) || 'sine', property: text(motion.property) || 'translateY',
    amplitude: finite(motion.amplitude, 0), frequency: finite(motion.frequency, 1), seedOffset: finite(motion.seedOffset, 0),
  };
}

function normalizeDuration(duration) {
  if (Number.isFinite(Number(duration))) return { min: positive(duration, 0.4), max: positive(duration, 0.4) };
  const source = duration && typeof duration === 'object' ? duration : {};
  return { min: finite(source.min, 0.4), max: finite(source.max, finite(source.min, 0.4)) };
}

function normalizeDwell(dwell = {}) {
  return { min: finite(dwell.min, 0), max: finite(dwell.max, finite(dwell.min, 0)) };
}

function normalizeChannels(channels = {}) {
  const normalized = {};
  for (const kind of ['rig', 'material', 'texture']) {
    const channel = channels?.[kind];
    if (!channel?.clip) continue;
    normalized[kind] = { clip: text(channel.clip) };
    if (kind === 'texture' && channel.mode) normalized[kind].mode = text(channel.mode);
  }
  return normalized;
}

function normalizeTimelineEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => ({ id: text(entry.id), at: finite(entry.at, 0), tags: list(entry.tags) }));
}

function normalizeVariants(variants) {
  if (!Array.isArray(variants)) return [];
  return variants.map((variant) => ({ id: text(variant.id), weight: finite(variant.weight, 1), channels: normalizeChannels(variant.channels) }));
}

function normalizeWeightedNext(next) {
  if (!Array.isArray(next)) return [];
  return next.map((choice) => ({ state: text(choice.state), weight: finite(choice.weight, 1) }));
}

function validateChannels(channels, label, refs, errors) {
  if (channels.rig?.clip && !refs.rigClipIds.has(channels.rig.clip)) errors.push(`${label}.channels.rig.clip references unknown rig clip "${channels.rig.clip}".`);
  if (channels.material?.clip && !refs.materialClipIds.has(channels.material.clip)) errors.push(`${label}.channels.material.clip references unknown material clip "${channels.material.clip}".`);
  if (channels.texture?.clip && !refs.textureClipIds.has(channels.texture.clip)) errors.push(`${label}.channels.texture.clip references unknown texture clip "${channels.texture.clip}".`);
  if (channels.texture?.mode && !ANIMATION_TEXTURE_TRANSITIONS.includes(channels.texture.mode)) errors.push(`${label}.channels.texture.mode is not supported.`);
}

function validateTimeline(entries, label, errors, warnings) {
  const semantics = new Set();
  entries.forEach((entry, index) => {
    if (!entry.id) errors.push(`${label}[${index}].id is required.`);
    if (entry.at < 0 || entry.at > 1) errors.push(`${label}[${index}].at must be between 0 and 1.`);
    const key = [...entry.tags].sort().join('|');
    if (key && semantics.has(key)) warnings.push(`${label}[${index}] duplicates anchor/marker semantics "${key}".`);
    semantics.add(key);
  });
}

function uniqueIds(entries, label, errors) {
  const ids = new Set();
  entries.forEach((entry, index) => {
    if (!entry.id) errors.push(`${label}[${index}].id is required.`);
    else if (ids.has(entry.id)) errors.push(`${label}[${index}].id "${entry.id}" is duplicated.`);
    else ids.add(entry.id);
  });
  return ids;
}

function reachableStates(graph) {
  const found = new Set([graph.initialState]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const transition of graph.transitions) if (found.has(transition.from) && !found.has(transition.to)) { found.add(transition.to); changed = true; }
    for (const state of graph.states) if (found.has(state.id)) for (const next of state.next) if (!found.has(next.state)) { found.add(next.state); changed = true; }
  }
  return found;
}

function validSelector(value) {
  return /^(group|joint|cell|role|type|slot|tag):[^\s]+$/.test(text(value));
}

function list(value) { if (Array.isArray(value)) return [...new Set(value.map(text).filter(Boolean))]; return text(value).split(/[,\n]+/).map(text).filter(Boolean); }
function vector2(value) { return Array.isArray(value) ? [finite(value[0], 0), finite(value[1], 0)] : [0, 0]; }
function text(value) { return String(value ?? '').trim(); }
function identifier(value, fallback) { return text(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '') || fallback; }
function finite(value, fallback) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function positive(value, fallback) { const number = finite(value, fallback); return number > 0 ? number : fallback; }
function nonNegative(value, fallback) { const number = finite(value, fallback); return number >= 0 ? number : fallback; }
