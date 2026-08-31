import { CONTENT_SCHEMA_VERSION, isCompatibleSchemaVersion, isNonEmptyString, isPlainObject } from './contentSchema.js';

export const STATUS_EFFECT_SCHEMA_VERSION = CONTENT_SCHEMA_VERSION;
export const STATUS_EFFECT_TYPES = ['fire', 'acid', 'frost', 'ionSurge', 'shield', 'refractive', 'reflective'];

export const STATUS_EFFECT_DEFINITIONS = Object.freeze({
  fire: Object.freeze({ id: 'fire', label: 'Fire', stackMode: 'intensity', defaultDuration: 5, editorTags: ['dot', 'heat', 'spreading'] }),
  acid: Object.freeze({ id: 'acid', label: 'Acid', stackMode: 'intensity', defaultDuration: 6, editorTags: ['dot', 'armor-eating'] }),
  frost: Object.freeze({ id: 'frost', label: 'Frost', stackMode: 'intensity', defaultDuration: 4, editorTags: ['slow', 'de-icing', 'heat-sink'] }),
  ionSurge: Object.freeze({ id: 'ionSurge', label: 'Ion Surge', stackMode: 'charge', defaultDuration: 3, editorTags: ['misfire', 'controls', 'sensor-glitch'] }),
  shield: Object.freeze({ id: 'shield', label: 'Shield', stackMode: 'pool', defaultDuration: 2, editorTags: ['absorb', 'timed-block'] }),
  refractive: Object.freeze({ id: 'refractive', label: 'Refractive', stackMode: 'quality', defaultDuration: 8, editorTags: ['decoy', 'sensor'] }),
  reflective: Object.freeze({ id: 'reflective', label: 'Reflective', stackMode: 'quality', defaultDuration: 8, editorTags: ['beam-bounce', 'arc'] }),
});

export function validateStatusEffectDefinition(definition) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(definition)) return { valid: false, errors: ['Status effect definition must be an object.'], warnings };
  if (!isCompatibleSchemaVersion(definition.schemaVersion ?? STATUS_EFFECT_SCHEMA_VERSION)) {
    errors.push(`Unsupported status effect schemaVersion "${definition.schemaVersion ?? 'missing'}". Expected 0.x.`);
  }
  if (!STATUS_EFFECT_TYPES.includes(definition.type)) errors.push(`type must be one of: ${STATUS_EFFECT_TYPES.join(', ')}.`);
  if (!isNonEmptyString(definition.id)) errors.push('id must be a non-empty string.');
  validateNumber(definition.intensity ?? 1, 'intensity', errors, { min: 0 });
  validateNumber(definition.duration ?? STATUS_EFFECT_DEFINITIONS[definition.type]?.defaultDuration ?? 1, 'duration', errors, { min: 0 });
  if (definition.materialRules != null && !isPlainObject(definition.materialRules)) warnings.push('materialRules should be an object when present.');
  return { valid: errors.length === 0, errors, warnings };
}

export function normalizeStatusEffect(definition) {
  const report = validateStatusEffectDefinition(definition);
  if (!report.valid) throw new Error(`Invalid status effect "${definition?.id ?? 'unknown'}": ${report.errors.join(' ')}`);
  const base = STATUS_EFFECT_DEFINITIONS[definition.type];
  return {
    schemaVersion: definition.schemaVersion ?? STATUS_EFFECT_SCHEMA_VERSION,
    id: definition.id,
    type: definition.type,
    label: definition.label ?? base.label,
    intensity: definition.intensity ?? 1,
    duration: definition.duration ?? base.defaultDuration,
    stackMode: definition.stackMode ?? base.stackMode,
    materialRules: definition.materialRules ?? {},
    editorTags: definition.editorTags ?? base.editorTags,
  };
}

function validateNumber(value, label, errors, options = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${label} must be a finite number.`);
    return;
  }
  if (options.min != null && value < options.min) errors.push(`${label} must be at least ${options.min}.`);
}
