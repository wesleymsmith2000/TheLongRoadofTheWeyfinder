const DEADZONE = 0.22;

export function createGamepadInput(source = () => navigator.getGamepads?.() ?? []) {
  const previousButtons = new Set();

  return {
    read() {
      const pad = findStandardPad(source());
      if (!pad) {
        previousButtons.clear();
        return emptyInput();
      }

      const input = mapStandardGamepad(pad, previousButtons);
      previousButtons.clear();
      for (let index = 0; index < pad.buttons.length; index += 1) {
        if (buttonPressed(pad.buttons[index])) previousButtons.add(index);
      }
      return input;
    },
  };
}

export function mapStandardGamepad(pad, previousButtons = new Set()) {
  const axes = pad.axes.map((value) => deadzone(value));
  const leftTrigger = buttonValue(pad.buttons[6]);
  const rightTrigger = buttonValue(pad.buttons[7]);
  const bumperTurn = (buttonPressed(pad.buttons[5]) ? 1 : 0) - (buttonPressed(pad.buttons[4]) ? 1 : 0);
  const triggerTurn = rightTrigger - leftTrigger;
  const stickTurn = axes[2] ?? 0;

  return {
    x: axes[0] ?? 0,
    y: axes[1] ?? 0,
    turn: strongestAxis(stickTurn, bumperTurn, triggerTurn),
    brake: buttonPressed(pad.buttons[0]) || buttonPressed(pad.buttons[10]),
    debugTogglePressed: buttonJustPressed(pad, previousButtons, 2) || buttonJustPressed(pad, previousButtons, 8),
    fireTogglePressed: buttonJustPressed(pad, previousButtons, 1),
    resetPressed: buttonJustPressed(pad, previousButtons, 3) || buttonJustPressed(pad, previousButtons, 9),
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
    debugTogglePressed: false,
    fireTogglePressed: false,
    resetPressed: false,
  };
}

function buttonJustPressed(pad, previousButtons, index) {
  return buttonPressed(pad.buttons[index]) && !previousButtons.has(index);
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
