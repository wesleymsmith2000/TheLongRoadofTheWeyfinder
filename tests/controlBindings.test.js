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
  assert.equal(gamepadButtonLabel(0), 'A');
  assert.equal(gamepadButtonLabel(11), 'RS');
});
