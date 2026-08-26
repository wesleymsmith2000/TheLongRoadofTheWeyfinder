import { createGame, stepGame } from './core/game.js';
import { configureRoadLaneForViewport, screenToWorld } from './core/camera.js';
import { CanvasRenderer } from './render/canvasRenderer.js';
import { createKeyboardInput } from './input/keyboard.js';
import { createGamepadInput } from './input/gamepad.js';
import { createMouseInput } from './input/mouse.js';
import { createDebugOverlay } from './debug/debugOverlay.js';

const canvas = document.querySelector('#game');
const gameOver = document.querySelector('#gameOver');
const controlsToggle = document.querySelector('#controlsToggle');
const controlsPanel = document.querySelector('#controlsPanel');
const renderer = new CanvasRenderer(canvas);
const keyboard = createKeyboardInput(window);
const gamepad = createGamepadInput();
const mouse = createMouseInput(canvas, (screen) => screenToWorld(screen, game.camera, { width: window.innerWidth, height: window.innerHeight }));
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
    fireHeld: mouseInput.fireHeld,
    brake: keyInput.brake || padInput.brake,
    debugTogglePressed: keyInput.debugTogglePressed,
    fireTogglePressed: keyInput.fireTogglePressed,
    resetPressed: keyInput.resetPressed,
    controlsTogglePressed: keyInput.controlsTogglePressed || padInput.controlsTogglePressed,
  };
  configureRoadLaneForViewport(game.road, window.innerWidth, window.innerHeight);
  if (input.debugTogglePressed) debug.visible = !debug.visible;
  if (input.controlsTogglePressed) toggleControls();
  const next = stepGame(game, input, dt);
  if (next !== game) game = next;
  game.fps = game.fps * 0.9 + (1 / Math.max(dt, 0.001)) * 0.1;
  gameOver.classList.toggle('hidden', !game.gameOver);
  renderer.draw(game, debug);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

controlsToggle.addEventListener('click', toggleControls);

function toggleControls() {
  controlsPanel.classList.toggle('hidden');
}
