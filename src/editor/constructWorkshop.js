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
const connectAboveButton = document.querySelector('#connectAboveButton');
const connectBelowButton = document.querySelector('#connectBelowButton');
const resetButton = document.querySelector('#resetButton');
const downloadButton = document.querySelector('#downloadButton');
const copyJsonButton = document.querySelector('#copyJsonButton');
const applyJsonButton = document.querySelector('#applyJsonButton');
const jsonOutput = document.querySelector('#jsonOutput');
const statusPanel = document.querySelector('#statusPanel');
const cellList = document.querySelector('#cellList');
const connectionList = document.querySelector('#connectionList');
const loadoutSelects = [
  document.querySelector('#primarySlot0Select'),
  document.querySelector('#primarySlot1Select'),
  document.querySelector('#secondarySlot0Select'),
  document.querySelector('#secondarySlot1Select'),
  document.querySelector('#secondarySlot2Select'),
];

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
let selectedCellId = null;
let constructCatalog = [];
let currentLayer = 0;
let definition = cloneDefinition(BUILTIN_CONSTRUCT_DEFINITIONS[0]);

for (const status of CANON_STATUSES) {
  canonStatusSelect.append(new Option(status, status));
}
for (const type of CELL_TYPES) {
  cellTypeSelect.append(new Option(type, type));
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

loadDefinition(definition);

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
  selectedCellId = null;
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
  if (tool === 'erase') {
    if (existing) removeCell(existing.id);
    render();
    return;
  }
  if (tool === 'connect') {
    if (existing) selectOrConnect(existing);
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

function selectOrConnect(cell) {
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
  if (!exists) {
    definition.connections.push({ a: from.id, b: cell.id, aSide: side, bSide: oppositeSide(side), type: 'structural' });
  }
  selectedCellId = cell.id;
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
  renderJson();
  renderStatus();
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
  context.stroke();
  context.fillStyle = '#101313';
  context.font = '700 13px Inter, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(`${cell.type.toUpperCase().slice(0, 2)}${normalizedLayer(cell) === currentLayer ? '' : normalizedLayer(cell)}`, center.x, center.y);
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
  const report = validateConstructDefinition(normalizedDefinition());
  const moduleSummary = constructModuleSummary(definition);
  const selectedEntry = constructCatalog.find((entry) => entry.key === constructSelect.value);
  const lines = [
    `<span><strong>${report.valid ? 'Valid construct asset' : 'Construct needs changes'}</strong></span>`,
    selectedEntry ? `<span>Loaded from ${escapeHtml(selectedEntry.group)}: ${escapeHtml(selectedEntry.label)}</span>` : null,
    `<span>Layer ${currentLayer}: ${cellsOnLayer(currentLayer).length} visible cells; ${definition.cells.length} total cells, ${(definition.connections ?? []).length} explicit connections</span>`,
    `<span>${moduleSummary.guns} firing points, main-gun rate x${moduleSummary.gunRateMultiplier}</span>`,
    `<span>${moduleSummary.engines} engines, acceleration/top speed x${moduleSummary.engineMultiplier}</span>`,
    `<span>${moduleSummary.wheels} wheels, braking/control x${moduleSummary.wheelMultiplier}${moduleSummary.wheelAsymmetry ? ', asymmetric pull likely' : ''}</span>`,
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
  lines.push(...report.warnings.map((warning) => `<span class="warning">Warning: ${escapeHtml(warning)}</span>`));
  statusPanel.innerHTML = lines.join('');
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
  return {
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
