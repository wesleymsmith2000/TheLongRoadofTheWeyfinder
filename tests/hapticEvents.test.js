import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import { createEnemy } from '../src/core/enemy.js';
import { createProjectile } from '../src/core/projectile.js';
import { fireSecondary } from '../src/core/secondaryWeapon.js';
import { consumeHapticEvents, emitHapticEvent, HAPTIC_EVENTS } from '../src/core/hapticEvents.js';
import { consumeSoundEvents, SOUND_EVENTS } from '../src/core/soundEvents.js';
import { setGunLoadoutSlot } from '../src/core/weaponLoadout.js';
import { CELL_SIZE } from '../src/core/voxelMask.js';
import startingVehicleDefinition from '../content/constructs/starting_vehicle.json' with { type: 'json' };

test('haptic events can be emitted and consumed', () => {
  const game = createGame();
  emitHapticEvent(game, HAPTIC_EVENTS.PLAYER_VOXEL_DAMAGE, { intensity: 0.2 });
  assert.deepEqual(consumeHapticEvents(game), [{ id: HAPTIC_EVENTS.PLAYER_VOXEL_DAMAGE, intensity: 0.2 }]);
  assert.deepEqual(consumeHapticEvents(game), []);
});

test('player voxel damage emits ricochet sound and light haptic event', () => {
  const game = createGame();
  game.autofire = false;
  game.enemies = [];
  game.enemySpawnQueue = [];
  consumeSoundEvents(game);
  consumeHapticEvents(game);
  game.enemyProjectiles = [
    createProjectile(game.vehicle.x, game.vehicle.y, 1, 0, {
      team: 'enemy',
      weapon: 'enemy-bullet',
      radius: 3,
      damage: 2,
      impulse: 0,
      lifetime: 1,
    }),
  ];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(consumeSoundEvents(game).some((event) => event.id === SOUND_EVENTS.BULLET_RICOCHET), true);
  const haptic = consumeHapticEvents(game).find((event) => event.id === HAPTIC_EVENTS.PLAYER_VOXEL_DAMAGE);
  assert.equal(Boolean(haptic), true);
  assert.equal(haptic.intensity > 0, true);
});

test('player cell loss emits crash sound and heavy haptic event', () => {
  const game = createGame();
  game.autofire = false;
  game.enemies = [];
  game.enemySpawnQueue = [];
  consumeSoundEvents(game);
  consumeHapticEvents(game);
  game.enemyProjectiles = [
    createProjectile(game.vehicle.x, game.vehicle.y, 1, 0, {
      team: 'enemy',
      weapon: 'heavy-test-hit',
      radius: CELL_SIZE,
      damage: 10000,
      impulse: 0,
      lifetime: 1,
    }),
  ];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(consumeSoundEvents(game).some((event) => event.id === SOUND_EVENTS.PLAYER_CELL_LOSS), true);
  const haptic = consumeHapticEvents(game).find((event) => event.id === HAPTIC_EVENTS.PLAYER_CELL_LOSS);
  assert.equal(Boolean(haptic), true);
  assert.equal(haptic.durationMs <= 1000, true);
  assert.equal(haptic.strongMagnitude > haptic.weakMagnitude, true);
});

test('mortar primary and explosive secondaries emit weapon fire haptics', () => {
  const vehicleDefinition = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'primary', 0, 'mortar').definition;
  const mortarGame = createGame(1147, { vehicleDefinition });
  mortarGame.enemies = [createEnemy(mortarGame.vehicle.x + CELL_SIZE * 10, mortarGame.vehicle.y)];
  mortarGame.enemySpawnQueue = [];
  consumeHapticEvents(mortarGame);
  stepGame(mortarGame, { gunnerEnabled: false }, 1 / 60);
  assert.equal(consumeHapticEvents(mortarGame).some((event) => event.id === HAPTIC_EVENTS.PLAYER_WEAPON_FIRE && event.weapon === 'mortar'), true);

  for (const weapon of ['rocket', 'cannon', 'sta_missile']) {
    const game = createGame();
    game.secondary.selected = weapon;
    consumeHapticEvents(game);
    assert.equal(fireSecondary(game), true);
    assert.equal(consumeHapticEvents(game).some((event) => event.id === HAPTIC_EVENTS.PLAYER_WEAPON_FIRE && event.weapon === weapon), true);
  }
});
