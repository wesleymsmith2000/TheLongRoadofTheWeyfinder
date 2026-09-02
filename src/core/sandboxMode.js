import { CONTENT_SCHEMA_VERSION, isPlainObject } from './contentSchema.js';

export const SANDBOX_SCHEMA_VERSION = CONTENT_SCHEMA_VERSION;
export const SANDBOX_EVENT_TYPES = ['spawn', 'clearEnemies', 'setScrap', 'addScrap', 'setTargetingMode', 'message', 'complete'];

export const DEFAULT_SANDBOX_DEFINITION = Object.freeze({
  schemaVersion: SANDBOX_SCHEMA_VERSION,
  title: 'Sandbox Level',
  duration: 300,
  level: 1,
  completeOnEmpty: false,
  spawns: [
    {
      id: 'opening-skiff',
      archetype: 'mortar_skiff.prototype0',
      at: 0,
      count: 1,
      interval: 0,
      laneOffset: 0,
      spread: 64,
      roadY: -180,
      speed: 22,
    },
  ],
  events: [
    { id: 'starting-scrap', type: 'setScrap', at: 0, value: 120 },
    {
      id: 'second-wave',
      type: 'spawn',
      at: 8,
      spawns: [
        {
          archetype: 'heavy_mortar_boat.pirates_road',
          count: 2,
          interval: 1.25,
          laneOffset: 0,
          spread: 92,
          roadY: -220,
          speed: 18,
        },
      ],
    },
  ],
});

export function sandboxDefinitionFromEnemy(enemyId, options = {}) {
  const count = positiveInteger(options.count, 1);
  const frequency = positiveNumber(options.frequency, 0);
  const interval = positiveNumber(options.interval, frequency > 0 ? 1 / frequency : 0);
  return normalizeSandboxDefinition({
    ...DEFAULT_SANDBOX_DEFINITION,
    title: options.title ?? 'Enemy Sandbox',
    duration: positiveNumber(options.duration, DEFAULT_SANDBOX_DEFINITION.duration),
    level: positiveInteger(options.level, 1),
    spawns: [
      {
        id: 'quick-spawn',
        archetype: enemyId,
        at: positiveNumber(options.at, 0),
        count,
        interval,
        laneOffset: finiteNumber(options.laneOffset, 0),
        spread: positiveNumber(options.spread, 72),
        roadY: finiteNumber(options.roadY, -180),
        speed: positiveNumber(options.speed, 22),
      },
    ],
    events: [{ id: 'starting-scrap', type: 'setScrap', at: 0, value: 120 }],
  });
}

export function normalizeSandboxDefinition(definition = DEFAULT_SANDBOX_DEFINITION) {
  const source = isPlainObject(definition) ? definition : DEFAULT_SANDBOX_DEFINITION;
  const normalized = {
    schemaVersion: source.schemaVersion ?? SANDBOX_SCHEMA_VERSION,
    title: nonEmptyString(source.title, DEFAULT_SANDBOX_DEFINITION.title),
    duration: positiveNumber(source.duration, DEFAULT_SANDBOX_DEFINITION.duration),
    level: positiveInteger(source.level, 1),
    completeOnEmpty: source.completeOnEmpty === true,
    spawns: normalizeSpawns(source.spawns),
    events: normalizeEvents(source.events),
  };
  if (normalized.spawns.length === 0 && normalized.events.every((event) => event.type !== 'spawn')) {
    normalized.spawns = structuredClone(DEFAULT_SANDBOX_DEFINITION.spawns);
  }
  return normalized;
}

export function validateSandboxDefinition(definition) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(definition)) return { valid: false, errors: ['Sandbox definition must be an object.'], warnings };
  const normalized = normalizeSandboxDefinition(definition);
  if (!Array.isArray(definition.spawns) && !Array.isArray(definition.events)) warnings.push('Sandbox has no spawns or events; the default spawn will be used.');
  for (const [index, spawn] of normalized.spawns.entries()) validateSpawn(spawn, `spawns[${index}]`, errors);
  for (const [index, event] of normalized.events.entries()) {
    if (!SANDBOX_EVENT_TYPES.includes(event.type)) errors.push(`events[${index}].type must be one of: ${SANDBOX_EVENT_TYPES.join(', ')}.`);
    if (event.type === 'spawn') {
      for (const [spawnIndex, spawn] of event.spawns.entries()) validateSpawn(spawn, `events[${index}].spawns[${spawnIndex}]`, errors);
    }
  }
  return { valid: errors.length === 0, errors, warnings, definition: normalized };
}

function normalizeSpawns(spawns) {
  if (!Array.isArray(spawns)) return [];
  return spawns.map((spawn, index) => normalizeSpawn(spawn, index)).filter(Boolean);
}

function normalizeSpawn(spawn, index = 0) {
  if (!isPlainObject(spawn)) return null;
  const frequency = positiveNumber(spawn.frequency, 0);
  return {
    id: nonEmptyString(spawn.id, `spawn-${index + 1}`),
    archetype: nonEmptyString(spawn.archetype ?? spawn.enemy, null),
    construct: nonEmptyString(spawn.construct, null),
    kind: nonEmptyString(spawn.kind, 'standard'),
    entry: nonEmptyString(spawn.entry, 'ahead'),
    at: positiveNumber(spawn.at, 0),
    count: positiveInteger(spawn.count ?? spawn.repeat, 1),
    interval: positiveNumber(spawn.interval ?? spawn.intervalSeconds, frequency > 0 ? 1 / frequency : 0),
    laneOffset: finiteNumber(spawn.laneOffset, 0),
    spread: positiveNumber(spawn.spread, 0),
    randomLaneOffset: positiveNumber(spawn.randomLaneOffset, 0),
    roadY: finiteNumber(spawn.roadY, null),
    speed: positiveNumber(spawn.speed, null),
    level: positiveInteger(spawn.level, null),
  };
}

function normalizeEvents(events) {
  if (!Array.isArray(events)) return [];
  return events
    .map((event, index) => {
      if (!isPlainObject(event)) return null;
      const type = nonEmptyString(event.type, 'message');
      return {
        id: nonEmptyString(event.id, `event-${index + 1}`),
        type,
        at: positiveNumber(event.at, 0),
        text: nonEmptyString(event.text ?? event.message, ''),
        value: finiteNumber(event.value, 0),
        mode: nonEmptyString(event.mode, null),
        spawns: normalizeSpawns(event.spawns ?? (type === 'spawn' ? [event] : [])),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.at - b.at);
}

function validateSpawn(spawn, label, errors) {
  if (!spawn.archetype && !spawn.construct) errors.push(`${label} must include archetype, enemy, or construct.`);
  if (spawn.count < 1) errors.push(`${label}.count must be at least 1.`);
  if (spawn.interval < 0) errors.push(`${label}.interval must be zero or greater.`);
}

function nonEmptyString(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function finiteNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function positiveNumber(value, fallback) {
  const number = finiteNumber(value, fallback);
  return typeof number === 'number' && number >= 0 ? number : fallback;
}

function positiveInteger(value, fallback) {
  const number = finiteNumber(value, fallback);
  return Number.isInteger(number) && number >= 1 ? number : fallback;
}
