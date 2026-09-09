import test from 'node:test';
import assert from 'node:assert/strict';
import canonPackManifest from '../content/packs/canon.prototype0.json' with { type: 'json' };
import basicTurretDefinition from '../content/constructs/basic_turret.json' with { type: 'json' };
import moonlitBeaconEncounter from '../content/encounters/moonlit_beacon_choice_vignette.json' with { type: 'json' };
import prototypeLevelDefinition from '../content/levels/prototype0_road_trial.json' with { type: 'json' };
import aimedPatternDefinition from '../content/patterns/enemy_aimed_shot.json' with { type: 'json' };
import radialPatternDefinition from '../content/patterns/enemy_radial_burst.json' with { type: 'json' };
import trackingFlechetteSprite from '../content/resources/weapons/sprite.weapon.tracking_flechette.json' with { type: 'json' };
import mortarPlayerShellSprite from '../content/resources/weapons/sprite.weapon.mortar_player_shell.json' with { type: 'json' };
import materialTextureAtlas from '../content/resources/materials/image.material.texture_atlas_1.json' with { type: 'json' };
import fateGoldGlitterMaterial from '../content/materials/fate_gold_glitter.json' with { type: 'json' };
import moonlitBeaconMaterial from '../content/materials/moonlit_beacon_material.json' with { type: 'json' };
import ghostForestGroundMaterial from '../content/terrain/materials/ghost_forest_ground.json' with { type: 'json' };
import ghostForestFloorTile from '../content/terrain/tiles/ghost_forest_floor.json' with { type: 'json' };
import {
  createContentRegistry,
  getAvailableContent,
  instantiateLevel,
  loadContentBundle,
  registerContentAsset,
  resolveContentDependencies,
  validateContentPack,
} from '../src/core/contentRegistry.js';

test('canon content pack manifest validates for registry import', () => {
  const report = validateContentPack(canonPackManifest);
  assert.equal(report.valid, true);
  assert.deepEqual(report.errors, []);
});

test('content registry registers immutable runtime asset definitions', () => {
  const registry = createContentRegistry();
  const registered = registerContentAsset(registry, 'construct', basicTurretDefinition, canonPackManifest.packId);

  assert.equal(registered.assetId, 'basic_turret');
  assert.equal(registered.sourcePack, 'canon.prototype0');
  assert.equal(Object.isFrozen(registered), true);
  assert.deepEqual(
    getAvailableContent(registry, 'construct', { tag: 'enemy' }).map((definition) => definition.assetId),
    ['basic_turret'],
  );
});

test('content registry accepts status effect assets for creator packs', () => {
  const registry = createContentRegistry();
  const effect = registerContentAsset(
    registry,
    'statusEffect',
    { schemaVersion: '0.1', id: 'test.fire', type: 'fire', intensity: 1, duration: 3 },
    'test.pack',
  );
  assert.equal(effect.assetId, 'test.fire');
  assert.equal(getAvailableContent(registry, 'statusEffect').length, 1);
});

test('content registry accepts weapon image resource descriptors', () => {
  const registry = createContentRegistry();
  const flechette = registerContentAsset(registry, 'image', trackingFlechetteSprite, canonPackManifest.packId);
  const mortar = registerContentAsset(registry, 'image', mortarPlayerShellSprite, canonPackManifest.packId);

  assert.equal(flechette.assetId, 'sprite.weapon.tracking_flechette');
  assert.equal(mortar.path, 'assets/images/weapons/mortar_player_shell.png');
  assert.equal(getAvailableContent(registry, 'image', { tag: 'weapon' }).length, 2);
});

test('content registry accepts the preliminary material texture atlas image', () => {
  const registry = createContentRegistry();
  const atlas = registerContentAsset(registry, 'image', materialTextureAtlas, canonPackManifest.packId);

  assert.equal(atlas.assetId, 'image.material.texture_atlas_1');
  assert.deepEqual(atlas.nativeSize, [1536, 1024]);
  assert.equal(getAvailableContent(registry, 'image', { tag: 'texture' }).length, 1);
});

test('content registry rejects image resources with malformed native sizes', () => {
  const registry = createContentRegistry();
  assert.throws(
    () => registerContentAsset(registry, 'image', { schemaVersion: '0.1', assetId: 'sprite.bad', kind: 'image', path: 'bad.svg', nativeSize: [0, 32] }),
    /nativeSize/,
  );
});

test('content registry accepts terrain material and tile assets', () => {
  const registry = createContentRegistry();
  const material = registerContentAsset(registry, 'terrainMaterial', ghostForestGroundMaterial, canonPackManifest.packId);
  const tile = registerContentAsset(registry, 'terrainTile', ghostForestFloorTile, canonPackManifest.packId);

  assert.equal(material.materialId, 'ghost_forest.ground');
  assert.equal(tile.assetId, 'terrain.tile.ghost_forest.floor');
  assert.equal(getAvailableContent(registry, 'terrainTile', { tag: 'ground' }).length, 1);
});

test('content registry accepts visual materials and lighting presets', () => {
  const registry = createContentRegistry();
  const gold = registerContentAsset(registry, 'material', fateGoldGlitterMaterial, 'test.pack');
  const beacon = registerContentAsset(registry, 'material', moonlitBeaconMaterial, 'test.pack');
  const moonlight = registerContentAsset(
    registry,
    'lightingPreset',
    {
      schemaVersion: '0.1',
      assetId: 'lighting.preset.steppes_moonlight',
      presetId: 'STEPPES_MOONLIGHT',
      keyLightDirection: { x: -0.5, y: -1 },
      keyLightColor: '#c9d8ff',
      ambientIntensity: 0.32,
      keyLightIntensity: 0.42,
      darknessOverlay: 0.38,
      dynamicLightScale: 1.2,
    },
    'test.pack',
  );

  assert.equal(gold.materialId, 'fate.gold_glitter');
  assert.equal(beacon.lightSource.priority, 'CRITICAL');
  assert.equal(moonlight.presetId, 'STEPPES_MOONLIGHT');
  assert.equal(getAvailableContent(registry, 'material', { tag: 'moonlit' }).length, 2);
});

test('content registry validates encounter assets', () => {
  const registry = createContentRegistry();
  const encounter = registerContentAsset(registry, 'encounter', moonlitBeaconEncounter, canonPackManifest.packId);

  assert.equal(encounter.assetId, 'encounter.moonlit_beacon_choice_vignette');
  assert.equal(getAvailableContent(registry, 'encounter', { tag: 'choice' }).length, 1);
});

test('weapon validation accepts arcing projectile fields', () => {
  const registry = createContentRegistry();
  const mortar = registerContentAsset(
    registry,
    'weapon',
    {
      schemaVersion: '0.1',
      assetId: 'test.mortar',
      displayName: 'Test Mortar',
      ammo: 6,
      heat: 8,
      cooldown: 1.2,
      projectile: {
        behavior: 'arc',
        projectileSpeed: 45,
        radius: 3,
        damage: 12,
        impulse: 90,
        lifetime: 3,
        verticalVelocity: 80,
        gravity: 100,
        maxArcHeight: 32,
        shadowRadius: 5,
      },
    },
    'test.pack',
  );
  assert.equal(mortar.assetId, 'test.mortar');
});

test('level dependency resolution reports missing simulation assets before play', () => {
  const registry = createContentRegistry();
  registerContentAsset(registry, 'level', prototypeLevelDefinition, canonPackManifest.packId);

  const report = resolveContentDependencies([{ kind: 'level', assetId: 'prototype0_road_trial' }], registry);
  assert.equal(report.ok, false);
  assert.equal(report.missing.some((dependency) => dependency.kind === 'construct' && dependency.assetId === 'basic_turret'), true);
  assert.equal(report.missing.some((dependency) => dependency.kind === 'pattern' && dependency.assetId === 'enemy_aimed_shot'), true);
  assert.equal(report.missing.some((dependency) => dependency.kind === 'encounter' && dependency.assetId === 'encounter.moonlit_beacon_choice_vignette'), true);
});

test('instantiateLevel returns a validated level package once required dependencies are registered', () => {
  const registry = createContentRegistry();
  loadContentBundle({ manifests: [canonPackManifest], assets: [] }, { registry });
  registerContentAsset(registry, 'construct', basicTurretDefinition, canonPackManifest.packId);
  registerContentAsset(registry, 'pattern', aimedPatternDefinition, canonPackManifest.packId);
  registerContentAsset(registry, 'pattern', radialPatternDefinition, canonPackManifest.packId);
  registerContentAsset(registry, 'encounter', moonlitBeaconEncounter, canonPackManifest.packId);
  registerContentAsset(registry, 'level', prototypeLevelDefinition, canonPackManifest.packId);

  const runPackage = instantiateLevel('prototype0_road_trial', registry, 1147);
  assert.equal(runPackage.seed, 1147);
  assert.equal(runPackage.definition.assetId, 'prototype0_road_trial');
  assert.equal(runPackage.dependencies.some(({ ref }) => ref.kind === 'level' && ref.assetId === 'prototype0_road_trial'), true);
  assert.equal(runPackage.dependencies.some(({ ref }) => ref.kind === 'sound' && ref.assetId === 'voiceover.prototype0.intro'), false);
});

test('optional level resources warn instead of blocking dependency resolution', () => {
  const registry = createContentRegistry();
  loadContentBundle({ manifests: [canonPackManifest], assets: [] }, { registry });
  registerContentAsset(registry, 'construct', basicTurretDefinition, canonPackManifest.packId);
  registerContentAsset(registry, 'pattern', aimedPatternDefinition, canonPackManifest.packId);
  registerContentAsset(registry, 'pattern', radialPatternDefinition, canonPackManifest.packId);
  registerContentAsset(registry, 'encounter', moonlitBeaconEncounter, canonPackManifest.packId);
  registerContentAsset(registry, 'level', prototypeLevelDefinition, canonPackManifest.packId);

  const report = resolveContentDependencies([{ kind: 'level', assetId: 'prototype0_road_trial' }], registry);
  assert.equal(report.ok, true);
  assert.equal(report.warnings.some((warning) => warning.includes('voiceover.prototype0.intro')), true);
});
