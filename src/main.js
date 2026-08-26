import { createGame, stepGame } from './core/game.js';
import { configureRoadLaneForViewport, screenToWorld } from './core/camera.js';
import { CanvasRenderer } from './render/canvasRenderer.js';
import { createKeyboardInput } from './input/keyboard.js';
import { createGamepadInput } from './input/gamepad.js';
import { createMouseInput, createPointerButtonInput } from './input/mouse.js';
import { createDebugOverlay } from './debug/debugOverlay.js';

const canvas = document.querySelector('#game');
const gameOver = document.querySelector('#gameOver');
const controlsToggle = document.querySelector('#controlsToggle');
const controlsPanel = document.querySelector('#controlsPanel');
const boostButton = document.querySelector('#boostButton');
const boostFill = document.querySelector('#boostFill');
const secondarySelect = document.querySelector('#secondarySelect');
const secondaryAutofire = document.querySelector('#secondaryAutofire');
const secondaryFire = document.querySelector('#secondaryFire');
const secondaryAmmo = document.querySelector('#secondaryAmmo');
const secondaryHeat = document.querySelector('#secondaryHeat');
const scoreDamage = document.querySelector('#scoreDamage');
const levelComplete = document.querySelector('#levelComplete');
const levelTime = document.querySelector('#levelTime');
const levelNumber = document.querySelector('#levelNumber');
const levelsCompleted = document.querySelector('#levelsCompleted');
const nextLevelButton = document.querySelector('#nextLevelButton');
const restartButton = document.querySelector('#restartButton');
const renderer = new CanvasRenderer(canvas);
const keyboard = createKeyboardInput(window);
const gamepad = createGamepadInput();
const mouse = createMouseInput(canvas, (screen) => screenToWorld(screen, game.camera, { width: window.innerWidth, height: window.innerHeight }));
const touchBoost = createPointerButtonInput(boostButton);
const touchSecondary = createPointerButtonInput(secondaryFire);
const debug = createDebugOverlay();

let game = createGame();
let previous = performance.now();

function frame(now) {
  const dt = (now - previous) / 1000;
  previous = now;
  const keyInput = keyboard.read();
  const padInput = gamepad.read();
  const mouseInput = mouse.read();
  const stickAimActive = Math.hypot(padInput.aimX ?? 0, padInput.aimY ?? 0) > 0.2;
  const stickAimWorld = stickAimActive
    ? screenToWorld(
        {
          x: window.innerWidth / 2 + padInput.aimX * 100,
          y: window.innerHeight * 0.58 + padInput.aimY * 100,
        },
        game.camera,
        { width: window.innerWidth, height: window.innerHeight },
      )
    : null;
  const input = {
    x: keyInput.x || padInput.x || mouseInput.x,
    y: keyInput.y || padInput.y || mouseInput.y,
    turn: keyInput.turn || padInput.turn,
    aimX: 0,
    aimY: 0,
    aimWorld: stickAimWorld ?? mouseInput.aimWorld,
    manualAimActive: stickAimActive || Boolean(mouseInput.aimWorld),
    fireHeld: mouseInput.fireHeld,
    brake: keyInput.brake || padInput.brake,
    debugTogglePressed: keyInput.debugTogglePressed,
    fireTogglePressed: keyInput.fireTogglePressed,
    resetPressed: keyInput.resetPressed || restartButtonPressed.consume(),
    controlsTogglePressed: keyInput.controlsTogglePressed || padInput.controlsTogglePressed,
    nextLevelPressed: nextLevelButtonPressed.consume(),
    dodgePressed: keyInput.dodgePressed || padInput.dodgePressed || touchBoost.consume(),
    dodgeX: keyInput.dodgeX || padInput.dodgeX || mouseInput.x,
    dodgeY: keyInput.dodgeY || padInput.dodgeY || mouseInput.y,
    secondarySelect: secondarySelect.value,
    secondaryAutofire: secondaryAutofire.checked,
    secondaryCycle: keyInput.secondaryCycle || padInput.secondaryCycle,
    secondaryFirePressed: keyInput.secondaryFirePressed || padInput.secondaryFirePressed || touchSecondary.consume(),
  };
  configureRoadLaneForViewport(game.road, window.innerWidth, window.innerHeight);
  if (input.debugTogglePressed) debug.visible = !debug.visible;
  if (input.controlsTogglePressed) toggleControls();
  const next = stepGame(game, input, dt);
  if (next !== game) game = next;
  game.fps = game.fps * 0.9 + (1 / Math.max(dt, 0.001)) * 0.1;
  gameOver.classList.toggle('hidden', !game.gameOver);
  levelComplete.classList.toggle('hidden', !game.levelComplete);
  levelTime.textContent = game.levelTime.toFixed(1);
  levelNumber.textContent = game.level;
  levelsCompleted.textContent = game.levelsCompleted;
  boostFill.style.width = `${(game.boost.fuel / game.boost.maxFuel) * 100}%`;
  secondarySelect.value = game.secondary.selected;
  const selectedAmmo = game.secondary.ammo[game.secondary.selected];
  secondaryAmmo.textContent = selectedAmmo == null ? '-' : selectedAmmo;
  secondaryHeat.style.width = `${game.secondary.heat}%`;
  scoreDamage.textContent = game.score.damageDone;
  renderer.draw(game, debug);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

controlsToggle.addEventListener('click', toggleControls);
const nextLevelButtonPressed = createButtonPress(nextLevelButton);
const restartButtonPressed = createButtonPress(restartButton);

function toggleControls() {
  controlsPanel.classList.toggle('hidden');
}

function createButtonPress(button) {
  let pending = false;
  button.addEventListener('click', () => {
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
