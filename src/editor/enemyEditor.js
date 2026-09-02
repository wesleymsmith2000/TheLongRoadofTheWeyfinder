import { CANON_STATUSES, CONTENT_SCHEMA_VERSION } from '../core/contentSchema.js';
import {
  CANON_ENEMY_ARCHETYPE_PACK,
  ENEMY_AGGREGATE_KINDS,
  ENEMY_CELL_ANIMATION_KINDS,
  ENEMY_ENTRY_KINDS,
  ENEMY_MOVEMENT_KINDS,
  ENEMY_RUNTIME_FACTORIES,
  validateEnemyArchetypePack,
} from '../core/enemyArchetypeDefinition.js';
import aimedPatternDefinition from '../../content/patterns/enemy_aimed_shot.json' with { type: 'json' };
import radialPatternDefinition from '../../content/patterns/enemy_radial_burst.json' with { type: 'json' };
import ghostPhaseHomingRadial from '../../content/examples/prototype0-zone-enemy-set/patterns/example.ghost_phase_homing_radial.json' with { type: 'json' };
import frogTractorBeam from '../../content/examples/prototype0-zone-enemy-set/patterns/example.frog_tractor_beam.json' with { type: 'json' };
import frogShortLaser from '../../content/examples/prototype0-zone-enemy-set/patterns/example.frog_short_laser.json' with { type: 'json' };
import mortarLine7 from '../../content/examples/prototype0-zone-enemy-set/patterns/example.mortar_line_7.json' with { type: 'json' };
import buzzardTrailingMortar from '../../content/examples/prototype0-zone-enemy-set/patterns/example.buzzard_trailing_mortar.json' with { type: 'json' };
import inchwormRepulsorEye from '../../content/examples/prototype0-zone-enemy-set/patterns/example.inchworm_repulsor_eye.json' with { type: 'json' };
import inchwormEyeMiniBeam from '../../content/examples/prototype0-zone-enemy-set/patterns/example.inchworm_eye_mini_beam.json' with { type: 'json' };
import zoneEnemyArchetypes from '../../content/examples/prototype0-zone-enemy-set/enemies/example.zone_enemy_archetypes.json' with { type: 'json' };
import {
  installLocalContentBundle,
  installLocalContentFiles,
  listLocalContentPacks,
} from '../core/localContentLibrary.js';
import { BUILTIN_CONSTRUCT_BY_ID, BUILTIN_CONSTRUCT_DEFINITIONS } from './constructCatalog.js';
import { bindBuildVersion } from './versionBadge.js';

const canvas = document.querySelector('#enemyCanvas');
const context = canvas.getContext('2d');
const jsonOutput = document.querySelector('#jsonOutput');
const statusPanel = document.querySelector('#statusPanel');
const moduleStatusPanel = document.querySelector('#moduleStatusPanel');
const patternList = document.querySelector('#patternList');
const downloadButton = document.querySelector('#downloadButton');
const installPackButton = document.querySelector('#installPackButton');
const importFolderButton = document.querySelector('#importFolderButton');
const importFolderInput = document.querySelector('#importFolderInput');
const importFilesButton = document.querySelector('#importFilesButton');
const importFilesInput = document.querySelector('#importFilesInput');
const applyJsonButton = document.querySelector('#applyJsonButton');
const copyJsonButton = document.querySelector('#copyJsonButton');

bindBuildVersion();

const fields = Object.fromEntries(
  [
    'templateSelect',
    'enemyIdInput',
    'enemyNameInput',
    'runtimeFactorySelect',
    'baseArchetypeInput',
    'constructSelect',
    'canonStatusSelect',
    'tagsInput',
    'entryKindSelect',
    'entryDirectionSelect',
    'entrySpeedInput',
    'warningLeadInput',
    'packIdInput',
    'schemaInput',
    'packNameInput',
    'movementKindSelect',
    'movementTargetSelect',
    'movementSpeedInput',
    'movementAmplitudeInput',
    'movementFrequencyInput',
    'movementAccelerationInput',
    'movementStrengthInput',
    'movementPhaseInput',
    'movementDurationInput',
    'movementZInput',
    'movementMinZInput',
    'movementMaxZInput',
    'movementHopHeightInput',
    'aggregateKindSelect',
    'aggregatePartCountInput',
    'aggregateRoleInput',
    'aggregateAttachmentInput',
    'bossBeamSourceSelectorInput',
    'bossBeamSourceRequiredInput',
    'bossNoduleChanceInput',
    'bossNoduleSourceInput',
    'animationKindSelect',
    'animationSelectorInput',
    'animationAmplitudeInput',
    'animationFrequencyInput',
    'animationPhaseInput',
    'opacityMinInput',
    'opacityMaxInput',
    'advancedDescriptorInput',
  ].map((id) => [id, document.querySelector(`#${id}`)]),
);

const TEMPLATE_ARCHETYPES = [...CANON_ENEMY_ARCHETYPE_PACK.archetypes, ...zoneEnemyArchetypes.archetypes];
const PATTERN_DEFINITIONS = [
  aimedPatternDefinition,
  radialPatternDefinition,
  ghostPhaseHomingRadial,
  frogTractorBeam,
  frogShortLaser,
  mortarLine7,
  buzzardTrailingMortar,
  inchwormRepulsorEye,
  inchwormEyeMiniBeam,
];
const CONSTRUCT_OPTIONS = [
  ...new Set([
    ...BUILTIN_CONSTRUCT_DEFINITIONS.map((definition) => definition.assetId),
    'runtime.pirate_ship.prototype0',
    'runtime.pirate_ram_ship.prototype0',
    ...TEMPLATE_ARCHETYPES.map((enemy) => enemy.construct).filter(Boolean),
  ]),
];
let pack = clone(CANON_ENEMY_ARCHETYPE_PACK);
let archetype = clone(CANON_ENEMY_ARCHETYPE_PACK.archetypes.find((candidate) => candidate.id === 'ghost_fabric.prototype0') ?? CANON_ENEMY_ARCHETYPE_PACK.archetypes[0]);

for (const template of TEMPLATE_ARCHETYPES) fields.templateSelect.append(new Option(template.displayName ?? template.id, template.id));
for (const factory of ENEMY_RUNTIME_FACTORIES) fields.runtimeFactorySelect.append(new Option(factory, factory));
for (const construct of CONSTRUCT_OPTIONS) fields.constructSelect.append(new Option(construct, construct));
for (const status of CANON_STATUSES) fields.canonStatusSelect.append(new Option(status, status));
for (const kind of ENEMY_ENTRY_KINDS) fields.entryKindSelect.append(new Option(kind, kind));
for (const kind of ENEMY_MOVEMENT_KINDS) fields.movementKindSelect.append(new Option(kind, kind));
for (const kind of ENEMY_AGGREGATE_KINDS) fields.aggregateKindSelect.append(new Option(kind, kind));
for (const kind of ENEMY_CELL_ANIMATION_KINDS) fields.animationKindSelect.append(new Option(kind, kind));
for (const pattern of PATTERN_DEFINITIONS) {
  const label = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.value = pattern.assetId;
  checkbox.addEventListener('input', renderFromFields);
  label.append(checkbox, document.createTextNode(pattern.displayName ?? pattern.assetId));
  patternList.append(label);
}

fields.templateSelect.addEventListener('change', () => {
  const next = TEMPLATE_ARCHETYPES.find((candidate) => candidate.id === fields.templateSelect.value);
  if (next) loadArchetype(next, packForTemplate(next));
});
for (const field of Object.values(fields)) field.addEventListener('input', renderFromFields);
downloadButton.addEventListener('click', downloadJson);
installPackButton.addEventListener('click', installCurrentPack);
importFolderButton.addEventListener('click', () => importFolderInput.click());
importFolderInput.addEventListener('change', () => importLocalFiles(importFolderInput));
importFilesButton.addEventListener('click', () => importFilesInput.click());
importFilesInput.addEventListener('change', () => importLocalFiles(importFilesInput));
applyJsonButton.addEventListener('click', applyJson);
copyJsonButton.addEventListener('click', async () => navigator.clipboard.writeText(jsonOutput.value));

loadArchetype(archetype);
renderModuleStatus();
requestAnimationFrame(animate);

function loadArchetype(nextArchetype, nextPack = pack) {
  archetype = clone(nextArchetype);
  pack = clone(nextPack);
  syncToFields();
  render();
}

function syncToFields() {
  fields.templateSelect.value = archetype.id;
  fields.enemyIdInput.value = archetype.id ?? '';
  fields.enemyNameInput.value = archetype.displayName ?? '';
  fields.runtimeFactorySelect.value = archetype.runtimeFactory ?? ENEMY_RUNTIME_FACTORIES[0];
  fields.baseArchetypeInput.value = archetype.baseArchetype ?? '';
  ensureSelectOption(fields.constructSelect, archetype.construct);
  fields.constructSelect.value = archetype.construct ?? CONSTRUCT_OPTIONS[0];
  fields.canonStatusSelect.value = archetype.canonStatus ?? 'EXPERIMENTAL';
  fields.tagsInput.value = (archetype.tags ?? []).join(', ');
  syncPatterns();

  fields.entryKindSelect.value = archetype.entry?.kind ?? 'aheadDrift';
  fields.entryDirectionSelect.value = archetype.entry?.direction ?? 'roadForward';
  fields.entrySpeedInput.value = archetype.entry?.speed ?? '';
  fields.warningLeadInput.value = archetype.entry?.warningLeadSeconds ?? '';

  fields.packIdInput.value = pack.assetId ?? 'enemy_archetype_pack';
  fields.schemaInput.value = pack.schemaVersion ?? CONTENT_SCHEMA_VERSION;
  fields.packNameInput.value = pack.displayName ?? 'Enemy Archetype Pack';

  const movement = archetype.movementProfiles?.[0] ?? defaultMovementFor(archetype);
  fields.movementKindSelect.value = movement.kind ?? 'drift';
  fields.movementTargetSelect.value = movement.target ?? 'player';
  fields.movementSpeedInput.value = movement.speed ?? '';
  fields.movementAmplitudeInput.value = movement.amplitude ?? '';
  fields.movementFrequencyInput.value = movement.frequency ?? '';
  fields.movementAccelerationInput.value = movement.acceleration ?? '';
  fields.movementStrengthInput.value = movement.strength ?? '';
  fields.movementPhaseInput.value = movement.phaseOffset ?? '';
  fields.movementDurationInput.value = movement.duration ?? '';
  fields.movementZInput.value = movement.z ?? '';
  fields.movementMinZInput.value = movement.minZ ?? '';
  fields.movementMaxZInput.value = movement.maxZ ?? '';
  fields.movementHopHeightInput.value = movement.hopHeight ?? '';

  const aggregate = archetype.aggregate ?? defaultAggregateFor(archetype);
  fields.aggregateKindSelect.value = aggregate.kind ?? 'singleBody';
  fields.aggregatePartCountInput.value = aggregate.parts?.[0]?.count ?? (aggregate.kind === 'multiPartBoss' ? 8 : 0);
  fields.aggregateRoleInput.value = aggregate.parts?.[0]?.role ?? (aggregate.kind === 'singleBody' ? '' : 'arm');
  fields.aggregateAttachmentInput.value = aggregate.parts?.[0]?.attachment ?? (aggregate.kind === 'singleBody' ? '' : 'radial');
  fields.bossBeamSourceSelectorInput.value = archetype.arms?.beamSource?.selector ?? 'type:gun';
  fields.bossBeamSourceRequiredInput.checked = archetype.arms?.beamSource?.shutoffWhenDestroyed ?? true;
  fields.bossNoduleChanceInput.value = archetype.arms?.noduleShots?.chancePerSecond ?? '';
  fields.bossNoduleSourceInput.value = archetype.arms?.noduleShots?.source ?? 'liveArmGun';

  const animation = archetype.cellAnimations?.[0] ?? defaultAnimationFor(archetype);
  fields.animationKindSelect.value = animation.kind ?? 'none';
  fields.animationSelectorInput.value = animation.selector ?? 'type:armor';
  fields.animationAmplitudeInput.value = animation.amplitude ?? '';
  fields.animationFrequencyInput.value = animation.frequency ?? '';
  fields.animationPhaseInput.value = animation.phaseOffset ?? '';
  fields.opacityMinInput.value = animation.opacityMin ?? '';
  fields.opacityMaxInput.value = animation.opacityMax ?? '';
  fields.advancedDescriptorInput.value = JSON.stringify(advancedDescriptorFor(archetype), null, 2);
}

function syncPatterns() {
  for (const checkbox of patternList.querySelectorAll('input')) {
    checkbox.checked = (archetype.patterns ?? []).includes(checkbox.value);
  }
}

function renderFromFields() {
  archetype = archetypeFromFields();
  pack = packFromFields(archetype);
  render();
}

function archetypeFromFields() {
  const advanced = parseJsonObject(fields.advancedDescriptorInput.value, advancedDescriptorFor(archetype));
  const next = {
    ...archetype,
    ...advanced,
    id: fields.enemyIdInput.value.trim(),
    displayName: fields.enemyNameInput.value.trim(),
    runtimeFactory: fields.runtimeFactorySelect.value,
    construct: fields.constructSelect.value,
    patterns: selectedPatterns(),
    entry: entryFromFields(),
    palette: paletteFromArchetype(archetype),
    movementProfiles: movementProfilesFromFields(),
    aggregate: aggregateFromFields(),
    cellAnimations: animationFromFields(),
    canonStatus: fields.canonStatusSelect.value,
    tags: fields.tagsInput.value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    editable: editorKnobsFor(archetype),
  };
  const arms = bossArmsFromFields();
  if (arms) next.arms = arms;
  const base = fields.baseArchetypeInput.value.trim();
  if (base) next.baseArchetype = base;
  else delete next.baseArchetype;
  if (fields.animationKindSelect.value === 'none') next.cellAnimations = [];
  return pruneEmpty(next);
}

function advancedDescriptorFor(enemy) {
  const controlledKeys = new Set([
    'id',
    'assetIdAlias',
    'displayName',
    'runtimeFactory',
    'baseArchetype',
    'construct',
    'patterns',
    'entry',
    'palette',
    'movementProfiles',
    'aggregate',
    'cellAnimations',
    'canonStatus',
    'tags',
    'editable',
    'arms',
  ]);
  return Object.fromEntries(Object.entries(enemy ?? {}).filter(([key]) => !controlledKeys.has(key)));
}

function editorKnobsFor(enemy) {
  const knobs = new Set(enemy.editable ?? ['construct', 'patterns', 'entry', 'palette']);
  for (const knob of ['movementProfiles', 'aggregate', 'cellAnimations']) knobs.add(knob);
  if (fields.runtimeFactorySelect.value === 'createBossEnemy' || enemy.arms) {
    for (const knob of ['arms', 'attackMix', 'beamSource', 'noduleShots']) knobs.add(knob);
  }
  return [...knobs];
}

function packFromFields(enemy) {
  return {
    schemaVersion: fields.schemaInput.value.trim(),
    assetId: fields.packIdInput.value.trim(),
    displayName: fields.packNameInput.value.trim(),
    canonStatus: fields.canonStatusSelect.value,
    tags: fields.tagsInput.value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    archetypes: [enemy],
  };
}

function selectedPatterns() {
  const visiblePatternIds = new Set(PATTERN_DEFINITIONS.map((pattern) => pattern.assetId));
  const checked = [...patternList.querySelectorAll('input')]
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);
  return [...new Set([...checked, ...(archetype.patterns ?? []).filter((id) => !visiblePatternIds.has(id))])];
}

function packForTemplate(template) {
  if (zoneEnemyArchetypes.archetypes.some((candidate) => candidate.id === template.id)) return zoneEnemyArchetypes;
  return CANON_ENEMY_ARCHETYPE_PACK;
}

function entryFromFields() {
  const entry = {
    kind: fields.entryKindSelect.value,
    direction: fields.entryDirectionSelect.value,
  };
  assignNumber(entry, 'speed', fields.entrySpeedInput);
  assignNumber(entry, 'warningLeadSeconds', fields.warningLeadInput);
  return entry;
}

function movementFromFields() {
  const movement = {
    ...(archetype.movementProfiles?.[0] ?? {}),
    id: archetype.movementProfiles?.[0]?.id ?? 'primary-movement',
    kind: fields.movementKindSelect.value,
    target: fields.movementTargetSelect.value,
  };
  assignNumber(movement, 'speed', fields.movementSpeedInput);
  assignNumber(movement, 'amplitude', fields.movementAmplitudeInput);
  assignNumber(movement, 'frequency', fields.movementFrequencyInput);
  assignNumber(movement, 'acceleration', fields.movementAccelerationInput);
  assignNumber(movement, 'strength', fields.movementStrengthInput);
  assignNumber(movement, 'phaseOffset', fields.movementPhaseInput);
  assignNumber(movement, 'duration', fields.movementDurationInput);
  assignNumber(movement, 'z', fields.movementZInput);
  assignNumber(movement, 'minZ', fields.movementMinZInput);
  assignNumber(movement, 'maxZ', fields.movementMaxZInput);
  assignNumber(movement, 'hopHeight', fields.movementHopHeightInput);
  return movement;
}

function movementProfilesFromFields() {
  return [movementFromFields(), ...(archetype.movementProfiles ?? []).slice(1)];
}

function aggregateFromFields() {
  const aggregate = { kind: fields.aggregateKindSelect.value };
  if (aggregate.kind === 'singleBody') return aggregate;
  const previousParts = archetype.aggregate?.kind === aggregate.kind ? archetype.aggregate?.parts ?? [] : [];
  const part = {
    ...(previousParts[0] ?? {}),
    id: fields.aggregateRoleInput.value.trim() || 'part',
    role: fields.aggregateRoleInput.value.trim() || 'part',
    attachment: fields.aggregateAttachmentInput.value.trim() || 'radial',
    movementProfile: previousParts[0]?.movementProfile ?? archetype.movementProfiles?.[0]?.id ?? 'primary-movement',
  };
  assignNumber(part, 'count', fields.aggregatePartCountInput);
  aggregate.parts = [part, ...previousParts.slice(1)];
  return aggregate;
}

function animationFromFields() {
  if (fields.animationKindSelect.value === 'none') return [];
  const animation = {
    selector: fields.animationSelectorInput.value.trim() || 'type:armor',
    kind: fields.animationKindSelect.value,
  };
  assignNumber(animation, 'amplitude', fields.animationAmplitudeInput);
  assignNumber(animation, 'frequency', fields.animationFrequencyInput);
  assignNumber(animation, 'phaseOffset', fields.animationPhaseInput);
  assignNumber(animation, 'opacityMin', fields.opacityMinInput);
  assignNumber(animation, 'opacityMax', fields.opacityMaxInput);
  return [animation];
}

function bossArmsFromFields() {
  if (fields.runtimeFactorySelect.value !== 'createBossEnemy' && !archetype.arms) return null;
  const arms = { ...(archetype.arms ?? {}) };
  const selector = fields.bossBeamSourceSelectorInput.value.trim();
  if (selector) {
    arms.beamSource = {
      ...(arms.beamSource ?? {}),
      bind: 'sourceCell',
      selector,
      shutoffWhenDestroyed: fields.bossBeamSourceRequiredInput.checked,
    };
  }
  const chance = Number(fields.bossNoduleChanceInput.value);
  if (Number.isFinite(chance) && chance > 0) {
    arms.noduleShots = {
      ...(arms.noduleShots ?? {}),
      enabled: true,
      source: fields.bossNoduleSourceInput.value.trim() || 'liveArmGun',
      chancePerSecond: chance,
    };
  } else if (arms.noduleShots) {
    arms.noduleShots = {
      ...arms.noduleShots,
      enabled: false,
      chancePerSecond: 0,
    };
  }
  return arms;
}

function paletteFromArchetype(enemy) {
  return {
    core: enemy.palette?.core ?? '#c8f4ff',
    armor: enemy.palette?.armor ?? '#8ca8ff',
    gun: enemy.palette?.gun ?? '#f7f2b2',
    shadow: enemy.palette?.shadow ?? 'rgb(0 0 0 / 0.22)',
  };
}

function defaultMovementFor(enemy) {
  if (enemy.runtimeFactory === 'createBossEnemy') return { id: 'boss-arms', kind: 'bossTentacleSwarm', target: 'player', amplitude: 34, frequency: 0.8, strength: 1 };
  if (enemy.runtimeFactory === 'createEnhancedEnemy' || enemy.runtimeFactory === 'createEnhancedPirateShipEnemy') {
    return { id: 'charge', kind: 'charge', target: 'player', speed: 310, acceleration: 165, strength: 1 };
  }
  return { id: 'drift', kind: 'drift', target: 'roadCenter', speed: enemy.entry?.speed ?? 35 };
}

function defaultAggregateFor(enemy) {
  if (enemy.runtimeFactory === 'createBossEnemy') return { kind: 'multiPartBoss', parts: [{ id: 'arms', role: 'arm', count: 8, attachment: 'radial', movementProfile: 'primary-movement' }] };
  return { kind: 'singleBody' };
}

function defaultAnimationFor(enemy) {
  if (enemy.id?.includes('ghost')) return { selector: 'type:armor', kind: 'fabricWeave', amplitude: 12, frequency: 1.1, phaseOffset: 0.4, opacityMin: 0.35, opacityMax: 0.78 };
  return { selector: 'type:armor', kind: 'none' };
}

function assignNumber(target, key, input) {
  if (input.value === '') return;
  const value = Number(input.value);
  if (Number.isFinite(value)) target[key] = value;
}

function render() {
  jsonOutput.value = `${JSON.stringify(pack, null, 2)}\n`;
  renderStatus();
}

function renderStatus() {
  const report = validateEnemyArchetypePack(pack);
  const movement = archetype.movementProfiles?.[0];
  const lines = [
    `<span><strong>${report.valid ? 'Valid enemy archetype pack' : 'Enemy pack needs changes'}</strong></span>`,
    `<span>${archetype.runtimeFactory} / ${archetype.construct} / ${(archetype.patterns ?? []).length} patterns</span>`,
  ];
  if (movement || (archetype.cellAnimations ?? []).length > 0 || archetype.aggregate?.kind !== 'singleBody') {
    lines.push('<span class="warning">Runtime note: movementProfiles, aggregate, and cellAnimations are validated editor descriptors until the level runner consumes them.</span>');
  }
  if (movement?.kind) {
    lines.push(`<span>Movement descriptor: ${escapeHtml(movement.kind)}${movement.z != null ? ` at z ${escapeHtml(movement.z)}` : ''}${movement.hopHeight != null ? `, hop ${escapeHtml(movement.hopHeight)}` : ''}</span>`);
  }
  if (archetype.arms?.beamSource) {
    lines.push(`<span>Boss beam source: ${escapeHtml(archetype.arms.beamSource.selector)}${archetype.arms.beamSource.shutoffWhenDestroyed ? ', source destruction shuts beam off' : ''}</span>`);
  }
  if (archetype.arms?.noduleShots?.enabled) {
    lines.push(`<span>Boss nodule shots: ${escapeHtml(archetype.arms.noduleShots.source ?? 'liveArmGun')} at ${escapeHtml(archetype.arms.noduleShots.chancePerSecond)} chance/sec</span>`);
  }
  lines.push(...report.errors.map((error) => `<span class="error">Error: ${escapeHtml(error)}</span>`));
  lines.push(...report.warnings.map((warning) => `<span class="warning">Warning: ${escapeHtml(warning)}</span>`));
  statusPanel.innerHTML = lines.join('');
}

async function importLocalFiles(input) {
  if (!input.files?.length) return;
  const result = await installLocalContentFiles(input.files, {
    packId: safePackId(fields.packIdInput.value || 'local.enemy_editor_import'),
    displayName: fields.packNameInput.value || 'Enemy Editor Import',
  });
  renderModuleStatus(result);
  input.value = '';
}

function installCurrentPack() {
  const bundle = currentPackBundle();
  const result = installLocalContentBundle(bundle);
  renderModuleStatus(result);
}

function currentPackBundle() {
  const packId = safePackId(`local.${pack.assetId || archetype.id || 'enemy_archetype_pack'}`);
  const selectedConstruct = BUILTIN_CONSTRUCT_BY_ID.get(archetype.construct);
  const manifest = {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    packId,
    displayName: pack.displayName || archetype.displayName || 'Enemy Archetype Pack',
    author: 'Local creator',
    provenance: 'Installed from the browser Enemy Editor.',
    canonStatus: 'COMMUNITY',
    tags: ['local', 'enemy'],
    dependencies: [],
    assets: {
      enemyArchetypes: [`enemies/${pack.assetId || 'enemy_archetypes'}.json`],
      ...(selectedConstruct ? { constructs: [`constructs/${selectedConstruct.assetId}.json`] } : {}),
    },
  };
  return {
    manifests: [manifest],
    assets: [
      ...(selectedConstruct ? [{ kind: 'construct', definition: selectedConstruct, sourcePack: packId }] : []),
      { kind: 'enemyArchetype', definition: pack, sourcePack: packId },
    ],
    files: [],
    errors: [],
    warnings: [],
  };
}

function renderModuleStatus(result = null) {
  const packs = listLocalContentPacks();
  const lines = [];
  if (result) {
    lines.push(`<span><strong>${result.ok ? 'Local module installed' : 'Local module failed'}</strong></span>`);
    lines.push(...(result.errors ?? []).map((error) => `<span class="error">Error: ${escapeHtml(error)}</span>`));
    lines.push(...(result.warnings ?? []).map((warning) => `<span class="warning">Warning: ${escapeHtml(warning)}</span>`));
  } else {
    lines.push('<span><strong>Local modules</strong></span>');
  }
  if (packs.length === 0) {
    lines.push('<span>No local packs installed in this browser.</span>');
  } else {
    for (const installed of packs) {
      const counts = Object.entries(installed.assetCounts ?? {})
        .map(([kind, count]) => `${count} ${kind}`)
        .join(', ');
      lines.push(`<span>${escapeHtml(installed.displayName)} (${escapeHtml(installed.packId)}): ${escapeHtml(counts || 'no assets')}</span>`);
    }
  }
  moduleStatusPanel.innerHTML = lines.join('');
}

function safePackId(value) {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'local.enemy_pack';
}

function ensureSelectOption(select, value) {
  if (!value) return;
  if ([...select.options].some((option) => option.value === value)) return;
  select.append(new Option(value, value));
}

function animate(now) {
  drawPreview(now / 1000);
  requestAnimationFrame(animate);
}

function drawPreview(time) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#0d1010';
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawMovementPath(time);
  context.save();
  context.translate(canvas.width / 2, canvas.height / 2 + 20);
  if (archetype.runtimeFactory === 'createBossEnemy' || archetype.aggregate?.kind === 'multiPartBoss') drawBossPreview(time);
  else drawBodyPreview(time);
  context.restore();
}

function drawGrid() {
  context.strokeStyle = 'rgb(244 238 228 / 0.06)';
  context.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 38) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  for (let y = 0; y < canvas.height; y += 38) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }
}

function drawMovementPath(time) {
  const movement = archetype.movementProfiles?.[0] ?? {};
  context.save();
  context.translate(canvas.width / 2, canvas.height / 2 + 20);
  context.strokeStyle = '#6fe0bf';
  context.lineWidth = 2;
  context.setLineDash([8, 8]);
  context.beginPath();
  for (let i = 0; i <= 80; i += 1) {
    const t = i / 80;
    const p = movementPoint(movement, t, time);
    if (i === 0) context.moveTo(p.x, p.y);
    else context.lineTo(p.x, p.y);
  }
  context.stroke();
  context.restore();
}

function movementPoint(movement, t, time) {
  const amp = movement.amplitude ?? 24;
  const phase = (movement.phaseOffset ?? 0) + time * (movement.frequency ?? 0.8) * Math.PI * 2;
  if (movement.kind === 'orbitTarget') return { x: Math.cos(t * Math.PI * 2 + phase) * amp * 1.8, y: Math.sin(t * Math.PI * 2 + phase) * amp };
  if (movement.kind === 'weave') return { x: Math.sin(t * Math.PI * 4 + phase) * amp, y: 130 - t * 260 };
  if (movement.kind === 'phase') return { x: Math.sin(t * Math.PI * 2 + phase) * amp * 0.6, y: 120 - t * 240 };
  if (movement.kind === 'hop') return { x: Math.sin(t * Math.PI * 2 + phase) * amp * 0.5, y: 130 - t * 260 - Math.sin(t * Math.PI) * ((movement.hopHeight ?? 42) * 0.65) };
  if (movement.kind === 'flyStrafe') return { x: (t - 0.5) * amp * 5, y: Math.sin(t * Math.PI * 2 + phase) * amp * 0.7 };
  if (movement.kind === 'walkerLegs') return { x: Math.sin(t * Math.PI * 2 + phase) * amp * 0.35, y: 115 - t * 230 };
  if (movement.kind === 'circleArtillery') return { x: Math.cos(t * Math.PI * 2 + phase) * amp * 1.6, y: Math.sin(t * Math.PI * 2 + phase) * amp * 1.15 };
  if (movement.kind === 'carrierRelease') return { x: Math.sin(t * Math.PI * 6 + phase) * amp * 0.55, y: 120 - t * 240 };
  if (movement.kind === 'strafeBroadside') return { x: (t - 0.5) * amp * 4, y: Math.sin(t * Math.PI * 2 + phase) * amp * 0.4 };
  if (movement.kind === 'returnToView') return { x: Math.cos(t * Math.PI) * amp * 2, y: (t - 0.5) * amp };
  if (movement.kind === 'charge') return { x: 0, y: 150 - t * 300 };
  return { x: 0, y: 120 - t * 240 };
}

function drawBodyPreview(time) {
  const movement = archetype.movementProfiles?.[0] ?? {};
  const offset = movement.kind === 'weave' ? Math.sin(time * (movement.frequency ?? 1) * Math.PI * 2) * (movement.amplitude ?? 20) * 0.28 : 0;
  context.translate(offset, 0);
  const construct = BUILTIN_CONSTRUCT_BY_ID.get(archetype.construct);
  if (construct) drawConstructCells(construct.cells, time);
  else if (archetype.silhouette?.kind === 'pirateShip' || archetype.construct?.includes('pirate')) drawPiratePreview(time);
  else drawConstructCells(basicCells(), time);
  if (archetype.aggregate?.kind === 'limbArray') drawAggregateParts(time);
}

function drawBossPreview(time) {
  drawConstructCells(bossCoreCells(), time);
  drawAggregateParts(time, 8, 86);
}

function drawPiratePreview(time) {
  drawConstructCells(
    [
      [-1, -1, 'armor'],
      [0, -1, 'armor'],
      [1, -1, 'armor'],
      [-2, 0, 'gun'],
      [-1, 0, 'armor'],
      [0, 0, 'core'],
      [1, 0, 'armor'],
      [2, 0, 'gun'],
      [-1, 1, 'armor'],
      [0, 1, 'armor'],
      [1, 1, 'armor'],
      [0, 2, 'armor'],
    ],
    time,
  );
  if (archetype.construct?.includes('ram') || archetype.model?.flair === 'spikedSkullBulkhead') {
    context.fillStyle = '#f4eee4';
    context.beginPath();
    context.arc(-7, 66, 3, 0, Math.PI * 2);
    context.arc(7, 66, 3, 0, Math.PI * 2);
    context.fill();
  }
}

function drawAggregateParts(time, fallbackCount = 6, radius = 70) {
  const part = archetype.aggregate?.parts?.[0] ?? {};
  const count = Math.max(0, Math.floor(part.count ?? fallbackCount));
  if (count <= 0) return;
  const movement = archetype.movementProfiles?.[0] ?? {};
  const amp = movement.amplitude ?? 18;
  const frequency = movement.frequency ?? 0.9;
  context.strokeStyle = 'rgb(247 192 106 / 0.55)';
  context.lineWidth = 4;
  context.lineCap = 'round';
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    const wave = Math.sin(time * frequency * Math.PI * 2 + i * 0.72) * amp;
    const end = { x: Math.cos(angle) * (radius + wave), y: Math.sin(angle) * (radius + wave) };
    context.beginPath();
    context.moveTo(0, 0);
    context.quadraticCurveTo(Math.cos(angle + 0.65) * radius * 0.5, Math.sin(angle + 0.65) * radius * 0.5, end.x, end.y);
    context.stroke();
    drawCell(end.x, end.y, 'gun', time, i);
  }
}

function drawConstructCells(cells, time) {
  for (const cell of cells) {
    const gridX = Array.isArray(cell) ? cell[0] : cell.gridX;
    const gridY = Array.isArray(cell) ? cell[1] : cell.gridY;
    const type = Array.isArray(cell) ? cell[2] : cell.type;
    const role = Array.isArray(cell) ? cell[3] : cell.role;
    drawCell(gridX * 26, gridY * 26, type, time, gridX * 3 + gridY, role);
  }
}

function drawCell(x, y, type, time, seed = 0, role = null) {
  const animation = (archetype.cellAnimations ?? [])[0];
  const animated = animation && animation.kind !== 'none' && selectorMatches(animation.selector, type, role);
  const wave = animated ? Math.sin(time * (animation.frequency ?? 1) * Math.PI * 2 + seed * (animation.phaseOffset ?? 0.4)) : 0;
  const swirl = animated && animation.kind === 'swirl' ? Math.cos(time * (animation.frequency ?? 1.2) * Math.PI * 2 + seed) : 0;
  const dx = animated ? wave * (animation.amplitude ?? 8) : 0;
  const dy = animated && animation.kind !== 'opacityPulse' ? swirl * (animation.amplitude ?? 8) * 0.55 : 0;
  const opacity = animated ? lerp(animation.opacityMin ?? 0.45, animation.opacityMax ?? 0.9, wave * 0.5 + 0.5) : 1;
  const palette = archetype.palette ?? {};
  context.save();
  context.globalAlpha = opacity;
  context.fillStyle = palette[role] ?? palette[type] ?? (type === 'core' ? '#e4d66b' : type === 'gun' ? '#d46e4f' : '#8fa6ad');
  context.strokeStyle = 'rgb(255 255 255 / 0.22)';
  context.lineWidth = 1;
  context.fillRect(x + dx - 11, y + dy - 11, 22, 22);
  context.strokeRect(x + dx - 11, y + dy - 11, 22, 22);
  context.restore();
}

function selectorMatches(selector, type, role = null) {
  if (!selector) return false;
  if (selector === 'all') return true;
  if (selector === '*') return true;
  if (selector.startsWith('type:')) return selector.slice(5) === type;
  if (selector.startsWith('role:')) return selector.slice(5) === role;
  return false;
}

function basicCells() {
  return [
    [-1, -1, 'armor'],
    [0, -1, 'armor'],
    [1, -1, 'armor'],
    [-1, 0, 'armor'],
    [0, 0, 'core'],
    [1, 0, 'armor'],
    [-1, 1, 'armor'],
    [0, 1, 'armor'],
    [1, 1, 'armor'],
  ];
}

function bossCoreCells() {
  return [
    [0, 0, 'core'],
    [1, 0, 'core'],
    [0, 1, 'core'],
    [1, 1, 'core'],
    [-1, 0, 'armor'],
    [2, 0, 'armor'],
    [0, -1, 'armor'],
    [1, -1, 'armor'],
    [0, 2, 'armor'],
    [1, 2, 'armor'],
  ];
}

function applyJson() {
  try {
    const parsed = JSON.parse(jsonOutput.value);
    if (Array.isArray(parsed.archetypes)) {
      loadArchetype(parsed.archetypes[0], parsed);
    } else {
      loadArchetype(parsed, packFromFields(parsed));
    }
  } catch (error) {
    statusPanel.innerHTML = `<span class="error">Error: ${escapeHtml(error.message)}</span>`;
  }
}

function downloadJson() {
  const blob = new Blob([jsonOutput.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${pack.assetId || 'enemy_archetypes'}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function pruneEmpty(value) {
  if (Array.isArray(value)) return value.map(pruneEmpty);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, child]) => child !== '' && child != null)
      .map(([key, child]) => [key, pruneEmpty(child)]),
  );
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseJsonObject(value, fallback = {}) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
