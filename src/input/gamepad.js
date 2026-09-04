import { normalizeControlBindings } from './controlBindings.js';

const DEADZONE = 0.3;

export function createGamepadInput(source = () => navigator.getGamepads?.() ?? [], bindings = {}) {
  const previousButtons = new Set();
  let controlBindings = normalizeControlBindings(bindings).gamepad;

  return {
    setBindings(bindings) {
      controlBindings = normalizeControlBindings(bindings).gamepad;
    },
    read() {
      const pad = findStandardPad(source());
      if (!pad) {
        previousButtons.clear();
        return emptyInput();
      }

      const input = mapStandardGamepad(pad, previousButtons, controlBindings);
      previousButtons.clear();
      for (let index = 0; index < pad.buttons.length; index += 1) {
        if (buttonPressed(pad.buttons[index])) previousButtons.add(index);
      }
      return input;
    },
  };
}

export function mapStandardGamepad(pad, previousButtons = new Set(), bindings = {}) {
  const controlBindings = normalizeControlBindings({ gamepad: bindings }).gamepad;
  const axes = pad.axes.map((value) => deadzone(value));
  const leftTrigger = buttonValue(pad.buttons[6]);
  const rightTrigger = buttonValue(pad.buttons[7]);
  const bumperTurn = 0;
  const triggerTurn = rightTrigger - leftTrigger;
  const aimX = axes[2] ?? 0;
  const aimY = axes[3] ?? 0;
  const dpadX = (buttonPressed(pad.buttons[15]) ? 1 : 0) - (buttonPressed(pad.buttons[14]) ? 1 : 0);
  const dpadY = (buttonPressed(pad.buttons[13]) ? 1 : 0) - (buttonPressed(pad.buttons[12]) ? 1 : 0);

  return {
    x: axes[0] ?? 0,
    y: axes[1] ?? 0,
    turn: strongestAxis(bumperTurn, triggerTurn),
    aimX,
    aimY,
    cursorX: strongestAxis(axes[0] ?? 0, dpadX),
    cursorY: strongestAxis(axes[1] ?? 0, dpadY),
    cursorScrollX: aimX,
    cursorScrollY: aimY,
    cursorClickPressed: actionJustPressed(pad, previousButtons, controlBindings.cursorClick),
    brake: actionPressed(pad, controlBindings.brake),
    hudTogglePressed: actionJustPressed(pad, previousButtons, controlBindings.hudToggle),
    debugTogglePressed: actionJustPressed(pad, previousButtons, controlBindings.debugToggle),
    controlConfigTogglePressed: actionJustPressed(pad, previousButtons, controlBindings.controlConfigToggle),
    achievementsTogglePressed: actionJustPressed(pad, previousButtons, controlBindings.achievementsToggle),
    sandboxTogglePressed: actionJustPressed(pad, previousButtons, controlBindings.sandboxToggle),
    fireTogglePressed: actionJustPressed(pad, previousButtons, controlBindings.primaryAutofire),
    gunnerTogglePressed: actionJustPressed(pad, previousButtons, controlBindings.gunnerToggle),
    aiLeadTogglePressed: actionJustPressed(pad, previousButtons, controlBindings.aiLeadToggle),
    resetPressed: actionJustPressed(pad, previousButtons, controlBindings.reset),
    pausePressed: actionJustPressed(pad, previousButtons, controlBindings.pause),
    controlsTogglePressed: actionJustPressed(pad, previousButtons, controlBindings.controlsToggle),
    dodgePressed: actionJustPressed(pad, previousButtons, controlBindings.dodge),
    dodgeX: axes[0] ?? 0,
    dodgeY: axes[1] ?? 0,
    secondaryCycle: actionJustPressed(pad, previousButtons, controlBindings.secondaryRight) ? 1 : actionJustPressed(pad, previousButtons, controlBindings.secondaryLeft) ? -1 : 0,
    secondaryFirePressed: actionJustPressed(pad, previousButtons, controlBindings.secondaryFire),
    targetCycle: actionJustPressed(pad, previousButtons, controlBindings.targetNext) ? 1 : actionJustPressed(pad, previousButtons, controlBindings.targetPrevious) ? -1 : 0,
  };
}

function findStandardPad(gamepads) {
  return Array.from(gamepads).find((pad) => pad?.connected && pad.mapping === 'standard') ?? Array.from(gamepads).find((pad) => pad?.connected);
}

function emptyInput() {
  return {
    x: 0,
    y: 0,
    turn: 0,
    brake: false,
    aimX: 0,
    aimY: 0,
    cursorX: 0,
    cursorY: 0,
    cursorScrollX: 0,
    cursorScrollY: 0,
    cursorClickPressed: false,
    hudTogglePressed: false,
    debugTogglePressed: false,
    controlConfigTogglePressed: false,
    achievementsTogglePressed: false,
    sandboxTogglePressed: false,
    fireTogglePressed: false,
    gunnerTogglePressed: false,
    aiLeadTogglePressed: false,
    resetPressed: false,
    pausePressed: false,
    controlsTogglePressed: false,
    dodgePressed: false,
    dodgeX: 0,
    dodgeY: 0,
    secondaryCycle: 0,
    secondaryFirePressed: false,
    targetCycle: 0,
  };
}

function buttonJustPressed(pad, previousButtons, index) {
  return buttonPressed(pad.buttons[index]) && !previousButtons.has(index);
}

function actionPressed(pad, buttons = []) {
  return buttons.some((index) => buttonPressed(pad.buttons[index]));
}

function actionJustPressed(pad, previousButtons, buttons = []) {
  return buttons.some((index) => buttonJustPressed(pad, previousButtons, index));
}

function buttonPressed(button) {
  return Boolean(button?.pressed || button?.value > 0.55);
}

function buttonValue(button) {
  return button?.value > DEADZONE ? button.value : 0;
}

function deadzone(value = 0) {
  if (Math.abs(value) < DEADZONE) return 0;
  const scaled = (Math.abs(value) - DEADZONE) / (1 - DEADZONE);
  return Math.sign(value) * Math.min(1, scaled);
}

function strongestAxis(...values) {
  return values.reduce((strongest, value) => (Math.abs(value) > Math.abs(strongest) ? value : strongest), 0);
}
