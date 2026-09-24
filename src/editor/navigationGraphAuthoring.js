export const NAVIGATION_NODE_KINDS = ['level', 'encounter', 'relay', 'hazard', 'station', 'puzzle', 'boss', 'repair', 'unknown'];
export const NAVIGATION_EDGE_VISIBILITY = ['VISIBLE', 'FOGGED', 'CONDITIONAL', 'UNSTABLE', 'FALSE_ECHO'];
export const NAVIGATION_AXES = ['alignment', 'threat', 'clarity', 'fatePressure', 'roadCoherence', 'destinationSignal', 'recentTrend', 'ambushRisk'];

export function emptyNavigationGraph() {
  return {
    schemaVersion: '0.1',
    assetId: 'navigation.local',
    initialNode: 'relay-entry',
    visibleHorizon: 2,
    seedOffset: 0,
    nodes: [createNavigationNode({ id: 'relay-entry', displayName: 'Relay Entry', kind: 'relay', x: 0, y: 0 })],
    edges: [],
  };
}

export function createNavigationNode(options = {}) {
  const kind = NAVIGATION_NODE_KINDS.includes(options.kind) ? options.kind : 'level';
  const assetRef = text(options.assetRef);
  const node = {
    id: identifier(options.id, 'node'),
    title: text(options.displayName ?? options.title) || 'Navigation Node',
    kind,
    editorPosition: [finite(options.x, 0), finite(options.y, 0)],
    signals: normalizeNavigationAxes(options.signals ?? options.navigation),
    tags: list(options.tags),
  };
  if (assetRef) {
    if (kind === 'level') node.levelId = assetRef;
    else if (kind === 'encounter') node.encounterId = assetRef;
    else node.assetRef = assetRef;
  }
  if (options.destination === true || node.tags.includes('destination')) node.destination = true;
  return node;
}

export function createNavigationEdge(options = {}) {
  return {
    id: identifier(options.id, 'edge'),
    from: text(options.from),
    to: text(options.to),
    label: text(options.label) || 'Route',
    visibility: NAVIGATION_EDGE_VISIBILITY.includes(options.visibility) ? options.visibility : 'VISIBLE',
    bidirectional: options.bidirectional === true,
    enabled: options.enabled !== false,
    weight: positive(options.weight, 1),
    signals: normalizeSignalOverrides(options.signals ?? options.navigationDelta ?? options.navigation),
    requiredFlags: list(options.requiredFlags),
    blockedFlags: list(options.blockedFlags),
    tags: list(options.tags),
  };
}

export function normalizeNavigationGraph(graph = {}) {
  const source = graph && typeof graph === 'object' ? graph : {};
  return {
    schemaVersion: text(source.schemaVersion) || '0.1',
    assetId: text(source.assetId) || 'navigation.local',
    initialNode: text(source.initialNode),
    visibleHorizon: integerRange(source.visibleHorizon, 1, 4, 2),
    seedOffset: Math.trunc(finite(source.seedOffset, 0)),
    nodes: Array.isArray(source.nodes) ? source.nodes.map(normalizeNode) : [],
    edges: Array.isArray(source.edges) ? source.edges.map(normalizeEdge) : [],
    adaptiveMusic: normalizeAdaptiveMusic(source.adaptiveMusic),
  };
}

export function validateNavigationGraph(graph) {
  const errors = [];
  const warnings = [];
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) return { valid: false, errors: ['navigationGraph must be an object.'], warnings };
  const normalized = normalizeNavigationGraph(graph);
  if (!normalized.assetId) errors.push('navigationGraph.assetId is required.');
  if (!normalized.initialNode) errors.push('navigationGraph.initialNode is required.');
  if (normalized.nodes.length === 0) errors.push('navigationGraph.nodes must include at least one node.');

  const nodeIds = new Set();
  normalized.nodes.forEach((node, index) => {
    const label = `navigationGraph.nodes[${index}]`;
    if (!node.id) errors.push(`${label}.id is required.`);
    else if (nodeIds.has(node.id)) errors.push(`${label}.id "${node.id}" is duplicated.`);
    else nodeIds.add(node.id);
    if (!NAVIGATION_NODE_KINDS.includes(node.kind)) errors.push(`${label}.kind is not supported.`);
    validateAxisValues(node.signals, `${label}.signals`, errors);
  });
  if (normalized.initialNode && !nodeIds.has(normalized.initialNode)) errors.push(`navigationGraph.initialNode references unknown node "${normalized.initialNode}".`);

  const edgeIds = new Set();
  normalized.edges.forEach((edge, index) => {
    const label = `navigationGraph.edges[${index}]`;
    if (!edge.id) errors.push(`${label}.id is required.`);
    else if (edgeIds.has(edge.id)) errors.push(`${label}.id "${edge.id}" is duplicated.`);
    else edgeIds.add(edge.id);
    if (!nodeIds.has(edge.from)) errors.push(`${label}.from references unknown node "${edge.from || 'missing'}".`);
    if (!nodeIds.has(edge.to)) errors.push(`${label}.to references unknown node "${edge.to || 'missing'}".`);
    if (edge.from && edge.from === edge.to) warnings.push(`${label} loops back to the same node.`);
    if (!(edge.weight > 0)) errors.push(`${label}.weight must be positive.`);
    if (!NAVIGATION_EDGE_VISIBILITY.includes(edge.visibility)) errors.push(`${label}.visibility is not supported.`);
    validateDeltaValues(edge.signals, `${label}.signals`, errors);
  });

  if (nodeIds.has(normalized.initialNode)) {
    const reachable = reachableNodeIds(normalized);
    for (const node of normalized.nodes) {
      if (!reachable.has(node.id)) warnings.push(`Node "${node.id}" is unreachable from initialNode.`);
      const outgoing = normalized.edges.some((edge) => edge.enabled && edge.from === node.id);
      if (!outgoing && node.kind !== 'boss') warnings.push(`Node "${node.id}" has no outgoing route.`);
    }
  }
  return { valid: errors.length === 0, errors, warnings, graph: normalized };
}

export function previewNavigationScore(node, edge = null) {
  const base = normalizeNavigationAxes(node?.signals ?? node?.navigation);
  const overrides = normalizeSignalOverrides(edge?.signals ?? edge?.navigationDelta ?? edge?.navigation);
  const state = {};
  for (const axis of NAVIGATION_AXES) {
    const min = axis === 'alignment' || axis === 'recentTrend' ? -1 : 0;
    state[axis] = clamp(Number.isFinite(overrides[axis]) ? overrides[axis] : base[axis], min, 1);
  }
  const mix = {
    baseFog: 1,
    roadBearing: clamp(Math.max(0, state.alignment) * state.roadCoherence * state.clarity, 0, 1),
    fatePressure: clamp(Math.max(state.fatePressure, state.threat * 0.5) * (1 - state.roadCoherence * 0.25), 0, 1),
    destinationEcho: clamp(state.destinationSignal * state.clarity, 0, 1),
    dangerLayer: state.threat,
    ambushLayer: smoothstep(0.7, 1, state.ambushRisk),
  };
  return { state, mix, label: navigationStateLabel(state) };
}

export function createNavigationGraphExample() {
  return normalizeNavigationGraph({
    schemaVersion: '0.1',
    assetId: 'navigation.example.relay_web',
    initialNode: 'relay-entry',
    visibleHorizon: 2,
    seedOffset: 14,
    adaptiveMusic: { profile: 'relay-web', carryIntoLevel: true, afterimageFromLevel: true },
    nodes: [
      createNavigationNode({ id: 'relay-entry', displayName: 'Broken Relay', kind: 'relay', x: 0, y: 0, navigation: { clarity: 0.55, roadCoherence: 0.35, destinationSignal: 0.2 } }),
      createNavigationNode({ id: 'danger-bearing', displayName: 'Beacon Through Fog', kind: 'level', assetRef: 'level.beacon_through_fog', x: 1, y: -1, navigation: { alignment: 0.7, threat: 0.72, clarity: 0.5, roadCoherence: 0.55, destinationSignal: 0.46 } }),
      createNavigationNode({ id: 'false-familiarity', displayName: 'False Familiarity', kind: 'encounter', assetRef: 'encounter.false_familiarity', x: 1, y: 1, navigation: { alignment: -0.45, threat: 0.22, clarity: 0.7, fatePressure: 0.68 } }),
      createNavigationNode({ id: 'road-recovered', displayName: 'Road Recovered', kind: 'relay', x: 2, y: 0, tags: ['destination'], destination: true, navigation: { alignment: 0.9, threat: 0.4, clarity: 0.82, roadCoherence: 0.84, destinationSignal: 0.65 } }),
    ],
    edges: [
      createNavigationEdge({ id: 'entry-danger', from: 'relay-entry', to: 'danger-bearing', label: 'Unstable true bearing', visibility: 'FOGGED', navigationDelta: { threat: 0.12, alignment: 0.08 } }),
      createNavigationEdge({ id: 'entry-false', from: 'relay-entry', to: 'false-familiarity', label: 'Comfortable shortcut', visibility: 'FALSE_ECHO', navigationDelta: { fatePressure: 0.14, clarity: -0.08 } }),
      createNavigationEdge({ id: 'danger-recovery', from: 'danger-bearing', to: 'road-recovered', label: 'Hold the open question', visibility: 'CONDITIONAL', requiredFlags: ['anchor.restored'] }),
      createNavigationEdge({ id: 'false-loop', from: 'false-familiarity', to: 'relay-entry', label: 'Reflected signal', visibility: 'UNSTABLE' }),
    ],
  });
}

function normalizeNode(node = {}) {
  const normalized = {
    id: text(node.id),
    title: text(node.title ?? node.displayName) || text(node.id),
    kind: text(node.kind) || 'level',
    editorPosition: vector2(node.editorPosition),
    signals: normalizeNavigationAxes(node.signals ?? node.navigation),
    tags: list(node.tags),
  };
  const assetRef = text(node.levelId ?? node.encounterId ?? node.assetRef);
  if (assetRef) {
    if (normalized.kind === 'level') normalized.levelId = assetRef;
    else if (normalized.kind === 'encounter') normalized.encounterId = assetRef;
    else normalized.assetRef = assetRef;
  }
  if (node.destination === true || normalized.tags.includes('destination')) normalized.destination = true;
  return normalized;
}

function normalizeEdge(edge = {}) {
  return {
    id: text(edge.id),
    from: text(edge.from),
    to: text(edge.to),
    label: text(edge.label) || text(edge.id),
    visibility: text(edge.visibility) || 'VISIBLE',
    bidirectional: edge.bidirectional === true,
    enabled: edge.enabled !== false,
    weight: finite(edge.weight, 1),
    signals: normalizeSignalOverrides(edge.signals ?? edge.navigationDelta ?? edge.navigation),
    requiredFlags: list(edge.requiredFlags),
    blockedFlags: list(edge.blockedFlags),
    tags: list(edge.tags),
  };
}

function normalizeNavigationAxes(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(NAVIGATION_AXES.map((axis) => [axis, clamp(finite(source[axis], axis === 'clarity' ? 0.5 : 0), axis === 'alignment' || axis === 'recentTrend' ? -1 : 0, 1)]));
}

function normalizeSignalOverrides(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const result = {};
  for (const axis of NAVIGATION_AXES) {
    if (!Number.isFinite(Number(source[axis]))) continue;
    result[axis] = clamp(Number(source[axis]), axis === 'alignment' || axis === 'recentTrend' ? -1 : 0, 1);
  }
  return result;
}

function normalizeAdaptiveMusic(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    profile: text(source.profile) || 'relay-web',
    carryIntoLevel: source.carryIntoLevel !== false,
    afterimageFromLevel: source.afterimageFromLevel !== false,
  };
}

function validateAxisValues(value, label, errors) {
  for (const axis of NAVIGATION_AXES) {
    const number = value[axis];
    const min = axis === 'alignment' || axis === 'recentTrend' ? -1 : 0;
    if (!Number.isFinite(number) || number < min || number > 1) errors.push(`${label}.${axis} must be between ${min} and 1.`);
  }
}

function validateDeltaValues(value, label, errors) {
  for (const [axis, number] of Object.entries(value)) {
    const minimum = axis === 'alignment' || axis === 'recentTrend' ? -1 : 0;
    if (!NAVIGATION_AXES.includes(axis)) errors.push(`${label}.${axis} is not supported.`);
    else if (!Number.isFinite(number) || number < minimum || number > 1) errors.push(`${label}.${axis} must be between ${minimum} and 1.`);
  }
}

function reachableNodeIds(graph) {
  const found = new Set([graph.initialNode]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of graph.edges) {
      if (edge.enabled && found.has(edge.from) && !found.has(edge.to)) { found.add(edge.to); changed = true; }
    }
  }
  return found;
}

function navigationStateLabel(state) {
  if (state.ambushRisk >= 0.8) return 'Ambush Vector';
  if (state.alignment >= 0.65 && state.threat <= 0.55) return 'Beacon Through Fog';
  if (state.alignment > 0.2 && state.threat > 0.55) return 'Faint Bearing';
  if (state.alignment <= -0.45 && state.threat >= 0.65) return 'Closing Web';
  if (state.alignment < -0.2 && state.threat < 0.45) return 'Drifting Current';
  if (state.alignment <= 0 && state.fatePressure >= 0.55) return 'False Familiarity';
  if (state.threat >= 0.65) return 'Danger Adjacent';
  return state.alignment > 0 ? 'True Bearing' : 'Lost Between Anchors';
}

function list(value) {
  if (Array.isArray(value)) return [...new Set(value.map(text).filter(Boolean))];
  return text(value).split(/[,\n]+/).map(text).filter(Boolean);
}

function vector2(value) {
  return Array.isArray(value) ? [finite(value[0], 0), finite(value[1], 0)] : [0, 0];
}

function text(value) { return String(value ?? '').trim(); }
function identifier(value, fallback) { return text(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '') || fallback; }
function finite(value, fallback) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function positive(value, fallback) { const number = finite(value, fallback); return number > 0 ? number : fallback; }
function integerRange(value, min, max, fallback) { return Math.round(clamp(finite(value, fallback), min, max)); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function smoothstep(min, max, value) { const t = clamp((value - min) / (max - min || 1), 0, 1); return t * t * (3 - 2 * t); }
