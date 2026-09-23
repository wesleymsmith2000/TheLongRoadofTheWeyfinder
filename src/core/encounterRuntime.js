import {
  encounterChoicesForState,
  encounterState,
  normalizeEncounterDefinition,
  validateEncounterDefinition,
} from './encounterDefinition.js';
import { evaluateEncounterCondition, executeEncounterEffect } from './encounterVerbRegistry.js';

export const ENCOUNTER_POLICY_FLAGS = Object.freeze({
  none: Object.freeze({
    advanceVehicle: true,
    advanceTerrain: true,
    advanceEnemies: true,
    advanceProjectiles: true,
    advanceAmbient: true,
    advanceMusic: true,
    advanceEncounterClock: true,
    acceptDrivingInput: true,
    acceptEncounterInput: false,
  }),
  traversalHold: Object.freeze({
    advanceVehicle: true,
    advanceTerrain: false,
    advanceEnemies: true,
    advanceProjectiles: true,
    advanceAmbient: true,
    advanceMusic: true,
    advanceEncounterClock: true,
    acceptDrivingInput: true,
    acceptEncounterInput: true,
  }),
  encounterHold: Object.freeze({
    advanceVehicle: false,
    advanceTerrain: false,
    advanceEnemies: false,
    advanceProjectiles: false,
    advanceAmbient: true,
    advanceMusic: true,
    advanceEncounterClock: true,
    acceptDrivingInput: false,
    acceptEncounterInput: true,
  }),
  fullPause: Object.freeze({
    advanceVehicle: false,
    advanceTerrain: false,
    advanceEnemies: false,
    advanceProjectiles: false,
    advanceAmbient: false,
    advanceMusic: false,
    advanceEncounterClock: false,
    acceptDrivingInput: false,
    acceptEncounterInput: true,
  }),
});

export function createEncounterRuntimeState(definitions = []) {
  const state = {
    definitions: {},
    active: [],
    resolved: [],
    observations: [],
    chronicle: [],
    worldFlags: {},
    deferredRepercussions: [],
    diagnostics: [],
  };
  for (const definition of definitions) registerEncounterDefinition(state, definition);
  return state;
}

export function registerEncounterDefinition(runtime, definition) {
  if (!runtime) return null;
  const report = validateEncounterDefinition(definition);
  if (!report.valid) throw new Error(`Invalid encounter "${definition?.assetId ?? definition?.id ?? 'unknown'}": ${report.errors.join(' ')}`);
  runtime.definitions ??= {};
  runtime.definitions[report.definition.assetId] = report.definition;
  runtime.definitions[report.definition.id] = report.definition;
  return report.definition;
}

export function beginEncounter(game, definitionOrId, options = {}) {
  game.encounters ??= createEncounterRuntimeState();
  const definition = resolveEncounterDefinition(game.encounters, definitionOrId);
  if (!definition) throw new Error(`Unknown encounter "${definitionOrId}".`);
  const existing = game.encounters.active.find((instance) => instance.definitionId === definition.assetId && !instance.resolved);
  if (existing && options.allowDuplicate !== true) return existing;
  const instance = {
    instanceId: options.instanceId ?? `${definition.assetId}:${(game.encounters.active.length + game.encounters.resolved.length + 1).toString(36)}`,
    definitionId: definition.assetId,
    stateId: options.stateId ?? definition.initialState,
    presentationMode: options.presentationMode ?? definition.presentationMode,
    pausePolicy: options.pausePolicy ?? definition.pausePolicy,
    selectedChoiceIndex: 0,
    selectedChoices: [],
    variables: {},
    resolvedEffectIds: [],
    scheduledRepercussionIds: [],
    emittedTelemetry: [],
    elapsed: 0,
    resolved: false,
    message: '',
  };
  game.encounters.active.push(instance);
  applyEncounterEffects(game, instance, encounterState(definition, instance.stateId).effects, 'state');
  emitEncounterObservations(game, instance, encounterState(definition, instance.stateId).telemetryTags, 'state');
  return instance;
}

export function stepEncounters(game, input = {}, dt = 0) {
  const instance = activeEncounter(game);
  if (!instance) return;
  const definition = encounterDefinitionForInstance(game, instance);
  if (!definition) {
    instance.resolved = true;
    cleanupResolvedEncounters(game);
    return;
  }
  if (encounterPausePolicy(game).advanceEncounterClock) instance.elapsed += dt;
  if (!encounterPausePolicy(game).acceptEncounterInput) return;
  const choices = availableEncounterChoices(game, instance);
  if (choices.length === 0) return;
  if (input.encounterChoiceDelta) {
    instance.selectedChoiceIndex = wrapIndex((instance.selectedChoiceIndex ?? 0) + input.encounterChoiceDelta, choices.length);
  }
  const choiceId = input.encounterChoiceId ?? (input.encounterConfirmPressed ? choices[instance.selectedChoiceIndex ?? 0]?.id : null);
  if (choiceId) chooseEncounterChoice(game, instance, choiceId);
}

export function activeEncounter(game) {
  return game?.encounters?.active?.find((instance) => !instance.resolved) ?? null;
}

export function encounterDefinitionForInstance(game, instance) {
  return game?.encounters?.definitions?.[instance.definitionId] ?? null;
}

export function activeEncounterView(game) {
  const instance = activeEncounter(game);
  if (!instance) return null;
  const definition = encounterDefinitionForInstance(game, instance);
  if (!definition) return null;
  const state = encounterState(definition, instance.stateId);
  const choices = availableEncounterChoices(game, instance);
  const selectedChoiceIndex = Math.min(instance.selectedChoiceIndex ?? 0, Math.max(0, choices.length - 1));
  return {
    instanceId: instance.instanceId,
    definitionId: instance.definitionId,
    stateId: instance.stateId,
    title: state.title || definition.title,
    speaker: state.speaker,
    body: instance.message || state.body,
    prompt: state.prompt,
    presentationMode: instance.presentationMode ?? state.presentationMode ?? definition.presentationMode,
    pausePolicy: instance.pausePolicy ?? state.pausePolicy ?? definition.pausePolicy,
    choices,
    selectedChoiceIndex,
  };
}

export function encounterPausePolicy(game) {
  const view = activeEncounterView(game);
  if (!view) return ENCOUNTER_POLICY_FLAGS.none;
  if (typeof view.pausePolicy === 'object') {
    return { ...ENCOUNTER_POLICY_FLAGS.encounterHold, ...view.pausePolicy };
  }
  return ENCOUNTER_POLICY_FLAGS[view.pausePolicy] ?? ENCOUNTER_POLICY_FLAGS.encounterHold;
}

export function chooseEncounterChoice(game, instanceOrId, choiceId) {
  const instance = typeof instanceOrId === 'string'
    ? game.encounters?.active?.find((candidate) => candidate.instanceId === instanceOrId)
    : instanceOrId;
  if (!instance || instance.resolved) return { ok: false, reason: 'inactive' };
  const definition = encounterDefinitionForInstance(game, instance);
  if (!definition) return { ok: false, reason: 'missing-definition' };
  const choices = availableEncounterChoices(game, instance);
  const choice = choices.find((candidate) => candidate.id === choiceId && candidate.available !== false);
  if (!choice) return { ok: false, reason: 'unavailable' };

  instance.selectedChoices.push(choice.id);
  instance.message = '';
  applyEncounterEffects(game, instance, choice.effects, `choice:${choice.id}`);
  emitEncounterObservations(game, instance, choice.telemetryTags, `choice:${choice.id}`);
  scheduleEncounterRepercussions(game, instance, choice.repercussions);
  if (choice.routeBranchId) applyEncounterEffects(game, instance, [{ type: 'selectRouteBranch', branchId: choice.routeBranchId }], `choice:${choice.id}:route`);

  if (choice.nextState) {
    instance.stateId = choice.nextState;
    instance.selectedChoiceIndex = 0;
    const nextState = encounterState(definition, instance.stateId);
    applyEncounterEffects(game, instance, nextState.effects, `state:${nextState.id}`);
    emitEncounterObservations(game, instance, nextState.telemetryTags, `state:${nextState.id}`);
  }
  if (choice.resolve) resolveEncounter(game, instance);
  cleanupResolvedEncounters(game);
  return { ok: true, choiceId: choice.id };
}

export function availableEncounterChoices(game, instance) {
  const definition = encounterDefinitionForInstance(game, instance);
  if (!definition) return [];
  return encounterChoicesForState(definition, instance.stateId).map((choice) => ({
    ...choice,
    available: conditionsPass(game, instance, choice.conditions),
  })).filter((choice) => choice.available || choice.disabledReason);
}

export function serializeEncounterRuntime(runtime) {
  if (!runtime) return createEncounterRuntimeState();
  return {
    definitions: structuredClone(runtime.definitions ?? {}),
    active: structuredClone(runtime.active ?? []),
    resolved: structuredClone(runtime.resolved ?? []),
    observations: structuredClone(runtime.observations ?? []),
    chronicle: structuredClone(runtime.chronicle ?? []),
    worldFlags: structuredClone(runtime.worldFlags ?? {}),
    deferredRepercussions: structuredClone(runtime.deferredRepercussions ?? []),
    diagnostics: structuredClone(runtime.diagnostics ?? []),
  };
}

export function hydrateEncounterRuntime(payload) {
  if (!payload || typeof payload !== 'object') return createEncounterRuntimeState();
  return {
    definitions: structuredClone(payload.definitions ?? {}),
    active: structuredClone(payload.active ?? []),
    resolved: structuredClone(payload.resolved ?? []),
    observations: structuredClone(payload.observations ?? []),
    chronicle: structuredClone(payload.chronicle ?? []),
    worldFlags: structuredClone(payload.worldFlags ?? {}),
    deferredRepercussions: structuredClone(payload.deferredRepercussions ?? []),
    diagnostics: structuredClone(payload.diagnostics ?? []),
  };
}

function resolveEncounterDefinition(runtime, definitionOrId) {
  if (typeof definitionOrId === 'string') return runtime.definitions?.[definitionOrId] ?? null;
  const report = validateEncounterDefinition(definitionOrId);
  if (!report.valid) throw new Error(`Invalid encounter "${definitionOrId?.assetId ?? definitionOrId?.id ?? 'unknown'}": ${report.errors.join(' ')}`);
  const definition = report.definition ?? normalizeEncounterDefinition(definitionOrId);
  runtime.definitions ??= {};
  runtime.definitions[definition.assetId] = definition;
  runtime.definitions[definition.id] = definition;
  return definition;
}

function applyEncounterEffects(game, instance, effects = [], source = 'effect') {
  for (const [index, effect] of effects.entries()) {
    const effectId = effect.id || `${source}:${index}:${effect.type}`;
    if (instance.resolvedEffectIds.includes(effectId)) continue;
    instance.resolvedEffectIds.push(effectId);
    applyEncounterEffect(game, instance, effect);
  }
}

function applyEncounterEffect(game, instance, effect) {
  game.encounters ??= createEncounterRuntimeState();
  const executed = executeEncounterEffect(game, instance, effect, { beginEncounter });
  if (!executed) addEncounterDiagnostic(game, `Unsupported encounter effect "${effect.type ?? 'missing'}" was ignored.`, effect);
}

function scheduleEncounterRepercussions(game, instance, repercussions = []) {
  if (!Array.isArray(repercussions) || repercussions.length === 0) return;
  game.encounters ??= createEncounterRuntimeState();
  for (const repercussion of repercussions) {
    const id = repercussion.id || `${instance.instanceId}:repercussion:${game.encounters.deferredRepercussions.length + 1}`;
    if (instance.scheduledRepercussionIds.includes(id)) continue;
    instance.scheduledRepercussionIds.push(id);
    game.encounters.deferredRepercussions.push({
      ...structuredClone(repercussion),
      id,
      sourceEncounterId: instance.definitionId,
      fired: false,
    });
  }
}

function emitEncounterObservations(game, instance, tags = [], source = 'observation') {
  if (!Array.isArray(tags) || tags.length === 0) return;
  game.encounters ??= createEncounterRuntimeState();
  for (const tag of tags) {
    if (!tag || instance.emittedTelemetry.includes(`${source}:${tag}`)) continue;
    instance.emittedTelemetry.push(`${source}:${tag}`);
    game.encounters.observations.push({
      tag,
      source,
      sourceEncounterId: instance.definitionId,
      instanceId: instance.instanceId,
      time: game.time ?? 0,
    });
  }
}

function conditionsPass(game, instance, conditions = []) {
  return conditions.every((condition) => conditionPasses(game, instance, condition));
}

function conditionPasses(game, instance, condition) {
  const result = evaluateEncounterCondition(game, instance, condition);
  if (!result.supported) addEncounterDiagnostic(game, `Unsupported encounter condition "${condition.type ?? 'missing'}" evaluated false.`, condition);
  return result.passed;
}

function addEncounterDiagnostic(game, message, source = null) {
  game.encounters ??= createEncounterRuntimeState();
  game.encounters.diagnostics ??= [];
  const key = `${message}:${JSON.stringify(source ?? {})}`;
  if (game.encounters.diagnostics.some((entry) => entry.key === key)) return;
  game.encounters.diagnostics.push({ key, message, source: structuredClone(source), time: game.time ?? 0 });
}

function resolveEncounter(game, instance) {
  instance.resolved = true;
  game.encounterTerrainHold = false;
}

function cleanupResolvedEncounters(game) {
  if (!game.encounters?.active) return;
  const active = [];
  for (const instance of game.encounters.active) {
    if (instance.resolved) game.encounters.resolved.push(structuredClone(instance));
    else active.push(instance);
  }
  game.encounters.active = active;
}

function wrapIndex(index, length) {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}
