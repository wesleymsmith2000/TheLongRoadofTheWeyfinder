import { createGame, stepGame } from './core/game.js';
import { configureRoadLaneForViewport, screenToWorld } from './core/camera.js';
import { CanvasRenderer } from './render/canvasRenderer.js';
import { createKeyboardInput } from './input/keyboard.js';
import { createGamepadInput } from './input/gamepad.js';
import { createMouseInput, createPointerButtonInput } from './input/mouse.js';
import { createDebugOverlay } from './debug/debugOverlay.js';
import {
  SHOP_COSTS,
  UPGRADE_DEFINITIONS,
  ammoCapacityWithUpgrades,
  ammoRefillCost,
  ammoStatus,
  repairStatus,
  replacementStatus,
  upgradeCost,
  upgradeStatus,
} from './core/economy.js';
import { countDetachedVehicleCells, hasRepairableVehicleDamage } from './core/vehicle.js';
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
const compensatedAimToggle = document.querySelector('#compensatedAimToggle');
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
const shopRepairStatus = document.querySelector('#shopRepairStatus');
const shopReplaceStatus = document.querySelector('#shopReplaceStatus');
const shopAmmoStatus = document.querySelector('#shopAmmoStatus');
const shopUpgradeSelect = document.querySelector('#shopUpgradeSelect');
const shopBuyUpgradeButton = document.querySelector('#shopBuyUpgradeButton');
const shopUpgradeCost = document.querySelector('#shopUpgradeCost');
const shopUpgradeStatus = document.querySelector('#shopUpgradeStatus');
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
const padReticle = {
  x: window.innerWidth / 2,
  y: window.innerHeight * 0.42,
  active: false,
  idle: Infinity,
};
document.documentElement.style.setProperty('--level-complete-art', `url("${levelCompleteArt}")`);
document.documentElement.style.setProperty('--level-fail-art', `url("${levelFailArt}")`);
document.documentElement.style.setProperty('--repair-art', `url("${repairArt}")`);
document.documentElement.style.setProperty('--weapon-icon-sheet', `url("${weaponIconSheet}")`);
populateUpgradeSelect();

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
  updatePadReticle(padReticle, padInput, dt);
  const padAimWorld = padReticle.active && padReticle.idle <= 5 ? screenToWorld(padReticle, game.camera, viewport()) : null;
  const aimWorld = mouseInput.aimWorld ?? padAimWorld;
  game.aimReticle = aimWorld ? { ...aimWorld, active: true, source: mouseInput.aimWorld ? 'pointer' : 'gamepad' } : null;
  const input = {
    x: movementSource.x,
    y: movementSource.y,
    turn: keyInput.turn || padInput.turn,
    aimX: 0,
    aimY: 0,
    aimWorld,
    aimSource: mouseInput.aimWorld ? 'pointer' : 'gamepad',
    manualAimActive: stickAimActive || Boolean(mouseInput.aimWorld),
    manualAimHold: stickAimActive ? 5 : 0.45,
    gunnerEnabled: gunnerToggle.checked,
    compensatedAim: compensatedAimToggle.checked,
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
    shopBuyUpgradePressed: shopBuyUpgradePressed.consume(),
    shopAmmoWeapon: secondarySelect.value,
    shopUpgradeId: shopUpgradeSelect.value,
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
const shopBuyUpgradePressed = createButtonPress(shopBuyUpgradeButton);

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

function updatePadReticle(reticle, input, dt) {
  const strength = Math.hypot(input.aimX ?? 0, input.aimY ?? 0);
  if (strength > 0.2) {
    reticle.active = true;
    reticle.idle = 0;
    reticle.x = Math.max(18, Math.min(window.innerWidth - 18, reticle.x + input.aimX * 520 * dt));
    reticle.y = Math.max(18, Math.min(window.innerHeight - 18, reticle.y + input.aimY * 520 * dt));
    return;
  }
  if (reticle.active) reticle.idle += dt;
}

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function populateUpgradeSelect() {
  for (const upgrade of UPGRADE_DEFINITIONS) {
    const option = document.createElement('option');
    option.value = upgrade.id;
    option.textContent = `${upgrade.system}: ${upgrade.label}`;
    shopUpgradeSelect.append(option);
  }
}

function updateShopUi() {
  const ammoCost = ammoRefillCost(game.secondary.selected);
  const ammo = game.secondary.ammo[game.secondary.selected];
  const ammoCapacity = ammoCapacityWithUpgrades(game, game.secondary.selected);
  const selectedUpgradeCost = upgradeCost(game, shopUpgradeSelect.value);
  shopRepairCost.textContent = SHOP_COSTS.repair;
  shopReplaceCost.textContent = SHOP_COSTS.replaceDetached;
  shopAmmoCost.textContent = Number.isFinite(ammoCost) ? ammoCost : '-';
  shopUpgradeCost.textContent = Number.isFinite(selectedUpgradeCost) ? selectedUpgradeCost : '-';
  shopScrapAvailable.textContent = game.scrap;
  shopSelectedAmmo.textContent = game.secondary.selected;
  shopRepairStatus.textContent = repairStatus(game);
  shopReplaceStatus.textContent = replacementStatus(game);
  shopAmmoStatus.textContent = ammoStatus(game, game.secondary.selected);
  shopUpgradeStatus.textContent = upgradeStatus(game, shopUpgradeSelect.value);
  shopRepairButton.disabled = game.scrap < SHOP_COSTS.repair || !hasRepairableVehicleDamage(game.vehicle);
  shopReplaceButton.disabled = game.scrap < SHOP_COSTS.replaceDetached || countDetachedVehicleCells(game.vehicle) === 0;
  shopRefillAmmoButton.disabled = !Number.isFinite(ammoCost) || game.scrap < ammoCost || ammo == null || ammo >= ammoCapacity;
  shopBuyUpgradeButton.disabled = !Number.isFinite(selectedUpgradeCost) || game.scrap < selectedUpgradeCost;
}
