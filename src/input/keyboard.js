import { normalizeControlBindings } from './controlBindings.js';

export function createKeyboardInput(target = window, bindings = {}) {
  let controlBindings = normalizeControlBindings(bindings).keyboard;
  const keys = new Set();
  const pressed = new Set();
  let dodge = createDoubleTapDodge(controlBindings);
  target.addEventListener('keydown', (event) => {
    if (!event.repeat) dodge.keyDown(event.code);
    keys.add(event.code);
    pressed.add(event.code);
    if (preventedKeys(controlBindings).has(event.code)) event.preventDefault();
  });
  target.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });

  return {
    setBindings(bindings) {
      controlBindings = normalizeControlBindings(bindings).keyboard;
      dodge = createDoubleTapDodge(controlBindings);
    },
    read() {
      const x = actionHeld(keys, controlBindings.moveRight) - actionHeld(keys, controlBindings.moveLeft);
      const y = actionHeld(keys, controlBindings.moveDown) - actionHeld(keys, controlBindings.moveUp);
      const turn = 0;
      const dodgeInput = dodge.consume();
      const snapshot = {
        x,
        y,
        turn,
        aimX: 0,
        aimY: 0,
        brake: actionHeld(keys, controlBindings.brake),
        debugTogglePressed: actionPressed(pressed, controlBindings.debugToggle),
        fireTogglePressed: actionPressed(pressed, controlBindings.primaryAutofire),
        gunnerTogglePressed: actionPressed(pressed, controlBindings.gunnerToggle),
        resetPressed: actionPressed(pressed, controlBindings.reset),
        pausePressed: actionPressed(pressed, controlBindings.pause),
        controlsTogglePressed: actionPressed(pressed, controlBindings.controlsToggle),
        dodgePressed: dodgeInput.pressed,
        dodgeX: dodgeInput.x,
        dodgeY: dodgeInput.y,
        secondaryCycle: actionPressed(pressed, controlBindings.secondaryLeft) ? -1 : actionPressed(pressed, controlBindings.secondaryRight) ? 1 : 0,
        secondaryFirePressed: actionPressed(pressed, controlBindings.secondaryFire),
        targetCycle: actionPressed(pressed, controlBindings.targetPrevious) ? -1 : actionPressed(pressed, controlBindings.targetNext) ? 1 : 0,
      };
      pressed.clear();
      return snapshot;
    },
  };
}

function actionHeld(keys, codes = []) {
  return codes.some((code) => keys.has(code)) ? 1 : 0;
}

function actionPressed(pressed, codes = []) {
  return codes.some((code) => pressed.has(code));
}

function createDoubleTapDodge(bindings) {
  const lastTap = new Map();
  let pending = { pressed: false, x: 0, y: 0 };
  const dodgeBindings = new Map([
    ...bindings.moveUp.map((code) => [code, { name: 'up', x: 0, y: -1 }]),
    ...bindings.moveDown.map((code) => [code, { name: 'down', x: 0, y: 1 }]),
    ...bindings.moveLeft.map((code) => [code, { name: 'left', x: -1, y: 0 }]),
    ...bindings.moveRight.map((code) => [code, { name: 'right', x: 1, y: 0 }]),
  ]);

  return {
    keyDown(code) {
      const binding = dodgeBindings.get(code);
      if (!binding) return;
      const now = performance.now();
      const previous = lastTap.get(binding.name) ?? -Infinity;
      if (now - previous <= 260) pending = { pressed: true, x: binding.x, y: binding.y };
      lastTap.set(binding.name, now);
    },
    consume() {
      const value = pending;
      pending = { pressed: false, x: 0, y: 0 };
      return value;
    },
  };
}

function preventedKeys(bindings) {
  return new Set(['Space', 'Tab', ...bindings.moveUp, ...bindings.moveDown, ...bindings.moveLeft, ...bindings.moveRight, ...bindings.brake, ...bindings.pause]);
}
