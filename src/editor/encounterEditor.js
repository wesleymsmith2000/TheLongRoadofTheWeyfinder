import { CANON_STATUSES, CONTENT_SCHEMA_VERSION } from '../core/contentSchema.js';
import {
  ENCOUNTER_EFFECT_TYPES,
  ENCOUNTER_MUSIC_STATES,
  ENCOUNTER_PAUSE_POLICIES,
  ENCOUNTER_PRESENTATION_MODES,
  ENCOUNTER_TRIGGER_TYPES,
  normalizeEncounterDefinition,
  validateEncounterDefinition,
} from '../core/encounterDefinition.js';
import { bindBuildVersion } from './versionBadge.js';
import sampleEncounter from '../../content/encounters/moonlit_beacon_choice_vignette.json' with { type: 'json' };

const jsonOutput = document.querySelector('#jsonOutput');
const statusPanel = document.querySelector('#statusPanel');
const previewPanel = document.querySelector('#previewPanel');
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
    'triggerTypeSelect',
    'triggerDistanceInput',
    'triggerInteractionInput',
    'stateIdInput',
    'presentationModeSelect',
    'pausePolicySelect',
    'stateTitleInput',
    'stateBodyInput',
    'choiceCountInput',
    'musicStateSelect',
    'effectTypeSelect',
    'firstChoiceLabelInput',
    'routeBranchInput',
    'telemetryTagsInput',
    'directorTagsInput',
  ].map((id) => [id, document.querySelector(`#${id}`)]),
);

let encounter = clone(sampleEncounter);

bindBuildVersion();
populateSelect(fields.canonStatusSelect, CANON_STATUSES);
populateSelect(fields.triggerTypeSelect, ENCOUNTER_TRIGGER_TYPES);
populateSelect(fields.presentationModeSelect, ENCOUNTER_PRESENTATION_MODES);
populateSelect(fields.pausePolicySelect, ENCOUNTER_PAUSE_POLICIES);
populateSelect(fields.musicStateSelect, ENCOUNTER_MUSIC_STATES);
populateSelect(fields.effectTypeSelect, ENCOUNTER_EFFECT_TYPES);

for (const field of Object.values(fields)) {
  field.addEventListener('input', renderFromFields);
  field.addEventListener('change', renderFromFields);
}
resetButton.addEventListener('click', () => loadEncounter(sampleEncounter));
applyJsonButton.addEventListener('click', applyJson);
copyJsonButton.addEventListener('click', async () => navigator.clipboard.writeText(jsonOutput.value));
downloadButton.addEventListener('click', downloadJson);

loadEncounter(encounter);

function loadEncounter(nextEncounter) {
  encounter = normalizeEncounterDefinition(clone(nextEncounter));
  syncEncounterToFields();
  render();
}

function syncEncounterToFields() {
  const state = primaryState();
  const firstChoice = state.choices?.[0] ?? {};
  fields.assetIdInput.value = encounter.assetId ?? '';
  fields.displayNameInput.value = encounter.displayName ?? '';
  fields.schemaInput.value = encounter.schemaVersion ?? CONTENT_SCHEMA_VERSION;
  fields.canonStatusSelect.value = encounter.canonStatus ?? 'EXPERIMENTAL';
  fields.tagsInput.value = (encounter.tags ?? []).join(', ');
  fields.triggerTypeSelect.value = encounter.trigger?.type ?? 'route_distance';
  fields.triggerDistanceInput.value = encounter.trigger?.atDistance ?? 0;
  fields.triggerInteractionInput.value = encounter.trigger?.interactionId ?? '';
  fields.stateIdInput.value = state.id ?? encounter.initialState ?? 'opening';
  fields.presentationModeSelect.value = state.presentationMode ?? 'modalChoicePaused';
  fields.pausePolicySelect.value = typeof state.pausePolicy === 'string' ? state.pausePolicy : 'custom';
  fields.stateTitleInput.value = state.title ?? '';
  fields.stateBodyInput.value = state.body ?? '';
  fields.choiceCountInput.value = state.choices?.length ?? 0;
  fields.musicStateSelect.value = firstEffect(state, 'changeMusicState')?.state ?? 'ATTENTION';
  fields.effectTypeSelect.value = firstChoice.effects?.[0]?.type ?? 'showText';
  fields.firstChoiceLabelInput.value = firstChoice.label ?? '';
  fields.routeBranchInput.value = firstChoice.routeBranch?.branchId ?? firstEffect(firstChoice, 'selectRouteBranch')?.branchId ?? '';
  fields.telemetryTagsInput.value = (firstChoice.telemetryTags ?? encounter.telemetryHooks ?? []).join(', ');
  fields.directorTagsInput.value = (firstChoice.directorTags ?? encounter.directorHooks ?? []).join(', ');
}

function renderFromFields() {
  encounter = encounterFromFields();
  render();
}

function encounterFromFields() {
  const stateId = clean(fields.stateIdInput.value) || 'opening';
  const state = {
    ...primaryState(),
    id: stateId,
    presentationMode: fields.presentationModeSelect.value,
    pausePolicy: fields.pausePolicySelect.value,
    title: fields.stateTitleInput.value.trim(),
    body: fields.stateBodyInput.value.trim(),
    choices: resizeChoices(primaryState().choices ?? [], Number(fields.choiceCountInput.value)),
  };
  if (fields.musicStateSelect.value) {
    state.effects = upsertEffect(state.effects ?? [], { type: 'changeMusicState', state: fields.musicStateSelect.value, fade: 2 });
  }
  const firstChoice = state.choices[0];
  if (firstChoice) {
    firstChoice.label = fields.firstChoiceLabelInput.value.trim() || firstChoice.label;
    const branchId = clean(fields.routeBranchInput.value);
    if (branchId) {
      firstChoice.routeBranch = { ...(firstChoice.routeBranch ?? {}), branchId, promptLabel: firstChoice.routeBranch?.promptLabel ?? firstChoice.label };
      firstChoice.effects = upsertEffect(firstChoice.effects ?? [], { type: 'selectRouteBranch', branchId });
    }
    const effectType = fields.effectTypeSelect.value;
    if (effectType && effectType !== 'selectRouteBranch') firstChoice.effects = upsertEffect(firstChoice.effects ?? [], defaultEffect(effectType));
    firstChoice.telemetryTags = parseTags(fields.telemetryTagsInput.value);
    firstChoice.directorTags = parseTags(fields.directorTagsInput.value);
  }

  return normalizeEncounterDefinition({
    ...encounter,
    schemaVersion: fields.schemaInput.value.trim(),
    assetId: fields.assetIdInput.value.trim(),
    displayName: fields.displayNameInput.value.trim(),
    canonStatus: fields.canonStatusSelect.value,
    tags: parseTags(fields.tagsInput.value),
    trigger: triggerFromFields(),
    initialState: state.id,
    states: upsertState(encounter.states ?? [], state),
    telemetryHooks: unique([...(encounter.telemetryHooks ?? []), ...parseTags(fields.telemetryTagsInput.value)]),
    directorHooks: unique([...(encounter.directorHooks ?? []), ...parseTags(fields.directorTagsInput.value)]),
  });
}

function triggerFromFields() {
  const trigger = { ...(encounter.trigger ?? {}), type: fields.triggerTypeSelect.value };
  if (trigger.type === 'route_distance') trigger.atDistance = finiteNumber(fields.triggerDistanceInput.value, 0);
  if (trigger.type === 'interact_button') trigger.interactionId = clean(fields.triggerInteractionInput.value) || 'interact';
  return trigger;
}

function resizeChoices(choices, count) {
  const target = Math.max(0, Math.floor(count || 0));
  const next = clone(choices);
  while (next.length < target) {
      const number = next.length + 1;
      next.push({
        id: `choice_${number}`,
        label: `Choice ${number}`,
        resolve: number === 1,
        effects: [{ type: 'showText', text: `Choice ${number} selected.` }],
        telemetryTags: [],
        directorTags: [],
    });
  }
  next.length = target;
  return next;
}

function render() {
  jsonOutput.value = `${JSON.stringify(encounter, null, 2)}\n`;
  renderPreview();
  renderStatus();
}

function renderPreview() {
  const states = stateEntries(encounter.states);
  const lines = [];
  lines.push(`<div class="state-card"><strong>${escapeHtml(encounter.displayName ?? encounter.assetId)}</strong><span>${escapeHtml(encounter.trigger?.type ?? 'manual')} at ${escapeHtml(encounter.trigger?.atDistance ?? encounter.trigger?.interactionId ?? 'runtime')}</span></div>`);
  for (const state of states) {
    lines.push(`<div class="state-card"><strong>${escapeHtml(state.id)}</strong><span>${escapeHtml(state.presentationMode ?? '')} / ${escapeHtml(policyLabel(state.pausePolicy))}</span><span>${escapeHtml(state.title ?? '')}</span></div>`);
    for (const choice of state.choices ?? []) {
      const target = choice.nextState ? ` -> ${choice.nextState}` : choice.resolve ? ' -> resolves' : '';
      const branch = choice.routeBranch?.branchId ? ` branch:${choice.routeBranch.branchId}` : '';
      lines.push(`<div class="choice-card"><strong>${escapeHtml(choice.label ?? choice.id)}</strong><span>${escapeHtml(`${choice.id}${target}${branch}`)}</span></div>`);
    }
  }
  for (const repercussion of encounter.repercussions ?? []) {
    lines.push(`<div class="choice-card"><strong>${escapeHtml(repercussion.id)}</strong><span>${escapeHtml(repercussion.trigger?.type ?? 'deferred')}</span></div>`);
  }
  previewPanel.innerHTML = lines.join('');
}

function renderStatus() {
  const report = validateEncounterDefinition(encounter);
  const lines = [
    `<div class="status"><strong>${report.valid ? 'Valid encounter asset' : 'Encounter needs changes'}</strong>`,
    `<span>${stateEntries(encounter.states).length} states, ${choiceCount(encounter)} choices, ${(encounter.repercussions ?? []).length} repercussions</span>`,
    ...report.errors.map((error) => `<span class="error">Error: ${escapeHtml(error)}</span>`),
    ...report.warnings.map((warning) => `<span class="warning">Warning: ${escapeHtml(warning)}</span>`),
    '</div>',
  ];
  statusPanel.innerHTML = lines.join('');
}

function applyJson() {
  try {
    loadEncounter(JSON.parse(jsonOutput.value));
  } catch (error) {
    statusPanel.innerHTML = `<div class="status"><span class="error">Error: ${escapeHtml(error.message)}</span></div>`;
  }
}

function downloadJson() {
  const blob = new Blob([jsonOutput.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${encounter.assetId || 'encounter'}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function primaryState() {
  const states = stateEntries(encounter.states);
  return states.find((state) => state.id === encounter.initialState) ?? states[0] ?? {};
}

function stateEntries(states) {
  if (Array.isArray(states)) return states;
  if (!states || typeof states !== 'object') return [];
  return Object.entries(states).map(([id, state]) => ({ id, ...state }));
}

function upsertState(states, state) {
  const list = stateEntries(states);
  const index = list.findIndex((entry) => entry.id === state.id || entry.id === encounter.initialState);
  if (index >= 0) list[index] = state;
  else list.unshift(state);
  return list;
}

function firstEffect(source, type) {
  return source?.effects?.find((effect) => effect.type === type);
}

function upsertEffect(effects, effect) {
  const next = clone(effects);
  const index = next.findIndex((entry) => entry.type === effect.type);
  if (index >= 0) next[index] = { ...next[index], ...effect };
  else next.push(effect);
  return next;
}

function defaultEffect(type) {
  if (type === 'changeMusicState') return { type, state: fields.musicStateSelect.value };
  if (type === 'selectRouteBranch') return { type, branchId: clean(fields.routeBranchInput.value) || 'route.default' };
  if (type === 'giveResource' || type === 'consumeResource') return { type, resource: 'scrap', amount: 1 };
  if (type === 'changeWeather') return { type, weather: 'clear' };
  if (type === 'setWorldFlag') return { type, key: 'worldFlag', value: true };
  if (type === 'setEncounterVariable') return { type, key: 'choiceSelected', value: true };
  if (type === 'advanceTime') return { type, seconds: 30 };
  if (type === 'setRouteModifier') return { type, modifier: 'route.standard' };
  if (type === 'addChronicleEntry') return { type, entryId: `${encounter.assetId}.choice` };
  if (type === 'addDirectorInfluence') return { type, director: 'route', amount: 0.1 };
  if (type === 'setTerrainHold') return { type, hold: true };
  if (type === 'setLightingPreset') return { type, presetId: 'MOONLIGHT' };
  if (type === 'transitionLightingPreset') return { type, presetId: 'MOONLIGHT', duration: 2 };
  if (type === 'enableLight' || type === 'disableLight') return { type, lightId: 'light.beacon' };
  if (type === 'changeLightBand') return { type, lightId: 'light.beacon', spectralBand: 'UV' };
  if (type === 'revealFluorescentLayer') return { type, targetId: 'layer.hidden_message' };
  if (type === 'chargeMaterial' || type === 'clearPhosphorCharge') return { type, targetId: 'material.phosphor_trail_green' };
  if (type === 'revealObjectState') return { type, objectId: 'object.beacon', state: 'revealed' };
  if (type === 'scheduleEncounter') return { type, encounterId: 'encounter.followup' };
  if (type === 'spawnEncounter') return { type, encounterId: 'encounter.followup' };
  return { type, text: `${type} effect` };
}

function choiceCount(definition) {
  return stateEntries(definition.states).reduce((total, state) => total + (state.choices?.length ?? 0), 0);
}

function populateSelect(select, values) {
  for (const value of values) select.append(new Option(value, value));
}

function parseTags(value) {
  return unique(
    String(value ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  );
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function clean(value) {
  return String(value ?? '').trim();
}

function finiteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function policyLabel(policy) {
  return typeof policy === 'string' ? policy : 'CUSTOM';
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
