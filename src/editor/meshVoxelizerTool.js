import { validateConstructDefinition } from '../core/constructDefinition.js';
import { parseMeshBuffer, parseMeshText, summarizeMesh, voxelizeMeshToConstruct } from './meshVoxelizer.js';
import { bindBuildVersion } from './versionBadge.js';

const canvas = document.querySelector('#voxelCanvas');
const context = canvas.getContext('2d');
const fileInput = document.querySelector('#meshFileInput');
const importButton = document.querySelector('#importMeshButton');
const voxelizeButton = document.querySelector('#voxelizeButton');
const downloadButton = document.querySelector('#downloadButton');
const copyJsonButton = document.querySelector('#copyJsonButton');
const applyJsonButton = document.querySelector('#applyJsonButton');
const assetIdInput = document.querySelector('#assetIdInput');
const displayNameInput = document.querySelector('#displayNameInput');
const spanInput = document.querySelector('#spanInput');
const sampleDensityInput = document.querySelector('#sampleDensityInput');
const previewLayerInput = document.querySelector('#previewLayerInput');
const jsonOutput = document.querySelector('#jsonOutput');
const statusPanel = document.querySelector('#statusPanel');

bindBuildVersion();

let mesh = null;
let construct = null;

importButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', importMeshFile);
voxelizeButton.addEventListener('click', voxelizeCurrentMesh);
downloadButton.addEventListener('click', downloadJson);
copyJsonButton.addEventListener('click', async () => navigator.clipboard.writeText(jsonOutput.value));
applyJsonButton.addEventListener('click', applyJson);
for (const input of [assetIdInput, displayNameInput, spanInput, sampleDensityInput]) input.addEventListener('input', () => mesh && voxelizeCurrentMesh());
previewLayerInput.addEventListener('input', () => render());

loadSampleMesh();

async function importMeshFile() {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    mesh = parseMeshBuffer(await file.arrayBuffer(), file.name);
    assetIdInput.value = safeAssetId(`creator.${file.name.replace(/\.[^.]+$/, '')}`);
    displayNameInput.value = titleFromAssetId(assetIdInput.value);
    voxelizeCurrentMesh();
  } catch (error) {
    statusPanel.innerHTML = `<span class="error">Error: ${escapeHtml(error.message)}</span>`;
  } finally {
    fileInput.value = '';
  }
}

function loadSampleMesh() {
  mesh = parseMeshText(sampleObjCube(), 'sample-cube.obj');
  voxelizeCurrentMesh();
}

function voxelizeCurrentMesh() {
  if (!mesh) return;
  try {
    construct = voxelizeMeshToConstruct(mesh, {
      assetId: assetIdInput.value,
      displayName: displayNameInput.value,
      span: Number(spanInput.value),
      sampleDensity: Number(sampleDensityInput.value),
    });
    jsonOutput.value = `${JSON.stringify(construct, null, 2)}\n`;
    previewLayerInput.max = String(maxLayer(construct));
    previewLayerInput.value = String(Math.min(Number(previewLayerInput.value) || 0, maxLayer(construct)));
    render();
  } catch (error) {
    statusPanel.innerHTML = `<span class="error">Error: ${escapeHtml(error.message)}</span>`;
  }
}

function applyJson() {
  try {
    construct = JSON.parse(jsonOutput.value);
    assetIdInput.value = construct.assetId ?? '';
    displayNameInput.value = construct.displayName ?? '';
    previewLayerInput.max = String(maxLayer(construct));
    render();
  } catch (error) {
    statusPanel.innerHTML = `<span class="error">Error: ${escapeHtml(error.message)}</span>`;
  }
}

function render() {
  drawPreview();
  renderStatus();
}

function drawPreview() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#0d1010';
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  if (!construct) return;
  const layer = Number(previewLayerInput.value) || 0;
  for (const cell of construct.cells) {
    if ((cell.gridZ ?? 0) > layer) continue;
    drawCell(cell, layer);
  }
}

function drawGrid() {
  context.strokeStyle = 'rgb(244 238 228 / 0.08)';
  context.lineWidth = 1;
  for (let x = 32; x <= canvas.width - 32; x += 28) {
    context.beginPath();
    context.moveTo(x, 32);
    context.lineTo(x, canvas.height - 32);
    context.stroke();
  }
  for (let y = 32; y <= canvas.height - 32; y += 28) {
    context.beginPath();
    context.moveTo(32, y);
    context.lineTo(canvas.width - 32, y);
    context.stroke();
  }
}

function drawCell(cell, layer) {
  const scale = 28;
  const x = canvas.width / 2 + cell.gridX * scale;
  const y = canvas.height / 2 + cell.gridY * scale;
  const current = (cell.gridZ ?? 0) === layer;
  context.save();
  context.globalAlpha = current ? 1 : 0.18;
  context.fillStyle = cell.type === 'core' ? '#f7c06a' : '#818a8b';
  context.strokeStyle = cell.type === 'core' ? '#ffe7a1' : 'rgb(255 255 255 / 0.28)';
  context.lineWidth = cell.type === 'core' ? 3 : 1;
  context.fillRect(x - 10, y - 10, 20, 20);
  context.strokeRect(x - 10, y - 10, 20, 20);
  context.restore();
}

function renderStatus() {
  if (!construct || !mesh) {
    statusPanel.innerHTML = '<span>No mesh loaded.</span>';
    return;
  }
  const meshSummary = summarizeMesh(mesh);
  const report = validateConstructDefinition(construct);
  const layer = Number(previewLayerInput.value) || 0;
  const lines = [
    `<span><strong>${report.valid ? 'Valid construct asset' : 'Construct needs changes'}</strong></span>`,
    `<span>${escapeHtml(meshSummary.sourceFormat.toUpperCase())}: ${meshSummary.vertices} vertices, ${meshSummary.triangles} triangles</span>`,
    `<span>${construct.cells.length} cells across ${maxLayer(construct) + 1} layers; preview layer ${layer}</span>`,
    `<span>${construct.connections.length} explicit adjacency connections</span>`,
    ...report.errors.map((error) => `<span class="error">Error: ${escapeHtml(error)}</span>`),
    ...report.warnings.map((warning) => `<span class="warning">Warning: ${escapeHtml(warning)}</span>`),
  ];
  statusPanel.innerHTML = lines.join('');
}

function downloadJson() {
  const blob = new Blob([jsonOutput.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${construct?.assetId || 'voxelized_construct'}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function maxLayer(definition) {
  return Math.max(0, ...(definition?.cells ?? []).map((cell) => cell.gridZ ?? 0));
}

function sampleObjCube() {
  return `
v -1 -1 -1
v 1 -1 -1
v 1 1 -1
v -1 1 -1
v -1 -1 1
v 1 -1 1
v 1 1 1
v -1 1 1
f 1 2 3 4
f 5 8 7 6
f 1 5 6 2
f 2 6 7 3
f 3 7 8 4
f 4 8 5 1
`;
}

function safeAssetId(value) {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'creator.voxelized_mesh';
}

function titleFromAssetId(assetId) {
  return assetId
    .replaceAll('_', ' ')
    .replaceAll('.', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
