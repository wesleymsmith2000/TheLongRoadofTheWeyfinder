import { createGame, stepGame } from './core/game.js';
import { configureRoadLaneForViewport } from './core/camera.js';
import { CanvasRenderer } from './render/canvasRenderer.js';
import { createKeyboardInput } from './input/keyboard.js';
import { readGamepadInput } from './input/gamepad.js';
import { createDebugOverlay } from './debug/debugOverlay.js';

const canvas = document.querySelector('#game');
const gameOver = document.querySelector('#gameOver');
const renderer = new CanvasRenderer(canvas);
const keyboard = createKeyboardInput(window);
const debug = createDebugOverlay();

let game = createGame();
let previous = performance.now();

function frame(now) {
  const dt = (now - previous) / 1000;
  previous = now;
  const keyInput = keyboard.read();
  const padInput = readGamepadInput();
  const input = {
    x: keyInput.x || padInput.x,
    y: keyInput.y || padInput.y,
    turn: keyInput.turn || padInput.turn,
    brake: keyInput.brake || padInput.brake,
    debugTogglePressed: keyInput.debugTogglePressed,
    fireTogglePressed: keyInput.fireTogglePressed,
    resetPressed: keyInput.resetPressed,
  };
  configureRoadLaneForViewport(game.road, window.innerWidth, window.innerHeight);
  if (input.debugTogglePressed) debug.visible = !debug.visible;
  const next = stepGame(game, input, dt);
  if (next !== game) game = next;
  game.fps = game.fps * 0.9 + (1 / Math.max(dt, 0.001)) * 0.1;
  gameOver.classList.toggle('hidden', !game.gameOver);
  renderer.draw(game, debug);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
