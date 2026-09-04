import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONTROL_BINDINGS,
  gamepadButtonLabel,
  keyLabel,
  normalizeControlBindings,
  setGamepadBinding,
  setKeyboardBinding,
} from '../src/input/controlBindings.js';

test('control bindings normalize missing actions back to defaults', () => {
  const bindings = normalizeControlBindings({ keyboard: { moveUp: ['KeyI'] }, gamepad: { secondaryFire: [2] } });
  assert.deepEqual(bindings.keyboard.moveUp, ['KeyI']);
  assert.deepEqual(bindings.keyboard.moveDown, DEFAULT_CONTROL_BINDINGS.keyboard.moveDown);
  assert.deepEqual(bindings.gamepad.secondaryFire, [2]);
  assert.deepEqual(bindings.gamepad.cursorClick, DEFAULT_CONTROL_BINDINGS.gamepad.cursorClick);
});

test('control binding helpers replace keyboard and gamepad actions', () => {
  const keyboard = setKeyboardBinding(DEFAULT_CONTROL_BINDINGS, 'secondaryFire', 'KeyK');
  const gamepad = setGamepadBinding(DEFAULT_CONTROL_BINDINGS, 'secondaryFire', 2);
  assert.deepEqual(keyboard.keyboard.secondaryFire, ['KeyK']);
  assert.deepEqual(gamepad.gamepad.secondaryFire, [2]);
});

test('control binding labels are player readable', () => {
  assert.equal(keyLabel('KeyW'), 'W');
  assert.equal(keyLabel('ArrowLeft'), 'Left');
  assert.equal(keyLabel('Escape'), 'Esc');
  assert.equal(keyLabel('Tab'), 'Tab');
  assert.equal(gamepadButtonLabel(0), 'A');
  assert.equal(gamepadButtonLabel(11), 'RS');
});

test('pause and guided targeting defaults are bindable', () => {
  const bindings = normalizeControlBindings();
  assert.deepEqual(bindings.keyboard.pause, ['Escape', 'KeyP']);
  assert.deepEqual(bindings.keyboard.primaryAutofire, ['KeyF']);
  assert.deepEqual(bindings.keyboard.hudToggle, ['KeyU']);
  assert.deepEqual(bindings.keyboard.controlConfigToggle, ['KeyC']);
  assert.deepEqual(bindings.keyboard.achievementsToggle, ['KeyV']);
  assert.deepEqual(bindings.keyboard.sandboxToggle, ['KeyB']);
  assert.deepEqual(bindings.keyboard.aiLeadToggle, ['KeyL']);
  assert.deepEqual(bindings.keyboard.targetNext, ['Tab']);
  assert.deepEqual(bindings.keyboard.secondaryFire.includes('Space'), true);
  assert.deepEqual(bindings.gamepad.primaryAutofire, [12]);
  assert.deepEqual(bindings.gamepad.aiLeadToggle, [13]);
  assert.deepEqual(bindings.gamepad.targetPrevious, [6]);
  assert.deepEqual(bindings.gamepad.targetNext, [7]);
});
