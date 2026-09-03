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
  const paused = mapStandardGamepad(createPad({ pressed: [9] }));
  assert.equal(input.cursorClickPressed, true);
  assert.equal(input.fireTogglePressed, true);
  assert.equal(input.debugTogglePressed, true);
  assert.equal(input.resetPressed, true);
  assert.equal(input.controlsTogglePressed, true);
  assert.equal(input.dodgePressed, true);
  assert.equal(input.dodgeX > 0, true);
  assert.equal(input.dodgeY < 0, true);
  assert.equal(paused.pausePressed, true);
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
  assert.equal(triggerInput.targetCycle, 1);
  assert.equal(bumperInput.turn, 0);
  assert.equal(bumperInput.secondaryCycle, -1);
});

test('standard gamepad maps right stick to turret aim and virtual scroll instead of turn', () => {
  const input = mapStandardGamepad(createPad({ axes: [0, 0, 0.9, -0.9] }));
  assert.equal(input.aimX > 0.8, true);
  assert.equal(input.aimY < -0.8, true);
  assert.equal(input.cursorScrollX > 0.8, true);
  assert.equal(input.cursorScrollY < -0.8, true);
  assert.equal(input.turn, 0);
});

test('standard gamepad exposes launch-screen virtual cursor movement and A/B click', () => {
  const input = mapStandardGamepad(createPad({ axes: [0.8, 0, 0, 0], pressed: [0, 12] }));
  const bInput = mapStandardGamepad(createPad({ pressed: [1] }));
  assert.equal(input.cursorX > 0.7, true);
  assert.equal(input.cursorY < 0, true);
  assert.equal(input.cursorClickPressed, true);
  assert.equal(bInput.cursorClickPressed, true);
});

test('standard gamepad honors custom button bindings', () => {
  const input = mapStandardGamepad(createPad({ pressed: [2, 4, 5, 6, 7, 13] }), new Set(), {
    secondaryFire: [2],
    cursorClick: [3],
    hudToggle: [4],
    controlConfigToggle: [5],
    achievementsToggle: [6],
    sandboxToggle: [7],
    gunnerToggle: [13],
  });
  assert.equal(input.secondaryFirePressed, true);
  assert.equal(input.cursorClickPressed, false);
  assert.equal(input.hudTogglePressed, true);
  assert.equal(input.controlConfigTogglePressed, true);
  assert.equal(input.achievementsTogglePressed, true);
  assert.equal(input.sandboxTogglePressed, true);
  assert.equal(input.gunnerTogglePressed, true);
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
