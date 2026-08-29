import { CANON_STATUSES, CONTENT_SCHEMA_VERSION } from '../core/contentSchema.js';
import {
  LEVEL_BACKGROUND_MODES,
  collectLevelDependencies,
  createLevelPackagePlan,
  validateLevelDefinition,
} from '../core/levelDefinition.js';
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

for (const status of CANON_STATUSES) fields.canonStatusSelect.append(new Option(status, status));
for (const mode of LEVEL_BACKGROUND_MODES) fields.backgroundModeSelect.append(new Option(mode, mode));

for (const field of Object.values(fields)) field.addEventListener('input', renderFromFields);
resetButton.addEventListener('click', () => loadLevel(prototypeLevelDefinition));
applyJsonButton.addEventListener('click', applyJson);
copyJsonButton.addEventListener('click', async () => navigator.clipboard.writeText(jsonOutput.value));
downloadButton.addEventListener('click', downloadJson);

loadLevel(level);

function loadLevel(nextLevel) {
  level = clone(nextLevel);
  syncLevelToFields();
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
    next.push({
      id: `trigger-${next.length + 1}`,
      kind: next.length % 2 === 0 ? 'cue' : 'voiceover',
      atDistance: 80 + next.length * 300,
      assetRef: next.length % 2 === 0 ? undefined : `voiceover.${next.length + 1}`,
      message: next.length % 2 === 0 ? 'Cue event' : undefined,
      once: true,
    });
  }
  next.length = target;
  return next;
}

function render() {
  drawPreview();
  jsonOutput.value = `${JSON.stringify(level, null, 2)}\n`;
  renderStatus();
  renderDependencies();
}

function drawPreview() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#0d1010';
  context.fillRect(0, 0, canvas.width, canvas.height);
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
  for (const trigger of level.triggers ?? []) drawEvent(points, trigger.atDistance, '#6fe0bf', trigger.id);
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
  const lines = [
    `<span><strong>${report.valid ? 'Valid level asset' : 'Level needs changes'}</strong></span>`,
    `<span>${level.route?.segments?.length ?? 0} route segments, ${level.waves?.length ?? 0} waves, ${level.triggers?.length ?? 0} triggers</span>`,
  ];
  lines.push(...report.errors.map((error) => `<span class="error">Error: ${escapeHtml(error)}</span>`));
  lines.push(...report.warnings.map((warning) => `<span class="warning">Warning: ${escapeHtml(warning)}</span>`));
  statusPanel.innerHTML = lines.join('');
}

function renderDependencies() {
  let lines;
  try {
    const plan = createLevelPackagePlan(level);
    lines = ['Import Plan', `${plan.dependencies.length} dependencies`];
    for (const dependency of plan.dependencies) {
      lines.push(`${dependency.kind}: ${dependency.assetId ?? dependency.packId}`);
    }
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

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
