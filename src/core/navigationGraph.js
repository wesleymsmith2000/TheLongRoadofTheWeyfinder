import { CONTENT_SCHEMA_VERSION, isCompatibleSchemaVersion, isNonEmptyString, isPlainObject, isStringArray } from './contentSchema.js';

export const NAVIGATION_GRAPH_SCHEMA_VERSION = CONTENT_SCHEMA_VERSION;
export const NAVIGATION_NODE_KINDS = Object.freeze(['level', 'encounter', 'relay', 'hazard', 'station', 'puzzle', 'boss', 'repair', 'unknown']);
export const NAVIGATION_AXES = Object.freeze([
  'alignment',
  'threat',
  'clarity',
  'fatePressure',
  'roadCoherence',
  'destinationSignal',
  'recentTrend',
  'ambushRisk',
]);

const DEFAULT_AXES = Object.freeze({
  alignment: 0,
  threat: 0,
  clarity: 0.5,
  fatePressure: 0,
  roadCoherence: 0,
  destinationSignal: 0,
  recentTrend: 0,
  ambushRisk: 0,
});

export function normalizeNavigationGraph(definition = {}) {
  return {
    schemaVersion: definition.schemaVersion ?? NAVIGATION_GRAPH_SCHEMA_VERSION,
    assetId: definition.assetId ?? 'navigation.local',
    initialNode: definition.initialNode ?? definition.startNode ?? definition.nodes?.[0]?.id ?? null,
    visibleHorizon: clampInteger(definition.visibleHorizon ?? 2, 1, 4),
    seedOffset: Math.trunc(Number(definition.seedOffset) || 0),
    nodes: (definition.nodes ?? []).map((node) => ({
      ...structuredClone(node),
      kind: NAVIGATION_NODE_KINDS.includes(node?.kind) ? node.kind : 'unknown',
      tags: Array.isArray(node?.tags) ? [...node.tags] : [],
      signals: normalizeSignals(node?.signals ?? node?.navigation),
    })),
    edges: (definition.edges ?? []).map((edge, index) => ({
      ...structuredClone(edge),
      id: edge?.id ?? `edge-${index + 1}`,
      weight: positiveNumber(edge?.weight, 1),
      enabled: edge?.enabled !== false,
      tags: Array.isArray(edge?.tags) ? [...edge.tags] : [],
      signals: normalizeSignals(edge?.signals ?? edge?.navigation),
    })),
  };
}

export function validateNavigationGraph(definition) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(definition)) return { valid: false, errors: ['navigationGraph must be an object.'], warnings };
  const graph = normalizeNavigationGraph(definition);
  if (!isCompatibleSchemaVersion(graph.schemaVersion)) errors.push(`navigationGraph.schemaVersion "${graph.schemaVersion}" must be compatible with 0.x.`);
  if (!isNonEmptyString(graph.assetId)) errors.push('navigationGraph.assetId must be a non-empty string.');
  if (!Array.isArray(definition.nodes) || definition.nodes.length === 0) errors.push('navigationGraph.nodes must be a non-empty array.');
  if (!Array.isArray(definition.edges)) errors.push('navigationGraph.edges must be an array.');

  const nodeIds = new Set();
  for (const [index, node] of graph.nodes.entries()) {
    const label = `navigationGraph.nodes[${index}]`;
    if (!isNonEmptyString(node.id)) errors.push(`${label}.id must be a non-empty string.`);
    else if (nodeIds.has(node.id)) errors.push(`${label}.id "${node.id}" is duplicated.`);
    else nodeIds.add(node.id);
    if (!NAVIGATION_NODE_KINDS.includes(node.kind)) errors.push(`${label}.kind must be one of: ${NAVIGATION_NODE_KINDS.join(', ')}.`);
    if (node.tags != null && !isStringArray(node.tags)) errors.push(`${label}.tags must be an array of strings.`);
    validateSignals(node.signals, `${label}.signals`, errors);
  }
  if (!nodeIds.has(graph.initialNode)) errors.push(`navigationGraph.initialNode references unknown node "${graph.initialNode ?? 'missing'}".`);

  const edgeIds = new Set();
  for (const [index, edge] of graph.edges.entries()) {
    const label = `navigationGraph.edges[${index}]`;
    if (!isNonEmptyString(edge.id)) errors.push(`${label}.id must be a non-empty string.`);
    else if (edgeIds.has(edge.id)) errors.push(`${label}.id "${edge.id}" is duplicated.`);
    else edgeIds.add(edge.id);
    if (!nodeIds.has(edge.from)) errors.push(`${label}.from references unknown node "${edge.from ?? 'missing'}".`);
    if (!nodeIds.has(edge.to)) errors.push(`${label}.to references unknown node "${edge.to ?? 'missing'}".`);
    if (!(edge.weight > 0)) errors.push(`${label}.weight must be positive.`);
    if (edge.tags != null && !isStringArray(edge.tags)) errors.push(`${label}.tags must be an array of strings.`);
    validateSignals(edge.signals, `${label}.signals`, errors);
  }

  const reachable = reachableNodes(graph, graph.initialNode);
  for (const node of graph.nodes) {
    if (!reachable.has(node.id)) warnings.push(`navigationGraph node "${node.id}" is unreachable from initialNode.`);
  }
  if (!graph.nodes.some(isDestinationNode)) warnings.push('navigationGraph has no destination-tagged node; topology-derived alignment will remain neutral.');
  return { valid: errors.length === 0, errors, warnings, definition: graph };
}

export function createNavigationRuntime(definition, options = {}) {
  const report = validateNavigationGraph(definition);
  if (!report.valid) throw new Error(`Invalid navigation graph: ${report.errors.join(' ')}`);
  const graph = report.definition;
  const index = indexNavigationGraph(graph);
  const initial = index.nodes.get(graph.initialNode);
  const axes = axesForArrival(index, null, initial, null, DEFAULT_AXES);
  const runtime = {
    schemaVersion: NAVIGATION_GRAPH_SCHEMA_VERSION,
    definition: graph,
    currentNodeId: graph.initialNode,
    selectedEdgeId: null,
    previousNodeId: null,
    axes: { ...axes },
    targetAxes: { ...axes },
    musicMix: navigationMusicMix(axes),
    targetMusicMix: navigationMusicMix(axes),
    history: {
      visitedNodeIds: [graph.initialNode],
      selectedEdgeIds: [],
      visitCounts: { [graph.initialNode]: 1 },
      repeatedNodes: 0,
      consecutiveAwayChoices: 0,
      consecutiveTowardChoices: 0,
      failedEncounters: 0,
      restoredAnchors: 0,
      listenedBeforeChoosing: 0,
    },
    rngState: deriveSeed(options.seed ?? 1, graph.assetId, graph.seedOffset),
    revision: 0,
    lastTransition: null,
    diagnostics: [...report.warnings],
  };
  Object.defineProperty(runtime, '_index', { value: index, writable: true, enumerable: false });
  return runtime;
}

export function hydrateNavigationRuntime(saved, definition = saved?.definition) {
  const runtime = createNavigationRuntime(definition, { seed: saved?.rngState ?? 1 });
  if (!saved || !runtime._index.nodes.has(saved.currentNodeId)) return runtime;
  runtime.currentNodeId = saved.currentNodeId;
  runtime.selectedEdgeId = saved.selectedEdgeId ?? null;
  runtime.previousNodeId = saved.previousNodeId ?? null;
  runtime.axes = normalizeAxes(saved.axes, runtime.axes);
  runtime.targetAxes = normalizeAxes(saved.targetAxes, runtime.axes);
  runtime.musicMix = normalizeMix(saved.musicMix, navigationMusicMix(runtime.axes));
  runtime.targetMusicMix = normalizeMix(saved.targetMusicMix, navigationMusicMix(runtime.targetAxes));
  runtime.history = normalizeHistory(saved.history, runtime.currentNodeId);
  runtime.rngState = Number.isInteger(saved.rngState) ? saved.rngState >>> 0 : runtime.rngState;
  runtime.revision = Math.max(0, Math.trunc(saved.revision ?? 0));
  runtime.lastTransition = saved.lastTransition ? structuredClone(saved.lastTransition) : null;
  runtime.diagnostics = Array.isArray(saved.diagnostics) ? [...saved.diagnostics] : [];
  return runtime;
}

export function serializeNavigationRuntime(runtime) {
  if (!runtime) return null;
  return structuredClone({
    schemaVersion: runtime.schemaVersion,
    definition: runtime.definition,
    currentNodeId: runtime.currentNodeId,
    selectedEdgeId: runtime.selectedEdgeId,
    previousNodeId: runtime.previousNodeId,
    axes: runtime.axes,
    targetAxes: runtime.targetAxes,
    musicMix: runtime.musicMix,
    targetMusicMix: runtime.targetMusicMix,
    history: runtime.history,
    rngState: runtime.rngState,
    revision: runtime.revision,
    lastTransition: runtime.lastTransition,
    diagnostics: runtime.diagnostics,
  });
}

export function navigationView(runtime, options = {}) {
  if (!runtime) return null;
  const index = runtimeIndex(runtime);
  const horizon = effectiveVisibleHorizon(runtime);
  const visibleIds = visibleNodeIds(index, runtime.currentNodeId, horizon);
  const revealHidden = options.revealHidden === true;
  const nodeIds = revealHidden ? new Set(index.nodes.keys()) : visibleIds;
  const nodes = [...nodeIds].map((id) => publicNode(index.nodes.get(id), id === runtime.currentNodeId));
  const edges = runtime.definition.edges
    .filter((edge) => edge.enabled && nodeIds.has(edge.from) && (revealHidden || nodeIds.has(edge.to)))
    .map(publicEdge);
  const choices = (index.outgoing.get(runtime.currentNodeId) ?? []).filter((edge) => edge.enabled).map((edge) => ({
    ...publicEdge(edge),
    target: publicNode(index.nodes.get(edge.to), false),
  }));
  return {
    graphId: runtime.definition.assetId,
    currentNodeId: runtime.currentNodeId,
    selectedEdgeId: runtime.selectedEdgeId,
    visibleHorizon: horizon,
    nodes,
    edges,
    choices,
    axes: options.includeHiddenState === true ? { ...runtime.axes } : undefined,
    musicMix: { ...runtime.musicMix },
    history: options.includeHiddenState === true ? structuredClone(runtime.history) : undefined,
    revision: runtime.revision,
  };
}

export function selectNavigationEdge(runtime, edgeId, options = {}) {
  if (!runtime) return { ok: false, reason: 'navigation-inactive' };
  const index = runtimeIndex(runtime);
  const edge = index.edges.get(edgeId);
  if (!edge || !edge.enabled) return { ok: false, reason: 'edge-unavailable', edgeId };
  if (edge.from !== runtime.currentNodeId) return { ok: false, reason: 'edge-not-outgoing', edgeId, currentNodeId: runtime.currentNodeId };
  const from = index.nodes.get(edge.from);
  const to = index.nodes.get(edge.to);
  const previousAlignment = runtime.targetAxes.alignment;
  runtime.previousNodeId = from.id;
  runtime.currentNodeId = to.id;
  runtime.selectedEdgeId = edge.id;
  runtime.targetAxes = axesForArrival(index, from, to, edge, runtime.targetAxes);
  updateNavigationHistory(runtime, edge, to, previousAlignment, options);
  runtime.targetAxes.recentTrend = trendFromHistory(runtime.history);
  runtime.targetAxes.fatePressure = clamp01(runtime.targetAxes.fatePressure + Math.min(0.24, runtime.history.repeatedNodes * 0.025));
  runtime.targetAxes.ambushRisk = clamp01(Math.max(runtime.targetAxes.ambushRisk, runtime.targetAxes.threat * runtime.targetAxes.fatePressure));
  runtime.targetMusicMix = navigationMusicMix(runtime.targetAxes);
  runtime.lastTransition = {
    edgeId: edge.id,
    from: from.id,
    to: to.id,
    levelId: to.levelId ?? null,
    nodeKind: to.kind,
    revision: runtime.revision + 1,
  };
  runtime.revision += 1;
  return { ok: true, transition: structuredClone(runtime.lastTransition), view: navigationView(runtime, options) };
}

export function selectNavigationNode(runtime, nodeId, options = {}) {
  const edge = (runtimeIndex(runtime).outgoing.get(runtime?.currentNodeId) ?? []).find((candidate) => candidate.to === nodeId && candidate.enabled);
  return edge ? selectNavigationEdge(runtime, edge.id, options) : { ok: false, reason: 'node-not-adjacent', nodeId };
}

export function stepNavigationRuntime(runtime, dt) {
  if (!runtime || !(dt > 0)) return runtime;
  const blend = 1 - Math.exp(-Math.min(dt, 0.25) / 0.8);
  for (const axis of NAVIGATION_AXES) runtime.axes[axis] = lerp(runtime.axes[axis], runtime.targetAxes[axis], blend);
  for (const key of Object.keys(runtime.targetMusicMix)) runtime.musicMix[key] = lerp(runtime.musicMix[key] ?? 0, runtime.targetMusicMix[key], blend);
  return runtime;
}

export function updateNavigationSignals(runtime, patch = {}) {
  if (!runtime) return null;
  runtime.targetAxes = normalizeAxes({ ...runtime.targetAxes, ...patch }, runtime.targetAxes);
  runtime.targetMusicMix = navigationMusicMix(runtime.targetAxes);
  runtime.revision += 1;
  return { ...runtime.targetAxes };
}

export function recordNavigationOutcome(runtime, outcome = {}) {
  if (!runtime) return null;
  if (outcome.failedEncounter) runtime.history.failedEncounters += 1;
  if (outcome.restoredAnchor) runtime.history.restoredAnchors += 1;
  if (outcome.listenedBeforeChoosing) runtime.history.listenedBeforeChoosing += 1;
  const patch = {};
  if (outcome.failedEncounter) patch.fatePressure = runtime.targetAxes.fatePressure + 0.08;
  if (outcome.restoredAnchor) {
    patch.roadCoherence = runtime.targetAxes.roadCoherence + 0.1;
    patch.clarity = runtime.targetAxes.clarity + 0.08;
  }
  return updateNavigationSignals(runtime, patch);
}

export function navigationMusicMix(axes = DEFAULT_AXES) {
  const positiveAlignment = Math.max(0, axes.alignment ?? 0);
  const roadBearing = positiveAlignment * clamp01(axes.roadCoherence) * clamp01(axes.clarity);
  const fatePressure = Math.max(clamp01(axes.fatePressure), clamp01(axes.threat) * 0.5) * (1 - clamp01(axes.roadCoherence) * 0.25);
  return {
    baseFog: 1,
    roadBearing: clamp01(roadBearing),
    fatePressure: clamp01(fatePressure),
    destinationEcho: clamp01(axes.destinationSignal) * clamp01(axes.clarity),
    dangerLayer: clamp01(axes.threat),
    ambushLayer: smoothstep(0.7, 1, clamp01(axes.ambushRisk)),
  };
}

function indexNavigationGraph(graph) {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const outgoing = new Map(graph.nodes.map((node) => [node.id, []]));
  const incoming = new Map(graph.nodes.map((node) => [node.id, []]));
  for (const edge of graph.edges) {
    outgoing.get(edge.from)?.push(edge);
    incoming.get(edge.to)?.push(edge);
  }
  const destinationDistances = distancesToDestinations(graph, incoming);
  return { graph, nodes, edges, outgoing, incoming, destinationDistances };
}

function runtimeIndex(runtime) {
  if (runtime._index?.graph === runtime.definition) return runtime._index;
  const index = indexNavigationGraph(runtime.definition);
  Object.defineProperty(runtime, '_index', { value: index, writable: true, configurable: true, enumerable: false });
  return index;
}

function axesForArrival(index, from, to, edge, previous) {
  const result = normalizeAxes(previous, DEFAULT_AXES);
  const topologyAlignment = alignmentForMove(index, from?.id, to?.id);
  const nodeSignals = to?.signals ?? {};
  const edgeSignals = edge?.signals ?? {};
  result.alignment = finiteOr(edgeSignals.alignment, finiteOr(nodeSignals.alignment, topologyAlignment));
  for (const axis of NAVIGATION_AXES) {
    if (axis === 'alignment' || axis === 'recentTrend') continue;
    if (Number.isFinite(nodeSignals[axis])) result[axis] = nodeSignals[axis];
    if (Number.isFinite(edgeSignals[axis])) result[axis] = edgeSignals[axis];
  }
  const distance = index.destinationDistances.get(to?.id);
  if (!Number.isFinite(nodeSignals.destinationSignal) && !Number.isFinite(edgeSignals.destinationSignal) && Number.isFinite(distance)) {
    result.destinationSignal = 1 / (1 + distance);
  }
  return normalizeAxes(result, DEFAULT_AXES);
}

function alignmentForMove(index, fromId, toId) {
  if (!fromId || !toId) return 0;
  const fromDistance = index.destinationDistances.get(fromId);
  const toDistance = index.destinationDistances.get(toId);
  if (!Number.isFinite(fromDistance) || !Number.isFinite(toDistance) || fromDistance === toDistance) return 0;
  return clamp((fromDistance - toDistance) / Math.max(1, fromDistance), -1, 1);
}

function distancesToDestinations(graph, incoming) {
  const distances = new Map();
  const queue = graph.nodes.filter(isDestinationNode).map((node) => node.id);
  for (const id of queue) distances.set(id, 0);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const nodeId = queue[cursor];
    const distance = distances.get(nodeId);
    for (const edge of incoming.get(nodeId) ?? []) {
      if (!edge.enabled || distances.has(edge.from)) continue;
      distances.set(edge.from, distance + 1);
      queue.push(edge.from);
    }
  }
  return distances;
}

function visibleNodeIds(index, startId, horizon) {
  const visible = new Set([startId]);
  const queue = [{ id: startId, depth: 0 }];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const { id, depth } = queue[cursor];
    if (depth >= horizon) continue;
    for (const edge of index.outgoing.get(id) ?? []) {
      if (!edge.enabled || visible.has(edge.to)) continue;
      visible.add(edge.to);
      queue.push({ id: edge.to, depth: depth + 1 });
    }
  }
  return visible;
}

function effectiveVisibleHorizon(runtime) {
  const bonus = runtime.axes.roadCoherence >= 0.75 && runtime.axes.clarity >= 0.65 ? 1 : 0;
  const penalty = runtime.axes.clarity < 0.2 || runtime.axes.fatePressure > 0.88 ? 1 : 0;
  return clampInteger(runtime.definition.visibleHorizon + bonus - penalty, 1, 4);
}

function publicNode(node, current) {
  return {
    id: node.id,
    kind: node.kind,
    levelId: node.levelId ?? null,
    title: node.title ?? node.displayName ?? node.id,
    description: node.description ?? '',
    tags: [...(node.publicTags ?? [])],
    preview: node.preview ? structuredClone(node.preview) : null,
    current,
  };
}

function publicEdge(edge) {
  return {
    id: edge.id,
    from: edge.from,
    to: edge.to,
    title: edge.title ?? edge.label ?? edge.id,
    preview: edge.preview ? structuredClone(edge.preview) : null,
    tags: [...(edge.publicTags ?? [])],
  };
}

function updateNavigationHistory(runtime, edge, node, previousAlignment, options) {
  const history = runtime.history;
  history.selectedEdgeIds.push(edge.id);
  history.visitedNodeIds.push(node.id);
  history.visitCounts[node.id] = (history.visitCounts[node.id] ?? 0) + 1;
  if (history.visitCounts[node.id] > 1) history.repeatedNodes += 1;
  if (runtime.targetAxes.alignment > previousAlignment || runtime.targetAxes.alignment > 0) {
    history.consecutiveTowardChoices += 1;
    history.consecutiveAwayChoices = 0;
  } else if (runtime.targetAxes.alignment < previousAlignment || runtime.targetAxes.alignment < 0) {
    history.consecutiveAwayChoices += 1;
    history.consecutiveTowardChoices = 0;
  } else {
    history.consecutiveAwayChoices = 0;
    history.consecutiveTowardChoices = 0;
  }
  if (options.listenedBeforeChoosing) history.listenedBeforeChoosing += 1;
}

function trendFromHistory(history) {
  const toward = Math.min(4, history.consecutiveTowardChoices) / 4;
  const away = Math.min(4, history.consecutiveAwayChoices) / 4;
  return clamp(toward - away, -1, 1);
}

function normalizeSignals(signals) {
  if (!isPlainObject(signals)) return {};
  const result = {};
  for (const axis of NAVIGATION_AXES) {
    if (Number.isFinite(signals[axis])) result[axis] = clamp(signals[axis], axis === 'alignment' || axis === 'recentTrend' ? -1 : 0, 1);
  }
  return result;
}

function validateSignals(signals, label, errors) {
  for (const [key, value] of Object.entries(signals ?? {})) {
    if (!NAVIGATION_AXES.includes(key)) errors.push(`${label}.${key} is not a supported navigation axis.`);
    else if (!Number.isFinite(value)) errors.push(`${label}.${key} must be finite.`);
    else if ((key === 'alignment' || key === 'recentTrend') ? value < -1 || value > 1 : value < 0 || value > 1) {
      errors.push(`${label}.${key} is outside its supported range.`);
    }
  }
}

function normalizeAxes(source, fallback = DEFAULT_AXES) {
  const result = {};
  for (const axis of NAVIGATION_AXES) {
    const minimum = axis === 'alignment' || axis === 'recentTrend' ? -1 : 0;
    result[axis] = clamp(finiteOr(source?.[axis], fallback?.[axis] ?? DEFAULT_AXES[axis]), minimum, 1);
  }
  return result;
}

function normalizeMix(source, fallback) {
  return Object.fromEntries(Object.keys(fallback).map((key) => [key, clamp01(finiteOr(source?.[key], fallback[key]))]));
}

function normalizeHistory(history, currentNodeId) {
  const source = isPlainObject(history) ? history : {};
  return {
    visitedNodeIds: Array.isArray(source.visitedNodeIds) ? [...source.visitedNodeIds] : [currentNodeId],
    selectedEdgeIds: Array.isArray(source.selectedEdgeIds) ? [...source.selectedEdgeIds] : [],
    visitCounts: isPlainObject(source.visitCounts) ? { ...source.visitCounts } : { [currentNodeId]: 1 },
    repeatedNodes: Math.max(0, Math.trunc(source.repeatedNodes ?? 0)),
    consecutiveAwayChoices: Math.max(0, Math.trunc(source.consecutiveAwayChoices ?? 0)),
    consecutiveTowardChoices: Math.max(0, Math.trunc(source.consecutiveTowardChoices ?? 0)),
    failedEncounters: Math.max(0, Math.trunc(source.failedEncounters ?? 0)),
    restoredAnchors: Math.max(0, Math.trunc(source.restoredAnchors ?? 0)),
    listenedBeforeChoosing: Math.max(0, Math.trunc(source.listenedBeforeChoosing ?? 0)),
  };
}

function reachableNodes(graph, initialNode) {
  const outgoing = new Map(graph.nodes.map((node) => [node.id, []]));
  for (const edge of graph.edges) if (edge.enabled) outgoing.get(edge.from)?.push(edge.to);
  const reached = new Set(initialNode ? [initialNode] : []);
  const queue = [...reached];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const id of outgoing.get(queue[cursor]) ?? []) {
      if (reached.has(id)) continue;
      reached.add(id);
      queue.push(id);
    }
  }
  return reached;
}

function isDestinationNode(node) {
  return node.kind === 'boss' && node.destination === true || node.destination === true || node.tags?.includes('destination');
}

function deriveSeed(seed, text, offset) {
  let state = (Number(seed) || 1) >>> 0;
  for (const character of String(text ?? '')) state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
  return (state + (offset >>> 0)) >>> 0 || 1;
}

function positiveNumber(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / Math.max(0.000001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clampInteger(value, min, max) {
  return Math.max(min, Math.min(max, Math.trunc(Number(value) || min)));
}

function clamp01(value) {
  return clamp(Number(value) || 0, 0, 1);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}
