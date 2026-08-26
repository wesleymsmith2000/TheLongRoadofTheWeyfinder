export function readGamepadInput() {
  const pad = navigator.getGamepads?.().find(Boolean);
  if (!pad) return { x: 0, y: 0, turn: 0, brake: false };
  return {
    x: deadzone(pad.axes[0] ?? 0),
    y: deadzone(pad.axes[1] ?? 0),
    turn: deadzone(pad.axes[2] ?? pad.axes[0] ?? 0),
    brake: Boolean(pad.buttons[0]?.pressed),
  };
}

function deadzone(value) {
  return Math.abs(value) < 0.16 ? 0 : value;
}
