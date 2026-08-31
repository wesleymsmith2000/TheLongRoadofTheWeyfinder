import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS_EFFECT_TYPES, normalizeStatusEffect, validateStatusEffectDefinition } from '../src/core/statusEffects.js';

test('status effect vocabulary includes planned mechanics', () => {
  assert.deepEqual(STATUS_EFFECT_TYPES, ['fire', 'acid', 'frost', 'ionSurge', 'shield', 'refractive', 'reflective']);
});

test('status effects validate and normalize editor-authored definitions', () => {
  const effect = normalizeStatusEffect({ id: 'swamp-acid', type: 'acid', intensity: 1.4 });
  assert.equal(effect.schemaVersion, '0.1');
  assert.equal(effect.duration, 6);
  assert.equal(effect.stackMode, 'intensity');
  assert.equal(effect.editorTags.includes('armor-eating'), true);
});

test('status effect validation rejects unknown effect types', () => {
  const report = validateStatusEffectDefinition({ id: 'bad', type: 'gravity' });
  assert.equal(report.valid, false);
});
