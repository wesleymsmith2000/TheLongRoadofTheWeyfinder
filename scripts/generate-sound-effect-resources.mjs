import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const soundAssetRoot = join(repoRoot, 'assets', 'sounds');
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

const authoredDescriptors = [
  ...SOUND_GROUPS.flatMap(groupDescriptors),
  ...SINGLE_SOUNDS.map(([id, tags, usage]) => descriptorFor(id, `${id}.mp3`, 'sound.effect', tags, usage)),
];
const coveredPaths = new Set(authoredDescriptors.map((descriptor) => descriptor.path));
const fallbackDescriptors = readdirSync(soundAssetRoot)
  .filter((filename) => filename.toLowerCase().endsWith('.mp3'))
  .filter((filename) => !coveredPaths.has(`assets/sounds/${filename}`))
  .map(fallbackDescriptorFor);
const descriptors = [...authoredDescriptors, ...fallbackDescriptors].sort((a, b) => a.assetId.localeCompare(b.assetId));

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

function descriptorFor(basename, filename, prefix, tags, usage, options = {}) {
  const filePath = join(repoRoot, 'assets', 'sounds', filename);
  if (!existsSync(filePath)) throw new Error(`Missing sound asset: ${filename}`);
  const assetStem = options.assetStem ?? basename;
  const title = options.displayName ?? titleCase(assetStem);
  return {
    schemaVersion: '0.1',
    assetId: `${prefix}.${assetStem}`,
    displayName: title,
    author: 'Weyfinder prototype',
    provenance: options.provenance ?? 'Declared from assets/sounds for editor-facing sound selection.',
    canonStatus: 'CANON',
    kind: 'sound',
    path: `assets/sounds/${filename}`,
    mimeType: 'audio/mpeg',
    tags: ['sound', ...tags],
    usage,
  };
}

function fallbackDescriptorFor(filename) {
  const rawStem = filename.replace(/\.[^.]+$/, '');
  const assetStem = normalizeAssetStem(rawStem);
  const classification = classifyFallbackSound(assetStem);
  return descriptorFor(assetStem, filename, classification.prefix, classification.tags, classification.usage, {
    displayName: friendlySoundName(rawStem),
    provenance: 'Auto-declared from assets/sounds so editor tooling can offer every bundled sound file.',
  });
}

function classifyFallbackSound(assetStem) {
  if (assetStem.startsWith('boss_internal_explosion')) {
    return { prefix: 'sound.effect', tags: ['boss', 'explosion', 'internal'], usage: { events: ['bossInternalExplosion'] } };
  }
  if (assetStem.startsWith('boss_main_explosion')) {
    return { prefix: 'sound.effect', tags: ['boss', 'explosion', 'death'], usage: { events: ['bossMainExplosion'] } };
  }
  if (assetStem.startsWith('kraken')) {
    const event = assetStem.includes('defeated') ? 'krakenDefeated' : 'krakenEntrance';
    return { prefix: 'sound.effect', tags: ['boss', 'kraken'], usage: { events: [event] } };
  }
  if (assetStem.startsWith('pirate_boss')) {
    const event = assetStem.includes('defeat') ? 'pirateBossDefeated' : 'pirateBossEntrance';
    return { prefix: 'sound.effect', tags: ['boss', 'pirate', 'voice'], usage: { events: [event] } };
  }
  if (assetStem.startsWith('pirate')) {
    return { prefix: 'sound.effect', tags: ['enemy', 'pirate', 'voice'], usage: { events: ['pirateEnemyBark'] } };
  }
  if (assetStem.includes('cannon') || assetStem === 'gunfire') {
    return { prefix: 'sound.effect', tags: ['weapon', 'cannon', 'gunfire'], usage: { events: ['weaponFire', 'explosion'] } };
  }
  if (assetStem === 'button_chirp') return { prefix: 'sound.effect', tags: ['player', 'gun', 'ui'], usage: { events: ['playerMainGun'] } };
  if (assetStem.startsWith('error_buzz')) return { prefix: 'sound.effect', tags: ['enemy', 'beam'], usage: { events: ['enemyBeam'] } };
  if (assetStem === 'error_click') return { prefix: 'sound.effect', tags: ['enemy', 'bullet'], usage: { events: ['enemyBullet'] } };
  if (assetStem === 'particle_beam') return { prefix: 'sound.effect', tags: ['player', 'beam'], usage: { events: ['playerBeam'] } };
  if (assetStem === 'rocket_accelerate') return { prefix: 'sound.effect', tags: ['player', 'rocket'], usage: { events: ['playerSecondaryLaunch'] } };
  if (assetStem.startsWith('toggle_switch_click')) return { prefix: 'sound.effect', tags: ['ui', 'countdown'], usage: { events: ['mothCountdown', 'toggle'] } };
  if (assetStem === 'victory_tone1') return { prefix: 'sound.effect', tags: ['victory', 'stage'], usage: { events: ['stageVictory'] } };
  if (assetStem === 'achievement_notice') return { prefix: 'sound.effect', tags: ['achievement', 'ui'], usage: { events: ['achievementNotice'] } };
  return { prefix: 'sound.effect', tags: ['uncategorized'], usage: { events: ['unassignedEditorSound'] } };
}

function normalizeAssetStem(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/__+/g, '_')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function friendlySoundName(value) {
  return String(value)
    .replace(/__+/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
}

function titleCase(value) {
  return value
    .split('_')
    .map((part) => (part.length > 0 ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(' ');
}
