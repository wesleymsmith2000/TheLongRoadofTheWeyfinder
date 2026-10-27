import test from 'node:test';
import assert from 'node:assert/strict';
import { weaponManifest } from '../src/core/weaponManifest.js';
import { createCell } from '../src/core/cell.js';
import { createConnection } from '../src/core/connections.js';
import { createGame } from '../src/core/game.js';
import { createWeaponManifestView } from '../src/ui/weaponManifest.js';

function fixture() {
  return {
    runMode: 'normal',
    vehicleDefinition: {
      cells: [{ id: 'gun', type: 'gun' }, { id: 'utility', type: 'utility' }],
      gunLoadouts: [{ cellId: 'gun', primary: ['main.basic'], secondary: ['beam'] }],
      modules: [{ cellId: 'utility', kind: 'utilitySlots', slots: ['booster', 'scrap_magnet'] }],
    },
    vehicle: {
      cells: [createCell('core', 'core', 0, 0), createCell('armor', 'armor', 0, 1),
        createCell('gun', 'gun', 5, 5), createCell('utility', 'utility', -5, -5)],
      connections: [createConnection('core', 'armor', 'bottom'), createConnection('armor', 'gun', 'right'),
        createConnection('armor', 'utility', 'left')],
    },
  };
}

test('manifest lists installed weapons and utilities, with distinct slots and no empty or locked Arcade entries', () => {
  const entries = weaponManifest(fixture());
  assert.deepEqual(entries.map(entry => entry.weaponId), ['main.basic', 'beam', 'booster', 'scrap_magnet']);
  assert.ok(entries.every(entry => entry.status === 'good'));
  const arcade = weaponManifest(createGame(42, { runMode: 'arcade' }));
  assert.ok(arcade.every(entry => entry.status === 'good'));
  assert.equal(arcade.filter(entry => entry.kind === 'primary').length, 2);
  assert.equal(arcade.filter(entry => entry.kind === 'secondary').length, 3);
  assert.ok(arcade.some(entry => entry.weaponId === 'mini_beam' && entry.kind === 'utility'));
  assert.ok(arcade.every(entry => !entry.cellId.startsWith('gun-support')));
});

test('lost, detached and disabled systems remain listed, while a healthy duplicate stays good', () => {
  const game = fixture();
  const gun2 = createCell('gun2', 'gun', 2, 2);
  game.vehicle.cells.push(gun2);
  game.vehicle.connections.push(createConnection('core', 'gun2', 'top'));
  game.vehicleDefinition.cells.push({ id: 'gun2', type: 'gun' });
  game.vehicleDefinition.gunLoadouts.push({ cellId: 'gun2', primary: ['main.basic'], secondary: [] });
  const gun = game.vehicle.cells.find(cell => cell.id === 'gun');
  for (const reason of ['detached', 'destroyed', 'device', 'wire']) {
    Object.assign(gun, { attached: true });
    Object.assign(gun.state, { destroyed: false, deviceIntegrity: 1, wiringIntegrity: 1 });
    if (reason === 'detached') gun.attached = false;
    if (reason === 'destroyed') gun.state.destroyed = true;
    if (reason === 'device') gun.state.deviceIntegrity = 0;
    if (reason === 'wire') gun.state.wiringIntegrity = 0;
    const entries = weaponManifest(game);
    assert.equal(entries.filter(entry => entry.cellId === 'gun').length, 2);
    assert.ok(entries.filter(entry => entry.cellId === 'gun').every(entry => entry.status === 'lost'));
    assert.equal(entries.find(entry => entry.cellId === 'gun2').status, 'good');
  }
  gun.attached = true;
  Object.assign(gun.state, { destroyed: false, deviceIntegrity: 1, wiringIntegrity: 1 });
  assert.equal(weaponManifest(game)[0].status, 'good');
});

test('manifest warns for damage and weak structural paths rather than using grid adjacency', () => {
  const game = fixture();
  const gun = game.vehicle.cells.find(cell => cell.id === 'gun');
  gun.state.deviceIntegrity = 0.4;
  assert.equal(weaponManifest(game)[0].status, 'danger');
  gun.state.deviceIntegrity = 1;
  const armor = game.vehicle.cells.find(cell => cell.id === 'armor');
  armor.state.structureIntegrity = 0.62;
  assert.ok(weaponManifest(game).every(entry => entry.status === 'danger'));
  // A second strong authored path rescues the systems, regardless of grid gap.
  game.vehicle.connections.push(createConnection('core', 'gun', 'right'), createConnection('core', 'utility', 'left'));
  assert.ok(weaponManifest(game).every(entry => entry.status === 'good'));
  game.vehicle.connections = [];
  assert.ok(weaponManifest(game).every(entry => entry.status === 'danger'));
});

test('the compact view keeps an X over a lost duplicate and removes it after repair', () => {
  class Element {
    constructor() { this.children = []; this.attributes = {}; this.ownerDocument = document; }
    setAttribute(key, value) { this.attributes[key] = value; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
  }
  const document = { createElement: () => new Element() };
  const container = new Element();
  const update = createWeaponManifestView(container, { label: id => id, icon: () => new Element() });
  const entries = [
    { key: 'a', cellId: 'gun-a', weaponId: 'beam', integrity: 0, status: 'lost' },
    { key: 'b', cellId: 'gun-b', weaponId: 'beam', integrity: 1, status: 'good' },
  ];
  update(entries);
  assert.equal(container.children.length, 2);
  assert.equal(container.children[0].children[1].textContent, '×');
  assert.match(container.children[0].attributes['aria-label'], /Lost.*gun-a/);
  assert.equal(container.children[1].children.some(child => child.className === 'manifest-lost-cross'), false);
  entries[0].status = 'good'; entries[0].integrity = 1;
  update(entries);
  assert.equal(container.children[0].children.some(child => child.className === 'manifest-lost-cross'), false);
  assert.equal(container.children[0].className, 'manifest-card manifest-good');
});
