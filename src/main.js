import { LEVEL_TARGET_DURATION, createGame, stepGame } from './core/game.js';
import { configureRoadLaneForViewport, screenToWorld } from './core/camera.js';
import { CanvasRenderer } from './render/canvasRenderer.js';
import { createKeyboardInput } from './input/keyboard.js';
import { createGamepadInput } from './input/gamepad.js';
import { createMouseInput, createPointerButtonInput } from './input/mouse.js';
import { createDebugOverlay } from './debug/debugOverlay.js';
import { createPlayerVehicleLaunchEditor } from './editor/playerVehicleLaunchEditor.js';
import { createPrototypePlayerAccountData, preparePlayerAccountForSave } from './core/playerAccount.js';
import { ACHIEVEMENT_DEFINITIONS, achievementRewardText, achievementStatsFromGame, awardAchievements } from './core/achievements.js';
import { consumeSoundEvents, SOUND_EVENTS } from './core/soundEvents.js';
import {
  SHOP_COSTS,
  UPGRADE_DEFINITIONS,
  ammoCapacityWithUpgrades,
  ammoRefillCost,
  ammoStatus,
  repairCost,
  repairStatus,
  replacementStatus,
  upgradeCost,
  upgradeStatus,
} from './core/economy.js';
import { countDetachedVehicleCells, hasRepairableVehicleDamage, repairTargetOptions } from './core/vehicle.js';
import levelCompleteArt from '../assets/images/level_complete_screen.png';
import levelFailArt from '../assets/images/level_fail_screen.png';
import repairArt from '../assets/images/repair_screen.png';
import weaponIconSheet from '../assets/images/weapon_and_ammo_icon_spritesheet.png';
import bossFight1Music from '../assets/music/BossFight_1.mp3';
import bossFight2Music from '../assets/music/BossFight_2.mp3';
import digitizedStream1Music from '../assets/music/DigitizedStream_1.mp3';
import digitizedStream2Music from '../assets/music/DigitizedStream_2.mp3';
import freedomsPassBossFightMusic from '../assets/music/FreedomsPass_BossFight.mp3';
import freedomsPassDarkeningSkiesMusic from '../assets/music/FreedomsPass_DarkeningSkies.mp3';
import freedomsPassJourneyMusic from '../assets/music/FreedomsPass_Journey.mp3';
import freedomsPassStormsMusic from '../assets/music/FreedomsPass_StormsOfFatesShadow.mp3';
import ghostForrestBoss1Music from '../assets/music/GhostForrestBanshee_BossFight_1.mp3';
import ghostForrestBoss2Music from '../assets/music/GhostForrestBanshee_BossFight_2.mp3';
import ghostForrestPath1Music from '../assets/music/GhostForrestPathway_1.mp3';
import ghostForrestPath2Music from '../assets/music/GhostForrestPathway_2.mp3';
import piratesRoad1Music from '../assets/music/PiratesRoad_1.mp3';
import piratesRoad2Music from '../assets/music/PiratesRoad_2.mp3';
import piratesRoadBossMusic from '../assets/music/PiratesRoad_BossFight.mp3';
import shadowedDesertBossMusic from '../assets/music/ShadowedDesert_BossFight.mp3';
import shadowedDesertBoss1Music from '../assets/music/ShadowedDesert_BossFight_1.mp3';
import shadowedDesertJourneyMusic from '../assets/music/ShadowedDesert_Journey.mp3';
import shadowedDesertJourney1Music from '../assets/music/ShadowedDesert_Journey_1.mp3';
import shadowedDesertJourney2Music from '../assets/music/ShadowedDesert_Journey_2.mp3';
import shadowedDesertJourney3Music from '../assets/music/ShadowedDesert_Journey_3.mp3';
import shadowedDesertStormMusic from '../assets/music/ShadowedDesert_OminousStormfront.mp3';
import shadowedDesertStorm1Music from '../assets/music/ShadowedDesert_OminousStormfront_1.mp3';
import shadowedRoad1Music from '../assets/music/ShadowedRoad_1.mp3';
import shadowedRoad2Music from '../assets/music/ShadowedRoad_2.mp3';
import shadowedRoadBoss1Music from '../assets/music/ShadowedRoad_BossFight_1.mp3';
import shadowedRoadBoss2Music from '../assets/music/ShadowedRoad_BossFight_2.mp3';
import starlightRoad1Music from '../assets/music/StarlightRoad_1.mp3';
import starlightRoad2Music from '../assets/music/StarlightRoad_2.mp3';
import theWeyfindersRoad1Music from '../assets/music/TheWeyfindersRoad_1.mp3';
import theWeyfindersRoad2Music from '../assets/music/TheWeyfindersRoad_2.mp3';
import theWeyfindersRoad3Music from '../assets/music/TheWeyfindersRoad_3.mp3';
import twilightCrossroadsMusic from '../assets/music/TwilightCrossroads.mp3';
import twilightCrossroadsBossMusic from '../assets/music/TwilightCrossroads_BossFight.mp3';
import futuristicCannonSound from '../assets/sounds/A Futuristic Cannon Fire Sound Effect. About 2 Seconds Max. Should Have A Mix.mp3';
import buttonChirpSound from '../assets/sounds/ButtonChirp.mp3';
import errorBuzz2Sound from '../assets/sounds/ErrorBuzz2.mp3';
import errorClickSound from '../assets/sounds/ErrorClick.mp3';
import particleBeamSound from '../assets/sounds/ParticleBeam.mp3';
import rocketAccelerateSound from '../assets/sounds/RocketAccelerate.mp3';
import victoryTone1Sound from '../assets/sounds/VictoryTone1.mp3';

const MUSIC_URLS = {
  BossFight_1: bossFight1Music,
  BossFight_2: bossFight2Music,
  DigitizedStream_1: digitizedStream1Music,
  DigitizedStream_2: digitizedStream2Music,
  FreedomsPass_BossFight: freedomsPassBossFightMusic,
  FreedomsPass_DarkeningSkies: freedomsPassDarkeningSkiesMusic,
  FreedomsPass_Journey: freedomsPassJourneyMusic,
  FreedomsPass_StormsOfFatesShadow: freedomsPassStormsMusic,
  GhostForrestBanshee_BossFight_1: ghostForrestBoss1Music,
  GhostForrestBanshee_BossFight_2: ghostForrestBoss2Music,
  GhostForrestPathway_1: ghostForrestPath1Music,
  GhostForrestPathway_2: ghostForrestPath2Music,
  PiratesRoad_1: piratesRoad1Music,
  PiratesRoad_2: piratesRoad2Music,
  PiratesRoad_BossFight: piratesRoadBossMusic,
  ShadowedDesert_BossFight: shadowedDesertBossMusic,
  ShadowedDesert_BossFight_1: shadowedDesertBoss1Music,
  ShadowedDesert_Journey: shadowedDesertJourneyMusic,
  ShadowedDesert_Journey_1: shadowedDesertJourney1Music,
  ShadowedDesert_Journey_2: shadowedDesertJourney2Music,
  ShadowedDesert_Journey_3: shadowedDesertJourney3Music,
  ShadowedDesert_OminousStormfront: shadowedDesertStormMusic,
  ShadowedDesert_OminousStormfront_1: shadowedDesertStorm1Music,
  ShadowedRoad_1: shadowedRoad1Music,
  ShadowedRoad_2: shadowedRoad2Music,
  ShadowedRoad_BossFight_1: shadowedRoadBoss1Music,
  ShadowedRoad_BossFight_2: shadowedRoadBoss2Music,
  StarlightRoad_1: starlightRoad1Music,
  StarlightRoad_2: starlightRoad2Music,
  TheWeyfindersRoad_1: theWeyfindersRoad1Music,
  TheWeyfindersRoad_2: theWeyfindersRoad2Music,
  TheWeyfindersRoad_3: theWeyfindersRoad3Music,
  TwilightCrossroads: twilightCrossroadsMusic,
  TwilightCrossroads_BossFight: twilightCrossroadsBossMusic,
};

const SOUND_URLS = {
  [SOUND_EVENTS.PLAYER_MAIN_GUN]: buttonChirpSound,
  [SOUND_EVENTS.PLAYER_SECONDARY_LAUNCH]: rocketAccelerateSound,
  [SOUND_EVENTS.PLAYER_BEAM]: particleBeamSound,
  [SOUND_EVENTS.PLAYER_EXPLOSION]: futuristicCannonSound,
  [SOUND_EVENTS.ENEMY_BULLET]: errorClickSound,
  [SOUND_EVENTS.ENEMY_BEAM]: errorBuzz2Sound,
  [SOUND_EVENTS.ENEMY_DEATH]: futuristicCannonSound,
  [SOUND_EVENTS.STAGE_VICTORY]: victoryTone1Sound,
};

const canvas = document.querySelector('#game');
const virtualCursor = document.querySelector('#virtualCursor');
const gameOver = document.querySelector('#gameOver');
const launchScreen = document.querySelector('#launchScreen');
const launchButton = document.querySelector('#launchButton');
const vehicleEditorCanvas = document.querySelector('#vehicleEditorCanvas');
const vehiclePartSelect = document.querySelector('#vehiclePartSelect');
const vehiclePlaceButton = document.querySelector('#vehiclePlaceButton');
const vehicleEraseButton = document.querySelector('#vehicleEraseButton');
const vehicleConnectButton = document.querySelector('#vehicleConnectButton');
const vehicleResetButton = document.querySelector('#vehicleResetButton');
const vehicleEditorStatus = document.querySelector('#vehicleEditorStatus');
const hudToggle = document.querySelector('#hudToggle');
const combatPanel = document.querySelector('#combatPanel');
const debugToggle = document.querySelector('#debugToggle');
const controlsToggle = document.querySelector('#controlsToggle');
const controlsPanel = document.querySelector('#controlsPanel');
const achievementsToggle = document.querySelector('#achievementsToggle');
const achievementsPanel = document.querySelector('#achievementsPanel');
const achievementList = document.querySelector('#achievementList');
const boostButton = document.querySelector('#boostButton');
const boostFill = document.querySelector('#boostFill');
const secondarySelect = document.querySelector('#secondarySelect');
const secondaryIcon = document.querySelector('#secondaryIcon');
const secondaryAutofire = document.querySelector('#secondaryAutofire');
const secondaryFire = document.querySelector('#secondaryFire');
const secondaryTouchCycle = document.querySelector('#secondaryTouchCycle');
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
const shopRepairTarget = document.querySelector('#shopRepairTarget');
const shopAmmoSelect = document.querySelector('#shopAmmoSelect');
const shopUpgradeSelect = document.querySelector('#shopUpgradeSelect');
const shopBuyUpgradeButton = document.querySelector('#shopBuyUpgradeButton');
const shopUpgradeCost = document.querySelector('#shopUpgradeCost');
const shopUpgradeStatus = document.querySelector('#shopUpgradeStatus');
const upgradeSummary = document.querySelector('#upgradeSummary');
const restartButton = document.querySelector('#restartButton');
const levelName = document.querySelector('#levelName');
const levelProgressFill = document.querySelector('#levelProgressFill');
const renderer = new CanvasRenderer(canvas);
const keyboard = createKeyboardInput(window);
const gamepad = createGamepadInput();
const mouse = createMouseInput(canvas, (screen) => screenToWorld(screen, game.camera, { width: window.innerWidth, height: window.innerHeight }));
const touchBoost = createPointerButtonInput(boostButton);
const touchSecondary = createPointerButtonInput(secondaryFire);
const touchSecondaryCycle = createPointerButtonInput(secondaryTouchCycle);
const touchSecondaryFloating = createPointerButtonInput(secondaryTouchFire);
const debug = createDebugOverlay();

const PLAYER_ACCOUNT_STORAGE_KEY = 'weyfinder.prototype0.playerAccount';

let playerAccount = loadPlayerAccount();
let playerVehicleDefinition = playerAccount.savedVehicle;
let game = createGame(1147, { vehicleDefinition: playerVehicleDefinition ?? undefined });
let previous = performance.now();
let awaitingLaunch = true;
let activeMusicTrack = null;
const musicAudio = new Audio();
musicAudio.loop = true;
musicAudio.volume = 0.42;
const soundPlayers = new Map();
const padReticle = {
  x: window.innerWidth / 2,
  y: window.innerHeight * 0.42,
  active: false,
  idle: Infinity,
};
const virtualPointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  active: false,
  selectControl: null,
  selectRepeat: 0,
};
document.documentElement.style.setProperty('--level-complete-art', `url("${levelCompleteArt}")`);
document.documentElement.style.setProperty('--level-fail-art', `url("${levelFailArt}")`);
document.documentElement.style.setProperty('--repair-art', `url("${repairArt}")`);
document.documentElement.style.setProperty('--weapon-icon-sheet', `url("${weaponIconSheet}")`);
populateUpgradeSelect();
refreshRepairTargets();
renderAchievements();
if (window.matchMedia('(max-width: 700px), (pointer: coarse)').matches) combatPanel.classList.add('hidden');
const vehicleEditor = createPlayerVehicleLaunchEditor(
  {
    canvas: vehicleEditorCanvas,
    partSelect: vehiclePartSelect,
    placeButton: vehiclePlaceButton,
    eraseButton: vehicleEraseButton,
    connectButton: vehicleConnectButton,
    resetButton: vehicleResetButton,
    status: vehicleEditorStatus,
  },
  {
    account: playerAccount,
    definition: playerVehicleDefinition,
    onChange(definition) {
      playerVehicleDefinition = definition;
      playerAccount = preparePlayerAccountForSave(playerAccount, definition);
      savePlayerAccount();
      if (awaitingLaunch) {
        game = createGame(1147, { vehicleDefinition: playerVehicleDefinition });
        refreshRepairTargets();
      }
    },
  },
);
syncLaunchScreen();

function frame(now) {
  const dt = (now - previous) / 1000;
  previous = now;
  const keyInput = keyboard.read();
  const padInput = gamepad.read();
  updateVirtualPointer(virtualPointer, padInput, dt, awaitingLaunch || game.levelComplete || game.gameOver);
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
    shopRepairTarget: shopRepairTarget.value,
    shopReplacePressed: shopReplacePressed.consume(),
    shopRefillAmmoPressed: shopRefillAmmoPressed.consume(),
    shopBuyUpgradePressed: shopBuyUpgradePressed.consume(),
    shopAmmoWeapon: shopAmmoSelect.value || secondarySelect.value,
    shopUpgradeId: shopUpgradeSelect.value,
    dodgePressed: Boolean(dodgeSource),
    dodgeX: dodgeSource?.dodgeX ?? dodgeSource?.x ?? 0,
    dodgeY: dodgeSource?.dodgeY ?? dodgeSource?.y ?? -1,
    secondarySelect: secondarySelect.value,
    secondaryAutofire: secondaryAutofire.checked,
    secondaryCycle: keyInput.secondaryCycle || padInput.secondaryCycle || (touchSecondaryCycle.consume() ? 1 : 0),
    secondaryFirePressed:
      keyInput.secondaryFirePressed ||
      padInput.secondaryFirePressed ||
      mouseInput.firePressed ||
      touchSecondary.consume() ||
      touchSecondaryFloating.consume(),
  };
  configureRoadLaneForViewport(game.road, window.innerWidth, window.innerHeight);
  if (input.debugTogglePressed) toggleDebug();
  if (input.controlsTogglePressed) toggleControls();
  if (!awaitingLaunch) {
    const next = stepGame(game, input, dt);
    if (next !== game) {
      game = next;
      if (input.resetPressed) awaitingLaunch = true;
    }
  } else if (input.resetPressed) {
    game = createGame(1147, { vehicleDefinition: playerVehicleDefinition ?? undefined });
  }
  game.fps = game.fps * 0.9 + (1 / Math.max(dt, 0.001)) * 0.1;
  syncLaunchScreen();
  gameOver.classList.toggle('hidden', !game.gameOver);
  levelComplete.classList.toggle('hidden', !game.levelComplete);
  syncProgressHud();
  refreshAchievementAwards();
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
  syncMusic();
  playSoundEvents(game);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

bindButtonActivation(debugToggle, toggleDebug);
bindButtonActivation(hudToggle, toggleCombatHud);
bindButtonActivation(controlsToggle, toggleControls);
bindButtonActivation(achievementsToggle, toggleAchievements);
bindButtonActivation(launchButton, launchVehicle);
const nextLevelButtonPressed = createButtonPress(nextLevelButton);
const restartButtonPressed = createButtonPress(restartButton);
const shopRepairPressed = createButtonPress(shopRepairButton);
const shopReplacePressed = createButtonPress(shopReplaceButton);
const shopRefillAmmoPressed = createButtonPress(shopRefillAmmoButton);
const shopBuyUpgradePressed = createButtonPress(shopBuyUpgradeButton);

function toggleControls() {
  controlsPanel.classList.toggle('hidden');
}

function toggleAchievements() {
  achievementsPanel.classList.toggle('hidden');
}

function toggleDebug() {
  debug.visible = !debug.visible;
  debugToggle.setAttribute('aria-pressed', String(debug.visible));
}

function toggleCombatHud() {
  combatPanel.classList.toggle('hidden');
  hudToggle.setAttribute('aria-pressed', String(!combatPanel.classList.contains('hidden')));
}

function launchVehicle() {
  if (!awaitingLaunch) return;
  awaitingLaunch = false;
  game.levelStartTime = game.time;
  previous = performance.now();
  syncMusic(true);
  syncLaunchScreen();
}

function syncLaunchScreen() {
  const visible = awaitingLaunch;
  launchScreen.hidden = !visible;
  launchScreen.classList.toggle('hidden', !visible);
  launchScreen.style.display = visible ? 'grid' : 'none';
  launchScreen.setAttribute('aria-hidden', String(!visible));
}

function syncMusic(forcePlay = false) {
  const trackName = game.currentMusic;
  const src = MUSIC_URLS[trackName];
  if (!src || awaitingLaunch || game.gameOver || game.levelComplete) {
    musicAudio.pause();
    return;
  }
  if (trackName !== activeMusicTrack) {
    activeMusicTrack = trackName;
    musicAudio.src = src;
    musicAudio.currentTime = 0;
  }
  if (forcePlay || musicAudio.paused) musicAudio.play().catch(() => {});
}

function playSoundEvents(game) {
  if (awaitingLaunch) {
    consumeSoundEvents(game);
    return;
  }
  for (const event of consumeSoundEvents(game)) {
    const src = SOUND_URLS[event.id];
    if (!src) continue;
    const player = soundPlayerFor(src);
    player.volume = event.id === SOUND_EVENTS.PLAYER_MAIN_GUN ? 0.24 : 0.48;
    player.currentTime = 0;
    player.play().catch(() => {});
  }
}

function loadPlayerAccount() {
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYER_ACCOUNT_STORAGE_KEY));
    return saved ? { ...createPrototypePlayerAccountData(), ...saved } : createPrototypePlayerAccountData();
  } catch {
    return createPrototypePlayerAccountData();
  }
}

function savePlayerAccount() {
  localStorage.setItem(PLAYER_ACCOUNT_STORAGE_KEY, JSON.stringify(playerAccount));
}

function refreshAchievementAwards() {
  const nextAccount = awardAchievements(playerAccount, achievementStatsFromGame(game));
  if (nextAccount === playerAccount) return;
  playerAccount = nextAccount;
  vehicleEditor.setAccount(playerAccount);
  savePlayerAccount();
  renderAchievements();
}

function renderAchievements() {
  const unlocked = new Set(playerAccount.achievements?.unlocked ?? []);
  achievementList.replaceChildren(
    ...ACHIEVEMENT_DEFINITIONS.map((achievement) => {
      const row = document.createElement('div');
      row.className = `achievement-row${unlocked.has(achievement.id) ? '' : ' locked'}`;
      const title = document.createElement('strong');
      title.textContent = `${unlocked.has(achievement.id) ? 'Unlocked' : 'Locked'}: ${achievement.title}`;
      const description = document.createElement('span');
      description.textContent = achievement.description;
      const reward = document.createElement('span');
      reward.textContent = achievementRewardText(achievement.reward);
      row.append(title, description, reward);
      return row;
    }),
  );
}

function syncProgressHud() {
  levelName.textContent = levelNameFromTrack(game.currentMusic);
  const elapsed = Math.max(0, game.time - game.levelStartTime);
  const progress = game.levelComplete ? 1 : Math.min(0.985, elapsed / LEVEL_TARGET_DURATION);
  const spawnAdjusted = game.enemySpawnQueue.length === 0 ? Math.max(progress, 0.92) : progress;
  levelProgressFill.style.width = `${spawnAdjusted * 100}%`;
}

function levelNameFromTrack(trackName = '') {
  return trackName.replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2') || `Level ${game.level}`;
}

function soundPlayerFor(src) {
  if (!soundPlayers.has(src)) {
    const audio = new Audio(src);
    audio.volume = 0.48;
    soundPlayers.set(src, audio);
  }
  return soundPlayers.get(src);
}

function bindButtonActivation(button, handler) {
  let pointerHandled = false;
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    pointerHandled = true;
    handler();
  });
  button.addEventListener('click', () => {
    if (pointerHandled) {
      pointerHandled = false;
      return;
    }
    handler();
  });
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
    reticle.x = Math.max(18, Math.min(window.innerWidth - 18, reticle.x + input.aimX * 260 * dt));
    reticle.y = Math.max(18, Math.min(window.innerHeight - 18, reticle.y + input.aimY * 260 * dt));
    return;
  }
  if (reticle.active) reticle.idle += dt;
}

function updateVirtualPointer(pointer, input, dt, enabled) {
  if (!enabled) {
    pointer.active = false;
    pointer.selectControl = null;
    virtualCursor.hidden = true;
    return;
  }
  const x = input.cursorX ?? 0;
  const y = input.cursorY ?? 0;
  const strength = Math.hypot(x, y);
  if (strength > 0.05) pointer.active = true;
  if (!pointer.active && !input.cursorClickPressed) {
    virtualCursor.hidden = true;
    return;
  }
  if (pointer.selectControl) {
    updateVirtualSelect(pointer, input, dt);
    return;
  }
  pointer.x = Math.max(8, Math.min(window.innerWidth - 8, pointer.x + x * 520 * dt));
  pointer.y = Math.max(8, Math.min(window.innerHeight - 8, pointer.y + y * 520 * dt));
  virtualCursor.hidden = false;
  virtualCursor.dataset.mode = 'point';
  virtualCursor.style.transform = `translate(${pointer.x - 9}px, ${pointer.y - 9}px)`;
  scrollVirtualTarget(pointer, input, dt);
  if (input.cursorClickPressed) clickVirtualPointer(pointer);
}

function clickVirtualPointer(pointer) {
  virtualCursor.hidden = true;
  const target = document.elementFromPoint(pointer.x, pointer.y);
  virtualCursor.hidden = false;
  if (!target) return;
  const select = target.closest?.('select') ?? (target.control instanceof HTMLSelectElement ? target.control : null);
  if (select instanceof HTMLSelectElement) {
    pointer.selectControl = select;
    pointer.selectRepeat = 0;
    select.focus();
    virtualCursor.dataset.mode = 'select';
    return;
  }
  target.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: pointer.x,
      clientY: pointer.y,
      view: window,
    }),
  );
}

function updateVirtualSelect(pointer, input, dt) {
  const select = pointer.selectControl;
  if (!select?.isConnected) {
    pointer.selectControl = null;
    return;
  }
  pointer.active = true;
  const rect = select.getBoundingClientRect();
  pointer.x = Math.max(8, Math.min(window.innerWidth - 8, rect.left + rect.width / 2));
  pointer.y = Math.max(8, Math.min(window.innerHeight - 8, rect.top + rect.height / 2));
  virtualCursor.hidden = false;
  virtualCursor.dataset.mode = 'select';
  virtualCursor.style.transform = `translate(${pointer.x - 9}px, ${pointer.y - 9}px)`;
  if (input.cursorClickPressed) {
    select.blur();
    pointer.selectControl = null;
    virtualCursor.dataset.mode = 'point';
    return;
  }
  pointer.selectRepeat = Math.max(0, pointer.selectRepeat - dt);
  const y = input.cursorY ?? 0;
  if (Math.abs(y) <= 0.55) {
    pointer.selectRepeat = 0;
    return;
  }
  if (pointer.selectRepeat > 0) return;
  changeVirtualSelectOption(select, Math.sign(y));
  pointer.selectRepeat = 0.22;
}

function changeVirtualSelectOption(select, direction) {
  const next = Math.max(0, Math.min(select.options.length - 1, select.selectedIndex + direction));
  if (next === select.selectedIndex) return;
  select.selectedIndex = next;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function scrollVirtualTarget(pointer, input, dt) {
  const y = input.cursorY ?? 0;
  if (Math.abs(y) <= 0.45) return;
  virtualCursor.hidden = true;
  const target = document.elementFromPoint(pointer.x, pointer.y);
  virtualCursor.hidden = false;
  const scrollTarget = scrollableAncestor(target);
  if (!scrollTarget) return;
  const before = scrollTarget.scrollTop;
  scrollTarget.scrollTop += y * 520 * dt;
  if (scrollTarget.scrollTop !== before) virtualCursor.dataset.mode = 'scroll';
}

function scrollableAncestor(element) {
  for (let current = element; current && current !== document.body; current = current.parentElement) {
    if (current instanceof HTMLSelectElement) return null;
    const style = window.getComputedStyle(current);
    const canScrollY = /(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight + 1;
    if (canScrollY) return current;
  }
  return null;
}

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function populateUpgradeSelect() {
  for (const upgrade of UPGRADE_DEFINITIONS) {
    const option = document.createElement('option');
    option.value = upgrade.id;
    shopUpgradeSelect.append(option);
  }
  refreshUpgradeOptions();
}

function refreshUpgradeOptions() {
  const selected = shopUpgradeSelect.value;
  for (const option of shopUpgradeSelect.options) {
    const upgrade = UPGRADE_DEFINITIONS.find((candidate) => candidate.id === option.value);
    option.textContent = `${upgrade.system}: ${upgrade.label} Lv ${game.upgrades?.[upgrade.id] ?? 0}`;
  }
  shopUpgradeSelect.value = selected || UPGRADE_DEFINITIONS[0]?.id || '';
}

function refreshRepairTargets() {
  const selected = shopRepairTarget.value;
  shopRepairTarget.replaceChildren(
    ...repairTargetOptions(game.vehicle).map((target) => {
      const option = document.createElement('option');
      const cost = repairCost(game, target.id);
      option.value = target.id;
      option.textContent = cost > 0 ? `${target.label} (${cost} scrap)` : `${target.label} (OK)`;
      return option;
    }),
  );
  shopRepairTarget.value =
    Array.from(shopRepairTarget.options).some((option) => option.value === selected) ? selected : shopRepairTarget.options[0]?.value || 'all';
}

function refreshUpgradeSummary() {
  const openSystems = new Set(
    Array.from(upgradeSummary.querySelectorAll('details'))
      .filter((details) => details.open)
      .map((details) => details.dataset.system),
  );
  const groups = new Map();
  for (const upgrade of UPGRADE_DEFINITIONS) {
    if (!groups.has(upgrade.system)) groups.set(upgrade.system, []);
    groups.get(upgrade.system).push(upgrade);
  }
  upgradeSummary.replaceChildren(
    ...Array.from(groups.entries()).map(([system, upgrades]) => {
      const details = document.createElement('details');
      details.dataset.system = system;
      details.open = openSystems.size === 0 ? system === 'Main Gun' : openSystems.has(system);
      const summary = document.createElement('summary');
      const systemLevel = upgrades.reduce((sum, upgrade) => sum + (game.upgrades?.[upgrade.id] ?? 0), 0);
      summary.textContent = `${system} upgrades: ${systemLevel}`;
      const list = document.createElement('div');
      list.className = 'upgrade-list';
      for (const upgrade of upgrades) {
        const row = document.createElement('div');
        row.className = 'upgrade-line';
        const name = document.createElement('span');
        name.textContent = upgrade.label;
        const level = document.createElement('span');
        level.textContent = `Lv ${game.upgrades?.[upgrade.id] ?? 0}`;
        const cost = document.createElement('span');
        const nextCost = upgradeCost(game, upgrade.id);
        cost.textContent = Number.isFinite(nextCost) ? `${nextCost} scrap` : '-';
        row.append(name, level, cost);
        list.append(row);
      }
      details.append(summary, list);
      return details;
    }),
  );
}

function updateShopUi() {
  if (!shopAmmoSelect.value) shopAmmoSelect.value = game.secondary.selected;
  const ammoWeapon = shopAmmoSelect.value;
  const ammoCost = ammoRefillCost(ammoWeapon);
  const ammo = game.secondary.ammo[ammoWeapon];
  const ammoCapacity = ammoCapacityWithUpgrades(game, ammoWeapon);
  const selectedUpgradeCost = upgradeCost(game, shopUpgradeSelect.value);
  refreshRepairTargets();
  const selectedRepairCost = repairCost(game, shopRepairTarget.value);
  refreshUpgradeOptions();
  refreshUpgradeSummary();
  shopRepairCost.textContent = selectedRepairCost;
  shopReplaceCost.textContent = SHOP_COSTS.replaceDetached;
  shopAmmoCost.textContent = Number.isFinite(ammoCost) ? ammoCost : '-';
  shopUpgradeCost.textContent = Number.isFinite(selectedUpgradeCost) ? selectedUpgradeCost : '-';
  shopScrapAvailable.textContent = game.scrap;
  shopSelectedAmmo.textContent = ammoWeapon;
  shopRepairStatus.textContent = repairStatus(game, shopRepairTarget.value);
  shopReplaceStatus.textContent = replacementStatus(game);
  shopAmmoStatus.textContent = ammoStatus(game, ammoWeapon);
  shopUpgradeStatus.textContent = upgradeStatus(game, shopUpgradeSelect.value);
  shopRepairButton.disabled = selectedRepairCost <= 0 || game.scrap < selectedRepairCost || !hasRepairableVehicleDamage(game.vehicle, shopRepairTarget.value);
  shopReplaceButton.disabled = game.scrap < SHOP_COSTS.replaceDetached || countDetachedVehicleCells(game.vehicle) === 0;
  shopRefillAmmoButton.disabled = !Number.isFinite(ammoCost) || game.scrap < ammoCost || ammo == null || ammo >= ammoCapacity;
  shopBuyUpgradeButton.disabled = !Number.isFinite(selectedUpgradeCost) || game.scrap < selectedUpgradeCost;
}
