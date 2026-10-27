import test from 'node:test';
import assert from 'node:assert/strict';
import { weaponCooldown, formatCooldown } from '../src/core/weaponCooldown.js';
import { weaponManifest } from '../src/core/weaponManifest.js';
import { createCooldownRing } from '../src/ui/cooldownRing.js';
import { createWeaponManifestView } from '../src/ui/weaponManifest.js';
import { waveWarnings, formatWaveEta } from '../src/core/waveWarnings.js';
import { createGame, stepGame } from '../src/core/game.js';
import { createEnemy } from '../src/core/enemy.js';
import { fireSecondary } from '../src/core/secondaryWeapon.js';
import { stepDiverWaves } from '../src/core/diverEnemy.js';

test('three-digit cooldowns cover milliseconds, seconds and rounding boundaries', () => {
  for (const [seconds, value, unit] of [[12.34, '12.3', 's'], [1.234, '1.23', 's'], [123.4, '123', 's'],
    [0.123, '123', 'ms'], [0.005, '005', 'ms'], [0.0001, '001', 'ms'], [0.99999, '999', 'ms'], [1, '1.00', 's']]) {
    assert.deepEqual(formatCooldown(seconds), { value, unit });
  }
  assert.deepEqual(formatCooldown(0), { value: '', unit: '' });
});

test('cooldown readouts use per-mount primary timers, shared secondaries, utility recharge and interlocks', () => {
  const game = {
    primaryWeaponCooldowns: { 'gun:1:main.basic': 0.2, 'utility:0:mini_beam': 0.3 },
    primaryWeaponCooldownDurations: { 'gun:1:main.basic': 0.8, 'utility:0:mini_beam': 0.6 },
    secondary: { cooldown: 3, cooldownDuration: 6 }, boost: { cooldown: 0.1, cooldownDuration: 0.4 },
    repulsor: { charges: 0, rechargeTimer: 4, cooldown: 4.5 }, weaponInterlock: { remaining: 0.9, duration: 0.9 },
  };
  const entry = { cellId: 'gun', kind: 'primary', slotIndex: 1, weaponId: 'main.basic' };
  assert.equal(weaponCooldown(game, entry).remaining, 0.9);
  game.weaponInterlock.remaining = 0;
  assert.deepEqual(weaponCooldown(game, entry), { remaining: 0.2, duration: 0.8 });
  assert.equal(weaponCooldown(game, { ...entry, cellId: 'other' }).remaining, 0);
  assert.deepEqual(weaponCooldown(game, { kind: 'secondary', weaponId: 'rocket' }), { remaining: 3, duration: 6 });
  assert.equal(weaponCooldown(game, { kind: 'utility', weaponId: 'tractor_beam' }).remaining, 3);
  assert.equal(weaponCooldown(game, { kind: 'utility', weaponId: 'booster' }).remaining, 0.1);
  assert.equal(weaponCooldown(game, { kind: 'utility', weaponId: 'repulsor_beam' }).remaining, 4);
  assert.equal(weaponCooldown(game, { kind: 'utility', cellId: 'utility', slotIndex: 3, weaponId: 'mini_beam' }).remaining, 0.3);
  for (const weaponId of ['scrap_magnet', 'none']) assert.equal(weaponCooldown(game, { weaponId }).remaining, 0);
  assert.equal(weaponCooldown(game, { ...entry, status: 'lost' }).remaining, 0);
  assert.equal(weaponCooldown(game, { ...entry, standby: true }).remaining, 0);
});

function dom() {
  class Element {
    constructor() { this.children = []; this.attributes = {}; this.style = { setProperty: (key, value) => { this[key] = value; } }; this.ownerDocument = document; }
    setAttribute(key, value) { this.attributes[key] = value; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
  }
  const document = { createElement: () => new Element() };
  return { document, Element };
}

test('rings drain and update numeric milliseconds without rebuilding the manifest every frame', () => {
  const { document, Element } = dom();
  const ring = createCooldownRing(document);
  ring.update({ remaining: 0.123, duration: 0.246 });
  assert.equal(ring.element['--cooldown-progress'], '50%');
  assert.equal(ring.element.children[0].textContent, '123');
  assert.equal(ring.element.children[1].textContent, 'ms');
  ring.update({ remaining: 0, duration: 1 }); assert.equal(ring.element.hidden, true);
  const container = new Element();
  const update = createWeaponManifestView(container, { label: id => id, icon: () => new Element() });
  const entries = [{ key: 'gun:primary:0', weaponId: 'main.basic', integrity: 1, status: 'good', cooldown: { remaining: 1, duration: 2 } }];
  update(entries);
  const card = container.children[0];
  entries[0].cooldown.remaining = 0.321;
  update(entries);
  assert.equal(container.children[0], card);
  assert.equal(card.children.at(-1).children[0].textContent, '321');
});

test('actual firing records complete cooldown durations and the manifest reads the same shared timer', () => {
  const game = createGame(42, { runMode: 'arcade' });
  game.secondary.selected = 'cannon';
  assert.equal(fireSecondary(game), true);
  assert.ok(game.secondary.cooldownDuration > 0);
  const cannon = weaponManifest(game).find(entry => entry.weaponId === 'cannon');
  assert.equal(cannon.cooldown.remaining, game.secondary.cooldown);
  assert.equal(cannon.cooldown.duration, game.secondary.cooldownDuration);
  game.enemies = [createEnemy(game.vehicle.x, game.vehicle.y - 80)];
  game.performanceDiagnostics = { disableCollisions: true, freezeTerrainStreaming: true };
  stepGame(game, { fireHeld: true }, 0);
  const main = weaponManifest(game).find(entry => entry.kind === 'primary' && entry.weaponId === 'main.basic');
  assert.ok(main.cooldown.remaining > 0);
  assert.equal(main.cooldown.remaining, main.cooldown.duration);
});

function warningGame() {
  const game = createGame(42, { runMode: 'arcade' });
  game.enemies = [];
  game.enemySpawnQueue = [];
  game.diverWaves.nextIn = 60;
  return game;
}

test('wave ETAs honor time gates, actual distance/speed, empty-screen rushes and active Diver gating', () => {
  const game = warningGame();
  game.time = 20; game.levelStartTime = 10;
  game.enemySpawnQueue = [{ at: 17, enemy: createEnemy(0, 0) }];
  assert.equal(waveWarnings(game).find(entry => entry.kind === 'standard').eta, 7);
  game.enemySpawnQueue[0].triggerDistance = 900; game.road.routeDistance = 300; game.road.speed = 60;
  assert.equal(waveWarnings(game).find(entry => entry.kind === 'standard').eta, 10);
  game.arcadeEmptyScreenSeconds = 13.5;
  assert.equal(waveWarnings(game).find(entry => entry.kind === 'standard').eta, 1.5);
  game.enemySpawnQueue = [];
  assert.equal(waveWarnings(game).find(entry => entry.kind === 'diver').eta, 1.5);
  game.enemies = [{ diver: {}, x: game.camera.x, y: game.camera.y, destroyed: false }];
  assert.equal(waveWarnings(game).some(entry => entry.kind === 'diver'), false);
  game.enemies[0].arcadeGapDiver = true;
  assert.equal(waveWarnings(game).some(entry => entry.kind === 'diver'), true);
  game.gameOver = true; assert.deepEqual(waveWarnings(game), []);
  assert.equal(formatWaveEta(61.1), '01:02');
});

test('Diver approach markers reserve the real formation once at two seconds, including rushed waves', () => {
  for (const rush of [false, true]) {
    const game = warningGame();
    game.diverWaves.nextIn = rush ? 100 : 2.1;
    if (rush) game.arcadeEmptyScreenSeconds = 12.9;
    stepDiverWaves(game, 0.05);
    assert.equal(game.incomingMarkers.length, 0);
    if (rush) game.arcadeEmptyScreenSeconds = 13;
    stepDiverWaves(game, 0.06);
    const count = game.diverWaves.pendingWave.length;
    assert.ok(count >= 3 && count <= 5);
    assert.equal(game.incomingMarkers.filter(marker => marker.type === 'diver').length, count);
    const reserved = structuredClone(game.diverWaves.pendingWave);
    stepDiverWaves(game, 0);
    assert.equal(game.incomingMarkers.length, count);
    assert.deepEqual(game.diverWaves.pendingWave, reserved);
    if (rush) game.arcadeRushDiverEntry = true;
    stepDiverWaves(game, 2);
    assert.equal(game.enemies.filter(enemy => enemy.diver).length, count);
    assert.equal(game.diverWaves.pendingWave, null);
    assert.equal(game.diverWaves.wavesSpawned, 1);
  }
});

test('a canceled empty-screen rush removes its premature Diver markers and releases the reservation', () => {
  const game = warningGame();
  game.arcadeEmptyScreenSeconds = 13;
  game.diverWaves.nextIn = 100;
  stepDiverWaves(game, 0);
  assert.ok(game.diverWaves.pendingWave);
  game.arcadeEmptyScreenSeconds = 0;
  stepDiverWaves(game, 0);
  assert.equal(game.diverWaves.pendingWave, null);
  assert.equal(game.incomingMarkers.length, 0);
  assert.equal(game.enemies.length, 0);
});
