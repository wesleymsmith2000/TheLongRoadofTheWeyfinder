import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import soundManifest from '../content/packs/canon.prototype0_sound_effects.json' with { type: 'json' };
import { createContentRegistry, loadContentBundle, validateContentPack } from '../src/core/contentRegistry.js';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

test('canon sound effect resource pack validates and registers editor resources', () => {
  const descriptors = soundManifest.assets.sounds.map((entry) => readResource(entry));
  const report = validateContentPack(soundManifest, (entry) => readResource(entry));
  assert.equal(report.valid, true);

  const bundleReport = loadContentBundle(
    {
      manifests: [soundManifest],
      assets: descriptors.map((definition) => ({ kind: 'sound', definition, sourcePack: soundManifest.packId })),
    },
    { registry: createContentRegistry() },
  );

  assert.equal(bundleReport.valid, true);
  assert.equal(bundleReport.registry.assets.get('sound').size, 59);
  assert.equal(bundleReport.registry.assets.get('sound').has('sound.effect.bullet_ricochet_1'), true);
  assert.equal(bundleReport.registry.assets.get('sound').has('sound.ambient.ocean_waves_1'), true);
});

test('new sound effects preserve editor usage metadata', () => {
  const byId = new Map(soundManifest.assets.sounds.map((entry) => {
    const definition = readResource(entry);
    return [definition.assetId, definition];
  }));

  assert.equal(groupCount(byId, 'bullet_ricochet'), 4);
  assert.equal(byId.get('sound.effect.bullet_ricochet_1').usage.chance.bulletImpact, 0.25);
  assert.equal(groupCount(byId, 'buzzard_start'), 4);
  assert.equal(groupCount(byId, 'car_start'), 4);
  assert.equal(groupCount(byId, 'car_skidding'), 4);
  assert.equal(groupCount(byId, 'crash_and_jangle'), 4);
  assert.equal(groupCount(byId, 'crash_and_splash'), 4);
  assert.equal(groupCount(byId, 'insect_chittering'), 4);
  assert.equal(groupCount(byId, 'laser_scorch_pulsed'), 3);
  assert.equal(groupCount(byId, 'power_down'), 2);
  assert.equal(byId.get('sound.effect.laser_scorch_constant').usage.loop, true);
  assert.equal(byId.get('sound.effect.ghost_enemy_start').usage.events.includes('ghostEnemyEntrance'), true);
  assert.equal(byId.get('sound.effect.ghost_enemy_defeat').usage.events.includes('ghostEnemyDestroyed'), true);
  assert.equal(byId.get('sound.effect.harpoon_powerup').usage.events.includes('harpoonPowerupCollected'), true);
  assert.equal(byId.get('sound.effect.player_mortar_fire').usage.events.includes('playerMortarFire'), true);
  assert.equal(byId.get('sound.effect.enemy_mortar_fire').usage.events.includes('enemyMortarFire'), true);
});

test('ambient sound descriptors expose chain rules and source files', () => {
  const descriptors = soundManifest.assets.sounds.map((entry) => readResource(entry));
  for (const descriptor of descriptors) {
    assert.equal(existsSync(join(repoRoot, descriptor.path)), true, descriptor.path);
  }

  const ambient = descriptors.filter((descriptor) => descriptor.assetId.startsWith('sound.ambient.'));
  assert.equal(ambient.length, 16);
  for (const descriptor of ambient) {
    assert.equal(descriptor.usage.ambientChain.minLength, 1);
    assert.equal(descriptor.usage.ambientChain.maxLength, 10);
    assert.equal(descriptor.usage.ambientChain.meanIntervalSoundSetLengthMultiplier, 5);
    assert.equal(Array.isArray(descriptor.usage.ambientChain.levelMatchers), true);
  }
});

function groupCount(byId, group) {
  return [...byId.values()].filter((definition) => definition.usage?.group === group).length;
}

function readResource(entry) {
  const fullPath = normalize(join(repoRoot, 'content', 'packs', entry));
  return JSON.parse(readFileSync(fullPath, 'utf8'));
}
