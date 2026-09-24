import { isNonEmptyString } from './contentSchema.js';
import { selectNavigationEdge } from './navigationGraph.js';

export const ENCOUNTER_MUSIC_STATES = ['TRAVEL', 'ATTENTION', 'SUSPICION', 'MANIFESTATION', 'AFTERIMAGE', 'ROAD_ATTENTION', 'FATE_ATTENTION'];

export const ENCOUNTER_CONDITION_REGISTRY = Object.freeze({
  flagEquals: condition('flagEquals', ({ game, condition: value }) => game.encounters?.worldFlags?.[value.flag] === value.value),
  resourceAbove: condition('resourceAbove', ({ game, condition: value }) => resourceValue(game, value.resource) >= numeric(value.amount)),
  resourceBelow: condition('resourceBelow', ({ game, condition: value }) => resourceValue(game, value.resource) <= numeric(value.amount)),
  choiceWas: condition('choiceWas', ({ instance, condition: value }) => instance.selectedChoices.includes(value.choiceId)),
  interactionCount: condition('interactionCount', ({ instance, condition: value }) => (instance.variables[`${value.interactionId}:count`] ?? 0) >= numeric(value.count)),
  routeBranchSelected: condition('routeBranchSelected', ({ game, condition: value }) => game.road?.selectedRouteBranchId === value.branchId),
});

export const ENCOUNTER_EFFECT_REGISTRY = Object.freeze({
  selectRouteBranch: effect('selectRouteBranch', ({ game, effect: value }) => {
    const branchId = value.branchId ?? value.routeBranchId ?? null;
    if (game.navigation) selectNavigationEdge(game.navigation, branchId, { source: 'encounter' });
    if (game.road) game.road.selectedRouteBranchId = branchId;
  }, requiredString('branchId')),
  spawnEncounter: effect('spawnEncounter', ({ game, effect: value, api }) => {
    api.beginEncounter(game, value.encounterId, { allowDuplicate: value.allowDuplicate === true });
  }, requiredString('encounterId')),
  scheduleEncounter: effect('scheduleEncounter', ({ game, instance, effect: value }) => {
    game.encounters.deferredRepercussions.push({
      id: value.id || `${instance.instanceId}:schedule:${game.encounters.deferredRepercussions.length + 1}`,
      type: 'scheduledEncounter',
      encounterId: value.encounterId,
      trigger: value.trigger ?? { type: 'after_event', eventId: value.eventId ?? instance.definitionId },
      sourceEncounterId: instance.definitionId,
      fired: false,
    });
  }, requiredString('encounterId')),
  giveResource: effect('giveResource', ({ game, effect: value }) => applyResourceDelta(game, value.resource, Math.max(0, numeric(value.amount))), requiredString('resource')),
  consumeResource: effect('consumeResource', ({ game, effect: value }) => applyResourceDelta(game, value.resource, -Math.max(0, numeric(value.amount))), requiredString('resource')),
  changeMusicState: effect('changeMusicState', ({ game, effect: value }) => {
    game.music ??= {};
    game.music.semanticState = value.state ?? game.music.semanticState;
  }, (value, label) => ENCOUNTER_MUSIC_STATES.includes(value.state) ? [] : [`${label}.state must be one of: ${ENCOUNTER_MUSIC_STATES.join(', ')}.`]),
  setWorldFlag: effect('setWorldFlag', ({ game, effect: value }) => {
    game.encounters.worldFlags[value.flag] = value.value ?? true;
  }, requiredString('flag')),
  setEncounterVariable: effect('setEncounterVariable', ({ instance, effect: value }) => {
    instance.variables[value.key] = value.value;
  }, requiredString('key')),
  advanceTime: effect('advanceTime', ({ game, effect: value }) => {
    game.time += Math.max(0, numeric(value.duration ?? value.seconds));
    if (isNonEmptyString(value.marker)) game.worldTimeMarker = value.marker;
  }),
  setRouteModifier: effect('setRouteModifier', ({ game, effect: value }) => {
    if (game.road) game.road.routeModifier = value.modifier ?? value.value ?? null;
  }),
  addChronicleEntry: effect('addChronicleEntry', ({ game, instance, effect: value }) => {
    game.encounters.chronicle.push({
      id: value.entryId ?? value.id ?? `chronicle-${game.encounters.chronicle.length + 1}`,
      text: value.text ?? '',
      sourceEncounterId: instance.definitionId,
    });
  }),
  addDirectorInfluence: effect('addDirectorInfluence', ({ game, instance, effect: value }) => {
    game.encounters.observations.push({
      type: 'directorInfluence',
      tag: value.tag ?? value.director ?? value.id,
      weight: value.weight ?? value.amount ?? 1,
      sourceEncounterId: instance.definitionId,
    });
  }),
  setTerrainHold: effect('setTerrainHold', ({ game, effect: value }) => {
    game.encounterTerrainHold = value.enabled !== false;
  }),
  showText: effect('showText', ({ instance, effect: value }) => {
    instance.message = value.text ?? instance.message ?? '';
  }),
  revealObjectState: effect('revealObjectState', ({ instance, effect: value }) => {
    instance.variables[value.objectId ?? 'object'] = value.state ?? true;
  }),
});

export const ENCOUNTER_CONDITION_TYPES = Object.freeze(Object.keys(ENCOUNTER_CONDITION_REGISTRY));
export const ENCOUNTER_EFFECT_TYPES = Object.freeze(Object.keys(ENCOUNTER_EFFECT_REGISTRY));

export function validateEncounterConditionVerb(value, label) {
  const entry = ENCOUNTER_CONDITION_REGISTRY[value?.type];
  if (!entry) return [`${label}.type "${value?.type ?? 'missing'}" must be one of: ${ENCOUNTER_CONDITION_TYPES.join(', ')}.`];
  return entry.validate?.(value, label) ?? [];
}

export function validateEncounterEffectVerb(value, label) {
  const entry = ENCOUNTER_EFFECT_REGISTRY[value?.type];
  if (!entry) return [`${label}.type "${value?.type ?? 'missing'}" must be one of: ${ENCOUNTER_EFFECT_TYPES.join(', ')}.`];
  return entry.validate?.(value, label) ?? [];
}

export function evaluateEncounterCondition(game, instance, value) {
  const entry = ENCOUNTER_CONDITION_REGISTRY[value?.type];
  if (!entry) return { supported: false, passed: false };
  return { supported: true, passed: Boolean(entry.evaluate({ game, instance, condition: value })) };
}

export function executeEncounterEffect(game, instance, value, api = {}) {
  const entry = ENCOUNTER_EFFECT_REGISTRY[value?.type];
  if (!entry) return false;
  entry.execute({ game, instance, effect: value, api });
  return true;
}

function condition(id, evaluate, validate = null) {
  return Object.freeze({ id, evaluate, validate });
}

function effect(id, execute, validate = null) {
  return Object.freeze({ id, execute, validate });
}

function requiredString(key) {
  return (value, label) => isNonEmptyString(value[key]) ? [] : [`${label}.${key} is required for ${value.type}.`];
}

function numeric(value) {
  return Number(value) || 0;
}

function resourceValue(game, resource) {
  if (resource === 'scrap') return game.scrap ?? 0;
  return 0;
}

function applyResourceDelta(game, resource, delta) {
  if (resource !== 'scrap') return;
  game.scrap = Math.max(0, Math.floor((game.scrap ?? 0) + delta));
}
