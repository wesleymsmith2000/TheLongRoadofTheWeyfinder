import {
  CANON_STATUSES,
  CELL_TYPES,
  CONNECTION_SIDES,
  CONSTRUCT_SCHEMA_VERSION,
  validateConstructDefinition,
} from '../core/constructDefinition.js';
import basicTurretDefinition from '../../content/constructs/basic_turret.json' with { type: 'json' };

const canvas = document.querySelector('#constructCanvas');
const context = canvas.getContext('2d');
const assetIdInput = document.querySelector('#assetIdInput');
const schemaInput = document.querySelector('#schemaInput');
const canonStatusSelect = document.querySelector('#canonStatusSelect');
const tagsInput = document.querySelector('#tagsInput');
const cellTypeSelect = document.querySelector('#cellTypeSelect');
const paintButton = document.querySelector('#paintButton');
const eraseButton = document.querySelector('#eraseButton');
const connectButton = document.querySelector('#connectButton');
const resetButton = document.querySelector('#resetButton');
const downloadButton = document.querySelector('#downloadButton');
const copyJsonButton = document.querySelector('#copyJsonButton');
const applyJsonButton = document.querySelector('#applyJsonButton');
const jsonOutput = document.querySelector('#jsonOutput');
const statusPanel = document.querySelector('#statusPanel');
const cellList = document.querySelector('#cellList');
const connectionList = document.querySelector('#connectionList');

const cellColors = {
  armor: '#818a8b',
  core: '#f7c06a',
  engine: '#6fe0bf',
  gun: '#ff8f70',
  wheel: '#9ca8ff',
};
const gridRadius = 4;
const gridCount = gridRadius * 2 + 1;
const gridPad = 44;
const gridSize = canvas.width - gridPad * 2;
const cellSize = gridSize / gridCount;

let tool = 'paint';
let selectedCellId = null;
let definition = cloneDefinition(basicTurretDefinition);

for (const status of CANON_STATUSES) {
  canonStatusSelect.append(new Option(status, status));
}
for (const type of CELL_TYPES) {
  cellTypeSelect.append(new Option(type, type));
}

canvas.addEventListener('click', handleCanvasClick);
assetIdInput.addEventListener('input', syncFieldsToDefinition);
schemaInput.addEventListener('input', syncFieldsToDefinition);
canonStatusSelect.addEventListener('change', syncFieldsToDefinition);
tagsInput.addEventListener('input', syncFieldsToDefinition);
paintButton.addEventListener('click', () => setTool('paint'));
eraseButton.addEventListener('click', () => setTool('erase'));
connectButton.addEventListener('click', () => setTool('connect'));
resetButton.addEventListener('click', () => loadDefinition(basicTurretDefinition));
downloadButton.addEventListener('click', downloadJson);
copyJsonButton.addEventListener('click', copyJson);
applyJsonButton.addEventListener('click', applyJsonFromOutput);

loadDefinition(definition);

function loadDefinition(nextDefinition) {
  definition = cloneDefinition(nextDefinition);
  definition.schemaVersion ??= CONSTRUCT_SCHEMA_VERSION;
  definition.canonStatus ??= 'EXPERIMENTAL';
  definition.tags ??= [];
  definition.cells ??= [];
  definition.connections ??= [];
  definition.modules ??= [];
  selectedCellId = null;
  syncDefinitionToFields();
  render();
}

function syncDefinitionToFields() {
  assetIdInput.value = definition.assetId ?? '';
  schemaInput.value = definition.schemaVersion ?? CONSTRUCT_SCHEMA_VERSION;
  canonStatusSelect.value = definition.canonStatus ?? 'EXPERIMENTAL';
  tagsInput.value = (definition.tags ?? []).join(', ');
}

function syncFieldsToDefinition() {
  definition.assetId = assetIdInput.value.trim();
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
  const existing = cellAt(grid.x, grid.y);
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
    const id = uniqueCellId(cellTypeSelect.value, grid.x, grid.y);
    definition.cells.push({ id, type: cellTypeSelect.value, gridX: grid.x, gridY: grid.y });
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

function removeCell(id) {
  definition.cells = definition.cells.filter((cell) => cell.id !== id);
  definition.connections = definition.connections.filter((edge) => edge.a !== id && edge.b !== id);
  if (selectedCellId === id) selectedCellId = null;
}

function render() {
  syncFieldsToDefinitionSilently();
  drawCanvas();
  renderLists();
  renderJson();
  renderStatus();
}

function syncFieldsToDefinitionSilently() {
  definition.assetId = assetIdInput.value.trim();
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
  context.lineWidth = 5;
  context.lineCap = 'round';
  context.strokeStyle = '#f7c06a';
  for (const edge of definition.connections ?? []) {
    const a = definition.cells.find((cell) => cell.id === edge.a);
    const b = definition.cells.find((cell) => cell.id === edge.b);
    if (!a || !b) continue;
    const start = gridToCanvas(a.gridX, a.gridY);
    const end = gridToCanvas(b.gridX, b.gridY);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }
}

function drawCell(cell) {
  const center = gridToCanvas(cell.gridX, cell.gridY);
  const size = cellSize - 10;
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
  context.fillText(cell.type.toUpperCase().slice(0, 2), center.x, center.y);
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
    ...definition.cells.map((cell) => {
      const item = document.createElement('div');
      item.className = 'item';
      const label = document.createElement('span');
      label.innerHTML = `<strong>${escapeHtml(cell.id)}</strong><br />${escapeHtml(cell.type)} at ${cell.gridX}, ${cell.gridY}`;
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
  const lines = [
    `<span><strong>${report.valid ? 'Valid construct asset' : 'Construct needs changes'}</strong></span>`,
    `<span>${definition.cells.length} cells, ${(definition.connections ?? []).length} explicit connections</span>`,
  ];
  lines.push(...report.errors.map((error) => `<span class="error">Error: ${escapeHtml(error)}</span>`));
  lines.push(...report.warnings.map((warning) => `<span class="warning">Warning: ${escapeHtml(warning)}</span>`));
  statusPanel.innerHTML = lines.join('');
}

function normalizedDefinition() {
  return {
    schemaVersion: definition.schemaVersion ?? CONSTRUCT_SCHEMA_VERSION,
    assetId: definition.assetId ?? '',
    author: definition.author,
    provenance: definition.provenance,
    canonStatus: definition.canonStatus ?? 'EXPERIMENTAL',
    dependencies: definition.dependencies,
    derivedFrom: definition.derivedFrom,
    tags: definition.tags ?? [],
    cells: [...definition.cells].sort((a, b) => a.gridY - b.gridY || a.gridX - b.gridX || a.id.localeCompare(b.id)),
    connections: [...(definition.connections ?? [])],
    modules: definition.modules ?? [],
  };
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

function cellAt(gridX, gridY) {
  return definition.cells.find((cell) => cell.gridX === gridX && cell.gridY === gridY);
}

function uniqueCellId(type, gridX, gridY) {
  const base = `${type}-${gridX}-${gridY}`.replaceAll('-', gridX < 0 || gridY < 0 ? '_' : '-');
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
  if (dx === 1 && dy === 0) return 'right';
  if (dx === -1 && dy === 0) return 'left';
  if (dx === 0 && dy === 1) return 'bottom';
  if (dx === 0 && dy === -1) return 'top';
  return null;
}

function oppositeSide(side) {
  return CONNECTION_SIDES[(CONNECTION_SIDES.indexOf(side) + 2) % CONNECTION_SIDES.length];
}

function sameConnection(edge, a, b) {
  return (edge.a === a && edge.b === b) || (edge.a === b && edge.b === a);
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
