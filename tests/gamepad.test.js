import test from 'node:test';
import assert from 'node:assert/strict';
import { mapStandardGamepad } from '../src/input/gamepad.js';

test('standard gamepad maps left stick to movement', () => {
  const input = mapStandardGamepad(createPad({ axes: [0.61, -0.61, 0, 0] }));
  assert.equal(input.x > 0.4, true);
  assert.equal(input.y < -0.4, true);
});

test('standard gamepad exposes Xbox-style button actions', () => {
  const input = mapStandardGamepad(createPad({ pressed: [0, 1, 2, 3] }));
  assert.equal(input.brake, true);
  assert.equal(input.fireTogglePressed, true);
  assert.equal(input.debugTogglePressed, true);
  assert.equal(input.resetPressed, true);
});

test('standard gamepad button toggles only fire on the press edge', () => {
  const input = mapStandardGamepad(createPad({ pressed: [1, 2, 3] }), new Set([1, 2, 3]));
  assert.equal(input.fireTogglePressed, false);
  assert.equal(input.debugTogglePressed, false);
  assert.equal(input.resetPressed, false);
});

test('standard gamepad uses triggers and bumpers for turning', () => {
  const triggerInput = mapStandardGamepad(createPad({ buttons: { 7: 0.8 } }));
  const bumperInput = mapStandardGamepad(createPad({ pressed: [4] }));
  assert.equal(triggerInput.turn > 0.7, true);
  assert.equal(bumperInput.turn, -1);
});

function createPad({ axes = [0, 0, 0, 0], pressed = [], buttons = {} } = {}) {
  const padButtons = Array.from({ length: 16 }, (_, index) => ({
    pressed: pressed.includes(index),
    value: buttons[index] ?? (pressed.includes(index) ? 1 : 0),
  }));
  return {
    connected: true,
    mapping: 'standard',
    axes,
    buttons: padButtons,
  };
}
