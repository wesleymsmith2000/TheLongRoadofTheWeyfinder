import { CANON_STATUSES, CONTENT_SCHEMA_VERSION } from '../core/contentSchema.js';
import { PATTERN_EMITTER_KINDS, validatePatternDefinition } from '../core/patternDefinition.js';
import { PROJECTILE_BEHAVIORS, validateWeaponDefinition } from '../core/weaponDefinition.js';
import rocketDefinition from '../../content/weapons/rocket.json' with { type: 'json' };
import cannonDefinition from '../../content/weapons/cannon.json' with { type: 'json' };
import beamDefinition from '../../content/weapons/beam.json' with { type: 'json' };
import aimedPatternDefinition from '../../content/patterns/enemy_aimed_shot.json' with { type: 'json' };
import radialPatternDefinition from '../../content/patterns/enemy_radial_burst.json' with { type: 'json' };

const canonAssets = {
  weapon: [rocketDefinition, cannonDefinition, beamDefinition],
  pattern: [aimedPatternDefinition, radialPatternDefinition],
};

const canvas = document.querySelector('#previewCanvas');
const context = canvas.getContext('2d');
const weaponModeButton = document.querySelector('#weaponModeButton');
const patternModeButton = document.querySelector('#patternModeButton');
const assetSelect = document.querySelector('#assetSelect');
const downloadButton = document.querySelector('#downloadButton');
const copyJsonButton = document.querySelector('#copyJsonButton');
const applyJsonButton = document.querySelector('#applyJsonButton');
const jsonOutput = document.querySelector('#jsonOutput');
const statusPanel = document.querySelector('#statusPanel');
const statsTitle = document.querySelector('#statsTitle');
const weaponFields = document.querySelector('#weaponFields');
const patternFields = document.querySelector('#patternFields');

const fields = Object.fromEntries(
  [
    'assetIdInput',
    'displayNameInput',
    'schemaInput',
    'canonStatusSelect',
    'tagsInput',
    'ammoInput',
    'heatInput',
    'cooldownInput',
    'weaponBehaviorSelect',
    'weaponSpeedInput',
    'weaponRadiusInput',
    'weaponDamageInput',
    'weaponImpulseInput',
    'weaponLifetimeInput',
    'weaponLengthInput',
    'patternKindSelect',
    'patternTargetSelect',
    'initialDelayInput',
    'intervalInput',
    'countInput',
    'patternSpeedInput',
    'spreadInput',
    'jitterInput',
    'patternRadiusInput',
    'patternDamageInput',
    'patternImpulseInput',
    'patternLifetimeInput',
  ].map((id) => [id, document.querySelector(`#${id}`)]),
);

let mode = 'weapon';
let asset = clone(canonAssets.weapon[0]);

for (const status of CANON_STATUSES) fields.canonStatusSelect.append(new Option(status, status));
for (const behavior of PROJECTILE_BEHAVIORS) fields.weaponBehaviorSelect.append(new Option(behavior, behavior));
for (const kind of PATTERN_EMITTER_KINDS) fields.patternKindSelect.append(new Option(kind, kind));

weaponModeButton.addEventListener('click', () => setMode('weapon'));
patternModeButton.addEventListener('click', () => setMode('pattern'));
assetSelect.addEventListener('change', () => loadSelectedAsset());
downloadButton.addEventListener('click', downloadJson);
copyJsonButton.addEventListener('click', async () => navigator.clipboard.writeText(jsonOutput.value));
applyJsonButton.addEventListener('click', applyJson);
for (const field of Object.values(fields)) field.addEventListener('input', renderFromFields);

setMode('weapon');

function setMode(nextMode) {
  mode = nextMode;
  weaponModeButton.setAttribute('aria-pressed', String(mode === 'weapon'));
  patternModeButton.setAttribute('aria-pressed', String(mode === 'pattern'));
  weaponFields.hidden = mode !== 'weapon';
  patternFields.hidden = mode !== 'pattern';
  statsTitle.textContent = mode === 'weapon' ? 'Weapon Stats' : 'Pattern Stats';
  populateAssetSelect();
  loadSelectedAsset();
}

function populateAssetSelect() {
  assetSelect.replaceChildren(...canonAssets[mode].map((definition) => new Option(definition.displayName ?? definition.assetId, definition.assetId)));
}

function loadSelectedAsset() {
  asset = clone(canonAssets[mode].find((definition) => definition.assetId === assetSelect.value) ?? canonAssets[mode][0]);
  syncAssetToFields();
  render();
}

function syncAssetToFields() {
  fields.assetIdInput.value = asset.assetId ?? '';
  fields.displayNameInput.value = asset.displayName ?? '';
  fields.schemaInput.value = asset.schemaVersion ?? CONTENT_SCHEMA_VERSION;
  fields.canonStatusSelect.value = asset.canonStatus ?? 'EXPERIMENTAL';
  fields.tagsInput.value = (asset.tags ?? []).join(', ');
  if (mode === 'weapon') syncWeaponToFields();
  if (mode === 'pattern') syncPatternToFields();
}

function syncWeaponToFields() {
  const projectile = asset.projectile ?? {};
  fields.ammoInput.value = asset.ammo ?? 0;
  fields.heatInput.value = asset.heat ?? 0;
  fields.cooldownInput.value = asset.cooldown ?? 0;
  fields.weaponBehaviorSelect.value = projectile.behavior ?? 'ballistic';
  fields.weaponSpeedInput.value = projectile.projectileSpeed ?? projectile.speed ?? 0;
  fields.weaponRadiusInput.value = projectile.radius ?? 0;
  fields.weaponDamageInput.value = projectile.damage ?? 0;
  fields.weaponImpulseInput.value = projectile.impulse ?? 0;
  fields.weaponLifetimeInput.value = projectile.lifetime ?? 0;
  fields.weaponLengthInput.value = projectile.length ?? 0;
}

function syncPatternToFields() {
  const emitter = asset.emitter ?? {};
  const projectile = emitter.projectile ?? {};
  fields.patternKindSelect.value = emitter.kind ?? 'aimed';
  fields.patternTargetSelect.value = emitter.target ?? 'player';
  fields.initialDelayInput.value = asset.initialDelay ?? 0;
  fields.intervalInput.value = asset.interval ?? 1;
  fields.countInput.value = emitter.count ?? 1;
  fields.patternSpeedInput.value = emitter.speed ?? 0;
  fields.spreadInput.value = emitter.spreadRadians ?? 0;
  fields.jitterInput.value = emitter.jitterRadians ?? 0;
  fields.patternRadiusInput.value = projectile.radius ?? 0;
  fields.patternDamageInput.value = projectile.damage ?? 0;
  fields.patternImpulseInput.value = projectile.impulse ?? 0;
  fields.patternLifetimeInput.value = projectile.lifetime ?? 0;
}

function renderFromFields() {
  asset = mode === 'weapon' ? weaponFromFields() : patternFromFields();
  render();
}

function render() {
  drawPreview();
  renderJson();
  renderStatus();
}

function baseMetadataFromFields() {
  return {
    schemaVersion: fields.schemaInput.value.trim(),
    assetId: fields.assetIdInput.value.trim(),
    displayName: fields.displayNameInput.value.trim(),
    author: asset.author,
    provenance: asset.provenance,
    canonStatus: fields.canonStatusSelect.value,
    dependencies: asset.dependencies,
    derivedFrom: asset.derivedFrom,
    tags: fields.tagsInput.value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
}

function weaponFromFields() {
  const projectile = { ...(asset.projectile ?? {}) };
  Object.assign(projectile, {
    weapon: fields.assetIdInput.value.trim(),
    behavior: fields.weaponBehaviorSelect.value,
    projectileSpeed: readNumber(fields.weaponSpeedInput),
    radius: readNumber(fields.weaponRadiusInput),
    damage: readNumber(fields.weaponDamageInput),
    impulse: readNumber(fields.weaponImpulseInput),
    lifetime: readNumber(fields.weaponLifetimeInput),
    length: readNumber(fields.weaponLengthInput),
  });
  return {
    ...baseMetadataFromFields(),
    ammo: readNumber(fields.ammoInput),
    heat: readNumber(fields.heatInput),
    cooldown: readNumber(fields.cooldownInput),
    projectile,
  };
}

function patternFromFields() {
  return {
    ...baseMetadataFromFields(),
    initialDelay: readNumber(fields.initialDelayInput),
    interval: readNumber(fields.intervalInput),
    emitter: {
      kind: fields.patternKindSelect.value,
      target: fields.patternTargetSelect.value,
      count: readNumber(fields.countInput),
      speed: readNumber(fields.patternSpeedInput),
      spreadRadians: readNumber(fields.spreadInput),
      jitterRadians: readNumber(fields.jitterInput),
      projectile: {
        ...(asset.emitter?.projectile ?? {}),
        team: 'enemy',
        weapon: 'bullet',
        behavior: 'ballistic',
        radius: readNumber(fields.patternRadiusInput),
        damage: readNumber(fields.patternDamageInput),
        impulse: readNumber(fields.patternImpulseInput),
        lifetime: readNumber(fields.patternLifetimeInput),
      },
    },
  };
}

function drawPreview() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#0d1010';
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  if (mode === 'weapon') drawWeaponPreview();
  if (mode === 'pattern') drawPatternPreview();
}

function drawGrid() {
  context.strokeStyle = 'rgb(244 238 228 / 0.08)';
  context.lineWidth = 1;
  for (let x = 40; x < canvas.width; x += 40) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  for (let y = 40; y < canvas.height; y += 40) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }
}

function drawWeaponPreview() {
  const projectile = asset.projectile ?? {};
  const origin = { x: 120, y: canvas.height / 2 };
  context.fillStyle = '#f7c06a';
  context.beginPath();
  context.arc(origin.x, origin.y, 13, 0, Math.PI * 2);
  context.fill();
  const length = projectile.behavior === 'beam' ? Math.min(560, projectile.length ?? 360) : Math.min(560, (projectile.projectileSpeed ?? 100) * 2.2);
  context.strokeStyle = projectile.behavior === 'beam' ? '#83f7ff' : '#ffb25f';
  context.lineWidth = projectile.behavior === 'beam' ? Math.max(2, (projectile.radius ?? 1) * 5) : 3;
  context.beginPath();
  context.moveTo(origin.x, origin.y);
  context.lineTo(origin.x + length, origin.y);
  context.stroke();
  context.fillStyle = '#f4eee4';
  context.beginPath();
  context.arc(origin.x + length, origin.y, Math.max(3, projectile.radius ?? 3), 0, Math.PI * 2);
  context.fill();
  if (projectile.behavior === 'homing') drawArc(origin.x + length * 0.45, origin.y - 54, 70, 0.4, 2.6, '#6fe0bf');
}

function drawPatternPreview() {
  const emitter = asset.emitter ?? {};
  const origin = { x: canvas.width / 2, y: canvas.height / 2 };
  context.fillStyle = '#ff8f70';
  context.beginPath();
  context.arc(origin.x, origin.y, 12, 0, Math.PI * 2);
  context.fill();
  const count = Math.max(0, Math.floor(emitter.count ?? 0));
  const speedLength = Math.max(26, Math.min(210, (emitter.speed ?? 80) * 1.5));
  for (let index = 0; index < count; index += 1) {
    const angle = emitter.kind === 'radial' ? (Math.PI * 2 * index) / Math.max(1, count) : aimedSpreadOffset(index, count, emitter.spreadRadians ?? 0);
    drawArrow(origin, angle, speedLength, index);
  }
  if (emitter.kind === 'aimed') {
    context.strokeStyle = 'rgb(111 224 191 / 0.5)';
    context.setLineDash([8, 8]);
    context.beginPath();
    context.moveTo(origin.x, origin.y);
    context.lineTo(canvas.width - 80, origin.y);
    context.stroke();
    context.setLineDash([]);
  }
}

function drawArrow(origin, angle, length, index) {
  const color = index % 2 === 0 ? '#fff1a8' : '#9be5ff';
  const end = { x: origin.x + Math.cos(angle) * length, y: origin.y + Math.sin(angle) * length };
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(origin.x, origin.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.beginPath();
  context.arc(end.x, end.y, Math.max(3, asset.emitter?.projectile?.radius ?? 4), 0, Math.PI * 2);
  context.fill();
}

function drawArc(x, y, radius, start, end, color) {
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(x, y, radius, start, end);
  context.stroke();
}

function renderJson() {
  jsonOutput.value = `${JSON.stringify(asset, null, 2)}\n`;
}

function renderStatus() {
  const report = mode === 'weapon' ? validateWeaponDefinition(asset) : validatePatternDefinition(asset);
  const lines = [
    `<span><strong>${report.valid ? 'Valid runtime asset' : 'Asset needs changes'}</strong></span>`,
    `<span>${mode === 'weapon' ? weaponSummary(asset) : patternSummary(asset)}</span>`,
  ];
  lines.push(...report.errors.map((error) => `<span class="error">Error: ${escapeHtml(error)}</span>`));
  lines.push(...report.warnings.map((warning) => `<span class="warning">Warning: ${escapeHtml(warning)}</span>`));
  statusPanel.innerHTML = lines.join('');
}

function weaponSummary(definition) {
  return `${definition.projectile?.behavior ?? 'unknown'} projectile, ${definition.projectile?.damage ?? 0} damage, ${definition.ammo ?? 0} ammo`;
}

function patternSummary(definition) {
  return `${definition.emitter?.kind ?? 'unknown'} emitter, ${definition.emitter?.count ?? 0} shots every ${definition.interval ?? 0}s`;
}

function applyJson() {
  try {
    const parsed = JSON.parse(jsonOutput.value);
    mode = parsed.emitter ? 'pattern' : 'weapon';
    weaponModeButton.setAttribute('aria-pressed', String(mode === 'weapon'));
    patternModeButton.setAttribute('aria-pressed', String(mode === 'pattern'));
    weaponFields.hidden = mode !== 'weapon';
    patternFields.hidden = mode !== 'pattern';
    statsTitle.textContent = mode === 'weapon' ? 'Weapon Stats' : 'Pattern Stats';
    asset = parsed;
    syncAssetToFields();
    render();
  } catch (error) {
    statusPanel.innerHTML = `<span class="error">Error: ${escapeHtml(error.message)}</span>`;
  }
}

function downloadJson() {
  const blob = new Blob([jsonOutput.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${asset.assetId || mode}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function aimedSpreadOffset(index, count, spread) {
  if (count <= 1) return 0;
  return ((index / (count - 1)) - 0.5) * spread * 2;
}

function readNumber(input) {
  return Number(input.value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
