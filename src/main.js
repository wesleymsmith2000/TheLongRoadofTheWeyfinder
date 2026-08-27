import { createGame, stepGame } from './core/game.js';
import { configureRoadLaneForViewport, screenToWorld } from './core/camera.js';
import { CanvasRenderer } from './render/canvasRenderer.js';
import { createKeyboardInput } from './input/keyboard.js';
import { createGamepadInput } from './input/gamepad.js';
import { createMouseInput, createPointerButtonInput } from './input/mouse.js';
import { createDebugOverlay } from './debug/debugOverlay.js';
import { SHOP_COSTS, ammoRefillCost } from './core/economy.js';
import { secondaryAmmoCapacity } from './core/secondaryWeapon.js';
import levelCompleteArt from '../assets/images/level_complete_screen.png';
import levelFailArt from '../assets/images/level_fail_screen.png';
import repairArt from '../assets/images/repair_screen.png';
import weaponIconSheet from '../assets/images/weapon_and_ammo_icon_spritesheet.png';

const canvas = document.querySelector('#game');
const gameOver = document.querySelector('#gameOver');
const controlsToggle = document.querySelector('#controlsToggle');
const controlsPanel = document.querySelector('#controlsPanel');
const boostButton = document.querySelector('#boostButton');
const boostFill = document.querySelector('#boostFill');
const secondarySelect = document.querySelector('#secondarySelect');
const secondaryIcon = document.querySelector('#secondaryIcon');
const secondaryAutofire = document.querySelector('#secondaryAutofire');
const secondaryFire = document.querySelector('#secondaryFire');
const secondaryTouchFire = document.querySelector('#secondaryTouchFire');
const secondaryAmmo = document.querySelector('#secondaryAmmo');
const secondaryHeat = document.querySelector('#secondaryHeat');
const gunnerToggle = document.querySelector('#gunnerToggle');
const scrapCount = document.querySelector('#scrapCount');
const scoreDamage = document.querySelector('#scoreDamage');
const levelComplete = document.querySelector('#levelComplete');
const levelTime = document.querySelector('#levelTime');
const levelNumber = document.querySelector('#levelNumber');
const levelsCompleted = document.querySelector('#levelsCompleted');
const nextLevelButton = document.querySelector('#nextLevelButton');
const shopRepairButton = document.querySelector('#shopRepairButton');
const shopReplaceButton = document.querySelector('#shopReplaceButton');
const shopRefillAmmoButton = document.querySelector('#shopRefillAmmoButton');
const shopRepairCost = document.querySelector('#shopRepairCost');
const shopReplaceCost = document.querySelector('#shopReplaceCost');
const shopAmmoCost = document.querySelector('#shopAmmoCost');
const shopSelectedAmmo = document.querySelector('#shopSelectedAmmo');
const shopScrapAvailable = document.querySelector('#shopScrapAvailable');
const restartButton = document.querySelector('#restartButton');
const renderer = new CanvasRenderer(canvas);
const keyboard = createKeyboardInput(window);
const gamepad = createGamepadInput();
const mouse = createMouseInput(canvas, (screen) => screenToWorld(screen, game.camera, { width: window.innerWidth, height: window.innerHeight }));
const touchBoost = createPointerButtonInput(boostButton);
const touchSecondary = createPointerButtonInput(secondaryFire);
const touchSecondaryFloating = createPointerButtonInput(secondaryTouchFire);
const debug = createDebugOverlay();

let game = createGame();
let previous = performance.now();
document.documentElement.style.setProperty('--level-complete-art', `url("${levelCompleteArt}")`);
document.documentElement.style.setProperty('--level-fail-art', `url("${levelFailArt}")`);
document.documentElement.style.setProperty('--repair-art', `url("${repairArt}")`);
document.documentElement.style.setProperty('--weapon-icon-sheet', `url("${weaponIconSheet}")`);

function frame(now) {
  const dt = (now - previous) / 1000;
  previous = now;
  const keyInput = keyboard.read();
  const padInput = gamepad.read();
  const mouseInput = mouse.read();
  const movementSource = chooseMovementSource(keyInput, mouseInput, padInput);
  const touchBoostPressed = touchBoost.consume();
  const dodgeSource = keyInput.dodgePressed ? keyInput : padInput.dodgePressed ? padInput : touchBoostPressed ? mouseInput : null;
  const stickAimActive = Math.hypot(padInput.aimX ?? 0, padInput.aimY ?? 0) > 0.2;
  if (keyInput.gunnerTogglePressed) gunnerToggle.checked = !gunnerToggle.checked;
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
    x: movementSource.x,
    y: movementSource.y,
    turn: keyInput.turn || padInput.turn,
    aimX: 0,
    aimY: 0,
    aimWorld: stickAimWorld ?? mouseInput.aimWorld,
    manualAimActive: stickAimActive || Boolean(mouseInput.aimWorld),
    manualAimHold: stickAimActive ? 5 : 0.45,
    gunnerEnabled: gunnerToggle.checked,
    fireHeld: false,
    brake: keyInput.brake || padInput.brake,
    debugTogglePressed: keyInput.debugTogglePressed,
    fireTogglePressed: keyInput.fireTogglePressed,
    resetPressed: keyInput.resetPressed || restartButtonPressed.consume(),
    controlsTogglePressed: keyInput.controlsTogglePressed || padInput.controlsTogglePressed,
    nextLevelPressed: nextLevelButtonPressed.consume(),
    shopRepairPressed: shopRepairPressed.consume(),
    shopReplacePressed: shopReplacePressed.consume(),
    shopRefillAmmoPressed: shopRefillAmmoPressed.consume(),
    shopAmmoWeapon: secondarySelect.value,
    dodgePressed: Boolean(dodgeSource),
    dodgeX: dodgeSource?.dodgeX ?? dodgeSource?.x ?? 0,
    dodgeY: dodgeSource?.dodgeY ?? dodgeSource?.y ?? -1,
    secondarySelect: secondarySelect.value,
    secondaryAutofire: secondaryAutofire.checked,
    secondaryCycle: keyInput.secondaryCycle || padInput.secondaryCycle,
    secondaryFirePressed:
      keyInput.secondaryFirePressed ||
      padInput.secondaryFirePressed ||
      mouseInput.firePressed ||
      touchSecondary.consume() ||
      touchSecondaryFloating.consume(),
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
  updateShopUi();
  boostFill.style.width = `${(game.boost.fuel / game.boost.maxFuel) * 100}%`;
  secondarySelect.value = game.secondary.selected;
  secondaryIcon.dataset.icon = game.secondary.selected;
  const selectedAmmo = game.secondary.ammo[game.secondary.selected];
  secondaryAmmo.textContent = selectedAmmo == null ? '-' : selectedAmmo;
  secondaryHeat.style.width = `${game.secondary.heat}%`;
  scrapCount.textContent = game.scrap;
  scoreDamage.textContent = game.score.damageDone;
  renderer.draw(game, debug);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

controlsToggle.addEventListener('click', toggleControls);
const nextLevelButtonPressed = createButtonPress(nextLevelButton);
const restartButtonPressed = createButtonPress(restartButton);
const shopRepairPressed = createButtonPress(shopRepairButton);
const shopReplacePressed = createButtonPress(shopReplaceButton);
const shopRefillAmmoPressed = createButtonPress(shopRefillAmmoButton);

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

function chooseMovementSource(keyInput, mouseInput, padInput) {
  if (axisMagnitude(keyInput) > 0) return keyInput;
  if (axisMagnitude(mouseInput) > 0.05) return mouseInput;
  if (axisMagnitude(padInput) > 0.05) return padInput;
  return { x: 0, y: 0 };
}

function axisMagnitude(input) {
  return Math.hypot(input.x ?? 0, input.y ?? 0);
}

function updateShopUi() {
  const ammoCost = ammoRefillCost(game.secondary.selected);
  const ammo = game.secondary.ammo[game.secondary.selected];
  const ammoCapacity = secondaryAmmoCapacity(game.secondary.selected);
  shopRepairCost.textContent = SHOP_COSTS.repair;
  shopReplaceCost.textContent = SHOP_COSTS.replaceDetached;
  shopAmmoCost.textContent = Number.isFinite(ammoCost) ? ammoCost : '-';
  shopScrapAvailable.textContent = game.scrap;
  shopSelectedAmmo.textContent = game.secondary.selected;
  shopRepairButton.disabled = game.scrap < SHOP_COSTS.repair;
  shopReplaceButton.disabled = game.scrap < SHOP_COSTS.replaceDetached || game.vehicle.detachedPieces.length === 0;
  shopRefillAmmoButton.disabled = !Number.isFinite(ammoCost) || game.scrap < ammoCost || ammo == null || ammo >= ammoCapacity;
}
