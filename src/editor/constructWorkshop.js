import {
  CANON_STATUSES,
  CELL_TYPES,
  CONSTRUCT_SCHEMA_VERSION,
  validateConstructDefinition,
} from '../core/constructDefinition.js';
import {
  MAX_PRIMARY_SLOTS,
  MAX_SECONDARY_SLOTS,
  PRIMARY_WEAPON_IDS,
  SECONDARY_WEAPON_IDS,
  normalizeGunLoadouts,
  setGunLoadoutSlot,
  weaponStackMultiplier,
} from '../core/weaponLoadout.js';
import { secondaryAmmoCapacity } from '../core/secondaryWeapon.js';
import { loadLocalContentLibrary } from '../core/localContentLibrary.js';
import { BUILTIN_CONSTRUCT_DEFINITIONS } from './constructCatalog.js';
import { connectAllAdjacentCells, removeConnectionBetween } from './constructConnectionAuthoring.js';
import { consumeEditorAssetHandoff } from './editorAssetHandoff.js';
import {
  POSE_RIG_DRIVERS,
  POSE_RIG_JOINT_KINDS,
  POSE_RIG_TRANSFORM_PROPERTIES,
  MAX_CELL_BINDING_INFLUENCES,
  createAnimationDescriptor,
  createCellBindingDescriptor,
  createCannonAimRigForConstruct,
  createGroupDescriptor,
  createJointDescriptor,
  createPoseDescriptor,
  createPoseTransformDescriptor,
  createWalkerStrideRigForConstruct,
  emptyPoseRig,
  hasPoseRigContent,
  normalizePoseRigDraft,
  parseVector,
  poseRigFromConstructDefinition,
  poseRigSummary,
} from './poseRigAuthoring.js';
import {
  ANIMATION_INTERRUPT_POLICIES,
  ANIMATION_TEXTURE_TRANSITIONS,
  animationGraphSummary,
  createAnimationGraphExample,
  createAnimationState,
  createAnimationTransition,
  emptyAnimationGraph,
  normalizeAnimationGraph,
  validateAnimationGraph,
} from './animationGraphAuthoring.js';
import { bindBuildVersion } from './versionBadge.js';

const canvas = document.querySelector('#constructCanvas');
const context = canvas.getContext('2d');
const constructSelect = document.querySelector('#constructSelect');
const loadConstructButton = document.querySelector('#loadConstructButton');
const refreshConstructsButton = document.querySelector('#refreshConstructsButton');
const assetIdInput = document.querySelector('#assetIdInput');
const displayNameInput = document.querySelector('#displayNameInput');
const schemaInput = document.querySelector('#schemaInput');
const canonStatusSelect = document.querySelector('#canonStatusSelect');
const tagsInput = document.querySelector('#tagsInput');
const cellTypeSelect = document.querySelector('#cellTypeSelect');
const layerInput = document.querySelector('#layerInput');
const layerViewSelect = document.querySelector('#layerViewSelect');
const paintButton = document.querySelector('#paintButton');
const eraseButton = document.querySelector('#eraseButton');
const connectButton = document.querySelector('#connectButton');
const removeConnectionButton = document.querySelector('#removeConnectionButton');
const autoConnectButton = document.querySelector('#autoConnectButton');
const weightPaintButton = document.querySelector('#weightPaintButton');
const weightEraseButton = document.querySelector('#weightEraseButton');
const connectAboveButton = document.querySelector('#connectAboveButton');
const connectBelowButton = document.querySelector('#connectBelowButton');
const resetButton = document.querySelector('#resetButton');
const downloadButton = document.querySelector('#downloadButton');
const copyJsonButton = document.querySelector('#copyJsonButton');
const applyJsonButton = document.querySelector('#applyJsonButton');
const jsonOutput = document.querySelector('#jsonOutput');
const statusPanel = document.querySelector('#statusPanel');
const lookupPanel = document.querySelector('#lookupPanel');
const cellList = document.querySelector('#cellList');
const connectionList = document.querySelector('#connectionList');
const loadoutSelects = [
  document.querySelector('#primarySlot0Select'),
  document.querySelector('#primarySlot1Select'),
  document.querySelector('#secondarySlot0Select'),
  document.querySelector('#secondarySlot1Select'),
  document.querySelector('#secondarySlot2Select'),
];
const poseRigStatus = document.querySelector('#poseRigStatus');
const walkerStridePresetButton = document.querySelector('#walkerStridePresetButton');
const cannonAimPresetButton = document.querySelector('#cannonAimPresetButton');
const clearPoseRigButton = document.querySelector('#clearPoseRigButton');
const poseGroupSelect = document.querySelector('#poseGroupSelect');
const poseGroupIdInput = document.querySelector('#poseGroupIdInput');
const poseGroupRoleInput = document.querySelector('#poseGroupRoleInput');
const poseGroupSelectorInput = document.querySelector('#poseGroupSelectorInput');
const poseGroupCellsInput = document.querySelector('#poseGroupCellsInput');
const poseGroupPivotInputs = [
  document.querySelector('#poseGroupPivotXInput'),
  document.querySelector('#poseGroupPivotYInput'),
  document.querySelector('#poseGroupPivotZInput'),
];
const poseJointSelect = document.querySelector('#poseJointSelect');
const poseJointIdInput = document.querySelector('#poseJointIdInput');
const poseJointGroupInput = document.querySelector('#poseJointGroupInput');
const poseJointKindSelect = document.querySelector('#poseJointKindSelect');
const poseJointAxisInputs = [
  document.querySelector('#poseJointAxisXInput'),
  document.querySelector('#poseJointAxisYInput'),
  document.querySelector('#poseJointAxisZInput'),
];
const poseJointTranslateInputs = [
  document.querySelector('#poseJointTranslateXInput'),
  document.querySelector('#poseJointTranslateYInput'),
  document.querySelector('#poseJointTranslateZInput'),
];
const poseSelect = document.querySelector('#poseSelect');
const poseIdInput = document.querySelector('#poseIdInput');
const poseTransformTargetInput = document.querySelector('#poseTransformTargetInput');
const poseTransformInputs = [
  document.querySelector('#poseTransformXInput'),
  document.querySelector('#poseTransformYInput'),
  document.querySelector('#poseTransformZInput'),
];
const poseTransformRotationInput = document.querySelector('#poseTransformRotationInput');
const poseTransformPivotInputs = [
  document.querySelector('#poseTransformPivotXInput'),
  document.querySelector('#poseTransformPivotYInput'),
  document.querySelector('#poseTransformPivotZInput'),
];
const poseAnimationSelect = document.querySelector('#poseAnimationSelect');
const poseAnimationIdInput = document.querySelector('#poseAnimationIdInput');
const poseAnimationKindSelect = document.querySelector('#poseAnimationKindSelect');
const poseAnimationTargetInput = document.querySelector('#poseAnimationTargetInput');
const poseAnimationPropertySelect = document.querySelector('#poseAnimationPropertySelect');
const poseAnimationAmplitudeInput = document.querySelector('#poseAnimationAmplitudeInput');
const poseAnimationFrequencyInput = document.querySelector('#poseAnimationFrequencyInput');
const poseAnimationPhaseInput = document.querySelector('#poseAnimationPhaseInput');
const poseAnimationDriverSelect = document.querySelector('#poseAnimationDriverSelect');
const poseAnimationRotationOffsetInput = document.querySelector('#poseAnimationRotationOffsetInput');
const poseAnimationKeyframesInput = document.querySelector('#poseAnimationKeyframesInput');
const savePoseGroupButton = document.querySelector('#savePoseGroupButton');
const removePoseGroupButton = document.querySelector('#removePoseGroupButton');
const savePoseJointButton = document.querySelector('#savePoseJointButton');
const removePoseJointButton = document.querySelector('#removePoseJointButton');
const weightJointSelect = document.querySelector('#weightJointSelect');
const weightBlendJointSelect = document.querySelector('#weightBlendJointSelect');
const weightValueInput = document.querySelector('#weightValueInput');
const weightBindingPanel = document.querySelector('#weightBindingPanel');
const fillSelectedWeightButton = document.querySelector('#fillSelectedWeightButton');
const normalizeSelectedWeightButton = document.querySelector('#normalizeSelectedWeightButton');
const blendSelectedWeightButton = document.querySelector('#blendSelectedWeightButton');
const smoothSelectedWeightButton = document.querySelector('#smoothSelectedWeightButton');
const savePoseButton = document.querySelector('#savePoseButton');
const removePoseButton = document.querySelector('#removePoseButton');
const savePoseAnimationButton = document.querySelector('#savePoseAnimationButton');
const removePoseAnimationButton = document.querySelector('#removePoseAnimationButton');
const poseRigJsonOutput = document.querySelector('#poseRigJsonOutput');
const applyPoseRigJsonButton = document.querySelector('#applyPoseRigJsonButton');
const animationControls = Object.fromEntries(
  [
    'animationGraphStatus', 'loadAnimationGraphExampleButton', 'clearAnimationGraphButton', 'animationGraphInitialStateSelect', 'animationGraphSeedOffsetInput',
    'animationGraphStateSelect', 'animationStateIdInput', 'animationStatePoseSelect', 'animationStateTagsInput',
    'animationStateMaterialInput', 'animationStateTextureInput', 'animationStateDwellMinInput', 'animationStateDwellMaxInput',
    'animationStateXInput', 'animationStateYInput', 'animationStateNextInput', 'saveAnimationStateButton',
    'removeAnimationStateButton', 'animationGraphTransitionSelect', 'animationTransitionIdInput',
    'animationTransitionPolicySelect', 'animationTransitionFromSelect', 'animationTransitionToSelect',
    'animationTransitionDurationMinInput', 'animationTransitionDurationMaxInput', 'animationTransitionRequiredTagsInput',
    'animationTransitionRigClipInput', 'animationTransitionMaterialClipInput', 'animationTransitionTextureClipInput',
    'animationTransitionTextureModeSelect', 'animationTransitionAnchorsInput', 'animationTransitionMarkersInput',
    'animationTransitionVariantsInput', 'saveAnimationTransitionButton', 'removeAnimationTransitionButton',
    'animationGraphCanvas', 'animationTransitionScrubInput', 'animationTimelineStatus', 'animationGraphJsonOutput',
    'applyAnimationGraphJsonButton',
  ].map((id) => [id, document.querySelector(`#${id}`)]),
);
const animationGraphContext = animationControls.animationGraphCanvas.getContext('2d');

bindBuildVersion();

const cellColors = {
  armor: '#818a8b',
  core: '#f7c06a',
  engine: '#6fe0bf',
  gun: '#ff8f70',
  utility: '#70c8ff',
  wheel: '#9ca8ff',
};
const gridRadius = 8;
const gridCount = gridRadius * 2 + 1;
const gridPad = 44;
const gridSize = canvas.width - gridPad * 2;
const cellSize = gridSize / gridCount;
const maxEditorLayer = 31;

let tool = 'paint';
let connectionActionMessage = '';
let selectedCellId = null;
let selectedPoseGroupId = null;
let selectedPoseJointId = null;
let selectedPoseId = null;
let selectedPoseAnimationId = null;
let selectedWeightJointId = null;
let selectedBlendJointId = null;
let selectedAnimationStateId = null;
let selectedAnimationTransitionId = null;
let animationGraphEnabled = false;
let constructCatalog = [];
let currentLayer = 0;
let definition = cloneDefinition(BUILTIN_CONSTRUCT_DEFINITIONS[0]);

for (const status of CANON_STATUSES) {
  canonStatusSelect.append(new Option(status, status));
}
for (const type of CELL_TYPES) {
  cellTypeSelect.append(new Option(type, type));
}
for (const kind of POSE_RIG_JOINT_KINDS) {
  poseJointKindSelect.append(new Option(kind, kind));
}
for (const kind of ['oscillate', 'poseCycle', 'aimAtTarget']) {
  poseAnimationKindSelect.append(new Option(kind, kind));
}
for (const property of POSE_RIG_TRANSFORM_PROPERTIES) {
  poseAnimationPropertySelect.append(new Option(property, property));
}
for (const driver of POSE_RIG_DRIVERS) {
  poseAnimationDriverSelect.append(new Option(driver, driver));
}
for (const policy of ANIMATION_INTERRUPT_POLICIES) {
  animationControls.animationTransitionPolicySelect.append(new Option(policy, policy));
}
for (const mode of ANIMATION_TEXTURE_TRANSITIONS) {
  animationControls.animationTransitionTextureModeSelect.append(new Option(mode, mode));
}
populateLoadoutSelects();
refreshConstructCatalog();

canvas.addEventListener('click', handleCanvasClick);
constructSelect.addEventListener('change', () => loadSelectedConstruct());
loadConstructButton.addEventListener('click', loadSelectedConstruct);
refreshConstructsButton.addEventListener('click', () => {
  refreshConstructCatalog();
  render();
});
assetIdInput.addEventListener('input', syncFieldsToDefinition);
displayNameInput.addEventListener('input', syncFieldsToDefinition);
schemaInput.addEventListener('input', syncFieldsToDefinition);
canonStatusSelect.addEventListener('change', syncFieldsToDefinition);
tagsInput.addEventListener('input', syncFieldsToDefinition);
layerInput.addEventListener('input', () => {
  currentLayer = clampLayer(Number(layerInput.value));
  layerInput.value = String(currentLayer);
  render();
});
layerViewSelect.addEventListener('change', render);
paintButton.addEventListener('click', () => setTool('paint'));
eraseButton.addEventListener('click', () => setTool('erase'));
connectButton.addEventListener('click', () => setTool('connect'));
removeConnectionButton.addEventListener('click', () => setTool('removeConnection'));
autoConnectButton.addEventListener('click', autoConnectCells);
weightPaintButton.addEventListener('click', () => setTool('weightPaint'));
weightEraseButton.addEventListener('click', () => setTool('weightErase'));
connectAboveButton.addEventListener('click', () => connectVertical(1));
connectBelowButton.addEventListener('click', () => connectVertical(-1));
resetButton.addEventListener('click', () => loadDefinition(BUILTIN_CONSTRUCT_DEFINITIONS[0]));
downloadButton.addEventListener('click', downloadJson);
copyJsonButton.addEventListener('click', copyJson);
applyJsonButton.addEventListener('click', applyJsonFromOutput);
for (const select of loadoutSelects) {
  select.addEventListener('change', () => {
    const result = setGunLoadoutSlot(definition, selectedCellId, select.dataset.slotKind, Number(select.dataset.slotIndex), select.value || null);
    if (result.changed) definition = result.definition;
    render();
  });
}
walkerStridePresetButton.addEventListener('click', applyWalkerStridePreset);
cannonAimPresetButton.addEventListener('click', applyCannonAimPreset);
clearPoseRigButton.addEventListener('click', () => {
  definition.poseRig = emptyPoseRig();
  clearPoseSelections();
  render();
});
poseGroupSelect.addEventListener('change', () => {
  selectedPoseGroupId = poseGroupSelect.value;
  syncPoseGroupFields();
});
poseJointSelect.addEventListener('change', () => {
  selectedPoseJointId = poseJointSelect.value;
  syncPoseJointFields();
});
weightJointSelect.addEventListener('change', () => {
  selectedWeightJointId = weightJointSelect.value;
  render();
});
weightBlendJointSelect.addEventListener('change', () => {
  selectedBlendJointId = weightBlendJointSelect.value;
  renderWeightBindingPanel();
});
poseSelect.addEventListener('change', () => {
  selectedPoseId = poseSelect.value;
  syncPoseFields();
});
poseAnimationSelect.addEventListener('change', () => {
  selectedPoseAnimationId = poseAnimationSelect.value;
  syncPoseAnimationFields();
});
savePoseGroupButton.addEventListener('click', savePoseGroup);
removePoseGroupButton.addEventListener('click', removePoseGroup);
savePoseJointButton.addEventListener('click', savePoseJoint);
removePoseJointButton.addEventListener('click', removePoseJoint);
fillSelectedWeightButton.addEventListener('click', fillSelectedWeight);
normalizeSelectedWeightButton.addEventListener('click', normalizeSelectedWeight);
blendSelectedWeightButton.addEventListener('click', blendSelectedWeight);
smoothSelectedWeightButton.addEventListener('click', smoothSelectedWeight);
savePoseButton.addEventListener('click', savePose);
removePoseButton.addEventListener('click', removePose);
savePoseAnimationButton.addEventListener('click', savePoseAnimation);
removePoseAnimationButton.addEventListener('click', removePoseAnimation);
applyPoseRigJsonButton.addEventListener('click', applyPoseRigJson);
animationControls.loadAnimationGraphExampleButton.addEventListener('click', installAnimationGraphExample);
animationControls.clearAnimationGraphButton.addEventListener('click', () => {
  definition.animationGraph = emptyAnimationGraph();
  animationGraphEnabled = false;
  clearAnimationGraphSelections();
  render();
});
animationControls.animationGraphInitialStateSelect.addEventListener('change', () => {
  definition.animationGraph.initialState = animationControls.animationGraphInitialStateSelect.value;
  animationGraphEnabled = true;
  render();
});
animationControls.animationGraphSeedOffsetInput.addEventListener('input', () => {
  definition.animationGraph.seedOffset = Math.trunc(Number(animationControls.animationGraphSeedOffsetInput.value) || 0);
  animationGraphEnabled = true;
  render();
});
animationControls.animationGraphStateSelect.addEventListener('change', () => {
  selectedAnimationStateId = animationControls.animationGraphStateSelect.value;
  syncAnimationStateFields();
  drawAnimationGraph();
});
animationControls.animationGraphTransitionSelect.addEventListener('change', () => {
  selectedAnimationTransitionId = animationControls.animationGraphTransitionSelect.value;
  syncAnimationTransitionFields();
  drawAnimationGraph();
  renderAnimationTimeline();
});
animationControls.saveAnimationStateButton.addEventListener('click', saveAnimationState);
animationControls.removeAnimationStateButton.addEventListener('click', removeAnimationState);
animationControls.saveAnimationTransitionButton.addEventListener('click', saveAnimationTransition);
animationControls.removeAnimationTransitionButton.addEventListener('click', removeAnimationTransition);
animationControls.applyAnimationGraphJsonButton.addEventListener('click', applyAnimationGraphJson);
animationControls.animationTransitionScrubInput.addEventListener('input', renderAnimationTimeline);

loadDefinition(definition);
const creatorHandoff = consumeEditorAssetHandoff(['construct']);
if (creatorHandoff) loadDefinition(creatorHandoff.definition);

function refreshConstructCatalog() {
  constructCatalog = [
    ...BUILTIN_CONSTRUCT_DEFINITIONS.map((definition) => ({
      key: `built-in:${definition.assetId}`,
      group: definition.assetId?.startsWith('example.construct.') ? 'Zone Enemy Examples' : 'Bundled Constructs',
      label: labelForConstruct(definition),
      definition,
    })),
    ...localConstructEntries(),
  ];
  populateConstructSelect();
}

function populateConstructSelect() {
  const previous = constructSelect.value;
  const groups = new Map();
  for (const entry of constructCatalog) {
    if (!groups.has(entry.group)) groups.set(entry.group, []);
    groups.get(entry.group).push(entry);
  }
  constructSelect.replaceChildren();
  for (const [label, entries] of groups) {
    const group = document.createElement('optgroup');
    group.label = label;
    for (const entry of entries) group.append(new Option(entry.label, entry.key));
    constructSelect.append(group);
  }
  const current = constructCatalog.find((entry) => entry.definition.assetId === definition.assetId);
  constructSelect.value = constructCatalog.some((entry) => entry.key === previous) ? previous : current?.key ?? constructCatalog[0]?.key ?? '';
}

function localConstructEntries() {
  const library = loadLocalContentLibrary();
  return Object.values(library.packs ?? {}).flatMap((pack) =>
    (pack.assets ?? [])
      .filter((asset) => asset.kind === 'construct' && asset.definition?.assetId)
      .map((asset) => ({
        key: `local:${pack.manifest?.packId ?? 'pack'}:${asset.definition.assetId}`,
        group: `Local: ${pack.manifest?.displayName ?? pack.manifest?.packId ?? 'Pack'}`,
        label: labelForConstruct(asset.definition),
        definition: asset.definition,
      })),
  );
}

function loadSelectedConstruct() {
  const entry = constructCatalog.find((candidate) => candidate.key === constructSelect.value);
  if (!entry) return;
  loadDefinition(entry.definition);
}

function loadDefinition(nextDefinition) {
  definition = cloneDefinition(nextDefinition);
  definition.schemaVersion ??= CONSTRUCT_SCHEMA_VERSION;
  definition.canonStatus ??= 'EXPERIMENTAL';
  definition.tags ??= [];
  definition.cells ??= [];
  definition.connections ??= [];
  definition.modules ??= [];
  definition.cells = definition.cells.map((cell) => ({ ...cell, gridZ: normalizedLayer(cell) }));
  definition.gunLoadouts = normalizeGunLoadouts(definition);
  definition.poseRig = poseRigFromConstructDefinition(definition);
  animationGraphEnabled = Boolean(definition.animationGraph);
  definition.animationGraph = normalizeAnimationGraph(definition.animationGraph ?? emptyAnimationGraph());
  delete definition.cellGroups;
  delete definition.poseAnimations;
  delete definition.cellBindings;
  delete definition.poseDynamics;
  delete definition.poseRigImports;
  selectedCellId = null;
  clearPoseSelections();
  clearAnimationGraphSelections();
  selectedAnimationStateId = definition.animationGraph.initialState || definition.animationGraph.states[0]?.id || null;
  selectedAnimationTransitionId = definition.animationGraph.transitions[0]?.id ?? null;
  currentLayer = clampLayer(layerForInitialView(definition));
  syncDefinitionToFields();
  populateConstructSelect();
  render();
}

function syncDefinitionToFields() {
  assetIdInput.value = definition.assetId ?? '';
  displayNameInput.value = definition.displayName ?? '';
  schemaInput.value = definition.schemaVersion ?? CONSTRUCT_SCHEMA_VERSION;
  canonStatusSelect.value = definition.canonStatus ?? 'EXPERIMENTAL';
  tagsInput.value = (definition.tags ?? []).join(', ');
  layerInput.value = String(currentLayer);
}

function syncFieldsToDefinition() {
  definition.assetId = assetIdInput.value.trim();
  definition.displayName = displayNameInput.value.trim();
  definition.schemaVersion = schemaInput.value.trim();
  definition.canonStatus = canonStatusSelect.value;
  definition.tags = tagsInput.value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  render();
}

function handleCanvasClick(event) {
  const point = canvasPoint(event);
  const grid = pointToGrid(point);
  if (!grid) return;
  const existing = cellAt(grid.x, grid.y, currentLayer);
  if (tool === 'weightPaint' || tool === 'weightErase') {
    if (existing) {
      selectedCellId = existing.id;
      if (tool === 'weightPaint') applyWeightToCell(existing.id);
      else eraseWeightFromCell(existing.id);
    }
    render();
    return;
  }
  if (tool === 'erase') {
    if (existing) removeCell(existing.id);
    render();
    return;
  }
  if (tool === 'connect' || tool === 'removeConnection') {
    if (existing) selectOrModifyConnection(existing, tool === 'removeConnection');
    render();
    return;
  }
  if (existing) {
    existing.type = cellTypeSelect.value;
    selectedCellId = existing.id;
  } else {
    const id = uniqueCellId(cellTypeSelect.value, grid.x, grid.y, currentLayer);
    definition.cells.push({ id, type: cellTypeSelect.value, gridX: grid.x, gridY: grid.y, gridZ: currentLayer });
    selectedCellId = id;
  }
  render();
}

function selectOrModifyConnection(cell, remove) {
  if (!selectedCellId || selectedCellId === cell.id) {
    selectedCellId = cell.id;
    return;
  }
  const from = definition.cells.find((candidate) => candidate.id === selectedCellId);
  if (!from) {
    selectedCellId = cell.id;
    return;
  }
  const side = adjacentSide(from, cell);
  if (!side) {
    selectedCellId = cell.id;
    return;
  }
  const exists = definition.connections.some((edge) => sameConnection(edge, from.id, cell.id));
  if (remove && exists) {
    definition.connections = removeConnectionBetween(definition.connections, from.id, cell.id);
    connectionActionMessage = `Removed connection between ${from.id} and ${cell.id}.`;
  } else if (!remove && !exists) {
    definition.connections.push({ a: from.id, b: cell.id, aSide: side, bSide: oppositeSide(side), type: 'structural' });
    connectionActionMessage = `Connected ${from.id} to ${cell.id}.`;
  }
  selectedCellId = cell.id;
}

function autoConnectCells() {
  const previousCount = definition.connections.length;
  definition.connections = connectAllAdjacentCells(definition.cells, definition.connections);
  const added = definition.connections.length - previousCount;
  connectionActionMessage = added > 0
    ? `Auto-connect added ${added} adjacent structural connection${added === 1 ? '' : 's'}.`
    : 'Auto-connect found no missing adjacent connections.';
  render();
}

function connectVertical(direction) {
  const from = definition.cells.find((candidate) => candidate.id === selectedCellId);
  if (!from) return;
  const targetLayer = normalizedLayer(from) + direction;
  const to = cellAt(from.gridX, from.gridY, targetLayer);
  if (!to) return;
  addConnection(from, to, direction > 0 ? 'above' : 'below');
  selectedCellId = to.id;
  currentLayer = clampLayer(targetLayer);
  syncDefinitionToFields();
  render();
}

function removeCell(id) {
  definition.cells = definition.cells.filter((cell) => cell.id !== id);
  definition.connections = definition.connections.filter((edge) => edge.a !== id && edge.b !== id);
  if (definition.poseRig?.cellBindings) delete definition.poseRig.cellBindings[id];
  if (selectedCellId === id) selectedCellId = null;
}

function render() {
  syncFieldsToDefinitionSilently();
  definition.gunLoadouts = normalizeGunLoadouts(definition);
  currentLayer = clampLayer(currentLayer);
  layerInput.value = String(currentLayer);
  drawCanvas();
  renderLists();
  syncLoadoutControls();
  renderPoseRigControls();
  renderAnimationGraphControls();
  renderJson();
  renderStatus();
  renderLookupPanel();
}

function syncFieldsToDefinitionSilently() {
  definition.assetId = assetIdInput.value.trim();
  definition.displayName = displayNameInput.value.trim();
  definition.schemaVersion = schemaInput.value.trim();
  definition.canonStatus = canonStatusSelect.value;
  definition.tags = tagsInput.value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function drawCanvas() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#0d1010';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = 'rgb(244 238 228 / 0.1)';
  context.lineWidth = 1;
  for (let index = 0; index <= gridCount; index += 1) {
    const position = gridPad + index * cellSize;
    context.beginPath();
    context.moveTo(gridPad, position);
    context.lineTo(canvas.width - gridPad, position);
    context.stroke();
    context.beginPath();
    context.moveTo(position, gridPad);
    context.lineTo(position, canvas.height - gridPad);
    context.stroke();
  }

  drawConnections();
  for (const cell of definition.cells) drawCell(cell);
  drawAxes();
}

function drawConnections() {
  context.lineCap = 'round';
  for (const edge of definition.connections ?? []) {
    const a = definition.cells.find((cell) => cell.id === edge.a);
    const b = definition.cells.find((cell) => cell.id === edge.b);
    if (!a || !b) continue;
    const visibility = connectionVisibility(a, b);
    if (!visibility.visible) continue;
    const start = gridToCanvas(a.gridX, a.gridY);
    const end = gridToCanvas(b.gridX, b.gridY);
    context.save();
    context.globalAlpha = visibility.alpha;
    context.lineWidth = edge.aSide === 'above' || edge.aSide === 'below' ? 3 : 5;
    context.strokeStyle = edge.aSide === 'above' || edge.aSide === 'below' ? '#6fe0bf' : '#f7c06a';
    context.beginPath();
    if (start.x === end.x && start.y === end.y) {
      context.arc(start.x, start.y, Math.max(8, cellSize * 0.24), 0, Math.PI * 2);
    } else {
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
    }
    context.stroke();
    context.restore();
  }
}

function drawCell(cell) {
  const visibility = cellVisibility(cell);
  if (!visibility.visible) return;
  const center = gridToCanvas(cell.gridX, cell.gridY);
  const size = (cellSize - 10) * visibility.scale;
  context.save();
  context.globalAlpha = visibility.alpha;
  context.fillStyle = cellColors[cell.type] ?? '#d7ceb8';
  context.strokeStyle = cell.id === selectedCellId ? '#ffffff' : 'rgb(0 0 0 / 0.45)';
  context.lineWidth = cell.id === selectedCellId ? 4 : 2;
  context.beginPath();
  context.roundRect(center.x - size / 2, center.y - size / 2, size, size, 7);
  context.fill();
  drawWeightHeatmap(cell, center, size, visibility);
  context.stroke();
  context.fillStyle = '#101313';
  context.font = '700 13px Inter, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(`${cell.type.toUpperCase().slice(0, 2)}${normalizedLayer(cell) === currentLayer ? '' : normalizedLayer(cell)}`, center.x, center.y);
  context.restore();
}

function drawWeightHeatmap(cell, center, size, visibility) {
  if (!selectedWeightJointId || !tool.startsWith('weight')) return;
  const influence = weightForJoint(cell.id, selectedWeightJointId);
  if (influence <= 0) return;
  context.save();
  context.globalAlpha = visibility.alpha * Math.min(0.82, 0.18 + influence * 0.64);
  context.fillStyle = '#f7c06a';
  context.beginPath();
  context.roundRect(center.x - size / 2, center.y - size / 2, size, size, 7);
  context.fill();
  context.restore();
}

function drawAxes() {
  const origin = gridToCanvas(0, 0);
  context.strokeStyle = 'rgb(111 224 191 / 0.6)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(gridPad, origin.y);
  context.lineTo(canvas.width - gridPad, origin.y);
  context.stroke();
  context.beginPath();
  context.moveTo(origin.x, gridPad);
  context.lineTo(origin.x, canvas.height - gridPad);
  context.stroke();
}

function renderLists() {
  cellList.replaceChildren(
    ...[...definition.cells]
      .sort((a, b) => normalizedLayer(a) - normalizedLayer(b) || a.gridY - b.gridY || a.gridX - b.gridX || a.id.localeCompare(b.id))
      .map((cell) => {
      const item = document.createElement('div');
      item.className = 'item';
      const label = document.createElement('span');
      label.innerHTML = `<strong>${escapeHtml(cell.id)}</strong><br />${escapeHtml(cell.type)} at ${cell.gridX}, ${cell.gridY}, ${normalizedLayer(cell)}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'danger';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        removeCell(cell.id);
        render();
      });
      item.addEventListener('click', () => {
        selectedCellId = cell.id;
        currentLayer = clampLayer(normalizedLayer(cell));
        syncDefinitionToFields();
        render();
      });
      item.append(label, remove);
      return item;
    }),
  );
  connectionList.replaceChildren(
    ...(definition.connections ?? []).map((edge, index) => {
      const item = document.createElement('div');
      item.className = 'item';
      const label = document.createElement('span');
      label.innerHTML = `<strong>${escapeHtml(edge.a)}</strong> ${escapeHtml(edge.aSide)} -> <strong>${escapeHtml(edge.b)}</strong> ${escapeHtml(edge.bSide ?? '')}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'danger';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        definition.connections.splice(index, 1);
        render();
      });
      item.append(label, remove);
      return item;
    }),
  );
}

function renderJson() {
  jsonOutput.value = `${JSON.stringify(normalizedDefinition(), null, 2)}\n`;
}

function renderStatus() {
  const normalized = normalizedDefinition();
  const report = validateConstructDefinition(normalized);
  const graphReport = animationGraphEnabled ? validateAnimationGraph(definition.animationGraph, definition.poseRig) : { valid: true, errors: [], warnings: [] };
  const valid = report.valid && graphReport.valid;
  const moduleSummary = constructModuleSummary(definition);
  const selectedEntry = constructCatalog.find((entry) => entry.key === constructSelect.value);
  const lines = [
    `<span><strong>${valid ? 'Valid construct asset' : 'Construct needs changes'}</strong></span>`,
    selectedEntry ? `<span>Loaded from ${escapeHtml(selectedEntry.group)}: ${escapeHtml(selectedEntry.label)}</span>` : null,
    `<span>Layer ${currentLayer}: ${cellsOnLayer(currentLayer).length} visible cells; ${definition.cells.length} total cells, ${(definition.connections ?? []).length} explicit connections</span>`,
    connectionActionMessage ? `<span>${escapeHtml(connectionActionMessage)}</span>` : null,
    `<span>${moduleSummary.guns} firing points, main-gun rate x${moduleSummary.gunRateMultiplier}</span>`,
    `<span>${moduleSummary.engines} engines, acceleration/top speed x${moduleSummary.engineMultiplier}</span>`,
    `<span>${moduleSummary.wheels} wheels, braking/control x${moduleSummary.wheelMultiplier}${moduleSummary.wheelAsymmetry ? ', asymmetric pull likely' : ''}</span>`,
    `<span>Pose rig: ${escapeHtml(poseRigSummary(definition.poseRig))}</span>`,
    animationGraphEnabled ? `<span>Animation graph: ${escapeHtml(animationGraphSummary(definition.animationGraph))}</span>` : null,
  ].filter(Boolean);
  const selectedLoadout = normalizeGunLoadouts(definition).find((loadout) => loadout.cellId === selectedCellId);
  if (selectedLoadout) lines.push(`<span>Selected gun loadout: ${escapeHtml(loadoutLabel(selectedLoadout))}</span>`);
  for (const weaponId of installedPrimaryWeaponIds(definition)) {
    lines.push(`<span>${escapeHtml(labelForWeapon(weaponId))} stack x${multiplierText(weaponStackMultiplier(definition, weaponId))}</span>`);
  }
  for (const weaponId of installedSecondaryWeaponIds(definition)) {
    const copies = secondaryWeaponCopyCount(definition, weaponId);
    lines.push(
      `<span>${escapeHtml(labelForWeapon(weaponId))} stack x${multiplierText(weaponStackMultiplier(definition, weaponId))}, ammo cap ${escapeHtml(formatAmmoCapacity(secondaryAmmoCapacity(weaponId, definition)))} from ${copies} mounted</span>`,
    );
  }
  lines.push(...report.errors.map((error) => `<span class="error">Error: ${escapeHtml(error)}</span>`));
  lines.push(...graphReport.errors.map((error) => `<span class="error">Animation graph: ${escapeHtml(error)}</span>`));
  lines.push(...report.warnings.map((warning) => `<span class="warning">Warning: ${escapeHtml(warning)}</span>`));
  lines.push(...graphReport.warnings.map((warning) => `<span class="warning">Animation graph: ${escapeHtml(warning)}</span>`));
  statusPanel.innerHTML = lines.join('');
}

function renderLookupPanel() {
  if (!lookupPanel) return;
  const tags = definition.tags ?? [];
  const finderTags = tags.filter((tag) => tag.startsWith('dev-lookup:') || tag.startsWith('runtime-hook:'));
  const shownTags = finderTags.length ? finderTags : tags.slice(0, 4);
  lookupPanel.innerHTML = [
    `<span><strong>Dev lookup</strong></span>`,
    `<span>Asset: <code>${escapeHtml(definition.assetId || 'untitled')}</code></span>`,
    shownTags.length ? `<span>Tags: ${shownTags.map((tag) => `<code>${escapeHtml(tag)}</code>`).join(' ')}</span>` : null,
  ]
    .filter(Boolean)
    .join('');
}

function renderPoseRigControls() {
  definition.poseRig = normalizePoseRigDraft(definition.poseRig);
  poseRigStatus.innerHTML = [
    `<span><strong>Pose rig</strong></span>`,
    `<span>${escapeHtml(poseRigSummary(definition.poseRig))}</span>`,
  ].join('');
  populateRigSelect(poseGroupSelect, definition.poseRig.groups, 'New group', selectedPoseGroupId);
  populateRigSelect(poseJointSelect, definition.poseRig.joints, 'New joint', selectedPoseJointId);
  populateRigSelect(weightJointSelect, definition.poseRig.joints, 'Select joint', selectedWeightJointId);
  populateRigSelect(weightBlendJointSelect, definition.poseRig.joints, 'Blend joint', selectedBlendJointId);
  populateRigSelect(poseSelect, definition.poseRig.poses, 'New pose', selectedPoseId);
  populateRigSelect(poseAnimationSelect, definition.poseRig.animations, 'New animation', selectedPoseAnimationId);
  syncPoseGroupFields();
  syncPoseJointFields();
  renderWeightBindingPanel();
  syncPoseFields();
  syncPoseAnimationFields();
  poseRigJsonOutput.value = `${JSON.stringify(definition.poseRig, null, 2)}\n`;
}

function populateRigSelect(select, items, blankLabel, selectedId) {
  const previous = selectedId && items.some((item) => item.id === selectedId) ? selectedId : '';
  select.replaceChildren(new Option(blankLabel, ''));
  for (const item of items) select.append(new Option(item.id, item.id));
  select.value = previous;
}

function syncPoseGroupFields() {
  const group = definition.poseRig.groups.find((entry) => entry.id === selectedPoseGroupId);
  poseGroupIdInput.value = group?.id ?? '';
  poseGroupRoleInput.value = group?.role ?? '';
  poseGroupSelectorInput.value = group?.selector ?? '';
  poseGroupCellsInput.value = (group?.cells ?? []).join(', ');
  setVectorInputs(poseGroupPivotInputs, group?.pivot ?? [0, 0, 0]);
}

function syncPoseJointFields() {
  const joint = definition.poseRig.joints.find((entry) => entry.id === selectedPoseJointId);
  poseJointIdInput.value = joint?.id ?? '';
  poseJointGroupInput.value = joint?.group ?? '';
  poseJointKindSelect.value = joint?.kind ?? 'fixed';
  setVectorInputs(poseJointAxisInputs, joint?.axis ?? [0, 0, 1]);
  setVectorInputs(poseJointTranslateInputs, joint?.defaultTransform?.translate ?? [0, 0, 0]);
}

function syncPoseFields() {
  const pose = definition.poseRig.poses.find((entry) => entry.id === selectedPoseId);
  const transform = pose?.transforms?.[0];
  poseIdInput.value = pose?.id ?? '';
  poseTransformTargetInput.value = transform?.target ?? '';
  setVectorInputs(poseTransformInputs, transform?.translate ?? [transform?.x ?? 0, transform?.y ?? 0, transform?.z ?? 0]);
  poseTransformRotationInput.value = String(transform?.rotation ?? 0);
  setVectorInputs(poseTransformPivotInputs, transform?.pivot ?? [0, 0, 0]);
}

function syncPoseAnimationFields() {
  const animation = definition.poseRig.animations.find((entry) => entry.id === selectedPoseAnimationId);
  poseAnimationIdInput.value = animation?.id ?? '';
  poseAnimationKindSelect.value = animation?.kind ?? 'oscillate';
  poseAnimationTargetInput.value = animation?.target ?? '';
  poseAnimationPropertySelect.value = animation?.property ?? 'translateY';
  poseAnimationAmplitudeInput.value = String(animation?.amplitude ?? 12);
  poseAnimationFrequencyInput.value = String(animation?.frequency ?? 1);
  poseAnimationPhaseInput.value = String(animation?.phase ?? 0);
  poseAnimationDriverSelect.value = animation?.driver ?? 'time';
  poseAnimationRotationOffsetInput.value = String(animation?.rotationOffset ?? 0);
  poseAnimationKeyframesInput.value = animation?.keyframes ? JSON.stringify(animation.keyframes, null, 2) : '';
}

function savePoseGroup() {
  const group = createGroupDescriptor({
    id: poseGroupIdInput.value,
    role: poseGroupRoleInput.value,
    selector: poseGroupSelectorInput.value,
    cells: poseGroupCellsInput.value,
    pivot: vectorFromInputs(poseGroupPivotInputs),
  });
  definition.poseRig.groups = upsertById(definition.poseRig.groups, group);
  selectedPoseGroupId = group.id;
  render();
}

function removePoseGroup() {
  if (!selectedPoseGroupId) return;
  definition.poseRig.groups = definition.poseRig.groups.filter((group) => group.id !== selectedPoseGroupId);
  definition.poseRig.joints = definition.poseRig.joints.filter((joint) => joint.group !== selectedPoseGroupId);
  definition.poseRig.animations = definition.poseRig.animations.filter((animation) => animation.target !== `group:${selectedPoseGroupId}`);
  for (const pose of definition.poseRig.poses) {
    pose.transforms = (pose.transforms ?? []).filter((transform) => transform.target !== `group:${selectedPoseGroupId}`);
  }
  selectedPoseGroupId = null;
  render();
}

function savePoseJoint() {
  const joint = createJointDescriptor({
    id: poseJointIdInput.value,
    group: poseJointGroupInput.value,
    kind: poseJointKindSelect.value,
    axis: vectorFromInputs(poseJointAxisInputs),
    defaultTranslate: vectorFromInputs(poseJointTranslateInputs),
  });
  definition.poseRig.joints = upsertById(definition.poseRig.joints, joint);
  selectedPoseJointId = joint.id;
  if (!selectedWeightJointId) selectedWeightJointId = joint.id;
  render();
}

function removePoseJoint() {
  if (!selectedPoseJointId) return;
  definition.poseRig.joints = definition.poseRig.joints.filter((joint) => joint.id !== selectedPoseJointId);
  for (const cellId of Object.keys(definition.poseRig.cellBindings ?? {})) {
    eraseWeightFromCell(cellId, selectedPoseJointId);
  }
  if (selectedWeightJointId === selectedPoseJointId) selectedWeightJointId = null;
  if (selectedBlendJointId === selectedPoseJointId) selectedBlendJointId = null;
  selectedPoseJointId = null;
  render();
}

function renderWeightBindingPanel() {
  const selectedCell = definition.cells.find((cell) => cell.id === selectedCellId);
  const influences = selectedCell ? definition.poseRig.cellBindings?.[selectedCell.id] ?? [] : [];
  weightBindingPanel.innerHTML = [
    `<span><strong>Selected cell weights</strong></span>`,
    selectedCell ? `<span>Cell: <code>${escapeHtml(selectedCell.id)}</code></span>` : '<span>No cell selected</span>',
    selectedWeightJointId ? `<span>Heatmap joint: <code>${escapeHtml(selectedWeightJointId)}</code></span>` : '<span>No heatmap joint selected</span>',
    influences.length
      ? `<span>${influences.map((influence) => `${escapeHtml(influence.joint)} ${multiplierText(influence.weight)}`).join(', ')}</span>`
      : '<span>No explicit weighted binding</span>',
  ].join('');
}

function fillSelectedWeight() {
  if (!selectedCellId) return;
  applyWeightToCell(selectedCellId);
  render();
}

function normalizeSelectedWeight() {
  if (!selectedCellId) return;
  setCellBinding(selectedCellId, definition.poseRig.cellBindings?.[selectedCellId] ?? []);
  render();
}

function blendSelectedWeight() {
  if (!selectedCellId || !selectedWeightJointId || !selectedBlendJointId || selectedWeightJointId === selectedBlendJointId) return;
  setCellBinding(selectedCellId, [
    { joint: selectedWeightJointId, weight: 0.5 },
    { joint: selectedBlendJointId, weight: 0.5 },
  ]);
  render();
}

function smoothSelectedWeight() {
  if (!selectedCellId) return;
  const neighbors = connectedCellIds(selectedCellId);
  const sampleBindings = [definition.poseRig.cellBindings?.[selectedCellId] ?? [], ...neighbors.map((id) => definition.poseRig.cellBindings?.[id] ?? [])].filter(
    (entries) => entries.length > 0,
  );
  if (sampleBindings.length === 0) return;
  const totals = new Map();
  for (const entries of sampleBindings) {
    for (const influence of entries) totals.set(influence.joint, (totals.get(influence.joint) ?? 0) + influence.weight / sampleBindings.length);
  }
  const smoothed = [...totals.entries()]
    .map(([joint, weight]) => ({ joint, weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_CELL_BINDING_INFLUENCES);
  setCellBinding(selectedCellId, smoothed);
  render();
}

function applyWeightToCell(cellId) {
  if (!selectedWeightJointId) return;
  const weight = Math.max(0.001, Math.min(1, Number(weightValueInput.value) || 1));
  const previous = definition.poseRig.cellBindings?.[cellId] ?? [];
  const retained = previous
    .filter((influence) => influence.joint !== selectedWeightJointId)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_CELL_BINDING_INFLUENCES - 1);
  setCellBinding(cellId, [...retained, { joint: selectedWeightJointId, weight }]);
}

function eraseWeightFromCell(cellId, jointId = selectedWeightJointId) {
  if (!jointId) return;
  const previous = definition.poseRig.cellBindings?.[cellId] ?? [];
  setCellBinding(
    cellId,
    previous.filter((influence) => influence.joint !== jointId),
  );
}

function setCellBinding(cellId, influences) {
  definition.poseRig.cellBindings ??= {};
  const descriptor = createCellBindingDescriptor({ cellId, influences });
  if (!descriptor || descriptor.influences.length === 0) {
    delete definition.poseRig.cellBindings[cellId];
    return;
  }
  definition.poseRig.cellBindings[cellId] = descriptor.influences;
}

function weightForJoint(cellId, jointId) {
  return definition.poseRig?.cellBindings?.[cellId]?.find((influence) => influence.joint === jointId)?.weight ?? 0;
}

function connectedCellIds(cellId) {
  return [
    ...new Set(
      (definition.connections ?? [])
        .filter((edge) => edge.a === cellId || edge.b === cellId)
        .map((edge) => (edge.a === cellId ? edge.b : edge.a)),
    ),
  ];
}

function savePose() {
  const transform = createPoseTransformDescriptor({
    target: poseTransformTargetInput.value,
    translate: vectorFromInputs(poseTransformInputs),
    rotation: poseTransformRotationInput.value,
    pivot: vectorFromInputs(poseTransformPivotInputs),
  });
  const pose = createPoseDescriptor({ id: poseIdInput.value, transforms: transform.target ? [transform] : [] });
  definition.poseRig.poses = upsertById(definition.poseRig.poses, pose);
  selectedPoseId = pose.id;
  render();
}

function removePose() {
  if (!selectedPoseId) return;
  definition.poseRig.poses = definition.poseRig.poses.filter((pose) => pose.id !== selectedPoseId);
  for (const animation of definition.poseRig.animations) {
    if (animation.keyframes) animation.keyframes = animation.keyframes.filter((keyframe) => keyframe.pose !== selectedPoseId);
  }
  selectedPoseId = null;
  render();
}

function savePoseAnimation() {
  const animation = createAnimationDescriptor({
    id: poseAnimationIdInput.value,
    kind: poseAnimationKindSelect.value,
    target: poseAnimationTargetInput.value,
    property: poseAnimationPropertySelect.value,
    amplitude: poseAnimationAmplitudeInput.value,
    frequency: poseAnimationFrequencyInput.value,
    phase: poseAnimationPhaseInput.value,
    driver: poseAnimationDriverSelect.value,
    rotationOffset: poseAnimationRotationOffsetInput.value,
    keyframes: poseAnimationKeyframesInput.value,
  });
  definition.poseRig.animations = upsertById(definition.poseRig.animations, animation);
  selectedPoseAnimationId = animation.id;
  render();
}

function removePoseAnimation() {
  if (!selectedPoseAnimationId) return;
  definition.poseRig.animations = definition.poseRig.animations.filter((animation) => animation.id !== selectedPoseAnimationId);
  selectedPoseAnimationId = null;
  render();
}

function applyPoseRigJson() {
  try {
    definition.poseRig = normalizePoseRigDraft(JSON.parse(poseRigJsonOutput.value));
    clearPoseSelections();
    render();
  } catch (error) {
    poseRigStatus.innerHTML = `<span class="error">Error: ${escapeHtml(error.message)}</span>`;
  }
}

function renderAnimationGraphControls() {
  definition.animationGraph = normalizeAnimationGraph(definition.animationGraph ?? emptyAnimationGraph());
  const graph = definition.animationGraph;
  if (!graph.states.some((state) => state.id === selectedAnimationStateId)) selectedAnimationStateId = graph.states[0]?.id ?? null;
  if (!graph.transitions.some((transition) => transition.id === selectedAnimationTransitionId)) selectedAnimationTransitionId = graph.transitions[0]?.id ?? null;

  populateGraphSelect(animationControls.animationGraphInitialStateSelect, graph.states, 'Select initial state', graph.initialState);
  animationControls.animationGraphSeedOffsetInput.value = String(graph.seedOffset ?? 0);
  populateGraphSelect(animationControls.animationGraphStateSelect, graph.states, 'New state', selectedAnimationStateId);
  populateGraphSelect(animationControls.animationGraphTransitionSelect, graph.transitions, 'New transition', selectedAnimationTransitionId);
  populateGraphSelect(animationControls.animationTransitionFromSelect, graph.states, 'From state', animationControls.animationTransitionFromSelect.value);
  populateGraphSelect(animationControls.animationTransitionToSelect, graph.states, 'To state', animationControls.animationTransitionToSelect.value);
  populateGraphSelect(animationControls.animationStatePoseSelect, definition.poseRig?.poses ?? [], 'No pose', animationControls.animationStatePoseSelect.value);
  syncAnimationStateFields();
  syncAnimationTransitionFields();

  const report = validateAnimationGraph(graph, definition.poseRig);
  animationControls.animationGraphStatus.innerHTML = [
    `<span><strong>${animationGraphEnabled ? (report.valid ? 'Animation graph ready' : 'Animation graph needs changes') : 'Animation graph not included'}</strong></span>`,
    `<span>${escapeHtml(animationGraphSummary(graph))}</span>`,
    ...report.errors.map((error) => `<span class="error">${escapeHtml(error)}</span>`),
    ...report.warnings.map((warning) => `<span class="warning">${escapeHtml(warning)}</span>`),
  ].join('');
  animationControls.animationGraphJsonOutput.value = `${JSON.stringify(graph, null, 2)}\n`;
  drawAnimationGraph();
  renderAnimationTimeline();
}

function installAnimationGraphExample() {
  const graph = createAnimationGraphExample();
  definition.poseRig = normalizePoseRigDraft(definition.poseRig);
  const poseIds = new Set(definition.poseRig.poses.map((pose) => pose.id));
  for (const state of graph.states) {
    const poseId = state.rig?.pose;
    if (poseId && !poseIds.has(poseId)) {
      definition.poseRig.poses.push({ id: poseId, transforms: [] });
      poseIds.add(poseId);
    }
  }
  const clipIds = new Set(definition.poseRig.clips.map((clip) => clip.id));
  const referencedClips = graph.transitions.flatMap((transition) => [
    transition.channels?.rig?.clip,
    ...transition.variants.map((variant) => variant.channels?.rig?.clip),
  ]).filter(Boolean);
  for (const clipId of referencedClips) {
    if (clipIds.has(clipId)) continue;
    definition.poseRig.clips.push({ id: clipId, duration: 1, loop: false, tracks: [] });
    clipIds.add(clipId);
  }
  definition.animationGraph = graph;
  animationGraphEnabled = true;
  selectedAnimationStateId = graph.initialState;
  selectedAnimationTransitionId = graph.transitions[0]?.id ?? null;
  render();
}

function populateGraphSelect(select, items, blankLabel, selectedId) {
  select.replaceChildren(new Option(blankLabel, ''));
  for (const item of items) select.append(new Option(item.id, item.id));
  if (items.some((item) => item.id === selectedId)) select.value = selectedId;
}

function syncAnimationStateFields() {
  const state = definition.animationGraph.states.find((entry) => entry.id === selectedAnimationStateId);
  animationControls.animationGraphStateSelect.value = state?.id ?? '';
  animationControls.animationStateIdInput.value = state?.id ?? '';
  animationControls.animationStatePoseSelect.value = state?.rig?.pose ?? '';
  animationControls.animationStateTagsInput.value = (state?.tags ?? []).join(', ');
  animationControls.animationStateMaterialInput.value = state?.material?.state ?? '';
  animationControls.animationStateTextureInput.value = state?.texture?.state ?? '';
  animationControls.animationStateDwellMinInput.value = String(state?.dwell?.min ?? 0.8);
  animationControls.animationStateDwellMaxInput.value = String(state?.dwell?.max ?? 2.4);
  animationControls.animationStateXInput.value = String(state?.editorPosition?.[0] ?? 0);
  animationControls.animationStateYInput.value = String(state?.editorPosition?.[1] ?? 0);
  animationControls.animationStateNextInput.value = JSON.stringify(state?.next ?? [], null, 2);
}

function syncAnimationTransitionFields() {
  const transition = definition.animationGraph.transitions.find((entry) => entry.id === selectedAnimationTransitionId);
  animationControls.animationGraphTransitionSelect.value = transition?.id ?? '';
  animationControls.animationTransitionIdInput.value = transition?.id ?? '';
  animationControls.animationTransitionPolicySelect.value = transition?.interruptPolicy ?? 'IMMEDIATE';
  animationControls.animationTransitionFromSelect.value = transition?.from ?? selectedAnimationStateId ?? '';
  animationControls.animationTransitionToSelect.value = transition?.to ?? definition.animationGraph.states.find((state) => state.id !== selectedAnimationStateId)?.id ?? '';
  animationControls.animationTransitionDurationMinInput.value = String(transition?.duration?.min ?? 0.4);
  animationControls.animationTransitionDurationMaxInput.value = String(transition?.duration?.max ?? 0.4);
  animationControls.animationTransitionRequiredTagsInput.value = (transition?.requiredAnchorTags ?? []).join(', ');
  animationControls.animationTransitionRigClipInput.value = transition?.channels?.rig?.clip ?? '';
  animationControls.animationTransitionMaterialClipInput.value = transition?.channels?.material?.clip ?? '';
  animationControls.animationTransitionTextureClipInput.value = transition?.channels?.texture?.clip ?? '';
  animationControls.animationTransitionTextureModeSelect.value = transition?.channels?.texture?.mode ?? 'STEP';
  animationControls.animationTransitionAnchorsInput.value = JSON.stringify(transition?.interruptAnchors ?? [], null, 2);
  animationControls.animationTransitionMarkersInput.value = JSON.stringify(transition?.markers ?? [], null, 2);
  animationControls.animationTransitionVariantsInput.value = JSON.stringify(transition?.variants ?? [], null, 2);
}

function saveAnimationState() {
  try {
    const previousId = selectedAnimationStateId;
    const state = createAnimationState({
      id: animationControls.animationStateIdInput.value,
      pose: animationControls.animationStatePoseSelect.value,
      tags: animationControls.animationStateTagsInput.value,
      materialState: animationControls.animationStateMaterialInput.value,
      textureState: animationControls.animationStateTextureInput.value,
      dwellMin: animationControls.animationStateDwellMinInput.value,
      dwellMax: animationControls.animationStateDwellMaxInput.value,
      x: animationControls.animationStateXInput.value,
      y: animationControls.animationStateYInput.value,
      next: JSON.parse(animationControls.animationStateNextInput.value || '[]'),
    });
    definition.animationGraph.states = upsertByPreviousId(definition.animationGraph.states, previousId, state);
    if (previousId && previousId !== state.id) renameAnimationStateReferences(previousId, state.id);
    if (!definition.animationGraph.initialState || definition.animationGraph.initialState === previousId) definition.animationGraph.initialState = state.id;
    selectedAnimationStateId = state.id;
    animationGraphEnabled = true;
    render();
  } catch (error) {
    showAnimationGraphError(`State JSON error: ${error.message}`);
  }
}

function removeAnimationState() {
  if (!selectedAnimationStateId) return;
  const removedId = selectedAnimationStateId;
  definition.animationGraph.states = definition.animationGraph.states.filter((state) => state.id !== removedId);
  definition.animationGraph.transitions = definition.animationGraph.transitions.filter((transition) => transition.from !== removedId && transition.to !== removedId);
  for (const state of definition.animationGraph.states) state.next = state.next.filter((choice) => choice.state !== removedId);
  selectedAnimationStateId = definition.animationGraph.states[0]?.id ?? null;
  definition.animationGraph.initialState = definition.animationGraph.states.some((state) => state.id === definition.animationGraph.initialState)
    ? definition.animationGraph.initialState
    : selectedAnimationStateId ?? '';
  selectedAnimationTransitionId = definition.animationGraph.transitions[0]?.id ?? null;
  animationGraphEnabled = true;
  render();
}

function saveAnimationTransition() {
  try {
    const transition = createAnimationTransition({
      id: animationControls.animationTransitionIdInput.value,
      from: animationControls.animationTransitionFromSelect.value,
      to: animationControls.animationTransitionToSelect.value,
      durationMin: animationControls.animationTransitionDurationMinInput.value,
      durationMax: animationControls.animationTransitionDurationMaxInput.value,
      interruptPolicy: animationControls.animationTransitionPolicySelect.value,
      requiredAnchorTags: animationControls.animationTransitionRequiredTagsInput.value,
      rigClip: animationControls.animationTransitionRigClipInput.value,
      materialClip: animationControls.animationTransitionMaterialClipInput.value,
      textureClip: animationControls.animationTransitionTextureClipInput.value,
      textureMode: animationControls.animationTransitionTextureModeSelect.value,
      interruptAnchors: JSON.parse(animationControls.animationTransitionAnchorsInput.value || '[]'),
      markers: JSON.parse(animationControls.animationTransitionMarkersInput.value || '[]'),
      variants: JSON.parse(animationControls.animationTransitionVariantsInput.value || '[]'),
    });
    definition.animationGraph.transitions = upsertByPreviousId(definition.animationGraph.transitions, selectedAnimationTransitionId, transition);
    selectedAnimationTransitionId = transition.id;
    animationGraphEnabled = true;
    render();
  } catch (error) {
    showAnimationGraphError(`Transition JSON error: ${error.message}`);
  }
}

function removeAnimationTransition() {
  definition.animationGraph.transitions = definition.animationGraph.transitions.filter((transition) => transition.id !== selectedAnimationTransitionId);
  selectedAnimationTransitionId = definition.animationGraph.transitions[0]?.id ?? null;
  animationGraphEnabled = true;
  render();
}

function applyAnimationGraphJson() {
  try {
    definition.animationGraph = normalizeAnimationGraph(JSON.parse(animationControls.animationGraphJsonOutput.value));
    animationGraphEnabled = true;
    clearAnimationGraphSelections();
    selectedAnimationStateId = definition.animationGraph.initialState || definition.animationGraph.states[0]?.id || null;
    selectedAnimationTransitionId = definition.animationGraph.transitions[0]?.id ?? null;
    render();
  } catch (error) {
    showAnimationGraphError(`Animation graph JSON error: ${error.message}`);
  }
}

function renameAnimationStateReferences(previousId, nextId) {
  if (definition.animationGraph.initialState === previousId) definition.animationGraph.initialState = nextId;
  for (const transition of definition.animationGraph.transitions) {
    if (transition.from === previousId) transition.from = nextId;
    if (transition.to === previousId) transition.to = nextId;
  }
  for (const state of definition.animationGraph.states) {
    for (const choice of state.next) if (choice.state === previousId) choice.state = nextId;
  }
}

function upsertByPreviousId(items, previousId, item) {
  const index = items.findIndex((entry) => entry.id === previousId);
  if (index < 0) return [...items.filter((entry) => entry.id !== item.id), item];
  const next = [...items];
  next[index] = item;
  return next.filter((entry, entryIndex) => entry.id !== item.id || entryIndex === index);
}

function clearAnimationGraphSelections() {
  selectedAnimationStateId = null;
  selectedAnimationTransitionId = null;
}

function showAnimationGraphError(message) {
  animationControls.animationGraphStatus.innerHTML = `<span class="error">${escapeHtml(message)}</span>`;
}

function drawAnimationGraph() {
  const canvas = animationControls.animationGraphCanvas;
  const graph = definition.animationGraph;
  const positions = animationStatePositions(graph.states, canvas);
  animationGraphContext.clearRect(0, 0, canvas.width, canvas.height);
  animationGraphContext.fillStyle = '#0d1010';
  animationGraphContext.fillRect(0, 0, canvas.width, canvas.height);
  animationGraphContext.font = '700 11px Inter, sans-serif';
  animationGraphContext.textAlign = 'center';

  for (const transition of graph.transitions) {
    const from = positions.get(transition.from);
    const to = positions.get(transition.to);
    if (!from || !to) continue;
    animationGraphContext.strokeStyle = transition.id === selectedAnimationTransitionId ? '#f7c06a' : '#6fe0bf';
    animationGraphContext.lineWidth = transition.id === selectedAnimationTransitionId ? 4 : 2;
    animationGraphContext.beginPath();
    animationGraphContext.moveTo(from.x, from.y);
    animationGraphContext.lineTo(to.x, to.y);
    animationGraphContext.stroke();
    drawGraphArrow(animationGraphContext, from, to);
  }

  for (const state of graph.states) {
    const point = positions.get(state.id);
    const selected = state.id === selectedAnimationStateId;
    animationGraphContext.fillStyle = selected ? '#f7c06a' : state.id === graph.initialState ? '#6fe0bf' : '#273332';
    animationGraphContext.strokeStyle = '#f4eee4';
    animationGraphContext.lineWidth = selected ? 4 : 2;
    animationGraphContext.beginPath();
    animationGraphContext.arc(point.x, point.y, selected ? 20 : 17, 0, Math.PI * 2);
    animationGraphContext.fill();
    animationGraphContext.stroke();
    animationGraphContext.fillStyle = '#f4eee4';
    animationGraphContext.fillText(state.id, point.x, point.y + 35);
  }
  animationGraphContext.textAlign = 'left';
}

function animationStatePositions(states, canvas) {
  const positions = new Map();
  const xs = states.map((state) => Number(state.editorPosition?.[0]) || 0);
  const ys = states.map((state) => Number(state.editorPosition?.[1]) || 0);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 1);
  states.forEach((state, index) => {
    const hasAuthoredPosition = Array.isArray(state.editorPosition);
    positions.set(state.id, {
      x: hasAuthoredPosition ? 48 + (((Number(state.editorPosition[0]) || 0) - minX) / Math.max(1, maxX - minX)) * (canvas.width - 96) : 48 + (index % 4) * 100,
      y: hasAuthoredPosition ? 48 + (((Number(state.editorPosition[1]) || 0) - minY) / Math.max(1, maxY - minY)) * (canvas.height - 96) : 48 + Math.floor(index / 4) * 80,
    });
  });
  return positions;
}

function drawGraphArrow(context, from, to) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const x = to.x - Math.cos(angle) * 21;
  const y = to.y - Math.sin(angle) * 21;
  context.fillStyle = context.strokeStyle;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x - Math.cos(angle - 0.55) * 9, y - Math.sin(angle - 0.55) * 9);
  context.lineTo(x - Math.cos(angle + 0.55) * 9, y - Math.sin(angle + 0.55) * 9);
  context.closePath();
  context.fill();
}

function renderAnimationTimeline() {
  const transition = definition.animationGraph.transitions.find((entry) => entry.id === selectedAnimationTransitionId);
  const progress = Number(animationControls.animationTransitionScrubInput.value) || 0;
  if (!transition) {
    animationControls.animationTimelineStatus.innerHTML = '<span>Select a transition to inspect its interruption timeline.</span>';
    return;
  }
  const passedAnchors = transition.interruptAnchors.filter((entry) => entry.at <= progress);
  const nextAnchor = transition.interruptAnchors.find((entry) => entry.at > progress);
  const passedMarkers = transition.markers.filter((entry) => entry.at <= progress);
  animationControls.animationTimelineStatus.innerHTML = [
    `<span><strong>${escapeHtml(transition.from)} -> ${escapeHtml(transition.to)}</strong> at ${Math.round(progress * 100)}%</span>`,
    `<span>Policy: ${escapeHtml(transition.interruptPolicy)}; duration ${transition.duration.min}-${transition.duration.max}s</span>`,
    `<span>Passed anchors: ${passedAnchors.length ? passedAnchors.map((entry) => escapeHtml(entry.id)).join(', ') : 'none'}</span>`,
    `<span>Next anchor: ${nextAnchor ? `${escapeHtml(nextAnchor.id)} at ${Math.round(nextAnchor.at * 100)}%` : 'none'}</span>`,
    `<span>Markers emitted: ${passedMarkers.length ? passedMarkers.map((entry) => escapeHtml(entry.id)).join(', ') : 'none'}</span>`,
  ].join('');
}

function applyWalkerStridePreset() {
  const rig = createWalkerStrideRigForConstruct(definition);
  if (!hasPoseRigContent(rig)) {
    poseRigStatus.innerHTML = '<span class="warning">Walker preset needs cells tagged with role supportLeg, legArmor, or legJoint.</span>';
    return;
  }
  definition.poseRig = rig;
  clearPoseSelections();
  render();
}

function applyCannonAimPreset() {
  definition.poseRig = createCannonAimRigForConstruct(definition);
  clearPoseSelections();
  render();
}

function clearPoseSelections() {
  selectedPoseGroupId = null;
  selectedPoseJointId = null;
  selectedPoseId = null;
  selectedPoseAnimationId = null;
  selectedWeightJointId = null;
  selectedBlendJointId = null;
}

function upsertById(items, item) {
  return [...items.filter((entry) => entry.id !== item.id), item];
}

function vectorFromInputs(inputs) {
  return parseVector(inputs.map((input) => input.value));
}

function setVectorInputs(inputs, vector) {
  inputs.forEach((input, index) => {
    input.value = String(vector[index] ?? 0);
  });
}

function constructModuleSummary(construct) {
  const cells = construct.cells ?? [];
  const guns = countCells(cells, 'gun');
  const engines = countCells(cells, 'engine');
  const wheels = countCells(cells, 'wheel');
  const leftWheels = cells.filter((cell) => cell.type === 'wheel' && cell.gridX < 0).length;
  const rightWheels = cells.filter((cell) => cell.type === 'wheel' && cell.gridX > 0).length;
  return {
    guns,
    engines,
    wheels,
    gunRateMultiplier: multiplierText(Math.sqrt(Math.max(guns, 1))),
    engineMultiplier: multiplierText(Math.sqrt(Math.max(engines, 1))),
    wheelMultiplier: multiplierText(Math.sqrt(Math.max(wheels, 1))),
    wheelAsymmetry: wheels > 1 && Math.abs(leftWheels - rightWheels) > 1,
  };
}

function countCells(cells, type) {
  return cells.filter((cell) => cell.type === type).length;
}

function multiplierText(value) {
  return value.toFixed(2).replace(/\.?0+$/, '');
}

function normalizedDefinition() {
  const poseRig = normalizePoseRigDraft(definition.poseRig);
  const normalized = {
    schemaVersion: definition.schemaVersion ?? CONSTRUCT_SCHEMA_VERSION,
    assetId: definition.assetId ?? '',
    displayName: definition.displayName,
    author: definition.author,
    provenance: definition.provenance,
    canonStatus: definition.canonStatus ?? 'EXPERIMENTAL',
    dependencies: definition.dependencies,
    derivedFrom: definition.derivedFrom,
    tags: definition.tags ?? [],
    cells: [...definition.cells].map(normalizedCell).sort((a, b) => a.gridZ - b.gridZ || a.gridY - b.gridY || a.gridX - b.gridX || a.id.localeCompare(b.id)),
    connections: [...(definition.connections ?? [])],
    modules: definition.modules ?? [],
    gunLoadouts: normalizeGunLoadouts(definition),
  };
  if (hasPoseRigContent(poseRig)) normalized.poseRig = poseRig;
  if (animationGraphEnabled) normalized.animationGraph = normalizeAnimationGraph(definition.animationGraph);
  return normalized;
}

function populateLoadoutSelects() {
  for (const select of loadoutSelects) {
    const allowed = select.dataset.slotKind === 'primary' ? PRIMARY_WEAPON_IDS : SECONDARY_WEAPON_IDS;
    select.replaceChildren(new Option('None', ''));
    for (const id of allowed) select.append(new Option(labelForWeapon(id), id));
  }
}

function syncLoadoutControls() {
  const selectedCell = definition.cells.find((cell) => cell.id === selectedCellId);
  const selectedLoadout = normalizeGunLoadouts(definition).find((loadout) => loadout.cellId === selectedCellId);
  for (const select of loadoutSelects) {
    const slotKind = select.dataset.slotKind;
    const slotIndex = Number(select.dataset.slotIndex);
    const enabled = selectedCell?.type === 'gun' && selectedLoadout;
    select.disabled = !enabled;
    select.value = enabled ? selectedLoadout[slotKind][slotIndex] ?? '' : '';
  }
}

function installedPrimaryWeaponIds(construct) {
  return [
    ...new Set(
      normalizeGunLoadouts(construct)
        .flatMap((loadout) => loadout.primary)
        .filter(Boolean),
    ),
  ];
}

function installedSecondaryWeaponIds(construct) {
  return [
    ...new Set(
      normalizeGunLoadouts(construct)
        .flatMap((loadout) => loadout.secondary)
        .filter(Boolean),
    ),
  ];
}

function secondaryWeaponCopyCount(construct, weaponId) {
  return normalizeGunLoadouts(construct).reduce((sum, loadout) => sum + loadout.secondary.filter((id) => id === weaponId).length, 0);
}

function formatAmmoCapacity(value) {
  return Number.isFinite(value) ? String(value) : 'unlimited';
}

function loadoutLabel(loadout) {
  const primary = loadout.primary.slice(0, MAX_PRIMARY_SLOTS).map((id) => id || 'empty').join(', ');
  const secondary = loadout.secondary.slice(0, MAX_SECONDARY_SLOTS).map((id) => id || 'empty').join(', ');
  return `primary ${primary}; secondary ${secondary}`;
}

function labelForWeapon(id) {
  return id
    .replaceAll('_', ' ')
    .replaceAll('.', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function labelForConstruct(construct) {
  const name = construct.displayName ?? construct.assetId ?? 'Untitled Construct';
  const count = Array.isArray(construct.cells) ? construct.cells.length : 0;
  return `${name} (${construct.assetId ?? 'new'}, ${count} cells)`;
}

function applyJsonFromOutput() {
  try {
    const parsed = JSON.parse(jsonOutput.value);
    loadDefinition(parsed);
  } catch (error) {
    statusPanel.innerHTML = `<span class="error">Error: ${escapeHtml(error.message)}</span>`;
  }
}

async function copyJson() {
  await navigator.clipboard.writeText(jsonOutput.value);
}

function downloadJson() {
  const blob = new Blob([jsonOutput.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${definition.assetId || 'construct'}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function setTool(nextTool) {
  tool = nextTool;
  paintButton.setAttribute('aria-pressed', String(tool === 'paint'));
  eraseButton.setAttribute('aria-pressed', String(tool === 'erase'));
  connectButton.setAttribute('aria-pressed', String(tool === 'connect'));
  removeConnectionButton.setAttribute('aria-pressed', String(tool === 'removeConnection'));
  weightPaintButton.setAttribute('aria-pressed', String(tool === 'weightPaint'));
  weightEraseButton.setAttribute('aria-pressed', String(tool === 'weightErase'));
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function pointToGrid(point) {
  if (point.x < gridPad || point.y < gridPad || point.x > canvas.width - gridPad || point.y > canvas.height - gridPad) return null;
  return {
    x: Math.floor((point.x - gridPad) / cellSize) - gridRadius,
    y: Math.floor((point.y - gridPad) / cellSize) - gridRadius,
  };
}

function gridToCanvas(gridX, gridY) {
  return {
    x: gridPad + (gridX + gridRadius + 0.5) * cellSize,
    y: gridPad + (gridY + gridRadius + 0.5) * cellSize,
  };
}

function cellAt(gridX, gridY, gridZ = currentLayer) {
  return definition.cells.find((cell) => cell.gridX === gridX && cell.gridY === gridY && normalizedLayer(cell) === gridZ);
}

function uniqueCellId(type, gridX, gridY, gridZ = currentLayer) {
  const zPart = gridZ === 0 ? '' : `-${gridZ}`;
  const base = `${type}-${gridX}-${gridY}${zPart}`.replaceAll('-', gridX < 0 || gridY < 0 || gridZ < 0 ? '_' : '-');
  let id = base;
  let suffix = 2;
  const ids = new Set(definition.cells.map((cell) => cell.id));
  while (ids.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function adjacentSide(a, b) {
  const dx = b.gridX - a.gridX;
  const dy = b.gridY - a.gridY;
  const dz = normalizedLayer(b) - normalizedLayer(a);
  if (dz === 0 && dx === 1 && dy === 0) return 'right';
  if (dz === 0 && dx === -1 && dy === 0) return 'left';
  if (dz === 0 && dx === 0 && dy === 1) return 'bottom';
  if (dz === 0 && dx === 0 && dy === -1) return 'top';
  if (dx === 0 && dy === 0 && dz === 1) return 'above';
  if (dx === 0 && dy === 0 && dz === -1) return 'below';
  return null;
}

function oppositeSide(side) {
  return {
    top: 'bottom',
    right: 'left',
    bottom: 'top',
    left: 'right',
    above: 'below',
    below: 'above',
  }[side];
}

function sameConnection(edge, a, b) {
  return (edge.a === a && edge.b === b) || (edge.a === b && edge.b === a);
}

function addConnection(from, to, side) {
  const exists = definition.connections.some((edge) => sameConnection(edge, from.id, to.id));
  if (!exists) definition.connections.push({ a: from.id, b: to.id, aSide: side, bSide: oppositeSide(side), type: 'structural' });
}

function normalizedLayer(cell) {
  return Number.isInteger(cell?.gridZ) ? cell.gridZ : Number.isInteger(cell?.layer) ? cell.layer : 0;
}

function normalizedCell(cell) {
  return { ...cell, gridZ: normalizedLayer(cell) };
}

function layerForInitialView(construct) {
  const core = construct.cells?.find((cell) => cell.type === 'core');
  return normalizedLayer(core ?? construct.cells?.[0]);
}

function clampLayer(value) {
  return Math.max(0, Math.min(maxEditorLayer, Number.isFinite(value) ? Math.round(value) : 0));
}

function cellsOnLayer(layer) {
  return definition.cells.filter((cell) => normalizedLayer(cell) === layer);
}

function cellVisibility(cell) {
  const layer = normalizedLayer(cell);
  if (layer === currentLayer) return { visible: true, alpha: 1, scale: 1 };
  if (layer < currentLayer && (layerViewSelect.value === 'lower' || layerViewSelect.value === 'all')) {
    return { visible: true, alpha: 0.22, scale: 0.86 };
  }
  if (layer > currentLayer && layerViewSelect.value === 'all') {
    return { visible: true, alpha: 0.12, scale: 0.74 };
  }
  return { visible: false, alpha: 0, scale: 1 };
}

function connectionVisibility(a, b) {
  const aVisible = cellVisibility(a);
  const bVisible = cellVisibility(b);
  if (!aVisible.visible && !bVisible.visible) return { visible: false, alpha: 0 };
  return { visible: true, alpha: Math.max(0.12, Math.min(aVisible.alpha || 0, bVisible.alpha || 0) || Math.max(aVisible.alpha, bVisible.alpha) * 0.6) };
}

function cloneDefinition(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
