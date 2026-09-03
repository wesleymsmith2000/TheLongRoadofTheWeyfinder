export const CONTROL_ACTIONS = [
  { id: 'moveUp', label: 'Move Up', keyboard: ['KeyW', 'ArrowUp'], gamepad: [] },
  { id: 'moveDown', label: 'Move Down', keyboard: ['KeyS', 'ArrowDown'], gamepad: [] },
  { id: 'moveLeft', label: 'Move Left', keyboard: ['KeyA', 'ArrowLeft'], gamepad: [] },
  { id: 'moveRight', label: 'Move Right', keyboard: ['KeyD', 'ArrowRight'], gamepad: [] },
  { id: 'brake', label: 'Brake', keyboard: [], gamepad: [10] },
  { id: 'pause', label: 'Pause / Gear Menu', keyboard: ['Escape', 'KeyP'], gamepad: [9] },
  { id: 'primaryAutofire', label: 'Toggle Primary Autofire', keyboard: ['KeyF'], gamepad: [12] },
  { id: 'hudToggle', label: 'Toggle HUD', keyboard: ['KeyU'], gamepad: [] },
  { id: 'debugToggle', label: 'Toggle Debug', keyboard: ['Backquote'], gamepad: [2] },
  { id: 'controlConfigToggle', label: 'Toggle Control Config', keyboard: ['KeyC'], gamepad: [] },
  { id: 'achievementsToggle', label: 'Toggle Achievements', keyboard: ['KeyV'], gamepad: [] },
  { id: 'sandboxToggle', label: 'Toggle Sandbox Panel', keyboard: ['KeyB'], gamepad: [] },
  { id: 'gunnerToggle', label: 'Toggle Gunner AI', keyboard: ['KeyG'], gamepad: [] },
  { id: 'reset', label: 'Restart / Reset', keyboard: ['KeyR'], gamepad: [3] },
  { id: 'controlsToggle', label: 'Help / Controls', keyboard: ['KeyH', 'Slash'], gamepad: [8, 9] },
  { id: 'secondaryLeft', label: 'Previous Secondary', keyboard: ['KeyQ', 'KeyZ'], gamepad: [4] },
  { id: 'secondaryRight', label: 'Next Secondary', keyboard: ['KeyE', 'KeyX'], gamepad: [5] },
  { id: 'secondaryFire', label: 'Fire Secondary', keyboard: ['Space', 'ShiftLeft', 'ShiftRight'], gamepad: [10, 11] },
  { id: 'targetPrevious', label: 'Previous AI Target', keyboard: [], gamepad: [6] },
  { id: 'targetNext', label: 'Next AI Target', keyboard: ['Tab'], gamepad: [7] },
  { id: 'dodge', label: 'Dodge / Boost', keyboard: [], gamepad: [1] },
  { id: 'cursorClick', label: 'Virtual Cursor Click', keyboard: [], gamepad: [0, 1] },
];

export const DEFAULT_CONTROL_BINDINGS = Object.freeze({
  keyboard: Object.freeze(Object.fromEntries(CONTROL_ACTIONS.map((action) => [action.id, Object.freeze([...action.keyboard])]))),
  gamepad: Object.freeze(Object.fromEntries(CONTROL_ACTIONS.map((action) => [action.id, Object.freeze([...action.gamepad])]))),
});

export function normalizeControlBindings(bindings = {}) {
  return {
    keyboard: normalizeDeviceBindings(bindings.keyboard, 'keyboard'),
    gamepad: normalizeDeviceBindings(bindings.gamepad, 'gamepad'),
  };
}

export function setKeyboardBinding(bindings, actionId, code) {
  const normalized = normalizeControlBindings(bindings);
  if (!CONTROL_ACTIONS.some((action) => action.id === actionId)) return normalized;
  normalized.keyboard[actionId] = code ? [code] : [];
  return normalized;
}

export function setGamepadBinding(bindings, actionId, index) {
  const normalized = normalizeControlBindings(bindings);
  if (!CONTROL_ACTIONS.some((action) => action.id === actionId)) return normalized;
  normalized.gamepad[actionId] = Number.isInteger(index) ? [index] : [];
  return normalized;
}

export function keyLabel(code) {
  if (!code) return 'Unbound';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'Space';
  if (code === 'Escape') return 'Esc';
  if (code === 'Tab') return 'Tab';
  if (code === 'Backquote') return '`';
  if (code === 'Slash') return '/';
  if (code.startsWith('Arrow')) return code.replace('Arrow', '');
  if (code.startsWith('Shift')) return code.replace('Shift', 'Shift ');
  return code;
}

export function gamepadButtonLabel(index) {
  const names = {
    0: 'A',
    1: 'B',
    2: 'X',
    3: 'Y',
    4: 'LB',
    5: 'RB',
    6: 'LT',
    7: 'RT',
    8: 'Back',
    9: 'Start',
    10: 'LS',
    11: 'RS',
    12: 'D-Up',
    13: 'D-Down',
    14: 'D-Left',
    15: 'D-Right',
  };
  return names[index] ?? `Button ${index}`;
}

function normalizeDeviceBindings(deviceBindings = {}, device) {
  const defaults = DEFAULT_CONTROL_BINDINGS[device];
  const normalized = {};
  for (const action of CONTROL_ACTIONS) {
    const value = deviceBindings[action.id];
    normalized[action.id] = Array.isArray(value) ? sanitize(value, device) : [...defaults[action.id]];
  }
  return normalized;
}

function sanitize(values, device) {
  if (device === 'gamepad') return values.filter((value) => Number.isInteger(value) && value >= 0 && value <= 31);
  return values.filter((value) => typeof value === 'string' && value.length > 0);
}
