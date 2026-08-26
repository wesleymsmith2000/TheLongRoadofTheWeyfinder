export function readGamepadInput() {
  const pad = navigator.getGamepads?.().find(Boolean);
  if (!pad) return { x: 0, y: 0, turn: 0, brake: false };
  const axes = pad.axes.map((value) => deadzone(value));
  const active = axes.some((value) => value !== 0) || pad.buttons.some((button) => button.pressed);
  if (!active) return { x: 0, y: 0, turn: 0, brake: false };
  return {
    x: axes[0] ?? 0,
    y: axes[1] ?? 0,
    turn: axes[2] ?? 0,
    brake: Boolean(pad.buttons[0]?.pressed),
  };
}

function deadzone(value) {
  return Math.abs(value) < 0.28 ? 0 : value;
}
