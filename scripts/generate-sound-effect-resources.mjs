import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = join(repoRoot, 'content', 'resources', 'sounds');
const manifestPath = join(repoRoot, 'content', 'packs', 'canon.prototype0.json');
const soundManifestPath = join(repoRoot, 'content', 'packs', 'canon.prototype0_sound_effects.json');

const SOUND_GROUPS = [
  {
    group: 'bullet_ricochet',
    prefix: 'sound.effect',
    count: 4,
    tags: ['combat', 'ricochet', 'impact', 'glaive'],
    usage: { events: ['glaiveBounce', 'bulletImpact'], chance: { bulletImpact: 0.25 } },
  },
  {
    group: 'buzzard_start',
    prefix: 'sound.effect',
    count: 4,
    tags: ['enemy', 'buzzard', 'entrance'],
    usage: { events: ['buzzardEntrance'], randomizeWithinGroup: true },
  },
  {
    group: 'car_skidding',
    prefix: 'sound.effect',
    count: 4,
    tags: ['enemy', 'car', 'skid'],
    usage: { events: ['carEnemySkidding'], randomizeWithinGroup: true },
  },
  {
    group: 'car_start',
    prefix: 'sound.effect',
    count: 4,
    tags: ['enemy', 'car', 'wheeled', 'entrance'],
    usage: { events: ['wheeledEnemyEntrance'], randomizeWithinGroup: true },
  },
  {
    group: 'crash_and_jangle',
    prefix: 'sound.effect',
    count: 4,
    tags: ['enemy', 'death', 'construct', 'crash'],
    usage: { events: ['defaultEnemyConstructDestroyed'], randomizeWithinGroup: true },
  },
  {
    group: 'crash_and_splash',
    prefix: 'sound.effect',
    count: 4,
    tags: ['enemy', 'death', 'water', 'splash'],
    usage: { events: ['waterConstructDestroyed'], excludes: ['octopus'], randomizeWithinGroup: true },
  },
  {
    group: 'insect_chittering',
    prefix: 'sound.effect',
    count: 4,
    tags: ['enemy', 'insectoid', 'entrance'],
    usage: { events: ['inchwormEntrance', 'mothEntrance'], randomizeWithinGroup: true },
  },
  {
    group: 'laser_scorch_pulsed',
    prefix: 'sound.effect',
    count: 3,
    tags: ['enemy', 'laser', 'ground-laser', 'charge'],
    usage: { events: ['groundLaserChargeStart'], randomizeWithinGroup: true },
  },
  {
    group: 'power_down',
    prefix: 'sound.effect',
    count: 2,
    tags: ['powerup', 'beam', 'end'],
    usage: { events: ['powerupEnded', 'enemyBeamStopped'], randomizeWithinGroup: true },
  },
  {
    group: 'ocean_waves',
    prefix: 'sound.ambient',
    count: 4,
    tags: ['ambient', 'water', 'ocean'],
    usage: {
      ambientChain: {
        minLength: 1,
        maxLength: 10,
        meanIntervalSoundSetLengthMultiplier: 5,
        levelMatchers: ['DigitizedStream', 'PiratesRoad'],
      },
    },
  },
  {
    group: 'night_forrest',
    prefix: 'sound.ambient',
    count: 4,
    tags: ['ambient', 'forest', 'night'],
    usage: {
      ambientChain: {
        minLength: 1,
        maxLength: 10,
        meanIntervalSoundSetLengthMultiplier: 5,
        levelMatchers: ['GhostForrestPathway', 'GhostForrestBanshee'],
      },
    },
  },
  {
    group: 'rolling_thunder',
    prefix: 'sound.ambient',
    count: 4,
    tags: ['ambient', 'storm', 'thunder'],
    usage: {
      ambientChain: {
        minLength: 1,
        maxLength: 10,
        meanIntervalSoundSetLengthMultiplier: 5,
        levelMatchers: ['FreedomsPass_StormsOfFatesShadow', 'FreedomsPass_BossFight', 'ShadowedDesert_OminousStormfront', 'ShadowedDesert_BossFight'],
      },
    },
  },
  {
    group: 'storm_wind',
    prefix: 'sound.ambient',
    count: 4,
    tags: ['ambient', 'storm', 'wind'],
    usage: {
      ambientChain: {
        minLength: 1,
        maxLength: 10,
        meanIntervalSoundSetLengthMultiplier: 5,
        levelMatchers: [
          'FreedomsPass_StormsOfFatesShadow',
          'FreedomsPass_BossFight',
          'ShadowedDesert_OminousStormfront',
          'ShadowedDesert_BossFight',
          'ShadowedDesert_Journey',
          'FreedomsPass_DarkeningSkies',
        ],
      },
    },
  },
];

const SINGLE_SOUNDS = [
  ['harpoon_powerup', ['powerup', 'harpoon'], { events: ['harpoonPowerupCollected'] }],
  ['inchworm_defeated', ['enemy', 'inchworm', 'death'], { events: ['inchwormHeadDestroyed'] }],
  ['inchworm_segment_destroyed', ['enemy', 'inchworm', 'segment', 'death'], { events: ['inchwormSegmentDestroyed'] }],
  ['laser_scorch_constant', ['enemy', 'laser', 'ground-laser', 'loop'], { events: ['groundLaserFiringSmokeLoop'], loop: true }],
  ['metal_slash', ['combat', 'glaive', 'impact', 'construct'], { events: ['glaiveConstructCollision'] }],
  ['player_mortar_fire', ['player', 'mortar', 'weapon'], { events: ['playerMortarFire'] }],
  ['enemy_mortar_fire', ['enemy', 'mortar', 'weapon'], { events: ['enemyMortarFire'] }],
  ['enemy_beam_powerup', ['enemy', 'beam', 'charge'], { events: ['enemyBeamChargeStart', 'groundLaserChargeStart'] }],
  ['ghost_enemy_start', ['enemy', 'ghost', 'entrance'], { events: ['ghostEnemyEntrance'] }],
  ['ghost_enemy_defeat', ['enemy', 'ghost', 'death'], { events: ['ghostEnemyDestroyed'] }],
];

mkdirSync(outputRoot, { recursive: true });

const descriptors = [
  ...SOUND_GROUPS.flatMap(groupDescriptors),
  ...SINGLE_SOUNDS.map(([id, tags, usage]) => descriptorFor(id, `${id}.mp3`, 'sound.effect', tags, usage)),
].sort((a, b) => a.assetId.localeCompare(b.assetId));

for (const descriptor of descriptors) {
  const path = join(outputRoot, `${descriptor.assetId}.json`);
  writeFileSync(path, `${JSON.stringify(descriptor, null, 2)}\n`);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.assets ??= {};
manifest.assets.sounds = descriptors.map((descriptor) => `../resources/sounds/${descriptor.assetId}.json`);
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const soundManifest = {
  schemaVersion: '0.1',
  packId: 'canon.prototype0_sound_effects',
  displayName: 'Prototype 0 Sound Effects',
  author: 'Weyfinder prototype',
  provenance: 'Generated from assets/sounds and new_sound_effects.md for editor-facing sound selection.',
  canonStatus: 'CANON',
  description: 'First-party sound effect and ambient sound resource descriptors for Creator Suite editors.',
  tags: ['canon', 'prototype', 'sound', 'audio'],
  dependencies: [],
  assets: {
    sounds: descriptors.map((descriptor) => `../resources/sounds/${descriptor.assetId}.json`),
  },
};
writeFileSync(soundManifestPath, `${JSON.stringify(soundManifest, null, 2)}\n`);

console.log(`Generated ${descriptors.length} sound resource descriptors.`);

function groupDescriptors(group) {
  return Array.from({ length: group.count }, (_, index) => {
    const variant = index + 1;
    const basename = `${group.group}_${variant}`;
    return descriptorFor(basename, `${basename}.mp3`, group.prefix, group.tags, { ...group.usage, group: group.group, variant });
  });
}

function descriptorFor(basename, filename, prefix, tags, usage) {
  const filePath = join(repoRoot, 'assets', 'sounds', filename);
  if (!existsSync(filePath)) throw new Error(`Missing sound asset: ${filename}`);
  const title = titleCase(basename);
  return {
    schemaVersion: '0.1',
    assetId: `${prefix}.${basename}`,
    displayName: title,
    author: 'Weyfinder prototype',
    provenance: 'Declared from assets/sounds for editor-facing sound selection.',
    canonStatus: 'CANON',
    kind: 'sound',
    path: `assets/sounds/${filename}`,
    mimeType: 'audio/mpeg',
    tags: ['sound', ...tags],
    usage,
  };
}

function titleCase(value) {
  return value
    .split('_')
    .map((part) => (part.length > 0 ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(' ');
}
