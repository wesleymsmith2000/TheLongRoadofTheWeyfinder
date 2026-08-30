import test from 'node:test';
import assert from 'node:assert/strict';
import { mapStandardGamepad } from '../src/input/gamepad.js';

test('standard gamepad maps left stick to movement', () => {
  const input = mapStandardGamepad(createPad({ axes: [0.61, -0.61, 0, 0] }));
  assert.equal(input.x > 0.4, true);
  assert.equal(input.y < -0.4, true);
});

test('standard gamepad ignores common idle stick drift', () => {
  const input = mapStandardGamepad(createPad({ axes: [-0.27, 0.26, 0, 0] }));
  assert.equal(input.x, 0);
  assert.equal(input.y, 0);
});

test('standard gamepad exposes Xbox-style button actions', () => {
  const input = mapStandardGamepad(createPad({ axes: [0.5, -0.5, 0, 0], pressed: [0, 1, 2, 3, 8, 12] }));
  assert.equal(input.brake, true);
  assert.equal(input.fireTogglePressed, true);
  assert.equal(input.debugTogglePressed, true);
  assert.equal(input.resetPressed, true);
  assert.equal(input.controlsTogglePressed, true);
  assert.equal(input.dodgePressed, true);
  assert.equal(input.dodgeX > 0, true);
  assert.equal(input.dodgeY < 0, true);
});

test('standard gamepad button toggles only fire on the press edge', () => {
  const input = mapStandardGamepad(createPad({ pressed: [1, 2, 3, 8, 12] }), new Set([1, 2, 3, 8, 12]));
  assert.equal(input.fireTogglePressed, false);
  assert.equal(input.debugTogglePressed, false);
  assert.equal(input.resetPressed, false);
  assert.equal(input.controlsTogglePressed, false);
  assert.equal(input.dodgePressed, false);
});

test('standard gamepad uses triggers for turning and bumpers for secondary cycling', () => {
  const triggerInput = mapStandardGamepad(createPad({ buttons: { 7: 0.8 } }));
  const bumperInput = mapStandardGamepad(createPad({ pressed: [4] }));
  assert.equal(triggerInput.turn > 0.7, true);
  assert.equal(bumperInput.turn, 0);
  assert.equal(bumperInput.secondaryCycle, -1);
});

test('standard gamepad maps right stick to turret aim instead of turn', () => {
  const input = mapStandardGamepad(createPad({ axes: [0, 0, 0.9, -0.9] }));
  assert.equal(input.aimX > 0.8, true);
  assert.equal(input.aimY < -0.8, true);
  assert.equal(input.turn, 0);
});

test('standard gamepad exposes launch-screen virtual cursor movement and click', () => {
  const input = mapStandardGamepad(createPad({ axes: [0.8, 0, 0, 0], pressed: [0, 12] }));
  assert.equal(input.cursorX > 0.7, true);
  assert.equal(input.cursorY < 0, true);
  assert.equal(input.cursorClickPressed, true);
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
