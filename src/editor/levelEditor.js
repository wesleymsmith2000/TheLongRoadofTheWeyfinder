import { CANON_STATUSES, CONTENT_SCHEMA_VERSION } from '../core/contentSchema.js';
import {
  LEVEL_BACKGROUND_MODES,
  collectLevelDependencies,
  createLevelPackagePlan,
  validateLevelDefinition,
} from '../core/levelDefinition.js';
import { bindBuildVersion } from './versionBadge.js';
import { consumeEditorAssetHandoff } from './editorAssetHandoff.js';
import {
  NAVIGATION_AXES,
  NAVIGATION_EDGE_VISIBILITY,
  NAVIGATION_NODE_KINDS,
  createNavigationEdge,
  createNavigationGraphExample,
  createNavigationNode,
  emptyNavigationGraph,
  normalizeNavigationGraph,
  previewNavigationScore,
  validateNavigationGraph,
} from './navigationGraphAuthoring.js';
import prototypeLevelDefinition from '../../content/levels/prototype0_road_trial.json' with { type: 'json' };

const canvas = document.querySelector('#levelCanvas');
const context = canvas.getContext('2d');
const jsonOutput = document.querySelector('#jsonOutput');
const statusPanel = document.querySelector('#statusPanel');
const dependencyList = document.querySelector('#dependencyList');
const downloadButton = document.querySelector('#downloadButton');
const resetButton = document.querySelector('#resetButton');
const applyJsonButton = document.querySelector('#applyJsonButton');
const copyJsonButton = document.querySelector('#copyJsonButton');
const navigationJsonOutput = document.querySelector('#navigationJsonOutput');
const navigationScorePreview = document.querySelector('#navigationScorePreview');
const navigationControls = Object.fromEntries(
  [
    'navigationAssetIdInput', 'navigationSeedOffsetInput', 'navigationInitialNodeSelect', 'navigationHorizonInput', 'loadNavigationExampleButton', 'applyNavigationJsonButton',
    'navigationNodeSelect', 'navigationNodeIdInput', 'navigationNodeKindSelect', 'navigationNodeNameInput',
    'navigationNodeAssetInput', 'navigationNodeXInput', 'navigationNodeYInput', 'navigationAlignmentInput',
    'navigationThreatInput', 'navigationClarityInput', 'navigationFateInput', 'navigationRoadInput',
    'navigationSignalInput', 'navigationAmbushInput', 'navigationNodeTagsInput', 'saveNavigationNodeButton',
    'removeNavigationNodeButton', 'navigationEdgeSelect', 'navigationEdgeIdInput', 'navigationEdgeVisibilitySelect',
    'navigationEdgeFromSelect', 'navigationEdgeToSelect', 'navigationEdgeLabelInput', 'navigationEdgeWeightInput',
    'navigationEdgeDeltaInput', 'navigationRequiredFlagsInput',
    'navigationBlockedFlagsInput', 'saveNavigationEdgeButton', 'removeNavigationEdgeButton',
    'routePreviewButton', 'graphPreviewButton',
  ].map((id) => [id, document.querySelector(`#${id}`)]),
);

bindBuildVersion();

const fields = Object.fromEntries(
  [
    'assetIdInput',
    'displayNameInput',
    'schemaInput',
    'canonStatusSelect',
    'tagsInput',
    'backgroundModeSelect',
    'startHeadingInput',
    'segmentCountInput',
    'turnScaleInput',
    'waveCountInput',
    'obstacleCountInput',
    'triggerCountInput',
    'seedOffsetInput',
  ].map((id) => [id, document.querySelector(`#${id}`)]),
);

let level = clone(prototypeLevelDefinition);
let navigationGraph = normalizeNavigationGraph(level.navigationGraph ?? emptyNavigationGraph());
let selectedNavigationNodeId = navigationGraph.nodes[0]?.id ?? '';
let selectedNavigationEdgeId = navigationGraph.edges[0]?.id ?? '';
let previewMode = 'route';

for (const status of CANON_STATUSES) fields.canonStatusSelect.append(new Option(status, status));
for (const mode of LEVEL_BACKGROUND_MODES) fields.backgroundModeSelect.append(new Option(mode, mode));
for (const kind of NAVIGATION_NODE_KINDS) navigationControls.navigationNodeKindSelect.append(new Option(kind, kind));
for (const visibility of NAVIGATION_EDGE_VISIBILITY) navigationControls.navigationEdgeVisibilitySelect.append(new Option(visibility, visibility));

for (const field of Object.values(fields)) field.addEventListener('input', renderFromFields);
resetButton.addEventListener('click', () => loadLevel(prototypeLevelDefinition));
applyJsonButton.addEventListener('click', applyJson);
copyJsonButton.addEventListener('click', async () => navigator.clipboard.writeText(jsonOutput.value));
downloadButton.addEventListener('click', downloadJson);
navigationControls.navigationNodeSelect.addEventListener('change', () => {
  selectedNavigationNodeId = navigationControls.navigationNodeSelect.value;
  syncNavigationFields();
  render();
});
navigationControls.navigationEdgeSelect.addEventListener('change', () => {
  selectedNavigationEdgeId = navigationControls.navigationEdgeSelect.value;
  syncNavigationFields();
  render();
});
navigationControls.navigationInitialNodeSelect.addEventListener('change', () => {
  navigationGraph.initialNode = navigationControls.navigationInitialNodeSelect.value;
  renderFromNavigation();
});
navigationControls.navigationHorizonInput.addEventListener('input', () => {
  navigationGraph.visibleHorizon = Number(navigationControls.navigationHorizonInput.value);
  renderFromNavigation();
});
navigationControls.navigationAssetIdInput.addEventListener('input', () => {
  navigationGraph.assetId = navigationControls.navigationAssetIdInput.value.trim();
  renderFromNavigation();
});
navigationControls.navigationSeedOffsetInput.addEventListener('input', () => {
  navigationGraph.seedOffset = Math.trunc(Number(navigationControls.navigationSeedOffsetInput.value) || 0);
  renderFromNavigation();
});
navigationControls.loadNavigationExampleButton.addEventListener('click', () => loadNavigationGraph(createNavigationGraphExample()));
navigationControls.applyNavigationJsonButton.addEventListener('click', applyNavigationJson);
navigationControls.saveNavigationNodeButton.addEventListener('click', saveNavigationNode);
navigationControls.removeNavigationNodeButton.addEventListener('click', removeNavigationNode);
navigationControls.saveNavigationEdgeButton.addEventListener('click', saveNavigationEdge);
navigationControls.removeNavigationEdgeButton.addEventListener('click', removeNavigationEdge);
navigationControls.routePreviewButton.addEventListener('click', () => setPreviewMode('route'));
navigationControls.graphPreviewButton.addEventListener('click', () => setPreviewMode('graph'));
for (const id of ['navigationAlignmentInput', 'navigationThreatInput', 'navigationClarityInput', 'navigationFateInput', 'navigationRoadInput', 'navigationSignalInput', 'navigationAmbushInput']) {
  navigationControls[id].addEventListener('input', renderNavigationScorePreview);
}

loadLevel(level);
const creatorHandoff = consumeEditorAssetHandoff(['level']);
if (creatorHandoff) loadLevel(creatorHandoff.definition);

function loadLevel(nextLevel) {
  level = clone(nextLevel);
  navigationGraph = normalizeNavigationGraph(level.navigationGraph ?? emptyNavigationGraph());
  selectedNavigationNodeId = navigationGraph.nodes[0]?.id ?? '';
  selectedNavigationEdgeId = navigationGraph.edges[0]?.id ?? '';
  syncLevelToFields();
  syncNavigationFields();
  render();
}

function syncLevelToFields() {
  fields.assetIdInput.value = level.assetId ?? '';
  fields.displayNameInput.value = level.displayName ?? '';
  fields.schemaInput.value = level.schemaVersion ?? CONTENT_SCHEMA_VERSION;
  fields.canonStatusSelect.value = level.canonStatus ?? 'EXPERIMENTAL';
  fields.tagsInput.value = (level.tags ?? []).join(', ');
  fields.backgroundModeSelect.value = level.background?.mode ?? 'mixed';
  fields.startHeadingInput.value = level.route?.startHeading ?? 0;
  fields.segmentCountInput.value = level.route?.segments?.length ?? 1;
  fields.turnScaleInput.value = 1;
  fields.waveCountInput.value = level.waves?.length ?? 0;
  fields.obstacleCountInput.value = level.obstacles?.length ?? 0;
  fields.triggerCountInput.value = level.triggers?.length ?? 0;
  fields.seedOffsetInput.value = level.background?.layers?.[0]?.seedOffset ?? 0;
}

function renderFromFields() {
  level = levelFromFields();
  render();
}

function levelFromFields() {
  const next = {
    ...level,
    schemaVersion: fields.schemaInput.value.trim(),
    assetId: fields.assetIdInput.value.trim(),
    displayName: fields.displayNameInput.value.trim(),
    canonStatus: fields.canonStatusSelect.value,
    tags: fields.tagsInput.value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    background: {
      ...(level.background ?? {}),
      mode: fields.backgroundModeSelect.value,
      layers: ensureBackgroundLayers(level.background?.layers ?? [], Number(fields.seedOffsetInput.value)),
    },
    route: {
      ...(level.route ?? {}),
      startHeading: Number(fields.startHeadingInput.value),
      segments: resizeRouteSegments(level.route?.segments ?? [], Number(fields.segmentCountInput.value), Number(fields.turnScaleInput.value)),
    },
    waves: resizeWaves(level.waves ?? [], Number(fields.waveCountInput.value)),
    obstacles: resizeObstacles(level.obstacles ?? [], Number(fields.obstacleCountInput.value)),
    triggers: resizeTriggers(level.triggers ?? [], Number(fields.triggerCountInput.value)),
    navigationGraph: normalizeNavigationGraph(navigationGraph),
  };
  next.dependencies = collectLevelDependencies(next).filter((dependency) => ['construct', 'pattern', 'pack'].includes(dependency.kind));
  return next;
}

function ensureBackgroundLayers(layers, seedOffset) {
  const next = layers.length > 0 ? clone(layers) : [{ id: 'road-grid', source: 'procedural', generator: 'road_grid', parallax: 0.2 }];
  next[0].seedOffset = Number.isFinite(seedOffset) ? seedOffset : 0;
  return next;
}

function resizeRouteSegments(segments, count, turnScale) {
  const target = Math.max(1, Math.floor(count || 1));
  const next = clone(segments);
  while (next.length < target) next.push({ id: `segment-${next.length + 1}`, length: 420, turnRadians: next.length % 2 === 0 ? 0.25 : -0.25 });
  next.length = target;
  const scale = Number.isFinite(turnScale) ? turnScale : 1;
  return next.map((segment) => ({ ...segment, turnRadians: (segment.turnRadians ?? 0) * scale }));
}

function resizeWaves(waves, count) {
  const target = Math.max(0, Math.floor(count || 0));
  const next = clone(waves);
  while (next.length < target) {
    next.push({
      id: `wave-${next.length + 1}`,
      atDistance: 220 + next.length * 360,
      spawn: [{ construct: 'basic_turret', count: 1, laneOffset: 0, spacing: 120, patterns: ['enemy_aimed_shot'] }],
    });
  }
  next.length = target;
  return next;
}

function resizeObstacles(obstacles, count) {
  const target = Math.max(0, Math.floor(count || 0));
  const next = clone(obstacles);
  while (next.length < target) {
    next.push({
      id: `obstacle-${next.length + 1}`,
      kind: 'procedural_field',
      atDistance: 300 + next.length * 260,
      laneOffset: next.length % 2 === 0 ? -120 : 120,
      width: 90,
      height: 140,
      density: 0.12,
      assetRef: null,
    });
  }
  next.length = target;
  return next;
}

function resizeTriggers(triggers, count) {
  const target = Math.max(0, Math.floor(count || 0));
  const next = clone(triggers);
  while (next.length < target) {
    const index = next.length;
    const triggerKind = ['cue', 'voiceover', 'encounter'][index % 3];
    next.push({
      id: `trigger-${index + 1}`,
      kind: triggerKind,
      atDistance: 80 + index * 300,
      assetRef: triggerKind === 'voiceover' ? `voiceover.${index + 1}` : triggerKind === 'encounter' ? 'encounter.moonlit_beacon_choice_vignette' : undefined,
      message: triggerKind === 'cue' ? 'Cue event' : undefined,
      once: true,
    });
  }
  next.length = target;
  return next;
}

function loadNavigationGraph(nextGraph) {
  navigationGraph = normalizeNavigationGraph(nextGraph);
  selectedNavigationNodeId = navigationGraph.nodes[0]?.id ?? '';
  selectedNavigationEdgeId = navigationGraph.edges[0]?.id ?? '';
  syncNavigationFields();
  renderFromNavigation();
}

function renderFromNavigation() {
  navigationGraph = normalizeNavigationGraph(navigationGraph);
  level = levelFromFields();
  syncNavigationFields();
  render();
}

function syncNavigationFields() {
  populateNavigationSelects();
  navigationControls.navigationAssetIdInput.value = navigationGraph.assetId ?? 'navigation.local';
  navigationControls.navigationSeedOffsetInput.value = String(navigationGraph.seedOffset ?? 0);
  navigationControls.navigationHorizonInput.value = navigationGraph.visibleHorizon ?? 2;

  const node = navigationGraph.nodes.find((candidate) => candidate.id === selectedNavigationNodeId) ?? navigationGraph.nodes[0];
  selectedNavigationNodeId = node?.id ?? '';
  navigationControls.navigationNodeSelect.value = selectedNavigationNodeId;
  navigationControls.navigationNodeIdInput.value = node?.id ?? '';
  navigationControls.navigationNodeKindSelect.value = node?.kind ?? 'level';
  navigationControls.navigationNodeNameInput.value = node?.title ?? node?.displayName ?? '';
  navigationControls.navigationNodeAssetInput.value = node?.levelId ?? node?.encounterId ?? node?.assetRef ?? '';
  navigationControls.navigationNodeXInput.value = node?.editorPosition?.[0] ?? 0;
  navigationControls.navigationNodeYInput.value = node?.editorPosition?.[1] ?? 0;
  navigationControls.navigationAlignmentInput.value = node?.signals?.alignment ?? 0;
  navigationControls.navigationThreatInput.value = node?.signals?.threat ?? 0;
  navigationControls.navigationClarityInput.value = node?.signals?.clarity ?? 0.5;
  navigationControls.navigationFateInput.value = node?.signals?.fatePressure ?? 0;
  navigationControls.navigationRoadInput.value = node?.signals?.roadCoherence ?? 0;
  navigationControls.navigationSignalInput.value = node?.signals?.destinationSignal ?? 0;
  navigationControls.navigationAmbushInput.value = node?.signals?.ambushRisk ?? 0;
  navigationControls.navigationNodeTagsInput.value = (node?.tags ?? []).join(', ');

  const edge = navigationGraph.edges.find((candidate) => candidate.id === selectedNavigationEdgeId) ?? navigationGraph.edges[0];
  selectedNavigationEdgeId = edge?.id ?? '';
  navigationControls.navigationEdgeSelect.value = selectedNavigationEdgeId;
  navigationControls.navigationEdgeIdInput.value = edge?.id ?? '';
  navigationControls.navigationEdgeVisibilitySelect.value = edge?.visibility ?? 'VISIBLE';
  navigationControls.navigationEdgeFromSelect.value = edge?.from ?? selectedNavigationNodeId;
  navigationControls.navigationEdgeToSelect.value = edge?.to ?? navigationGraph.nodes.find((candidate) => candidate.id !== selectedNavigationNodeId)?.id ?? selectedNavigationNodeId;
  navigationControls.navigationEdgeLabelInput.value = edge?.label ?? '';
  navigationControls.navigationEdgeWeightInput.value = edge?.weight ?? 1;
  navigationControls.navigationEdgeDeltaInput.value = JSON.stringify(edge?.signals ?? {}, null, 2);
  navigationControls.navigationRequiredFlagsInput.value = (edge?.requiredFlags ?? []).join(', ');
  navigationControls.navigationBlockedFlagsInput.value = (edge?.blockedFlags ?? []).join(', ');
  navigationJsonOutput.value = `${JSON.stringify(navigationGraph, null, 2)}\n`;
  renderNavigationScorePreview();
}

function populateNavigationSelects() {
  const nodeOptions = navigationGraph.nodes.map((node) => ({ value: node.id, label: `${node.title || node.displayName || node.id} (${node.kind})` }));
  setOptions(navigationControls.navigationNodeSelect, nodeOptions, selectedNavigationNodeId);
  setOptions(navigationControls.navigationInitialNodeSelect, nodeOptions, navigationGraph.initialNode);
  setOptions(navigationControls.navigationEdgeFromSelect, nodeOptions, navigationControls.navigationEdgeFromSelect.value);
  setOptions(navigationControls.navigationEdgeToSelect, nodeOptions, navigationControls.navigationEdgeToSelect.value);
  setOptions(
    navigationControls.navigationEdgeSelect,
    navigationGraph.edges.map((edge) => ({ value: edge.id, label: `${edge.label || edge.id}: ${edge.from} -> ${edge.to}` })),
    selectedNavigationEdgeId,
  );
}

function saveNavigationNode() {
  const previousId = selectedNavigationNodeId;
  const node = createNavigationNode({
    id: navigationControls.navigationNodeIdInput.value,
    displayName: navigationControls.navigationNodeNameInput.value,
    kind: navigationControls.navigationNodeKindSelect.value,
    assetRef: navigationControls.navigationNodeAssetInput.value,
    x: navigationControls.navigationNodeXInput.value,
    y: navigationControls.navigationNodeYInput.value,
    navigation: navigationAxesFromFields(),
    tags: navigationControls.navigationNodeTagsInput.value,
  });
  const index = navigationGraph.nodes.findIndex((candidate) => candidate.id === previousId);
  if (index >= 0) navigationGraph.nodes[index] = node;
  else navigationGraph.nodes.push(node);
  if (previousId && previousId !== node.id) {
    if (navigationGraph.initialNode === previousId) navigationGraph.initialNode = node.id;
    for (const edge of navigationGraph.edges) {
      if (edge.from === previousId) edge.from = node.id;
      if (edge.to === previousId) edge.to = node.id;
    }
  }
  if (!navigationGraph.initialNode) navigationGraph.initialNode = node.id;
  selectedNavigationNodeId = node.id;
  renderFromNavigation();
}

function removeNavigationNode() {
  if (!selectedNavigationNodeId) return;
  navigationGraph.nodes = navigationGraph.nodes.filter((node) => node.id !== selectedNavigationNodeId);
  navigationGraph.edges = navigationGraph.edges.filter((edge) => edge.from !== selectedNavigationNodeId && edge.to !== selectedNavigationNodeId);
  selectedNavigationNodeId = navigationGraph.nodes[0]?.id ?? '';
  navigationGraph.initialNode = navigationGraph.nodes.some((node) => node.id === navigationGraph.initialNode)
    ? navigationGraph.initialNode
    : selectedNavigationNodeId;
  selectedNavigationEdgeId = navigationGraph.edges[0]?.id ?? '';
  renderFromNavigation();
}

function saveNavigationEdge() {
  try {
    const edge = createNavigationEdge({
      id: navigationControls.navigationEdgeIdInput.value,
      from: navigationControls.navigationEdgeFromSelect.value,
      to: navigationControls.navigationEdgeToSelect.value,
      label: navigationControls.navigationEdgeLabelInput.value,
      visibility: navigationControls.navigationEdgeVisibilitySelect.value,
      weight: navigationControls.navigationEdgeWeightInput.value,
      signals: JSON.parse(navigationControls.navigationEdgeDeltaInput.value || '{}'),
      requiredFlags: navigationControls.navigationRequiredFlagsInput.value,
      blockedFlags: navigationControls.navigationBlockedFlagsInput.value,
    });
    const index = navigationGraph.edges.findIndex((candidate) => candidate.id === selectedNavigationEdgeId);
    if (index >= 0) navigationGraph.edges[index] = edge;
    else navigationGraph.edges.push(edge);
    selectedNavigationEdgeId = edge.id;
    renderFromNavigation();
  } catch (error) {
    statusPanel.innerHTML = `<span class="error">Edge JSON error: ${escapeHtml(error.message)}</span>`;
  }
}

function removeNavigationEdge() {
  navigationGraph.edges = navigationGraph.edges.filter((edge) => edge.id !== selectedNavigationEdgeId);
  selectedNavigationEdgeId = navigationGraph.edges[0]?.id ?? '';
  renderFromNavigation();
}

function applyNavigationJson() {
  try {
    loadNavigationGraph(JSON.parse(navigationJsonOutput.value));
  } catch (error) {
    statusPanel.innerHTML = `<span class="error">Navigation graph JSON error: ${escapeHtml(error.message)}</span>`;
  }
}

function navigationAxesFromFields() {
  return {
    alignment: Number(navigationControls.navigationAlignmentInput.value),
    threat: Number(navigationControls.navigationThreatInput.value),
    clarity: Number(navigationControls.navigationClarityInput.value),
    fatePressure: Number(navigationControls.navigationFateInput.value),
    roadCoherence: Number(navigationControls.navigationRoadInput.value),
    destinationSignal: Number(navigationControls.navigationSignalInput.value),
    ambushRisk: Number(navigationControls.navigationAmbushInput.value),
  };
}

function renderNavigationScorePreview() {
  const score = previewNavigationScore({ navigation: navigationAxesFromFields() });
  navigationScorePreview.innerHTML = [
    `<strong>${escapeHtml(score.label)}</strong>`,
    `Road ${percent(score.mix.roadBearing)} | Fate ${percent(score.mix.fatePressure)} | Destination ${percent(score.mix.destinationEcho)}`,
    `Danger ${percent(score.mix.dangerLayer)} | Ambush ${percent(score.mix.ambushLayer)}`,
  ].map((line) => `<span>${line}</span>`).join('');
}

function setPreviewMode(mode) {
  previewMode = mode;
  navigationControls.routePreviewButton.setAttribute('aria-pressed', String(mode === 'route'));
  navigationControls.graphPreviewButton.setAttribute('aria-pressed', String(mode === 'graph'));
  drawPreview();
}

function render() {
  level.navigationGraph = normalizeNavigationGraph(navigationGraph);
  drawPreview();
  jsonOutput.value = `${JSON.stringify(level, null, 2)}\n`;
  navigationJsonOutput.value = `${JSON.stringify(navigationGraph, null, 2)}\n`;
  renderStatus();
  renderDependencies();
}

function drawPreview() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#0d1010';
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (previewMode === 'graph') {
    drawNavigationGraph();
    return;
  }
  drawBackdrop();
  const points = routePoints();
  drawRoute(points);
  drawDistanceEvents(points);
}

function drawBackdrop() {
  context.strokeStyle = 'rgb(244 238 228 / 0.07)';
  context.lineWidth = 1;
  for (let x = 40; x < canvas.width; x += 40) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x - 80, canvas.height);
    context.stroke();
  }
  context.fillStyle = 'rgb(111 224 191 / 0.08)';
  context.fillRect(0, 0, canvas.width, canvas.height * 0.18);
}

function drawNavigationGraph() {
  drawBackdrop();
  const positions = navigationNodePositions();
  context.font = '700 12px Inter, sans-serif';
  for (const edge of navigationGraph.edges) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) continue;
    context.save();
    context.strokeStyle = edge.id === selectedNavigationEdgeId ? '#f7c06a' : edgeColor(edge.visibility);
    context.lineWidth = edge.id === selectedNavigationEdgeId ? 4 : 2;
    if (edge.visibility !== 'VISIBLE') context.setLineDash(edge.visibility === 'FALSE_ECHO' ? [3, 8] : [9, 7]);
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    drawArrowHead(from, to, context.strokeStyle);
    const middleX = (from.x + to.x) / 2;
    const middleY = (from.y + to.y) / 2;
    context.fillStyle = '#d7ceb8';
    context.fillText(edge.label || edge.id, middleX + 8, middleY - 8);
    context.restore();
  }

  for (const node of navigationGraph.nodes) {
    const point = positions.get(node.id);
    const selected = node.id === selectedNavigationNodeId;
    const initial = node.id === navigationGraph.initialNode;
    context.fillStyle = selected ? '#f7c06a' : initial ? '#6fe0bf' : '#273332';
    context.strokeStyle = initial ? '#6fe0bf' : '#f4eee4';
    context.lineWidth = selected ? 4 : 2;
    context.beginPath();
    context.arc(point.x, point.y, selected ? 24 : 20, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#f4eee4';
    context.textAlign = 'center';
    context.fillText(node.title || node.displayName || node.id, point.x, point.y + 42);
    context.fillStyle = '#d7ceb8';
    context.font = '600 10px Inter, sans-serif';
    context.fillText(node.kind, point.x, point.y + 56);
    context.font = '700 12px Inter, sans-serif';
  }
  context.textAlign = 'left';
  context.fillStyle = '#d7ceb8';
  context.fillText(`Visible horizon: ${navigationGraph.visibleHorizon}`, 18, 28);
}

function navigationNodePositions() {
  const positions = new Map();
  const xs = navigationGraph.nodes.map((node) => Number(node.editorPosition?.[0]) || 0);
  const ys = navigationGraph.nodes.map((node) => Number(node.editorPosition?.[1]) || 0);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 1);
  for (const node of navigationGraph.nodes) {
    const x = Number(node.editorPosition?.[0]) || 0;
    const y = Number(node.editorPosition?.[1]) || 0;
    positions.set(node.id, {
      x: 80 + ((x - minX) / Math.max(1, maxX - minX)) * (canvas.width - 160),
      y: 90 + ((y - minY) / Math.max(1, maxY - minY)) * (canvas.height - 180),
    });
  }
  return positions;
}

function drawArrowHead(from, to, color) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const distance = 24;
  const x = to.x - Math.cos(angle) * distance;
  const y = to.y - Math.sin(angle) * distance;
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x - Math.cos(angle - 0.55) * 12, y - Math.sin(angle - 0.55) * 12);
  context.lineTo(x - Math.cos(angle + 0.55) * 12, y - Math.sin(angle + 0.55) * 12);
  context.closePath();
  context.fill();
}

function edgeColor(visibility) {
  return ({ VISIBLE: '#6fe0bf', FOGGED: '#9ca8ff', CONDITIONAL: '#f7c06a', UNSTABLE: '#ff8f70', FALSE_ECHO: '#b78cf7' })[visibility] ?? '#d7ceb8';
}

function routePoints() {
  const points = [{ x: canvas.width / 2, y: canvas.height - 70, distance: 0 }];
  let heading = (level.route?.startHeading ?? -Math.PI / 2) + Math.PI / 2;
  let x = points[0].x;
  let y = points[0].y;
  let distance = 0;
  for (const segment of level.route?.segments ?? []) {
    const steps = Math.max(3, Math.ceil(segment.length / 80));
    const turnStep = (segment.turnRadians ?? 0) / steps;
    const lengthStep = segment.length / steps;
    for (let index = 0; index < steps; index += 1) {
      heading += turnStep;
      distance += lengthStep;
      x += Math.cos(heading) * lengthStep * 0.35;
      y += Math.sin(heading) * lengthStep * 0.35;
      points.push({ x, y, distance });
    }
  }
  return points;
}

function drawRoute(points) {
  context.strokeStyle = '#f7c06a';
  context.lineWidth = 6;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) context.lineTo(point.x, point.y);
  context.stroke();
  context.strokeStyle = 'rgb(244 238 228 / 0.24)';
  context.lineWidth = 1;
  for (const point of points) {
    context.beginPath();
    context.moveTo(point.x - 42, point.y);
    context.lineTo(point.x + 42, point.y);
    context.stroke();
  }
}

function drawDistanceEvents(points) {
  for (const wave of level.waves ?? []) drawEvent(points, wave.atDistance, '#ff8f70', wave.id);
  for (const obstacle of level.obstacles ?? []) drawEvent(points, obstacle.atDistance, '#9ca8ff', obstacle.id);
  for (const trigger of level.triggers ?? []) drawEvent(points, trigger.atDistance, trigger.kind === 'encounter' ? '#f7c06a' : '#6fe0bf', trigger.id);
}

function drawEvent(points, distance, color, label) {
  const point = nearestPoint(points, distance);
  context.fillStyle = color;
  context.beginPath();
  context.arc(point.x, point.y, 8, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#f4eee4';
  context.font = '700 12px Inter, sans-serif';
  context.fillText(label, point.x + 12, point.y - 10);
}

function nearestPoint(points, distance) {
  return points.reduce((nearest, point) => (Math.abs(point.distance - distance) < Math.abs(nearest.distance - distance) ? point : nearest), points[0]);
}

function renderStatus() {
  const report = validateLevelDefinition(level);
  const graphReport = validateNavigationGraph(navigationGraph);
  const valid = report.valid && graphReport.valid;
  const lines = [
    `<span><strong>${valid ? 'Valid level and navigation assets' : 'Level needs changes'}</strong></span>`,
    `<span>${level.route?.segments?.length ?? 0} route segments, ${level.waves?.length ?? 0} waves, ${level.triggers?.length ?? 0} triggers, ${encounterTriggerCount()} encounters</span>`,
    `<span>${navigationGraph.nodes.length} navigation nodes, ${navigationGraph.edges.length} edges</span>`,
  ];
  lines.push(...report.errors.map((error) => `<span class="error">Error: ${escapeHtml(error)}</span>`));
  lines.push(...graphReport.errors.map((error) => `<span class="error">Graph error: ${escapeHtml(error)}</span>`));
  lines.push(...report.warnings.map((warning) => `<span class="warning">Warning: ${escapeHtml(warning)}</span>`));
  lines.push(...graphReport.warnings.map((warning) => `<span class="warning">Graph warning: ${escapeHtml(warning)}</span>`));
  statusPanel.innerHTML = lines.join('');
}

function encounterTriggerCount() {
  return (level.triggers ?? []).filter((trigger) => trigger.kind === 'encounter').length;
}

function renderDependencies() {
  let lines;
  try {
    const plan = createLevelPackagePlan(level);
    lines = ['Import Plan', `${plan.dependencies.length} dependencies`];
    for (const dependency of plan.dependencies) {
      lines.push(`${dependency.kind}: ${dependency.assetId ?? dependency.packId}`);
    }
    const graphReferences = navigationGraph.nodes.filter((node) => node.levelId || node.encounterId || node.assetRef);
    if (graphReferences.length > 0) lines.push('Navigation content references');
    for (const node of graphReferences) lines.push(`${node.kind}: ${node.levelId ?? node.encounterId ?? node.assetRef}`);
  } catch (error) {
    lines = ['Import Plan', `Waiting for a valid level asset: ${error.message}`];
  }
  dependencyList.innerHTML = lines.map((line) => `<span>${escapeHtml(line)}</span>`).join('');
}

function applyJson() {
  try {
    loadLevel(JSON.parse(jsonOutput.value));
  } catch (error) {
    statusPanel.innerHTML = `<span class="error">Error: ${escapeHtml(error.message)}</span>`;
  }
}

function downloadJson() {
  const blob = new Blob([jsonOutput.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${level.assetId || 'level'}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setOptions(select, options, selectedValue) {
  select.replaceChildren(...options.map(({ value, label }) => new Option(label, value)));
  if (options.some((option) => option.value === selectedValue)) select.value = selectedValue;
}

function percent(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
