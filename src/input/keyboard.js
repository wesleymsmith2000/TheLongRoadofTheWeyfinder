export function createKeyboardInput(target = window) {
  const keys = new Set();
  const pressed = new Set();
  const dodge = createDoubleTapDodge();
  target.addEventListener('keydown', (event) => {
    if (!event.repeat) dodge.keyDown(event.code);
    keys.add(event.code);
    pressed.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  target.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });

  return {
    read() {
      const x = axis(keys, 'KeyD', 'ArrowRight') - axis(keys, 'KeyA', 'ArrowLeft');
      const y = axis(keys, 'KeyS', 'ArrowDown') - axis(keys, 'KeyW', 'ArrowUp');
      const turn = axis(keys, 'KeyE') - axis(keys, 'KeyQ');
      const dodgeInput = dodge.consume();
      const snapshot = {
        x,
        y,
        turn,
        aimX: 0,
        aimY: 0,
        brake: keys.has('Space'),
        debugTogglePressed: pressed.has('KeyD'),
        fireTogglePressed: pressed.has('KeyF'),
        resetPressed: pressed.has('KeyR'),
        controlsTogglePressed: pressed.has('KeyH') || pressed.has('Slash'),
        dodgePressed: dodgeInput.pressed,
        dodgeX: dodgeInput.x,
        dodgeY: dodgeInput.y,
        secondaryCycle: pressed.has('KeyZ') ? -1 : pressed.has('KeyX') ? 1 : 0,
        secondaryFirePressed: pressed.has('ShiftLeft') || pressed.has('ShiftRight') || pressed.has('Mouse0'),
      };
      pressed.clear();
      return snapshot;
    },
  };
}

function axis(keys, primary, alternate = '') {
  return keys.has(primary) || keys.has(alternate) ? 1 : 0;
}

function createDoubleTapDodge() {
  const lastTap = new Map();
  let pending = { pressed: false, x: 0, y: 0 };
  const bindings = new Map([
    ['KeyW', { name: 'up', x: 0, y: -1 }],
    ['ArrowUp', { name: 'up', x: 0, y: -1 }],
    ['KeyS', { name: 'down', x: 0, y: 1 }],
    ['ArrowDown', { name: 'down', x: 0, y: 1 }],
    ['KeyA', { name: 'left', x: -1, y: 0 }],
    ['ArrowLeft', { name: 'left', x: -1, y: 0 }],
    ['KeyD', { name: 'right', x: 1, y: 0 }],
    ['ArrowRight', { name: 'right', x: 1, y: 0 }],
  ]);

  return {
    keyDown(code) {
      const binding = bindings.get(code);
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
