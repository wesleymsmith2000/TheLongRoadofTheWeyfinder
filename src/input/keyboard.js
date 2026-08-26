export function createKeyboardInput(target = window) {
  const keys = new Set();
  const pressed = new Set();
  target.addEventListener('keydown', (event) => {
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
      };
      pressed.clear();
      return snapshot;
    },
  };
}

function axis(keys, primary, alternate = '') {
  return keys.has(primary) || keys.has(alternate) ? 1 : 0;
}
