import { CANON_STATUSES, CONTENT_SCHEMA_VERSION, isCompatibleSchemaVersion, isNonEmptyString, isPlainObject, isStringArray } from './contentSchema.js';

export const ENCOUNTER_SCHEMA_VERSION = CONTENT_SCHEMA_VERSION;

export const ENCOUNTER_TRIGGER_TYPES = ['route_distance', 'enter_zone', 'interact_button', 'collision', 'projectile_hit', 'manual'];
export const ENCOUNTER_PRESENTATION_MODES = ['liveRouteChoice', 'modalChoicePaused', 'worldHoldInteraction'];
export const ENCOUNTER_PAUSE_POLICIES = ['none', 'traversalHold', 'encounterHold', 'fullPause', 'custom'];
export const ENCOUNTER_EFFECT_TYPES = [
  'selectRouteBranch',
  'spawnEncounter',
  'scheduleEncounter',
  'giveResource',
  'consumeResource',
  'changeWeather',
  'changeMusicState',
  'setWorldFlag',
  'setEncounterVariable',
  'advanceTime',
  'setRouteModifier',
  'addChronicleEntry',
  'addDirectorInfluence',
  'setTerrainHold',
  'setLightingPreset',
  'transitionLightingPreset',
  'enableLight',
  'disableLight',
  'changeLightBand',
  'revealFluorescentLayer',
  'chargeMaterial',
  'clearPhosphorCharge',
  'showText',
  'revealObjectState',
];
export const ENCOUNTER_CONDITION_TYPES = [
  'flagEquals',
  'resourceAbove',
  'resourceBelow',
  'vehicleIntegrityBelow',
  'choiceWas',
  'interactionCount',
  'timeOfDayAtLeast',
  'chronicleHas',
  'directorInfluenceAbove',
  'routeBranchSelected',
  'materialIsExcited',
  'phosphorChargeAbove',
  'lightBandPresent',
  'lightIntensityAbove',
  'objectIlluminatedBy',
];
export const ENCOUNTER_REPERCUSSION_TRIGGER_TYPES = ['after_route_distance', 'next_level', 'enter_biome', 'timer', 'after_event', 'resource_threshold', 'run_end'];
export const ENCOUNTER_MUSIC_STATES = ['TRAVEL', 'ATTENTION', 'SUSPICION', 'MANIFESTATION', 'AFTERIMAGE', 'ROAD_ATTENTION', 'FATE_ATTENTION'];

const CUSTOM_PAUSE_FLAGS = [
  'advanceVehicle',
  'advanceTerrain',
  'advanceEnemies',
  'advanceProjectiles',
  'advanceAmbient',
  'advanceMusic',
  'advanceEncounterClock',
  'acceptDrivingInput',
  'acceptEncounterInput',
];

export function normalizeEncounterDefinition(definition = {}) {
  const source = isPlainObject(definition) ? definition : {};
  const assetId = nonEmptyString(source.assetId ?? source.id, 'encounter.unnamed');
  const states = normalizeStates(source.states);
  const initialState = nonEmptyString(source.initialState, states[0]?.id ?? 'start');
  if (states.length === 0) states.push(defaultEncounterState(initialState));
  return {
    schemaVersion: source.schemaVersion ?? ENCOUNTER_SCHEMA_VERSION,
    assetId,
    id: nonEmptyString(source.id, assetId),
    displayName: nonEmptyString(source.displayName ?? source.title, assetId),
    title: nonEmptyString(source.title ?? source.displayName, assetId),
    canonStatus: nonEmptyString(source.canonStatus, 'EXPERIMENTAL'),
    tags: Array.isArray(source.tags) ? source.tags.filter((tag) => typeof tag === 'string') : [],
    trigger: isPlainObject(source.trigger) ? structuredClone(source.trigger) : { type: 'manual' },
    presentationMode: normalizePresentationMode(source.presentationMode, states[0].presentationMode),
    pausePolicy: normalizePausePolicy(source.pausePolicy, states[0].pausePolicy),
    initialState,
    states,
    interactions: normalizeInteractions(source.interactions),
    repercussions: normalizeRepercussions(source.repercussions),
    telemetryHooks: Array.isArray(source.telemetryHooks) ? source.telemetryHooks.filter((tag) => typeof tag === 'string') : [],
    directorHooks: Array.isArray(source.directorHooks) ? source.directorHooks.filter((tag) => typeof tag === 'string') : [],
  };
}

export function validateEncounterDefinition(definition) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(definition)) return { valid: false, errors: ['Encounter definition must be an object.'], warnings };
  const normalized = normalizeEncounterDefinition(definition);

  validateMetadata(normalized, errors, warnings);
  validateTrigger(normalized.trigger, 'trigger', errors);

  const stateIds = new Set();
  for (const [index, state] of normalized.states.entries()) {
    if (!isNonEmptyString(state.id)) errors.push(`states[${index}].id must be a non-empty string.`);
    else if (stateIds.has(state.id)) errors.push(`states[${index}].id "${state.id}" is duplicated.`);
    else stateIds.add(state.id);
  }
  if (normalized.states.length === 0) errors.push('states must contain at least one encounter state.');

  const repercussionIds = new Set();
  for (const [index, repercussion] of normalized.repercussions.entries()) {
    if (!isNonEmptyString(repercussion.id)) errors.push(`repercussions[${index}].id must be a non-empty string.`);
    else if (repercussionIds.has(repercussion.id)) errors.push(`repercussions[${index}].id "${repercussion.id}" is duplicated.`);
    else repercussionIds.add(repercussion.id);
  }

  const choiceIds = new Set();
  for (const [index, state] of normalized.states.entries()) {
    validateState(state, `states[${index}]`, stateIds, choiceIds, repercussionIds, errors, warnings);
  }
  if (!isNonEmptyString(normalized.initialState)) errors.push('initialState must be a non-empty string.');
  else if (!stateIds.has(normalized.initialState)) errors.push(`initialState "${normalized.initialState}" does not match a state id.`);

  validateInteractions(normalized.interactions, stateIds, errors);
  validateRepercussions(normalized.repercussions, errors, warnings);
  validateHooks(normalized.telemetryHooks, 'telemetryHooks', warnings);
  validateHooks(normalized.directorHooks, 'directorHooks', warnings);

  return { valid: errors.length === 0, errors, warnings, definition: normalized };
}

export function encounterState(definition, stateId) {
  const normalized = definition?.states ? definition : normalizeEncounterDefinition(definition);
  return normalized.states.find((state) => state.id === stateId) ?? normalized.states[0] ?? defaultEncounterState(stateId ?? 'start');
}

export function encounterChoicesForState(definition, stateId) {
  return encounterState(definition, stateId).choices ?? [];
}

function normalizeStates(states) {
  const entries = stateEntries(states);
  return entries.map((state, index) => normalizeState(state, index)).filter(Boolean);
}

function normalizeState(state, index) {
  if (!isPlainObject(state)) return null;
  const id = nonEmptyString(state.id, `state-${index + 1}`);
  return {
    id,
    title: nonEmptyString(state.title, ''),
    speaker: nonEmptyString(state.speaker, ''),
    body: nonEmptyString(state.body ?? state.text ?? state.description, ''),
    prompt: nonEmptyString(state.prompt, ''),
    presentationMode: normalizePresentationMode(state.presentationMode, 'modalChoicePaused'),
    pausePolicy: normalizePausePolicy(state.pausePolicy, 'encounterHold'),
    effects: normalizeEffects(state.effects ?? state.entryEffects),
    exitEffects: normalizeEffects(state.exitEffects),
    choices: normalizeChoices(state.choices),
    telemetryTags: Array.isArray(state.telemetryTags) ? state.telemetryTags.filter((tag) => typeof tag === 'string') : [],
    directorTags: Array.isArray(state.directorTags) ? state.directorTags.filter((tag) => typeof tag === 'string') : [],
  };
}

function defaultEncounterState(id = 'start') {
  return {
    id,
    title: '',
    speaker: '',
    body: '',
    prompt: '',
    presentationMode: 'modalChoicePaused',
    pausePolicy: 'encounterHold',
    effects: [],
    exitEffects: [],
    choices: [],
    telemetryTags: [],
    directorTags: [],
  };
}

function normalizeChoices(choices) {
  if (!Array.isArray(choices)) return [];
  return choices
    .map((choice, index) => {
      if (!isPlainObject(choice)) return null;
      const routeBranch = isPlainObject(choice.routeBranch) ? structuredClone(choice.routeBranch) : null;
      return {
        id: nonEmptyString(choice.id, `choice-${index + 1}`),
        label: nonEmptyString(choice.label ?? choice.text, `Choice ${index + 1}`),
        summary: nonEmptyString(choice.summary, ''),
        disabledReason: nonEmptyString(choice.disabledReason, ''),
        routeBranch,
        routeBranchId: nonEmptyString(choice.routeBranchId ?? routeBranch?.branchId, ''),
        conditions: normalizeConditions(choice.conditions),
        effects: normalizeEffects(choice.effects),
        repercussions: normalizeRepercussions(choice.repercussions),
        scheduledRepercussions: Array.isArray(choice.scheduledRepercussions)
          ? choice.scheduledRepercussions.filter((id) => typeof id === 'string')
          : [],
        nextState: nonEmptyString(choice.nextState ?? choice.toState, ''),
        resolve: choice.resolve === true || choice.resolves === true,
        telemetryTags: Array.isArray(choice.telemetryTags) ? choice.telemetryTags.filter((tag) => typeof tag === 'string') : [],
        directorTags: Array.isArray(choice.directorTags) ? choice.directorTags.filter((tag) => typeof tag === 'string') : [],
      };
    })
    .filter(Boolean);
}

function normalizeEffects(effects) {
  if (!Array.isArray(effects)) return [];
  return effects
    .map((effect) => {
      if (!isPlainObject(effect)) return null;
      return {
        ...structuredClone(effect),
        id: nonEmptyString(effect.id, ''),
        type: nonEmptyString(effect.type, ''),
        variable: nonEmptyString(effect.variable ?? effect.key, ''),
        key: nonEmptyString(effect.key ?? effect.variable, ''),
      };
    })
    .filter(Boolean);
}

function normalizeConditions(conditions) {
  if (!Array.isArray(conditions)) return [];
  return conditions.filter(isPlainObject).map((condition) => structuredClone(condition));
}

function normalizeInteractions(interactions) {
  if (!Array.isArray(interactions)) return [];
  return interactions
    .map((interaction, index) => {
      if (!isPlainObject(interaction)) return null;
      return {
        ...structuredClone(interaction),
        id: nonEmptyString(interaction.id, `interaction-${index + 1}`),
        type: nonEmptyString(interaction.type, 'interact_button'),
        prompt: nonEmptyString(interaction.prompt, ''),
      };
    })
    .filter(Boolean);
}

function normalizeRepercussions(repercussions) {
  if (!Array.isArray(repercussions)) return [];
  return repercussions
    .map((repercussion, index) => {
      if (!isPlainObject(repercussion)) return null;
      return {
        ...structuredClone(repercussion),
        id: nonEmptyString(repercussion.id, `repercussion-${index + 1}`),
        conditions: normalizeConditions(repercussion.conditions),
        effects: normalizeEffects(repercussion.effects),
      };
    })
    .filter(Boolean);
}

function normalizePresentationMode(mode, fallback = 'modalChoicePaused') {
  const normalized = normalizeToken(mode);
  if (normalized === 'live_route_choice' || normalized === 'liveroutechoice') return 'liveRouteChoice';
  if (normalized === 'modal_choice_paused' || normalized === 'modalchoicepaused') return 'modalChoicePaused';
  if (normalized === 'world_hold_interaction' || normalized === 'worldholdinteraction') return 'worldHoldInteraction';
  return ENCOUNTER_PRESENTATION_MODES.includes(mode) ? mode : fallback;
}

function normalizePausePolicy(policy, fallback = 'encounterHold') {
  if (isPlainObject(policy)) return { name: 'custom', ...structuredClone(policy) };
  const normalized = normalizeToken(policy);
  if (normalized === 'none') return 'none';
  if (normalized === 'traversal_hold' || normalized === 'traversalhold') return 'traversalHold';
  if (normalized === 'encounter_hold' || normalized === 'encounterhold') return 'encounterHold';
  if (normalized === 'full_pause' || normalized === 'fullpause') return 'fullPause';
  if (normalized === 'custom') return 'custom';
  return fallback;
}

function validateMetadata(definition, errors, warnings) {
  if (!isCompatibleSchemaVersion(definition.schemaVersion)) {
    errors.push(`Unsupported encounter schemaVersion "${definition.schemaVersion ?? 'missing'}". Expected 0.x.`);
  }
  if (!isNonEmptyString(definition.assetId)) errors.push('assetId must be a non-empty string.');
  if (definition.canonStatus != null && !CANON_STATUSES.includes(definition.canonStatus)) {
    errors.push(`canonStatus must be one of: ${CANON_STATUSES.join(', ')}.`);
  }
  if (definition.tags != null && !isStringArray(definition.tags)) warnings.push('tags should be an array of strings.');
}

function validateTrigger(trigger, label, errors) {
  if (trigger == null) return;
  if (!isPlainObject(trigger)) {
    errors.push(`${label} must be an object when provided.`);
    return;
  }
  if (!ENCOUNTER_TRIGGER_TYPES.includes(trigger.type)) errors.push(`${label}.type must be one of: ${ENCOUNTER_TRIGGER_TYPES.join(', ')}.`);
  if (trigger.type === 'route_distance') validateFiniteNumber(trigger.atDistance, `${label}.atDistance`, errors, { min: 0 });
  if (trigger.type === 'enter_zone' && !isNonEmptyString(trigger.zoneId)) errors.push(`${label}.zoneId is required for enter_zone triggers.`);
  if (trigger.type === 'interact_button' && !isNonEmptyString(trigger.interactionId)) errors.push(`${label}.interactionId is required for interact_button triggers.`);
}

function validateState(state, label, stateIds, choiceIds, repercussionIds, errors, warnings) {
  if (!ENCOUNTER_PRESENTATION_MODES.includes(state.presentationMode)) {
    errors.push(`${label}.presentationMode must be one of: ${ENCOUNTER_PRESENTATION_MODES.join(', ')}.`);
  }
  validatePausePolicy(state.pausePolicy, `${label}.pausePolicy`, errors, warnings);
  validateEffects(state.effects, `${label}.effects`, errors, warnings);
  validateEffects(state.exitEffects, `${label}.exitEffects`, errors, warnings);

  for (const [index, choice] of state.choices.entries()) {
    validateChoice(choice, `${label}.choices[${index}]`, stateIds, choiceIds, repercussionIds, errors, warnings);
  }
}

function validatePausePolicy(policy, label, errors, warnings) {
  if (typeof policy === 'string') {
    if (!ENCOUNTER_PAUSE_POLICIES.includes(policy)) errors.push(`${label} must be one of: ${ENCOUNTER_PAUSE_POLICIES.join(', ')}.`);
    return;
  }
  if (!isPlainObject(policy)) {
    errors.push(`${label} must be a named policy or custom policy object.`);
    return;
  }
  for (const flag of CUSTOM_PAUSE_FLAGS) {
    if (policy[flag] != null && typeof policy[flag] !== 'boolean') errors.push(`${label}.${flag} must be boolean when provided.`);
  }
  if (policy.advanceTerrain === false && policy.acceptDrivingInput === true) warnings.push(`${label} accepts driving input while terrain is held.`);
}

function validateChoice(choice, label, stateIds, choiceIds, repercussionIds, errors, warnings) {
  if (!isNonEmptyString(choice.id)) errors.push(`${label}.id must be a non-empty string.`);
  else if (choiceIds.has(choice.id)) errors.push(`${label}.id "${choice.id}" is duplicated.`);
  else choiceIds.add(choice.id);
  if (!isNonEmptyString(choice.label)) errors.push(`${label}.label must be a non-empty string.`);
  validateConditions(choice.conditions, `${label}.conditions`, errors);
  validateRouteBranch(choice.routeBranch, `${label}.routeBranch`, errors);
  validateEffects(choice.effects, `${label}.effects`, errors, warnings);
  if (choice.nextState && !stateIds.has(choice.nextState)) errors.push(`${label}.nextState references unknown state "${choice.nextState}".`);
  for (const repercussionId of choice.scheduledRepercussions) {
    if (!repercussionIds.has(repercussionId)) warnings.push(`${label}.scheduledRepercussions references "${repercussionId}" before a matching repercussion is defined.`);
  }
  if (!choice.nextState && !choice.resolve && !choice.routeBranchId && choice.effects.length === 0 && choice.repercussions.length === 0 && choice.scheduledRepercussions.length === 0) {
    warnings.push(`${label} has no transition, route branch, effects, scheduled repercussions, or resolve flag.`);
  }
}

function validateInteractions(interactions, stateIds, errors) {
  for (const [index, interaction] of interactions.entries()) {
    const label = `interactions[${index}]`;
    if (!ENCOUNTER_TRIGGER_TYPES.includes(interaction.type)) errors.push(`${label}.type must be one of: ${ENCOUNTER_TRIGGER_TYPES.join(', ')}.`);
    if (!isNonEmptyString(interaction.prompt)) errors.push(`${label}.prompt must be a non-empty string.`);
    if (interaction.radius != null) validateFiniteNumber(interaction.radius, `${label}.radius`, errors, { min: 0 });
    if (interaction.toState != null && !stateIds.has(interaction.toState)) errors.push(`${label}.toState references unknown state "${interaction.toState}".`);
  }
}

function validateRepercussions(repercussions, errors, warnings) {
  for (const [index, repercussion] of repercussions.entries()) {
    const label = `repercussions[${index}]`;
    validateRepercussionTrigger(repercussion.trigger, `${label}.trigger`, errors);
    validateConditions(repercussion.conditions, `${label}.conditions`, errors);
    validateEffects(repercussion.effects, `${label}.effects`, errors, warnings);
  }
}

function validateRepercussionTrigger(trigger, label, errors) {
  if (!isPlainObject(trigger)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (!ENCOUNTER_REPERCUSSION_TRIGGER_TYPES.includes(trigger.type)) errors.push(`${label}.type must be one of: ${ENCOUNTER_REPERCUSSION_TRIGGER_TYPES.join(', ')}.`);
  if (trigger.type === 'after_route_distance') validateFiniteNumber(trigger.distance, `${label}.distance`, errors, { min: 0 });
  if (trigger.type === 'timer') validateFiniteNumber(trigger.seconds, `${label}.seconds`, errors, { min: 0 });
  if (trigger.type === 'enter_biome' && !isNonEmptyString(trigger.biome)) errors.push(`${label}.biome is required for enter_biome triggers.`);
  if (trigger.type === 'after_event' && !isNonEmptyString(trigger.eventId)) errors.push(`${label}.eventId is required for after_event triggers.`);
}

function validateConditions(conditions, label, errors) {
  if (!Array.isArray(conditions)) {
    errors.push(`${label} must be an array when provided.`);
    return;
  }
  for (const [index, condition] of conditions.entries()) {
    if (!ENCOUNTER_CONDITION_TYPES.includes(condition.type)) errors.push(`${label}[${index}].type must be one of: ${ENCOUNTER_CONDITION_TYPES.join(', ')}.`);
  }
}

function validateRouteBranch(routeBranch, label, errors) {
  if (routeBranch == null) return;
  if (!isPlainObject(routeBranch)) {
    errors.push(`${label} must be an object when provided.`);
    return;
  }
  if (!isNonEmptyString(routeBranch.branchId)) errors.push(`${label}.branchId must be a non-empty string.`);
  if (routeBranch.commitDistance != null) validateFiniteNumber(routeBranch.commitDistance, `${label}.commitDistance`, errors, { min: 0 });
}

function validateEffects(effects, label, errors, warnings) {
  if (!Array.isArray(effects)) {
    errors.push(`${label} must be an array when provided.`);
    return;
  }
  if (effects.length > 12) warnings.push(`${label} has many effects; mobile runtime should avoid large synchronous effect bursts.`);
  for (const [index, effect] of effects.entries()) {
    const entryLabel = `${label}[${index}]`;
    if (!ENCOUNTER_EFFECT_TYPES.includes(effect.type)) errors.push(`${entryLabel}.type must be one of: ${ENCOUNTER_EFFECT_TYPES.join(', ')}.`);
    if (effect.type === 'selectRouteBranch' && !isNonEmptyString(effect.branchId)) errors.push(`${entryLabel}.branchId is required for selectRouteBranch.`);
    if ((effect.type === 'spawnEncounter' || effect.type === 'scheduleEncounter') && !isNonEmptyString(effect.encounterId)) {
      errors.push(`${entryLabel}.encounterId is required for ${effect.type}.`);
    }
    if (effect.type === 'changeMusicState' && !ENCOUNTER_MUSIC_STATES.includes(effect.state)) {
      errors.push(`${entryLabel}.state must be one of: ${ENCOUNTER_MUSIC_STATES.join(', ')}.`);
    }
    if (effect.type === 'setEncounterVariable' && !isNonEmptyString(effect.key)) errors.push(`${entryLabel}.key is required for setEncounterVariable.`);
    if ((effect.type === 'giveResource' || effect.type === 'consumeResource') && !isNonEmptyString(effect.resource)) errors.push(`${entryLabel}.resource is required for ${effect.type}.`);
    if ((effect.type === 'setLightingPreset' || effect.type === 'transitionLightingPreset') && !isNonEmptyString(effect.presetId)) {
      errors.push(`${entryLabel}.presetId is required for ${effect.type}.`);
    }
    if ((effect.type === 'enableLight' || effect.type === 'disableLight' || effect.type === 'changeLightBand') && !isNonEmptyString(effect.lightId)) {
      errors.push(`${entryLabel}.lightId is required for ${effect.type}.`);
    }
    if ((effect.type === 'revealFluorescentLayer' || effect.type === 'chargeMaterial' || effect.type === 'clearPhosphorCharge') && !isNonEmptyString(effect.targetId)) {
      errors.push(`${entryLabel}.targetId is required for ${effect.type}.`);
    }
  }
}

function validateHooks(hooks, label, warnings) {
  if (hooks != null && !isStringArray(hooks)) warnings.push(`${label} should be an array of strings.`);
}

function stateEntries(states) {
  if (Array.isArray(states)) return states;
  if (!isPlainObject(states)) return [];
  return Object.entries(states).map(([id, state]) => ({ id, ...state }));
}

function validateFiniteNumber(value, label, errors, options = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${label} must be a finite number.`);
    return;
  }
  if (options.min != null && value < options.min) errors.push(`${label} must be at least ${options.min}.`);
}

function normalizeToken(value) {
  return typeof value === 'string' ? value.trim().replaceAll('-', '_').toLowerCase() : '';
}

function nonEmptyString(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
