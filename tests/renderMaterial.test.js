import test from 'node:test';
import assert from 'node:assert/strict';

import fateGoldGlitterMaterial from '../content/materials/fate_gold_glitter.json' with { type: 'json' };
import fluorescentHiddenMessageInk from '../content/materials/fluorescent_hidden_message_ink.json' with { type: 'json' };
import moonlitBeaconMaterial from '../content/materials/moonlit_beacon_material.json' with { type: 'json' };
import phosphorTrailGreen from '../content/materials/phosphor_trail_green.json' with { type: 'json' };
import {
  computeVoxelSurfaceLight,
  phosphorChargeAfterExposure,
  previewMaterialColor,
  normalizeRenderMaterial,
  renderMaterialBrightness,
  resolveEnvironmentLighting,
  sampleMaterialVariation,
  shadeMaterialColor,
  validateMaterialDefinition,
} from '../src/core/renderMaterial.js';
import { Roles } from '../src/core/voxelMask.js';

test('procedural material variation is stable for the same coordinates', () => {
  const material = normalizeRenderMaterial({
    materialId: 'test.steel',
    render: {
      albedo: '#65727a',
      texture: { pattern: 'brushed', scale: 0.35, strength: 0.4, seedOffset: 17 },
    },
  });

  assert.equal(sampleMaterialVariation(material, 12, -4), sampleMaterialVariation(material, 12, -4));
  assert.notEqual(sampleMaterialVariation(material, 12, -4), sampleMaterialVariation(material, 13, -4));
});

test('directional surface shade responds to exposed side and light direction', () => {
  const live = { role: Roles.STRUCTURE, hp: 1, maxHp: 1 };
  const empty = { role: Roles.EMPTY, hp: 0, maxHp: 0 };
  const mask = [
    [empty, empty, empty],
    [empty, live, live],
    [empty, live, live],
  ];

  const northwest = computeVoxelSurfaceLight(mask, 1, 1, resolveEnvironmentLighting({ keyLightDirection: { x: -1, y: -1 } }));
  const southeast = computeVoxelSurfaceLight(mask, 1, 1, resolveEnvironmentLighting({ keyLightDirection: { x: 1, y: 1 } }));

  assert.equal(northwest.directional > southeast.directional, true);
  assert.equal(northwest.ao < 1, true);
});

test('emissive materials stay brighter than reflective materials under moonlight', () => {
  const gold = normalizeRenderMaterial({
    materialId: 'gold',
    render: { albedo: '#d8b85a', shading: { reflectivity: 0.9, metallic: 1 } },
  });
  const beacon = normalizeRenderMaterial({
    materialId: 'beacon',
    render: { albedo: '#728094', emissive: { color: '#bffcff', intensity: 0.7 }, shading: { reflectivity: 0.2 } },
  });

  assert.equal(renderMaterialBrightness(gold, 'DAY') > renderMaterialBrightness(beacon, 'DAY') * 0.55, true);
  assert.equal(renderMaterialBrightness(beacon, 'MOONLIGHT') > renderMaterialBrightness(gold, 'MOONLIGHT'), true);
});

test('shade material color caches stable rgb strings', () => {
  assert.equal(shadeMaterialColor('#102030', 12.4), 'rgb(28 44 60)');
  assert.equal(shadeMaterialColor('#102030', 12.4), 'rgb(28 44 60)');
});

test('canon visual material samples validate and expose spectral behavior', () => {
  for (const definition of [fateGoldGlitterMaterial, fluorescentHiddenMessageInk, moonlitBeaconMaterial, phosphorTrailGreen]) {
    assert.equal(validateMaterialDefinition(definition).valid, true);
  }

  assert.notEqual(
    previewMaterialColor(fluorescentHiddenMessageInk, 'NIGHT', { excitationBand: 'UV', excitationIntensity: 1 }),
    previewMaterialColor(fluorescentHiddenMessageInk, 'NIGHT', { excitationBand: 'RED', excitationIntensity: 1 }),
  );
  assert.equal(phosphorChargeAfterExposure(phosphorTrailGreen.render.phosphorescence, { exposureSeconds: 1, elapsedSeconds: 0 }) > 0, true);
});
