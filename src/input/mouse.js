export function createMouseInput(target, toWorld) {
  const state = {
    x: 0,
    y: 0,
    active: false,
    fireHeld: false,
    firePressed: false,
    touchMove: { x: 0, y: 0 },
    movePointerId: null,
    aimPointerId: null,
    moveStart: { x: 0, y: 0 },
  };

  target.addEventListener('pointerdown', (event) => {
    target.setPointerCapture?.(event.pointerId);
    if (event.pointerType === 'touch' && event.clientX < window.innerWidth * 0.45 && state.movePointerId == null) {
      state.movePointerId = event.pointerId;
      state.moveStart = { x: event.clientX, y: event.clientY };
      state.touchMove = { x: 0, y: 0 };
    } else {
      state.aimPointerId = event.pointerId;
      state.fireHeld = true;
      state.firePressed = true;
      setAim(state, event);
    }
  });

  target.addEventListener('pointermove', (event) => {
    if (event.pointerId === state.movePointerId) {
      state.touchMove = {
        x: clampAxis((event.clientX - state.moveStart.x) / 64),
        y: clampAxis((event.clientY - state.moveStart.y) / 64),
      };
      return;
    }
    if (event.pointerType === 'mouse' || event.pointerId === state.aimPointerId) {
      setAim(state, event);
    }
  });

  target.addEventListener('pointerup', (event) => releasePointer(state, event.pointerId));
  target.addEventListener('pointercancel', (event) => releasePointer(state, event.pointerId));

  function setAim(targetState, event) {
    state.x = event.clientX;
    state.y = event.clientY;
    targetState.active = true;
  }

  target.addEventListener('pointerleave', () => {
    if (state.aimPointerId == null) state.active = false;
  });

  return {
    read() {
      return {
        x: state.touchMove.x,
        y: state.touchMove.y,
        aimWorld: state.active ? toWorld({ x: state.x, y: state.y }) : null,
        fireHeld: state.fireHeld,
        firePressed: consumeFirePressed(state),
      };
    },
  };
}

function consumeFirePressed(state) {
  const value = state.firePressed;
  state.firePressed = false;
  return value;
}

export function createPointerButtonInput(target) {
  let pending = false;
  target.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    pending = true;
  });
  return {
    consume() {
      const value = pending;
      pending = false;
      return value;
    },
  };
}

function releasePointer(state, pointerId) {
  if (pointerId === state.movePointerId) {
    state.movePointerId = null;
    state.touchMove = { x: 0, y: 0 };
  }
  if (pointerId === state.aimPointerId) {
    state.aimPointerId = null;
    state.fireHeld = false;
  }
}

function clampAxis(value) {
  return Math.max(-1, Math.min(1, value));
}
