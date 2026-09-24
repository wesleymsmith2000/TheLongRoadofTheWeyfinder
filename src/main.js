import {
  GUIDED_TARGET_CELL_TYPE_LABELS,
  GUIDED_TARGET_CELL_TYPES,
  LEVEL_TARGET_DURATION,
  TARGETING_MODES,
  applySandboxDefinitionToGame,
  createGame,
  stepGame,
} from './core/game.js';
import { BUILD_VERSION } from './core/buildVersion.js';
import { addCameraShake, configureRoadLaneForViewport, screenToWorld } from './core/camera.js';
import { CanvasRenderer } from './render/canvasRenderer.js';
import { createKeyboardInput } from './input/keyboard.js';
import { createGamepadInput } from './input/gamepad.js';
import { listEnemyArchetypes } from './core/enemyArchetypeDefinition.js';
import {
  CONTROL_ACTIONS,
  DEFAULT_CONTROL_BINDINGS,
  gamepadButtonLabel,
  keyLabel,
  normalizeControlBindings,
  setGamepadBinding,
  setKeyboardBinding,
} from './input/controlBindings.js';
import { createMouseInput, createPointerButtonInput } from './input/mouse.js';
import { createDebugOverlay } from './debug/debugOverlay.js';
import { createPerformanceDiagnostics, installPerformanceDiagnosticsGlobal } from './debug/performanceConfig.js';
import { createPerformanceMonitor } from './debug/performanceMonitor.js';
import { createPlayerVehicleLaunchEditor } from './editor/playerVehicleLaunchEditor.js';
import { createPrototypePlayerAccountData, normalizePrototypePlayerAccountData, preparePlayerAccountForSave } from './core/playerAccount.js';
import { applySaveStateToGame, createSaveState, validateSaveState } from './core/saveState.js';
import {
  createLocalContentBundleFromFiles,
  createRegistryWithLocalContent,
  installLocalContentBundle,
  installLocalContentFiles,
  instantiateLocalLevel,
  listLocalContentPacks,
  removeLocalContentPack,
} from './core/localContentLibrary.js';
import { ACHIEVEMENT_DEFINITIONS, achievementRewardText, achievementStatsFromGame, awardAchievements } from './core/achievements.js';
import { consumeSoundEvents, SOUND_EVENTS } from './core/soundEvents.js';
import { consumeHapticEvents, emitHapticEvent, HAPTIC_EVENTS } from './core/hapticEvents.js';
import { MUSIC_LAYERS, consumeProceduralMusicCue } from './core/proceduralMusic.js';
import {
  ammoCapacityWithUpgrades,
  ammoRefillCost,
  ammoStatus,
  availableUpgradeDefinitions,
  configureSandboxLoadout,
  repairCost,
  repairAllStatus,
  repairSandboxVehicle,
  refillSandboxAmmo,
  repairStatus,
  replacementCost,
  replacementStatus,
  upgradeCost,
  upgradeStatus,
} from './core/economy.js';
import {
  countDetachedVehicleCells,
  hasRepairableVehicleDamage,
  nextReplaceableDetachedVehicleCell,
  repairTargetOptions,
} from './core/vehicle.js';
import { DEFAULT_SANDBOX_DEFINITION, sandboxDefinitionFromEnemy, sandboxDefinitionFromLevel, validateSandboxDefinition } from './core/sandboxMode.js';
import { beginEncounter, activeEncounterView, chooseEncounterChoice } from './core/encounterRuntime.js';
import { normalizeEncounterDefinition, validateEncounterDefinition } from './core/encounterDefinition.js';
import { ENCOUNTER_CONDITION_TYPES, ENCOUNTER_EFFECT_TYPES } from './core/encounterVerbRegistry.js';
import {
  createNavigationRuntime,
  navigationView,
  recordNavigationOutcome,
  selectNavigationEdge,
  selectNavigationNode,
  updateNavigationSignals,
  validateNavigationGraph,
} from './core/navigationGraph.js';
import levelCompleteBannerArt from '../assets/images/level_complete_banner.png';
import levelCompleteArt from '../assets/images/level_complete_screen.png';
import bossDefeatedBannerArt from '../assets/images/boss_defeated_banner.png';
import levelFailArt from '../assets/images/level_fail_screen.png';
import pauseArt from '../assets/images/pause_screen.png';
import repairArt from '../assets/images/repair_screen.png';
import weaponIconSheet from '../assets/images/system_icons_2.png';
import systemIconSheet from '../assets/images/system_icons_1.png';
import upgradeIconSheetA from '../assets/images/upgrade_types_2.png';
import upgradeIconSheetB from '../assets/images/upgrade_types_1.png';
import uiIconAtlas from '../content/resources/ui/icon_atlas.json' with { type: 'json' };
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
import steppesDarkenedApollo1Music from '../assets/music/SteppesOfApollonSkoteinos_DarkenedApollo_1.mp3';
import steppesDarkenedApollo2Music from '../assets/music/SteppesOfApollonSkoteinos_DarkenedApollo_2.mp3';
import steppesEclipseBoss1Music from '../assets/music/SteppesOfApollonSkoteinos_EclipseOfTheFalseSun_BossFight_1.mp3';
import steppesEclipseBoss2Music from '../assets/music/SteppesOfApollonSkoteinos_EclipseOfTheFalseSun_BossFight_2.mp3';
import steppesMirageOfTruth1Music from '../assets/music/SteppesOfApollonSkoteinos_MirageOfTruth_1.mp3';
import steppesMirageOfTruth2Music from '../assets/music/SteppesOfApollonSkoteinos_MirageOfTruth_2.mp3';
import steppesTheObviousRoad1Music from '../assets/music/SteppesOfApollonSkoteinos_TheObviousRoad_1.mp3';
import steppesTheObviousRoad2Music from '../assets/music/SteppesOfApollonSkoteinos_TheObviousRoad_2.mp3';
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
import toggleSwitchClick2Sound from '../assets/sounds/Toggle Switch Click 2.mp3';
import victoryTone1Sound from '../assets/sounds/VictoryTone1.mp3';
import bossInternalExplosion1Sound from '../assets/sounds/boss__internal_explosion_1.mp3';
import bossInternalExplosion2Sound from '../assets/sounds/boss__internal_explosion_2.mp3';
import bossMainExplosion1Sound from '../assets/sounds/boss__main_explosion_1.mp3';
import bossMainExplosion2Sound from '../assets/sounds/boss__main_explosion_2.mp3';
import krakenDefeatedSound from '../assets/sounds/Kraken_Defeated.mp3';
import krakenEnterSound from '../assets/sounds/Kraken_Enter.mp3';
import pirateAvastSound from '../assets/sounds/Pirate__Avast_Skalleywag.mp3';
import pirateBroadsideSound from '../assets/sounds/Pirate__Give_em_a_broadside.mp3';
import pirateNoQuarterSound from '../assets/sounds/Pirate__No_quarter.mp3';
import pirateYarghSound from '../assets/sounds/Pirate__Yargh.mp3';
import pirateBossDefeatSound from '../assets/sounds/Pirate_Boss__Defeat__Shivered_me_timbers.mp3';
import pirateBossEntranceSound from '../assets/sounds/Pirate_Boss__Entrance_taunt.mp3';

const SOUND_ASSET_URLS = import.meta.glob('../assets/sounds/*.mp3', { eager: true, import: 'default' });

function soundAsset(filename) {
  return SOUND_ASSET_URLS[`../assets/sounds/${filename}`];
}

function numberedSoundAssets(prefix, count) {
  return Array.from({ length: count }, (_, index) => soundAsset(`${prefix}${index + 1}.mp3`)).filter(Boolean);
}

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
  SteppesOfApollonSkoteinos_DarkenedApollo_1: steppesDarkenedApollo1Music,
  SteppesOfApollonSkoteinos_DarkenedApollo_2: steppesDarkenedApollo2Music,
  SteppesOfApollonSkoteinos_EclipseOfTheFalseSun_BossFight_1: steppesEclipseBoss1Music,
  SteppesOfApollonSkoteinos_EclipseOfTheFalseSun_BossFight_2: steppesEclipseBoss2Music,
  SteppesOfApollonSkoteinos_MirageOfTruth_1: steppesMirageOfTruth1Music,
  SteppesOfApollonSkoteinos_MirageOfTruth_2: steppesMirageOfTruth2Music,
  SteppesOfApollonSkoteinos_TheObviousRoad_1: steppesTheObviousRoad1Music,
  SteppesOfApollonSkoteinos_TheObviousRoad_2: steppesTheObviousRoad2Music,
  TheWeyfindersRoad_1: theWeyfindersRoad1Music,
  TheWeyfindersRoad_2: theWeyfindersRoad2Music,
  TheWeyfindersRoad_3: theWeyfindersRoad3Music,
  TwilightCrossroads: twilightCrossroadsMusic,
  TwilightCrossroads_BossFight: twilightCrossroadsBossMusic,
};

const MUSIC_LAYER_URLS = {
  // Future stem/cue loops go here by base track:
  // TheWeyfindersRoad_1: { attention: attentionStemUrl, suspicion: suspicionStemUrl }
};
const BASE_MUSIC_VOLUME = 0.42;
const LAYER_MUSIC_VOLUME = 0.26;

const SOUND_URLS = {
  [SOUND_EVENTS.PLAYER_MAIN_GUN]: buttonChirpSound,
  [SOUND_EVENTS.PLAYER_SECONDARY_LAUNCH]: rocketAccelerateSound,
  [SOUND_EVENTS.PLAYER_BEAM]: particleBeamSound,
  [SOUND_EVENTS.PLAYER_EXPLOSION]: futuristicCannonSound,
  [SOUND_EVENTS.PLAYER_MORTAR_FIRE]: soundAsset('player_mortar_fire.mp3'),
  [SOUND_EVENTS.PLAYER_CELL_LOSS]: soundAsset('crash_and_jangle_3.mp3'),
  [SOUND_EVENTS.ENEMY_BULLET]: errorClickSound,
  [SOUND_EVENTS.ENEMY_BEAM]: errorBuzz2Sound,
  [SOUND_EVENTS.ENEMY_DEATH]: futuristicCannonSound,
  [SOUND_EVENTS.ENEMY_MORTAR_FIRE]: soundAsset('enemy_mortar_fire.mp3'),
  [SOUND_EVENTS.ENEMY_BEAM_POWERUP]: soundAsset('enemy_beam_powerup.mp3'),
  [SOUND_EVENTS.BOSS_INTERNAL_EXPLOSION_1]: bossInternalExplosion1Sound,
  [SOUND_EVENTS.BOSS_INTERNAL_EXPLOSION_2]: bossInternalExplosion2Sound,
  [SOUND_EVENTS.BOSS_MAIN_EXPLOSION_1]: bossMainExplosion1Sound,
  [SOUND_EVENTS.BOSS_MAIN_EXPLOSION_2]: bossMainExplosion2Sound,
  [SOUND_EVENTS.STAGE_VICTORY]: victoryTone1Sound,
  [SOUND_EVENTS.MOTH_COUNTDOWN]: toggleSwitchClick2Sound,
  [SOUND_EVENTS.BULLET_RICOCHET]: numberedSoundAssets('bullet_ricochet_', 4),
  [SOUND_EVENTS.GLAIVE_BOUNCE]: numberedSoundAssets('bullet_ricochet_', 4),
  [SOUND_EVENTS.METAL_SLASH]: soundAsset('metal_slash.mp3'),
  [SOUND_EVENTS.BUZZARD_START]: numberedSoundAssets('buzzard_start_', 4),
  [SOUND_EVENTS.CAR_START]: numberedSoundAssets('car_start_', 4),
  [SOUND_EVENTS.CAR_SKID]: numberedSoundAssets('car_skidding_', 4),
  [SOUND_EVENTS.CRASH_AND_JANGLE]: numberedSoundAssets('crash_and_jangle_', 4),
  [SOUND_EVENTS.CRASH_AND_SPLASH]: numberedSoundAssets('crash_and_splash_', 4),
  [SOUND_EVENTS.GHOST_ENEMY_START]: soundAsset('ghost_enemy_start.mp3'),
  [SOUND_EVENTS.GHOST_ENEMY_DEFEAT]: soundAsset('ghost_enemy_defeat.mp3'),
  [SOUND_EVENTS.HARPOON_POWERUP]: soundAsset('harpoon_powerup.mp3'),
  [SOUND_EVENTS.INCHWORM_DEFEATED]: soundAsset('inchworm_defeated.mp3'),
  [SOUND_EVENTS.INCHWORM_SEGMENT_DESTROYED]: soundAsset('inchworm_segment_destroyed.mp3'),
  [SOUND_EVENTS.INSECT_CHITTERING]: numberedSoundAssets('insect_chittering_', 4),
  [SOUND_EVENTS.LASER_SCORCH_PULSED]: numberedSoundAssets('laser_scorch_pulsed_', 3),
  [SOUND_EVENTS.POWER_DOWN]: numberedSoundAssets('power_down_', 2),
  [SOUND_EVENTS.PIRATE_YARGH]: pirateYarghSound,
  [SOUND_EVENTS.PIRATE_NO_QUARTER]: pirateNoQuarterSound,
  [SOUND_EVENTS.PIRATE_BROADSIDE]: pirateBroadsideSound,
  [SOUND_EVENTS.PIRATE_AVAST]: pirateAvastSound,
  [SOUND_EVENTS.PIRATE_BOSS_ENTRANCE]: pirateBossEntranceSound,
  [SOUND_EVENTS.PIRATE_BOSS_DEFEAT]: pirateBossDefeatSound,
  [SOUND_EVENTS.KRAKEN_ENTER]: krakenEnterSound,
  [SOUND_EVENTS.KRAKEN_DEFEATED]: krakenDefeatedSound,
};

const AMBIENT_SOUND_URLS = {
  ocean: numberedSoundAssets('ocean_waves_', 4),
  forest: numberedSoundAssets('night_forrest_', 4),
  thunder: numberedSoundAssets('rolling_thunder_', 4),
  wind: numberedSoundAssets('storm_wind_', 4),
};
const LASER_SCORCH_LOOP_URL = soundAsset('laser_scorch_constant.mp3');

const canvas = document.querySelector('#game');
const virtualCursor = document.querySelector('#virtualCursor');
const buildVersionTag = document.querySelector('#buildVersionTag');
const titleScreen = document.querySelector('#titleScreen');
const titleVersionTag = document.querySelector('#titleVersionTag');
const titleNormalRun = document.querySelector('#titleNormalRun');
const titleSandboxRun = document.querySelector('#titleSandboxRun');
const titleVehicleBay = document.querySelector('#titleVehicleBay');
const titleControls = document.querySelector('#titleControls');
const gameOver = document.querySelector('#gameOver');
const victoryBanner = document.querySelector('#victoryBanner');
const launchScreen = document.querySelector('#launchScreen');
const launchButton = document.querySelector('#launchButton');
const vehicleEditorCanvas = document.querySelector('#vehicleEditorCanvas');
const vehiclePartSelect = document.querySelector('#vehiclePartSelect');
const vehiclePlaceButton = document.querySelector('#vehiclePlaceButton');
const vehicleEraseButton = document.querySelector('#vehicleEraseButton');
const vehicleConnectButton = document.querySelector('#vehicleConnectButton');
const vehicleDisconnectButton = document.querySelector('#vehicleDisconnectButton');
const vehicleAutoConnectButton = document.querySelector('#vehicleAutoConnectButton');
const vehicleResetButton = document.querySelector('#vehicleResetButton');
const gunLoadoutSelects = [...document.querySelectorAll('.gun-loadout-select')];
const vehicleEditorStatus = document.querySelector('#vehicleEditorStatus');
const hudToggle = document.querySelector('#hudToggle');
const pauseToggle = document.querySelector('#pauseToggle');
const pauseScreen = document.querySelector('#pauseScreen');
const resumeButton = document.querySelector('#resumeButton');
const pauseSecondarySelect = document.querySelector('#pauseSecondarySelect');
const pauseSecondaryAutofire = document.querySelector('#pauseSecondaryAutofire');
const pauseSecondaryFire = document.querySelector('#pauseSecondaryFire');
const targetingModeSelect = document.querySelector('#targetingModeSelect');
const targetPreviousButton = document.querySelector('#targetPreviousButton');
const targetNextButton = document.querySelector('#targetNextButton');
const targetCellTypeSelect = document.querySelector('#targetCellTypeSelect');
const targetCellNextButton = document.querySelector('#targetCellNextButton');
const targetInfo = document.querySelector('#targetInfo');
const moduleStatusList = document.querySelector('#moduleStatusList');
const pauseLevelNumber = document.querySelector('#pauseLevelNumber');
const pauseScrapCount = document.querySelector('#pauseScrapCount');
const pauseDamageDone = document.querySelector('#pauseDamageDone');
const exportSaveButton = document.querySelector('#exportSaveButton');
const importSaveButton = document.querySelector('#importSaveButton');
const importSaveInput = document.querySelector('#importSaveInput');
const saveStatus = document.querySelector('#saveStatus');
const combatPanel = document.querySelector('#combatPanel');
const debugToggle = document.querySelector('#debugToggle');
const controlsToggle = document.querySelector('#controlsToggle');
const controlsPanel = document.querySelector('#controlsPanel');
const sandboxToggle = document.querySelector('#sandboxToggle');
const sandboxPanel = document.querySelector('#sandboxPanel');
const sandboxEnemySelect = document.querySelector('#sandboxEnemySelect');
const sandboxCountInput = document.querySelector('#sandboxCountInput');
const sandboxFrequencyInput = document.querySelector('#sandboxFrequencyInput');
const sandboxSpreadInput = document.querySelector('#sandboxSpreadInput');
const sandboxLevelInput = document.querySelector('#sandboxLevelInput');
const sandboxScriptInput = document.querySelector('#sandboxScriptInput');
const sandboxQuickRun = document.querySelector('#sandboxQuickRun');
const sandboxScriptRun = document.querySelector('#sandboxScriptRun');
const sandboxStop = document.querySelector('#sandboxStop');
const sandboxRefresh = document.querySelector('#sandboxRefresh');
const sandboxStatus = document.querySelector('#sandboxStatus');
const sandboxContentInput = document.querySelector('#sandboxContentInput');
const sandboxLevelSelect = document.querySelector('#sandboxLevelSelect');
const sandboxPlayLevel = document.querySelector('#sandboxPlayLevel');
const sandboxLoadoutToggle = document.querySelector('#sandboxLoadoutToggle');
const sandboxLoadoutPanel = document.querySelector('#sandboxLoadoutPanel');
const sandboxUpgradeSelect = document.querySelector('#sandboxUpgradeSelect');
const sandboxUpgradeLevel = document.querySelector('#sandboxUpgradeLevel');
const sandboxApplyUpgrade = document.querySelector('#sandboxApplyUpgrade');
const sandboxRepairVehicle = document.querySelector('#sandboxRepairVehicle');
const sandboxRefillAmmo = document.querySelector('#sandboxRefillAmmo');
const encounterVignette = document.querySelector('#encounterVignette');
const encounterSpeaker = document.querySelector('#encounterSpeaker');
const encounterTitle = document.querySelector('#encounterTitle');
const encounterBody = document.querySelector('#encounterBody');
const encounterPrompt = document.querySelector('#encounterPrompt');
const encounterChoices = document.querySelector('#encounterChoices');
const controlConfigToggle = document.querySelector('#controlConfigToggle');
const controlConfigPanel = document.querySelector('#controlConfigPanel');
const controlConfigList = document.querySelector('#controlConfigList');
const controlConfigClose = document.querySelector('#controlConfigClose');
const controlConfigReset = document.querySelector('#controlConfigReset');
const controlConfigStatus = document.querySelector('#controlConfigStatus');
const achievementsToggle = document.querySelector('#achievementsToggle');
const achievementsPanel = document.querySelector('#achievementsPanel');
const achievementList = document.querySelector('#achievementList');
const primaryFireToggle = document.querySelector('#primaryFireToggle');
const aiLeadToggle = document.querySelector('#aiLeadToggle');
const targetCycleButton = document.querySelector('#targetCycleButton');
const targetCellCycleButton = document.querySelector('#targetCellCycleButton');
const targetCellCycleLabel = document.querySelector('#targetCellCycleLabel');
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
const targetingAiXpGain = document.querySelector('#targetingAiXpGain');
const levelNumber = document.querySelector('#levelNumber');
const levelsCompleted = document.querySelector('#levelsCompleted');
const nextLevelButton = document.querySelector('#nextLevelButton');
const shopRepairButton = document.querySelector('#shopRepairButton');
const shopRepairAllButton = document.querySelector('#shopRepairAllButton');
const shopReplaceButton = document.querySelector('#shopReplaceButton');
const shopRefillAmmoButton = document.querySelector('#shopRefillAmmoButton');
const shopRepairCost = document.querySelector('#shopRepairCost');
const shopReplaceCost = document.querySelector('#shopReplaceCost');
const shopAmmoCost = document.querySelector('#shopAmmoCost');
const shopSelectedAmmo = document.querySelector('#shopSelectedAmmo');
const shopScrapAvailable = document.querySelector('#shopScrapAvailable');
const shopRepairStatus = document.querySelector('#shopRepairStatus');
const shopRepairAllStatus = document.querySelector('#shopRepairAllStatus');
const shopReplaceStatus = document.querySelector('#shopReplaceStatus');
const shopAmmoStatus = document.querySelector('#shopAmmoStatus');
const shopRepairTarget = document.querySelector('#shopRepairTarget');
const shopAmmoSelect = document.querySelector('#shopAmmoSelect');
const shopRepairTab = document.querySelector('#shopRepairTab');
const shopUpgradeTab = document.querySelector('#shopUpgradeTab');
const shopRepairAmmoSection = document.querySelector('#shopRepairAmmoSection');
const shopUpgradesSection = document.querySelector('#shopUpgradesSection');
const shopUpgradeSystemSelect = document.querySelector('#shopUpgradeSystemSelect');
const shopUpgradeSelect = document.querySelector('#shopUpgradeSelect');
const shopUpgradeSystemIcon = document.querySelector('#shopUpgradeSystemIcon');
const shopUpgradeIcon = document.querySelector('#shopUpgradeIcon');
const shopUpgradeReadoutTitle = document.querySelector('#shopUpgradeReadoutTitle');
const shopUpgradeLevel = document.querySelector('#shopUpgradeLevel');
const shopBuyUpgradeButton = document.querySelector('#shopBuyUpgradeButton');
const shopUpgradeCost = document.querySelector('#shopUpgradeCost');
const shopUpgradeStatus = document.querySelector('#shopUpgradeStatus');
const upgradeSummary = document.querySelector('#upgradeSummary');
const restartButton = document.querySelector('#restartButton');
const levelName = document.querySelector('#levelName');
const levelProgressFill = document.querySelector('#levelProgressFill');
const performanceDiagnostics = installPerformanceDiagnosticsGlobal(createPerformanceDiagnostics());
const renderer = new CanvasRenderer(canvas, { diagnostics: performanceDiagnostics });
const CONTROL_BINDINGS_STORAGE_KEY = 'weyfinder.prototype0.controlBindings';
const SANDBOX_STORAGE_KEY = 'weyfinder.prototype0.sandboxDefinition';
const AI_SHOT_LEADING_STORAGE_KEY = 'weyfinder.prototype0.aiShotLeading';
let controlBindings = loadControlBindings();
let pendingControlCapture = null;
const keyboard = createKeyboardInput(window, controlBindings);
const gamepad = createGamepadInput(undefined, controlBindings);
const mouse = createMouseInput(canvas, (screen) => screenToWorld(screen, game.camera, { width: window.innerWidth, height: window.innerHeight }));
const touchPrimaryFireToggle = createPointerButtonInput(primaryFireToggle);
const touchAiLeadToggle = createPointerButtonInput(aiLeadToggle);
const touchTargetCycle = createPointerButtonInput(targetCycleButton);
const touchTargetCellCycle = createPointerButtonInput(targetCellCycleButton);
const touchBoost = createPointerButtonInput(boostButton);
const touchSecondary = createPointerButtonInput(secondaryFire);
const touchSecondaryCycle = createPointerButtonInput(secondaryTouchCycle);
const touchSecondaryFloating = createPointerButtonInput(secondaryTouchFire);
const pauseSecondaryPress = createPointerButtonInput(pauseSecondaryFire);
const debug = createDebugOverlay();
const perfMonitor = createPerformanceMonitor({
  getMode: () => performanceDiagnostics.monitorMode(),
  getOverlayVisible: () => debug.visible,
});
const uiDirty = {
  shop: true,
  pause: true,
};
const uiTimers = {
  shop: 0,
  pause: 0,
};
let shopUiWasVisible = false;
let pauseUiWasVisible = false;
let activeShopSection = 'repair';
const upgradeSummaryOpenState = new Map();
const frameAudioCounters = {
  audioPlayCalls: 0,
  enemyBulletSoundEvents: 0,
};
const IDLE_FRONT_PAGE_FRAME_INTERVAL_MS = 1000 / 12;
const IDLE_PERFORMANCE_COUNTERS = Object.freeze({
  playerProjectiles: 0,
  enemyProjectiles: 0,
  smokeParticles: 0,
  scrapPickups: 0,
  enemies: 0,
  enemyCells: 0,
  liveEnemyCells: 0,
  vehicleCells: 0,
  terrainChunks: 0,
  terrainCacheBuilds: 0,
  terrainPendingChunks: 0,
  audioPlayCalls: 0,
  enemyBulletSoundEvents: 0,
});

const PLAYER_ACCOUNT_STORAGE_KEY = 'weyfinder.prototype0.playerAccount';

let playerAccount = loadPlayerAccount();
let playerVehicleDefinition = playerAccount.savedVehicle;
let game = createGame(1147, { vehicleDefinition: playerVehicleDefinition ?? undefined });
let aiShotLeading = loadAiShotLeading();
let previous = performance.now();
let awaitingLaunch = true;
let titleActive = true;
let activeMusicTrack = null;
let pendingEncounterChoiceId = null;
let lastEncounterViewKey = '';
const musicAudio = new Audio();
musicAudio.loop = true;
musicAudio.volume = BASE_MUSIC_VOLUME;
const soundPlayers = new Map();
const musicLayerPlayers = new Map();
const continuousSoundLoops = new Map();
const ambientSoundStates = new Map();
const ambientDurations = new Map();
let lastProceduralMusicCue = null;
let soundPlayersPrewarmed = false;
const lastSoundPlayedAt = new Map();
const hapticPulseQueue = [];
let hapticLastPulseAt = 0;
const HAPTIC_MIN_INTERVAL_MS = 35;
const SOUND_MIN_INTERVAL_MS = new Map([
  [SOUND_EVENTS.ENEMY_BULLET, 55],
  [SOUND_EVENTS.ENEMY_BEAM, 90],
  [SOUND_EVENTS.ENEMY_BEAM_POWERUP, 350],
  [SOUND_EVENTS.ENEMY_MORTAR_FIRE, 120],
  [SOUND_EVENTS.PLAYER_MAIN_GUN, 35],
  [SOUND_EVENTS.PLAYER_MORTAR_FIRE, 80],
  [SOUND_EVENTS.PLAYER_CELL_LOSS, 160],
  [SOUND_EVENTS.MOTH_COUNTDOWN, 120],
  [SOUND_EVENTS.BULLET_RICOCHET, 90],
  [SOUND_EVENTS.GLAIVE_BOUNCE, 90],
  [SOUND_EVENTS.METAL_SLASH, 70],
  [SOUND_EVENTS.BUZZARD_START, 700],
  [SOUND_EVENTS.CAR_START, 420],
  [SOUND_EVENTS.CAR_SKID, 420],
  [SOUND_EVENTS.CRASH_AND_JANGLE, 140],
  [SOUND_EVENTS.CRASH_AND_SPLASH, 180],
  [SOUND_EVENTS.GHOST_ENEMY_START, 700],
  [SOUND_EVENTS.GHOST_ENEMY_DEFEAT, 220],
  [SOUND_EVENTS.HARPOON_POWERUP, 500],
  [SOUND_EVENTS.INCHWORM_DEFEATED, 450],
  [SOUND_EVENTS.INCHWORM_SEGMENT_DESTROYED, 120],
  [SOUND_EVENTS.INSECT_CHITTERING, 550],
  [SOUND_EVENTS.LASER_SCORCH_PULSED, 320],
  [SOUND_EVENTS.POWER_DOWN, 420],
  [SOUND_EVENTS.PIRATE_YARGH, 900],
  [SOUND_EVENTS.PIRATE_NO_QUARTER, 900],
  [SOUND_EVENTS.PIRATE_BROADSIDE, 900],
  [SOUND_EVENTS.PIRATE_AVAST, 900],
  [SOUND_EVENTS.PIRATE_BOSS_ENTRANCE, 2500],
  [SOUND_EVENTS.PIRATE_BOSS_DEFEAT, 2500],
  [SOUND_EVENTS.KRAKEN_ENTER, 2500],
  [SOUND_EVENTS.KRAKEN_DEFEATED, 2500],
]);
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
const selectionFlash = document.createElement('div');
selectionFlash.className = 'selection-flash';
selectionFlash.hidden = true;
document.body.append(selectionFlash);
let selectionFlashTimer = 0;
document.documentElement.style.setProperty('--level-complete-art', `url("${levelCompleteArt}")`);
document.documentElement.style.setProperty('--level-complete-banner-art', `url("${levelCompleteBannerArt}")`);
document.documentElement.style.setProperty('--boss-defeated-banner-art', `url("${bossDefeatedBannerArt}")`);
document.documentElement.style.setProperty('--level-fail-art', `url("${levelFailArt}")`);
document.documentElement.style.setProperty('--pause-art', `url("${pauseArt}")`);
document.documentElement.style.setProperty('--repair-art', `url("${repairArt}")`);
document.documentElement.style.setProperty('--weapon-icon-sheet', `url("${weaponIconSheet}")`);
document.documentElement.style.setProperty('--system-icon-sheet', `url("${systemIconSheet}")`);
document.documentElement.style.setProperty('--upgrade-icon-sheet-a', `url("${upgradeIconSheetA}")`);
document.documentElement.style.setProperty('--upgrade-icon-sheet-b', `url("${upgradeIconSheetB}")`);
if (buildVersionTag) buildVersionTag.textContent = BUILD_VERSION;
if (titleVersionTag) titleVersionTag.textContent = BUILD_VERSION;
exposeLocalContentModuleApi();
exposeSandboxApi();
exposeEncounterApi();
exposeNavigationApi();
exposeProceduralMusicApi();
exposeHapticApi();
annotateWeaponOptionIcons();
populateUpgradeSelect();
refreshSandboxContentOptions();
syncSandboxScript(loadSandboxDefinition());
refreshRepairTargets();
renderAchievements();
renderControlConfig();
if (window.matchMedia('(max-width: 700px), (pointer: coarse)').matches) combatPanel.classList.add('hidden');
const vehicleEditor = createPlayerVehicleLaunchEditor(
  {
    canvas: vehicleEditorCanvas,
    partSelect: vehiclePartSelect,
    placeButton: vehiclePlaceButton,
    eraseButton: vehicleEraseButton,
    connectButton: vehicleConnectButton,
    disconnectButton: vehicleDisconnectButton,
    autoConnectButton: vehicleAutoConnectButton,
    resetButton: vehicleResetButton,
    loadoutSelects: gunLoadoutSelects,
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
syncTitleScreen();
syncLaunchScreen();
syncAiLeadToggle();

function frame(now) {
  perfMonitor.beginFrame(now);
  const dt = Math.min(0.1, (now - previous) / 1000);
  previous = now;
  const keyInput = keyboard.read();
  const padInput = gamepad.read();
  pollPendingGamepadBinding();
  const virtualPointerEnabled = isVirtualPointerEnabled();
  updateVirtualPointer(virtualPointer, padInput, dt, virtualPointerEnabled);
  const padActionInput = virtualPointerEnabled
    ? {
      ...padInput,
      fireTogglePressed: false,
      aiLeadTogglePressed: false,
      secondaryCycle: 0,
      secondaryFirePressed: false,
      targetCycle: 0,
      targetCellCycle: 0,
      dodgePressed: false,
    }
    : padInput;
  const mouseInput = mouse.read();
  const movementSource = chooseMovementSource(keyInput, mouseInput, padActionInput);
  const primaryFireTogglePressed = keyInput.fireTogglePressed || padActionInput.fireTogglePressed || touchPrimaryFireToggle.consume();
  const aiLeadTogglePressed = keyInput.aiLeadTogglePressed || padActionInput.aiLeadTogglePressed || touchAiLeadToggle.consume();
  const touchBoostPressed = touchBoost.consume();
  const dodgeSource = keyInput.dodgePressed ? keyInput : padActionInput.dodgePressed ? padActionInput : touchBoostPressed ? mouseInput : null;
  const stickAimActive = Math.hypot(padActionInput.aimX ?? 0, padActionInput.aimY ?? 0) > 0.2;
  const targetCycle = keyInput.targetCycle || padActionInput.targetCycle || targetPreviousPressed.consume() * -1 || targetNextPressed.consume() || touchTargetCycle.consume();
  const targetCellCycle = keyInput.targetCellCycle || padActionInput.targetCellCycle || targetCellNextPressed.consume() || touchTargetCellCycle.consume();
  const encounterChoiceId = pendingEncounterChoiceId;
  pendingEncounterChoiceId = null;
  if (keyInput.gunnerTogglePressed || padActionInput.gunnerTogglePressed) gunnerToggle.checked = !gunnerToggle.checked;
  if (aiLeadTogglePressed) toggleAiShotLeading();
  updatePadReticle(padReticle, padActionInput, dt);
  const padAimWorld = padReticle.active && padReticle.idle <= 5 ? screenToWorld(padReticle, game.camera, viewport()) : null;
  const aimWorld = mouseInput.aimWorld ?? padAimWorld;
  game.aimReticle = aimWorld ? { ...aimWorld, active: true, source: mouseInput.aimWorld ? 'pointer' : 'gamepad' } : null;
  const input = {
    x: movementSource.x,
    y: movementSource.y,
    turn: targetingModeSelect.value === 'guided' ? 0 : keyInput.turn || padActionInput.turn,
    aimX: 0,
    aimY: 0,
    aimWorld,
    aimSource: mouseInput.aimWorld ? 'pointer' : 'gamepad',
    manualAimActive: stickAimActive || Boolean(mouseInput.aimWorld),
    manualAimHold: stickAimActive ? 5 : 0.45,
    gunnerEnabled: gunnerToggle.checked,
    compensatedAim: compensatedAimToggle.checked,
    fireHeld: false,
    brake: keyInput.brake || padActionInput.brake,
    debugTogglePressed: keyInput.debugTogglePressed || padActionInput.debugTogglePressed,
    fireTogglePressed: primaryFireTogglePressed,
    resetPressed: keyInput.resetPressed || restartButtonPressed.consume(),
    pausePressed: keyInput.pausePressed || padInput.pausePressed || pauseTogglePressed.consume() || resumeButtonPressed.consume(),
    controlsTogglePressed: keyInput.controlsTogglePressed || padActionInput.controlsTogglePressed,
    nextLevelPressed: nextLevelButtonPressed.consume(),
    shopRepairPressed: shopRepairPressed.consume(),
    shopRepairAllPressed: shopRepairAllPressed.consume(),
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
    secondaryCycle: keyInput.secondaryCycle || padActionInput.secondaryCycle || (touchSecondaryCycle.consume() ? 1 : 0),
    secondaryFirePressed:
      keyInput.secondaryFirePressed ||
      padActionInput.secondaryFirePressed ||
      mouseInput.firePressed ||
      touchSecondary.consume() ||
      touchSecondaryFloating.consume() ||
      pauseSecondaryPress.consume(),
    targetingMode: targetingModeSelect.value,
    targetCycle,
    targetCellCycle,
    targetCellType: targetCellTypeSelect.value,
    aiShotLeading,
    encounterConfirmPressed: keyInput.encounterConfirmPressed || padActionInput.encounterConfirmPressed,
    encounterCancelPressed: keyInput.encounterCancelPressed || padActionInput.encounterCancelPressed,
    encounterChoiceDelta: keyInput.encounterChoiceDelta || padActionInput.encounterChoiceDelta,
    encounterChoiceId,
  };
  if (
    input.shopRepairPressed ||
    input.shopRepairAllPressed ||
    input.shopReplacePressed ||
    input.shopRefillAmmoPressed ||
    input.shopBuyUpgradePressed ||
    input.nextLevelPressed
  ) {
    uiDirty.shop = true;
    uiDirty.pause = true;
  }
  perfMonitor.mark('input');
  configureRoadLaneForViewport(game.road, window.innerWidth, window.innerHeight);
  if (input.debugTogglePressed) toggleDebug();
  if (input.controlsTogglePressed) toggleControls();
  if (keyInput.hudTogglePressed || padActionInput.hudTogglePressed) toggleCombatHud();
  if (keyInput.controlConfigTogglePressed || padActionInput.controlConfigTogglePressed) toggleControlConfig();
  if (keyInput.achievementsTogglePressed || padActionInput.achievementsTogglePressed) toggleAchievements();
  if (keyInput.sandboxTogglePressed || padActionInput.sandboxTogglePressed) toggleSandboxPanel();
  if (!awaitingLaunch) {
    game.performanceDiagnostics = performanceDiagnostics.snapshot();
    const next = stepGame(game, input, dt);
    if (next !== game) {
      game = next;
      if (input.resetPressed) awaitingLaunch = true;
    }
  } else if (input.resetPressed) {
    game = createGame(1147, { vehicleDefinition: playerVehicleDefinition ?? undefined });
  }
  perfMonitor.mark('simulation');
  game.fps = game.fps * 0.9 + (1 / Math.max(dt, 0.001)) * 0.1;
  if (!performanceDiagnostics.state.noDomSync) {
    syncLaunchScreen();
    gameOver.classList.toggle('hidden', !game.gameOver);
    levelComplete.classList.toggle('hidden', !game.levelComplete);
    syncVictoryBanner();
    syncEncounterVignette();
    syncProgressHud();
    syncSandboxUi();
    refreshAchievementAwards();
    levelTime.textContent = game.levelTime.toFixed(1);
    targetingAiXpGain.textContent = (game.targetingAi?.lastLevelXp ?? 0).toFixed(1);
    levelNumber.textContent = game.level;
    levelsCompleted.textContent = game.levelsCompleted;
    updateShopUi(dt);
    syncPauseUi(mouseInput.aimWorld ?? padAimWorld, dt);
    boostFill.style.width = `${(game.boost.fuel / game.boost.maxFuel) * 100}%`;
    secondarySelect.value = game.secondary.selected;
    setIconElement(secondaryIcon, weaponIconDescriptor(game.secondary.selected));
    const selectedAmmo = game.secondary.ammo[game.secondary.selected];
    secondaryAmmo.textContent = selectedAmmo == null ? '-' : formatAmmoValue(selectedAmmo);
    secondaryHeat.style.width = `${game.secondary.heat}%`;
    primaryFireToggle.setAttribute('aria-pressed', String(game.autofire));
    primaryFireToggle.textContent = game.autofire ? 'FIRE' : 'QUIET';
    syncAiLeadToggle();
    syncTargetCellFocus();
    scrapCount.textContent = game.scrap;
    scoreDamage.textContent = game.score.damageDone;
  }
  perfMonitor.mark('ui');
  stepAmbientCameraSway(game, dt);
  const frontPageIdle = awaitingLaunch || titleActive;
  const shouldDrawGameCanvas = !frontPageIdle;
  canvas.hidden = !shouldDrawGameCanvas;
  if (shouldDrawGameCanvas) renderer.draw(game, debug);
  perfMonitor.mark('render');
  syncMusic();
  const audioCounters = playSoundEvents(game, now);
  syncContinuousSounds(game, now);
  syncAmbientSoundChains(game, now);
  playHapticEvents(game, now);
  frameAudioCounters.audioPlayCalls = audioCounters.audioPlayCalls;
  frameAudioCounters.enemyBulletSoundEvents = audioCounters.enemyBulletSoundEvents;
  perfMonitor.mark('audio');
  const monitorMode = performanceDiagnostics.monitorMode();
  const counters = monitorMode === 'off' ? undefined : frontPageIdle ? idlePerformanceCounters() : performanceCounters(game);
  game.performance = perfMonitor.endFrame(counters);
  scheduleNextFrame(frontPageIdle);
}

requestAnimationFrame(frame);

function scheduleNextFrame(frontPageIdle) {
  if (frontPageIdle) {
    window.setTimeout(() => requestAnimationFrame(frame), IDLE_FRONT_PAGE_FRAME_INTERVAL_MS);
    return;
  }
  requestAnimationFrame(frame);
}

bindButtonActivation(debugToggle, toggleDebug);
bindButtonActivation(hudToggle, toggleCombatHud);
bindButtonActivation(controlsToggle, toggleControls);
bindButtonActivation(sandboxToggle, toggleSandboxPanel);
bindButtonActivation(controlConfigToggle, toggleControlConfig);
bindButtonActivation(achievementsToggle, toggleAchievements);
bindButtonActivation(launchButton, launchVehicle);
bindButtonActivation(titleNormalRun, startNormalRun);
bindButtonActivation(titleSandboxRun, startTitleSandboxRun);
bindButtonActivation(titleVehicleBay, openVehicleBay);
bindButtonActivation(titleControls, openTitleControlConfig);
secondarySelect.addEventListener('change', syncSecondarySelects);
pauseSecondarySelect.addEventListener('change', syncSecondarySelects);
secondaryAutofire.addEventListener('change', syncSecondaryAutofire);
pauseSecondaryAutofire.addEventListener('change', syncSecondaryAutofire);
targetCellTypeSelect.addEventListener('change', () => { uiDirty.pause = true; });
shopRepairTab.addEventListener('click', () => setShopSection('repair'));
shopUpgradeTab.addEventListener('click', () => setShopSection('upgrades'));
shopRepairTab.addEventListener('keydown', handleShopTabKeydown);
shopUpgradeTab.addEventListener('keydown', handleShopTabKeydown);
shopRepairTarget.addEventListener('change', markShopUiDirty);
shopAmmoSelect.addEventListener('change', markShopUiDirty);
shopUpgradeSystemSelect.addEventListener('change', () => {
  refreshUpgradeOptions();
  markShopUiDirty();
});
shopUpgradeSelect.addEventListener('change', markShopUiDirty);
controlConfigClose.addEventListener('click', closeControlConfig);
controlConfigReset.addEventListener('click', resetControlBindings);
sandboxQuickRun.addEventListener('click', runQuickSandbox);
sandboxScriptRun.addEventListener('click', runScriptSandbox);
sandboxStop.addEventListener('click', stopSandbox);
sandboxRefresh.addEventListener('click', () => {
  refreshSandboxContentOptions();
  sandboxStatus.textContent = 'Sandbox content refreshed.';
});
sandboxContentInput.addEventListener('change', importSandboxContentFiles);
sandboxPlayLevel.addEventListener('click', playSelectedSandboxLevel);
sandboxLoadoutToggle.addEventListener('click', toggleSandboxLoadout);
sandboxApplyUpgrade.addEventListener('click', applySandboxLoadoutUpgrade);
sandboxRepairVehicle.addEventListener('click', repairSandboxLoadoutVehicle);
sandboxRefillAmmo.addEventListener('click', refillSandboxLoadoutAmmo);
sandboxEnemySelect.addEventListener('change', updateSandboxScriptFromQuick);
sandboxCountInput.addEventListener('input', updateSandboxScriptFromQuick);
sandboxFrequencyInput.addEventListener('input', updateSandboxScriptFromQuick);
sandboxSpreadInput.addEventListener('input', updateSandboxScriptFromQuick);
sandboxLevelInput.addEventListener('input', updateSandboxScriptFromQuick);
window.addEventListener('keydown', captureKeyboardBinding, { capture: true });
const pauseTogglePressed = createButtonPress(pauseToggle);
const resumeButtonPressed = createButtonPress(resumeButton);
const targetPreviousPressed = createButtonPress(targetPreviousButton);
const targetNextPressed = createButtonPress(targetNextButton);
const targetCellNextPressed = createButtonPress(targetCellNextButton);
const nextLevelButtonPressed = createButtonPress(nextLevelButton);
const restartButtonPressed = createButtonPress(restartButton);
const shopRepairPressed = createButtonPress(shopRepairButton);
const shopRepairAllPressed = createButtonPress(shopRepairAllButton);
const shopReplacePressed = createButtonPress(shopReplaceButton);
const shopRefillAmmoPressed = createButtonPress(shopRefillAmmoButton);
const shopBuyUpgradePressed = createButtonPress(shopBuyUpgradeButton);
exportSaveButton.addEventListener('click', exportCurrentSave);
importSaveButton.addEventListener('click', () => importSaveInput.click());
importSaveInput.addEventListener('change', importSelectedSave);

function toggleControls() {
  controlsPanel.classList.toggle('hidden');
}

function toggleControlConfig() {
  controlConfigPanel.classList.toggle('hidden');
}

function closeControlConfig() {
  pendingControlCapture = null;
  controlConfigPanel.classList.add('hidden');
}

function toggleAchievements() {
  achievementsPanel.classList.toggle('hidden');
}

function toggleSandboxPanel() {
  sandboxPanel.classList.toggle('hidden');
  sandboxToggle.setAttribute('aria-pressed', String(!sandboxPanel.classList.contains('hidden')));
}

function toggleSandboxLoadout() {
  const visible = sandboxLoadoutPanel.classList.toggle('hidden') === false;
  sandboxLoadoutToggle.setAttribute('aria-pressed', String(visible));
  if (visible) refreshSandboxLoadoutOptions();
}

function refreshSandboxLoadoutOptions() {
  const selected = sandboxUpgradeSelect.value;
  const upgrades = availableUpgradeDefinitions(game, game.account, game.vehicleDefinition);
  sandboxUpgradeSelect.replaceChildren(
    new Option('All installed upgrades', 'all'),
    ...upgrades.map((upgrade) => new Option(`${upgrade.system}: ${upgrade.label}`, upgrade.id)),
  );
  sandboxUpgradeSelect.value = selected === 'all' || upgrades.some((upgrade) => upgrade.id === selected) ? selected : 'all';
}

function applySandboxLoadoutUpgrade() {
  if (!game.sandbox?.enabled) {
    sandboxStatus.textContent = 'Start a sandbox run before changing its loadout.';
    return;
  }
  const level = Math.max(0, Math.min(99, Math.trunc(Number(sandboxUpgradeLevel.value) || 0)));
  const selected = sandboxUpgradeSelect.value;
  const result = configureSandboxLoadout(game, selected === 'all'
    ? { allUpgradeLevel: level }
    : { upgradeLevels: { [selected]: level } });
  sandboxStatus.textContent = `Sandbox loadout updated: ${result.applied.length} upgrade${result.applied.length === 1 ? '' : 's'} set to level ${level}.`;
  uiDirty.shop = true;
}

function repairSandboxLoadoutVehicle() {
  if (!game.sandbox?.enabled) {
    sandboxStatus.textContent = 'Start a sandbox run before repairing its vehicle.';
    return;
  }
  const result = repairSandboxVehicle(game);
  sandboxStatus.textContent = result.changed
    ? `Sandbox vehicle restored: ${result.replaced} cells replaced and ${Math.ceil(result.repaired)} damage repaired.`
    : 'Sandbox vehicle is already fully repaired.';
}

function refillSandboxLoadoutAmmo() {
  if (!game.sandbox?.enabled) {
    sandboxStatus.textContent = 'Start a sandbox run before refilling its ammo.';
    return;
  }
  const refilled = refillSandboxAmmo(game);
  sandboxStatus.textContent = refilled ? `Refilled ${refilled} sandbox ammo reserve${refilled === 1 ? '' : 's'}.` : 'Sandbox ammo is already full.';
}

function syncSecondarySelects(event) {
  const value = event?.target?.value;
  if (!value) return;
  secondarySelect.value = value;
  pauseSecondarySelect.value = value;
}

function syncSecondaryAutofire(event) {
  const checked = Boolean(event?.target?.checked);
  secondaryAutofire.checked = checked;
  pauseSecondaryAutofire.checked = checked;
}

function markShopUiDirty() {
  uiDirty.shop = true;
}

function setShopSection(section) {
  activeShopSection = section === 'upgrades' ? 'upgrades' : 'repair';
  shopRepairAmmoSection.classList.toggle('hidden', activeShopSection !== 'repair');
  shopUpgradesSection.classList.toggle('hidden', activeShopSection !== 'upgrades');
  shopRepairTab.setAttribute('aria-pressed', String(activeShopSection === 'repair'));
  shopUpgradeTab.setAttribute('aria-pressed', String(activeShopSection === 'upgrades'));
  markShopUiDirty();
}

function blurActiveControl() {
  document.activeElement?.blur?.();
}

function handleShopTabKeydown(event) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  const nextSection = activeShopSection === 'repair' ? 'upgrades' : 'repair';
  setShopSection(nextSection);
  const button = nextSection === 'repair' ? shopRepairTab : shopUpgradeTab;
  button.focus();
  flashElementLabel(button, button.textContent.trim());
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
  blurActiveControl();
  titleActive = false;
  awaitingLaunch = false;
  game.levelStartTime = game.time;
  previous = performance.now();
  scheduleSoundPrewarm();
  syncMusic(true);
  syncTitleScreen();
  syncLaunchScreen();
}

function startNormalRun() {
  titleActive = false;
  closeControlConfig();
  if (awaitingLaunch) {
    launchVehicle();
    return;
  }
  syncTitleScreen();
}

function startTitleSandboxRun() {
  titleActive = false;
  closeControlConfig();
  runQuickSandbox();
  syncTitleScreen();
}

function openVehicleBay() {
  titleActive = false;
  closeControlConfig();
  if (!awaitingLaunch) {
    game = createGame(1147, { vehicleDefinition: playerVehicleDefinition ?? undefined });
    awaitingLaunch = true;
    refreshRepairTargets();
  }
  previous = performance.now();
  syncTitleScreen();
  syncLaunchScreen();
}

function openTitleControlConfig() {
  controlConfigPanel.classList.remove('hidden');
  controlConfigStatus.textContent = controlConfigStatus.textContent || 'Control bindings ready.';
}

function runQuickSandbox() {
  const definition = quickSandboxDefinition();
  syncSandboxScript(definition);
  startSandbox(definition);
}

function runScriptSandbox() {
  try {
    const definition = JSON.parse(sandboxScriptInput.value);
    const report = validateSandboxDefinition(definition);
    if (!report.valid) {
      sandboxStatus.textContent = `Sandbox rejected: ${report.errors.join(' ')}`;
      return;
    }
    startSandbox(report.definition);
  } catch (error) {
    sandboxStatus.textContent = `Sandbox parse failed: ${error.message}`;
  }
}

function startSandbox(definition, suppliedRuntime = null) {
  const runtime = suppliedRuntime ?? localSandboxRuntimeOptions();
  try {
    titleActive = false;
    closeControlConfig();
    if (game.sandbox?.enabled && !definition.sourceLevelId) {
      applySandboxDefinitionToGame(game, definition, runtime);
    } else {
      game = createGame(1147, {
        vehicleDefinition: playerVehicleDefinition ?? undefined,
        sandbox: definition,
        terrainRoute: definition.route ?? undefined,
        environmentLighting: definition.lighting ?? undefined,
        ...runtime,
      });
    }
    renderer.setContentRegistry(runtime.registry);
    blurActiveControl();
    awaitingLaunch = false;
    game.paused = false;
    game.levelStartTime = game.time;
    previous = performance.now();
    scheduleSoundPrewarm();
    localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(definition));
    refreshRepairTargets();
    syncTitleScreen();
    syncLaunchScreen();
    syncMusic(true);
    sandboxStatus.textContent = `Sandbox running: ${definition.title}`;
  } catch (error) {
    sandboxStatus.textContent = `Sandbox failed: ${error.message}`;
  }
}

async function importSandboxContentFiles() {
  const files = sandboxContentInput.files;
  if (!files?.length) return;
  sandboxStatus.textContent = `Importing ${files.length} content file${files.length === 1 ? '' : 's'}...`;
  try {
    const result = await installLocalContentFiles(files, { displayName: 'Sandbox Import' });
    if (!result.ok) {
      sandboxStatus.textContent = `Import rejected: ${result.errors.join(' ')}`;
      return;
    }
    refreshSandboxContentOptions();
    const warning = result.warnings.length ? ` ${result.warnings.join(' ')}` : '';
    sandboxStatus.textContent = `Imported ${result.installedPacks.length} local pack${result.installedPacks.length === 1 ? '' : 's'}.${warning}`;
  } catch (error) {
    sandboxStatus.textContent = `Import failed: ${error.message}`;
  } finally {
    sandboxContentInput.value = '';
  }
}

function playSelectedSandboxLevel() {
  const levelId = sandboxLevelSelect.value;
  if (!levelId) {
    sandboxStatus.textContent = 'Import and select a custom level first.';
    return;
  }
  try {
    const runtime = localSandboxRuntimeOptions();
    const runPackage = instantiateLocalLevel(levelId, { storage: localStorage, registry: runtime.registry, seed: 1147 });
    const definition = sandboxDefinitionFromLevel(runPackage.definition);
    syncSandboxScript(definition);
    startSandbox(definition, runtime);
  } catch (error) {
    sandboxStatus.textContent = `Custom level failed: ${error.message}`;
  }
}

function refreshSandboxContentOptions() {
  populateSandboxEnemySelect();
  populateSandboxLevelSelect();
}

function populateSandboxLevelSelect() {
  const selected = sandboxLevelSelect.value;
  const runtime = localSandboxRuntimeOptions();
  const levels = [...(runtime.registry.assets.get('level')?.values() ?? [])]
    .sort((a, b) => (a.displayName ?? a.assetId).localeCompare(b.displayName ?? b.assetId));
  sandboxLevelSelect.replaceChildren(
    new Option(levels.length ? 'Select custom level' : 'No custom levels installed', ''),
    ...levels.map((level) => new Option(level.displayName ?? level.title ?? level.assetId, level.assetId)),
  );
  if (levels.some((level) => level.assetId === selected)) sandboxLevelSelect.value = selected;
}

function localSandboxRuntimeOptions() {
  const { registry } = createRegistryWithLocalContent(localStorage);
  return {
    registry,
    enemyArchetypes: [...(registry.assets.get('enemyArchetype')?.values() ?? [])].flatMap((pack) => pack.archetypes ?? []),
    constructDefinitions: [...(registry.assets.get('construct')?.values() ?? [])],
    patternDefinitions: [...(registry.assets.get('pattern')?.values() ?? [])],
    voxelModels: [...(registry.assets.get('voxelModel')?.values() ?? [])],
    encounters: [...(registry.assets.get('encounter')?.values() ?? [])],
  };
}

function stopSandbox() {
  game = createGame(1147, { vehicleDefinition: playerVehicleDefinition ?? undefined });
  awaitingLaunch = true;
  titleActive = true;
  previous = performance.now();
  refreshRepairTargets();
  syncTitleScreen();
  syncLaunchScreen();
  sandboxStatus.textContent = 'Sandbox stopped.';
}

function syncTitleScreen() {
  titleScreen.hidden = !titleActive;
  titleScreen.classList.toggle('hidden', !titleActive);
  titleScreen.setAttribute('aria-hidden', String(!titleActive));
  document.body.classList.toggle('title-active', titleActive);
}

function syncLaunchScreen() {
  const visible = awaitingLaunch && !titleActive;
  launchScreen.hidden = !visible;
  launchScreen.classList.toggle('hidden', !visible);
  launchScreen.style.display = visible ? 'grid' : 'none';
  launchScreen.setAttribute('aria-hidden', String(!visible));
}

function syncPauseUi(hoverWorld = null, dt = 0) {
  const visible = Boolean(game.paused);
  pauseScreen.classList.toggle('hidden', !visible);
  pauseScreen.setAttribute('aria-hidden', String(!visible));
  pauseToggle.setAttribute('aria-pressed', String(visible));
  if (!visible) {
    pauseUiWasVisible = false;
    uiTimers.pause = 0;
    return;
  }
  if (!pauseUiWasVisible) {
    pauseUiWasVisible = true;
    uiDirty.pause = true;
  }
  uiTimers.pause += dt;
  if (!uiDirty.pause && uiTimers.pause < 0.2) return;
  uiDirty.pause = false;
  uiTimers.pause = 0;
  if (!TARGETING_MODES.includes(targetingModeSelect.value)) targetingModeSelect.value = 'mixed';
  targetingModeSelect.value = game.targetingMode ?? targetingModeSelect.value;
  syncTargetCellFocus();
  pauseSecondarySelect.value = secondarySelect.value;
  pauseSecondaryAutofire.checked = secondaryAutofire.checked;
  pauseLevelNumber.textContent = game.level;
  pauseScrapCount.textContent = game.scrap;
  pauseDamageDone.textContent = game.score.damageDone;
  if (!saveStatus.textContent) saveStatus.textContent = 'Save exports restore run progress as a checkpoint.';
  renderModuleStatus();
  renderTargetInfo(hoverWorld);
}

function exportCurrentSave() {
  const save = createSaveState(game, playerAccount);
  const blob = new Blob([`${JSON.stringify(save, null, 2)}\n`], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `weyfinder-save-level-${game.level}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  saveStatus.textContent = 'Save exported.';
}

async function importSelectedSave() {
  const file = importSaveInput.files?.[0];
  importSaveInput.value = '';
  if (!file) return;
  try {
    const save = JSON.parse(await file.text());
    const report = validateSaveState(save);
    if (!report.valid) {
      saveStatus.textContent = `Save rejected: ${report.errors.join(' ')}`;
      return;
    }
    if (report.sandboxRequired && !window.confirm('This save was edited or is unofficial. Load it as sandbox progress?')) {
      saveStatus.textContent = 'Save import canceled.';
      return;
    }
    playerAccount = save.payload.playerAccount ? normalizePrototypePlayerAccountData(save.payload.playerAccount) : playerAccount;
    playerVehicleDefinition = save.payload.vehicleDefinition ?? playerAccount.savedVehicle;
    savePlayerAccount();
    game = createGame(save.payload.seed ?? 1147, {
      vehicleDefinition: playerVehicleDefinition ?? undefined,
      levelMusic: game.levelMusic,
      startLevel: save.payload.level,
    });
    applySaveStateToGame(game, save);
    awaitingLaunch = false;
    previous = performance.now();
    refreshRepairTargets();
    renderAchievements();
    syncLaunchScreen();
    saveStatus.textContent = report.official ? 'Official save loaded.' : 'Sandbox save loaded.';
  } catch (error) {
    saveStatus.textContent = `Save import failed: ${error.message}`;
  }
}

function quickSandboxDefinition(options = {}) {
  const enemyId = sandboxEnemySelect.value || DEFAULT_SANDBOX_DEFINITION.spawns[0].archetype;
  return sandboxDefinitionFromEnemy(enemyId, {
    count: numericInputValue(sandboxCountInput, 1),
    frequency: numericInputValue(sandboxFrequencyInput, 0),
    spread: numericInputValue(sandboxSpreadInput, 72),
    level: numericInputValue(sandboxLevelInput, 1),
    title: 'Sandbox Level',
    ...options,
  });
}

function loadSandboxDefinition() {
  try {
    return JSON.parse(localStorage.getItem(SANDBOX_STORAGE_KEY)) ?? DEFAULT_SANDBOX_DEFINITION;
  } catch {
    return DEFAULT_SANDBOX_DEFINITION;
  }
}

function syncSandboxScript(definition) {
  sandboxScriptInput.value = `${JSON.stringify(definition, null, 2)}\n`;
}

function updateSandboxScriptFromQuick() {
  syncSandboxScript(quickSandboxDefinition());
}

function numericInputValue(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function populateSandboxEnemySelect() {
  const selected = sandboxEnemySelect.value;
  const options = sandboxEnemyOptions();
  sandboxEnemySelect.replaceChildren(
    ...options.map((enemy) => {
      const option = document.createElement('option');
      option.value = enemy.id;
      option.textContent = `${enemy.displayName ?? enemy.id} (${enemy.id})`;
      return option;
    }),
  );
  sandboxEnemySelect.value = options.some((enemy) => enemy.id === selected) ? selected : options[0]?.id ?? '';
}

function sandboxEnemyOptions() {
  const byId = new Map();
  for (const archetype of [...listEnemyArchetypes(), ...localEnemyArchetypes()]) {
    if (archetype?.id) byId.set(archetype.id, archetype);
  }
  byId.set('mortar_skiff.prototype0', {
    id: 'mortar_skiff.prototype0',
    displayName: 'Mortar Skiff',
  });
  byId.set('boss.zeppelin.prototype0', {
    id: 'boss.zeppelin.prototype0',
    displayName: 'Prototype Zeppelin Boss',
  });
  byId.set('boss.pirate_dreadnought.prototype0', {
    id: 'boss.pirate_dreadnought.prototype0',
    displayName: 'Pirate Dreadnought Boss',
  });
  byId.set('shadowed_road_mine_dropper.prototype0', {
    id: 'shadowed_road_mine_dropper.prototype0',
    displayName: 'Shadowed Road Mine Dropper',
  });
  byId.set('boss.shadowed_road_hotrod.prototype0', {
    id: 'boss.shadowed_road_hotrod.prototype0',
    displayName: 'Shadowed Road Hotrod Boss',
  });
  return [...byId.values()].sort((a, b) => (a.displayName ?? a.id).localeCompare(b.displayName ?? b.id));
}

function localEnemyArchetypes() {
  try {
    const { registry, ok } = createRegistryWithLocalContent(localStorage);
    if (!ok) return [];
    return [...(registry.assets.get('enemyArchetype')?.values() ?? [])].flatMap((pack) => (Array.isArray(pack.archetypes) ? pack.archetypes : []));
  } catch {
    return [];
  }
}

function syncSandboxUi() {
  const enabled = Boolean(game.sandbox?.enabled);
  sandboxToggle.setAttribute('aria-pressed', String(enabled || !sandboxPanel.classList.contains('hidden')));
  if (!enabled || sandboxPanel.classList.contains('hidden')) return;
  const pending = game.enemySpawnQueue.length;
  const active = game.enemies.filter((enemy) => !enemy.destroyed).length;
  sandboxStatus.textContent = game.sandbox.lastMessage || `Sandbox active: ${active} active, ${pending} queued.`;
}

function syncVictoryBanner() {
  if (!victoryBanner) return;
  const banner = game.victoryBanner;
  const visible = Boolean(banner && !game.levelComplete && !game.gameOver && !awaitingLaunch);
  victoryBanner.classList.toggle('hidden', !visible);
  if (!visible) return;
  victoryBanner.dataset.kind = banner.kind === 'boss' ? 'boss' : 'level';
  const progress = Math.max(0, banner.elapsed ?? 0);
  const frame = Math.min(7, Math.floor(progress * 8) % 8);
  const column = frame % 4;
  const row = Math.floor(frame / 4);
  victoryBanner.style.backgroundPosition = `${column * 33.3333}% ${row * 100}%`;
}

function syncEncounterVignette() {
  if (!encounterVignette) return;
  const view = activeEncounterView(game);
  const visible =
    Boolean(view) &&
    (view.presentationMode === 'modalChoicePaused' || view.presentationMode === 'worldHoldInteraction') &&
    !awaitingLaunch &&
    !titleActive;
  encounterVignette.classList.toggle('hidden', !visible);
  encounterVignette.setAttribute('aria-hidden', String(!visible));
  if (!visible) {
    lastEncounterViewKey = '';
    return;
  }
  const viewKey = JSON.stringify({
    instanceId: view.instanceId,
    stateId: view.stateId,
    body: view.body,
    choices: view.choices.map((choice) => [choice.id, choice.label, choice.available]),
    selectedChoiceIndex: view.selectedChoiceIndex,
  });
  if (viewKey === lastEncounterViewKey) return;
  lastEncounterViewKey = viewKey;
  encounterSpeaker.textContent = view.speaker || '';
  encounterSpeaker.hidden = !view.speaker;
  encounterTitle.textContent = view.title || 'The Road Pauses';
  encounterBody.textContent = view.body || '';
  encounterPrompt.textContent = view.prompt || '';
  encounterChoices.replaceChildren(
    ...view.choices.map((choice, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = index === view.selectedChoiceIndex ? 'selected' : '';
      button.disabled = choice.available === false;
      button.setAttribute('aria-current', String(index === view.selectedChoiceIndex));
      button.textContent = choice.disabledReason ? `${choice.label} - ${choice.disabledReason}` : choice.label;
      button.addEventListener('click', () => {
        pendingEncounterChoiceId = choice.id;
      });
      return button;
    }),
  );
}

function syncMusic(forcePlay = false) {
  const musicPlan = game.music ?? { baseTrack: game.currentMusic, layerVolumes: {} };
  const cue = consumeProceduralMusicCue(game.music);
  if (cue) lastProceduralMusicCue = cue;
  const trackName = musicPlan.baseTrack ?? game.currentMusic;
  const src = MUSIC_URLS[trackName];
  if (!src || awaitingLaunch || game.gameOver || game.levelComplete || game.paused) {
    musicAudio.pause();
    pauseMusicLayers();
    return;
  }
  if (trackName !== activeMusicTrack) {
    activeMusicTrack = trackName;
    musicAudio.src = src;
    musicAudio.currentTime = 0;
  }
  musicAudio.volume = BASE_MUSIC_VOLUME * (0.86 + (musicPlan.layerVolumes?.travel ?? 1) * 0.14);
  if (forcePlay || musicAudio.paused) musicAudio.play().catch(() => {});
  syncMusicLayers(trackName, musicPlan, forcePlay);
}

function syncMusicLayers(trackName, musicPlan, forcePlay = false) {
  const urls = MUSIC_LAYER_URLS[trackName] ?? {};
  for (const layer of Object.values(MUSIC_LAYERS)) {
    const player = musicLayerPlayerFor(trackName, layer, urls[layer]);
    if (!player) continue;
    const targetVolume = (musicPlan.layerVolumes?.[layer] ?? 0) * LAYER_MUSIC_VOLUME;
    player.volume = targetVolume;
    if (targetVolume <= 0.004) {
      player.pause();
      continue;
    }
    if (forcePlay || player.paused) player.play().catch(() => {});
  }
}

function pauseMusicLayers() {
  for (const player of musicLayerPlayers.values()) player.pause();
}

function musicLayerPlayerFor(trackName, layer, src) {
  if (!src) return null;
  const key = `${trackName}:${layer}`;
  if (!musicLayerPlayers.has(key)) {
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = 0;
    audio.preload = 'auto';
    musicLayerPlayers.set(key, audio);
  }
  const player = musicLayerPlayers.get(key);
  if (player.src !== src) {
    player.src = src;
    player.currentTime = musicAudio.currentTime;
  } else if (Math.abs(player.currentTime - musicAudio.currentTime) > 0.18) {
    player.currentTime = musicAudio.currentTime;
  }
  return player;
}

function playSoundEvents(game, now = performance.now()) {
  const counters = { audioPlayCalls: 0, enemyBulletSoundEvents: 0 };
  if (awaitingLaunch) {
    consumeSoundEvents(game);
    return counters;
  }
  if (performanceDiagnostics.state.noSfx) {
    consumeSoundEvents(game);
    return counters;
  }
  for (const event of consumeSoundEvents(game)) {
    const src = resolveSoundSource(event.id);
    if (!src) continue;
    if (event.id === SOUND_EVENTS.ENEMY_BULLET) counters.enemyBulletSoundEvents += 1;
    if (performanceDiagnostics.state.noEnemyBulletSfx && event.id === SOUND_EVENTS.ENEMY_BULLET) continue;
    if (!soundEventAllowed(event.id, now)) continue;
    const player = soundPlayerFor(src);
    player.volume = soundEventVolume(event.id);
    player.currentTime = 0;
    player.play().catch(() => {});
    counters.audioPlayCalls += 1;
  }
  return counters;
}

function resolveSoundSource(id) {
  const source = SOUND_URLS[id];
  if (!Array.isArray(source)) return source;
  if (source.length === 0) return null;
  return source[Math.floor(Math.random() * source.length)] ?? source[0];
}

function soundEventVolume(id) {
  if (id === SOUND_EVENTS.PLAYER_MAIN_GUN) return 0.24;
  if (id === SOUND_EVENTS.PLAYER_MORTAR_FIRE) return 0.5;
  if (id === SOUND_EVENTS.PLAYER_CELL_LOSS) return 0.58;
  if (id === SOUND_EVENTS.ENEMY_MORTAR_FIRE) return 0.46;
  if (id === SOUND_EVENTS.BULLET_RICOCHET || id === SOUND_EVENTS.GLAIVE_BOUNCE) return 0.34;
  if (id === SOUND_EVENTS.METAL_SLASH) return 0.42;
  if (id === SOUND_EVENTS.LASER_SCORCH_PULSED || id === SOUND_EVENTS.ENEMY_BEAM_POWERUP) return 0.4;
  if (id === SOUND_EVENTS.POWER_DOWN) return 0.36;
  if (id.startsWith('boss-main-explosion')) return 0.72;
  if (id.startsWith('boss-internal-explosion')) return 0.56;
  if (id.startsWith('pirate-boss') || id.startsWith('kraken')) return 0.62;
  if (id.startsWith('pirate-')) return 0.54;
  return 0.48;
}

function playHapticEvents(game, now = performance.now()) {
  if (awaitingLaunch || performanceDiagnostics.state.noSfx) {
    consumeHapticEvents(game);
    hapticPulseQueue.length = 0;
    return;
  }
  for (const event of consumeHapticEvents(game)) {
    const pattern = hapticPatternForEvent(event);
    if (!pattern) continue;
    if (pattern.kind === 'rolling') {
      queueRollingHaptic(pattern.durationMs, pattern.intervalMs, pattern.weakMagnitude, pattern.strongMagnitude, pattern.pulseMs, pattern.jitterMs);
      continue;
    }
    triggerHapticPulse(pattern, now);
  }
  stepQueuedHaptics(now);
}

function hapticPatternForEvent(event) {
  if (event.id === HAPTIC_EVENTS.PLAYER_VOXEL_DAMAGE) {
    return {
      durationMs: event.durationMs ?? 70,
      weakMagnitude: event.intensity ?? 0.14,
      strongMagnitude: 0.02,
    };
  }
  if (event.id === HAPTIC_EVENTS.PLAYER_CELL_LOSS) {
    return {
      durationMs: Math.min(1000, event.durationMs ?? 320),
      weakMagnitude: event.weakMagnitude ?? Math.min(1, (event.intensity ?? 0.45) * 0.75),
      strongMagnitude: event.strongMagnitude ?? event.intensity ?? 0.45,
    };
  }
  if (event.id === HAPTIC_EVENTS.PLAYER_WEAPON_FIRE) return weaponFireHapticPattern(event.weapon);
  if (event.id === HAPTIC_EVENTS.AMBIENT_OCEAN_WAVES) {
    return { kind: 'rolling', durationMs: 5000, intervalMs: 650, pulseMs: 120, weakMagnitude: 0.07, strongMagnitude: 0.015, jitterMs: 120 };
  }
  if (event.id === HAPTIC_EVENTS.AMBIENT_ROLLING_THUNDER) {
    return { kind: 'rolling', durationMs: event.durationMs ?? 2800, intervalMs: 360, pulseMs: 150, weakMagnitude: 0.2, strongMagnitude: 0.32, jitterMs: 180 };
  }
  if (event.id === HAPTIC_EVENTS.AMBIENT_STORM_WIND) {
    return { kind: 'rolling', durationMs: 3400, intervalMs: 320, pulseMs: 170, weakMagnitude: 0.24, strongMagnitude: 0.12, jitterMs: 100 };
  }
  if (event.durationMs || event.weakMagnitude || event.strongMagnitude || event.intensity) {
    return {
      durationMs: event.durationMs ?? 100,
      weakMagnitude: event.weakMagnitude ?? event.intensity ?? 0.15,
      strongMagnitude: event.strongMagnitude ?? 0,
    };
  }
  return null;
}

function weaponFireHapticPattern(weapon) {
  if (weapon === 'cannon') return { durationMs: 95, weakMagnitude: 0.18, strongMagnitude: 0.28 };
  if (weapon === 'mortar') return { durationMs: 85, weakMagnitude: 0.16, strongMagnitude: 0.22 };
  if (weapon === 'rocket' || weapon === 'sta_missile') return { durationMs: 80, weakMagnitude: 0.14, strongMagnitude: 0.2 };
  return { durationMs: 55, weakMagnitude: 0.08, strongMagnitude: 0.08 };
}

function queueRollingHaptic(durationMs, intervalMs, weakMagnitude, strongMagnitude, pulseMs, jitterMs = 0) {
  const now = performance.now();
  for (let time = now; time < now + durationMs; time += Math.max(60, intervalMs + (Math.random() * 2 - 1) * jitterMs)) {
    hapticPulseQueue.push({ at: time, durationMs: pulseMs, weakMagnitude, strongMagnitude });
  }
}

function stepQueuedHaptics(now = performance.now()) {
  hapticPulseQueue.sort((a, b) => a.at - b.at);
  while (hapticPulseQueue.length && hapticPulseQueue[0].at <= now) triggerHapticPulse(hapticPulseQueue.shift(), now);
  while (hapticPulseQueue.length > 96) hapticPulseQueue.pop();
}

function triggerHapticPulse(pattern, now = performance.now()) {
  if (now - hapticLastPulseAt < HAPTIC_MIN_INTERVAL_MS) return;
  hapticLastPulseAt = now;
  const duration = Math.max(1, Math.min(1000, pattern.durationMs ?? 80));
  const weakMagnitude = Math.max(0, Math.min(1, pattern.weakMagnitude ?? pattern.intensity ?? 0));
  const strongMagnitude = Math.max(0, Math.min(1, pattern.strongMagnitude ?? 0));
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
  for (const pad of pads) {
    const actuator = pad.vibrationActuator ?? pad.hapticActuators?.[0];
    if (actuator?.playEffect) {
      actuator.playEffect('dual-rumble', { duration, weakMagnitude, strongMagnitude }).catch?.(() => {});
    } else if (actuator?.pulse) {
      actuator.pulse(Math.max(weakMagnitude, strongMagnitude), duration).catch?.(() => {});
    }
  }
  if (typeof navigator !== 'undefined' && navigator.vibrate && Math.max(weakMagnitude, strongMagnitude) >= 0.12) {
    navigator.vibrate(Math.min(duration, 250));
  }
}

function soundEventAllowed(id, now) {
  const interval = SOUND_MIN_INTERVAL_MS.get(id) ?? 0;
  if (interval <= 0) return true;
  const previousPlay = lastSoundPlayedAt.get(id) ?? -Infinity;
  if (now - previousPlay < interval) return false;
  lastSoundPlayedAt.set(id, now);
  return true;
}

function syncContinuousSounds(game, now) {
  const active = !awaitingLaunch
    && !titleActive
    && !game.gameOver
    && !game.paused
    && !performanceDiagnostics.state.noSfx
    && hasActiveGroundLaser(game);
  syncLoopingSound('ground-laser-scorch', LASER_SCORCH_LOOP_URL, active, 0.22, now);
}

function hasActiveGroundLaser(game) {
  return game.enemyProjectiles?.some((projectile) => (
    projectile.lifetime > 0
    && projectile.behavior === 'beam'
    && projectile.endZ === 0
    && (projectile.weapon === 'walker-ground-sweep' || projectile.weapon === 'zeppelin-ground-laser')
  ));
}

function syncLoopingSound(key, src, active, volume, now) {
  if (!src) return;
  let player = continuousSoundLoops.get(key);
  if (!player) {
    player = soundPlayerFor(src);
    player.loop = true;
    continuousSoundLoops.set(key, player);
  }
  if (active) {
    player.volume = volume;
    if (player.paused) player.play().catch(() => {});
    return;
  }
  if (!player.paused) {
    player.pause();
    player.currentTime = 0;
    const powerDown = resolveSoundSource(SOUND_EVENTS.POWER_DOWN);
    if (powerDown && soundEventAllowed(SOUND_EVENTS.POWER_DOWN, now)) {
      const powerDownPlayer = soundPlayerFor(powerDown);
      powerDownPlayer.volume = soundEventVolume(SOUND_EVENTS.POWER_DOWN);
      powerDownPlayer.currentTime = 0;
      powerDownPlayer.play().catch(() => {});
    }
  }
}

function syncAmbientSoundChains(game, now) {
  const activeKeys = !awaitingLaunch
    && !titleActive
    && !game.gameOver
    && !game.paused
    && !performanceDiagnostics.state.noSfx
    ? ambientKeysForTrack(game.music?.baseTrack ?? game.currentMusic)
    : [];
  const activeSet = new Set(activeKeys);
  for (const key of Object.keys(AMBIENT_SOUND_URLS)) {
    if (!activeSet.has(key)) {
      stopAmbientChain(key);
      continue;
    }
    stepAmbientChain(game, key, now);
  }
}

function ambientKeysForTrack(trackName = '') {
  const keys = [];
  if (/^(?:DigitizedStream|PiratesRoad)_/i.test(trackName)) keys.push('ocean');
  if (/^(?:GhostForrestPathway|GhostForrestBanshee)_/i.test(trackName)) keys.push('forest');
  if (/^(?:Freedoms?Pass_StormsOfFatesShadow|Freedoms?Pass_BossFight|ShadowedDesert_OminousStormfront|ShadowedDesert_BossFight)/i.test(trackName)) {
    keys.push('thunder');
  }
  if (/^(?:Freedoms?Pass_StormsOfFatesShadow|Freedoms?Pass_BossFight|Freedoms?Pass_DarkeningSkies|ShadowedDesert_OminousStormfront|ShadowedDesert_BossFight|ShadowedDesert_Journey)/i.test(trackName)) {
    keys.push('wind');
  }
  return keys;
}

function stepAmbientChain(game, key, now) {
  const sources = AMBIENT_SOUND_URLS[key]?.filter(Boolean) ?? [];
  if (sources.length === 0) return;
  const state = ambientSoundStates.get(key) ?? { nextAt: now + randomAmbientRestMs(sources), chainRemaining: 0, player: null };
  ambientSoundStates.set(key, state);
  if (state.player && !state.player.paused) return;
  if (now < (state.nextAt ?? 0)) return;
  const chainStarting = (state.chainRemaining ?? 0) <= 0;
  if (chainStarting) {
    state.chainRemaining = 1 + Math.floor(Math.random() * 10);
    if (key === 'ocean') emitHapticEvent(game, HAPTIC_EVENTS.AMBIENT_OCEAN_WAVES);
  }
  const src = sources[Math.floor(Math.random() * sources.length)] ?? sources[0];
  if (key === 'thunder') {
    emitHapticEvent(game, HAPTIC_EVENTS.AMBIENT_ROLLING_THUNDER, {
      durationMs: Math.min(5000, Math.max(1400, (ambientDurations.get(src) ?? 4) * 650)),
    });
  }
  if (key === 'wind' && /storm_wind_1/i.test(src)) triggerStormWindFeedback(game);
  const player = soundPlayerFor(src);
  player.loop = false;
  player.volume = ambientVolumeForKey(key);
  player.currentTime = 0;
  state.player = player;
  player.onloadedmetadata = () => {
    if (Number.isFinite(player.duration) && player.duration > 0) ambientDurations.set(src, player.duration);
  };
  player.onended = () => {
    state.player = null;
    state.chainRemaining = Math.max(0, (state.chainRemaining ?? 1) - 1);
    state.nextAt = performance.now() + (state.chainRemaining > 0 ? Math.random() * 1200 + 300 : randomAmbientRestMs(sources));
  };
  player.play().catch(() => {
    state.player = null;
    state.chainRemaining = 0;
    state.nextAt = now + randomAmbientRestMs(sources);
  });
}

function stopAmbientChain(key) {
  const state = ambientSoundStates.get(key);
  if (!state) return;
  if (state.player && !state.player.paused) {
    state.player.pause();
    state.player.currentTime = 0;
  }
  state.player = null;
  state.chainRemaining = 0;
}

function randomAmbientRestMs(sources) {
  const meanSeconds = meanAmbientDurationSeconds(sources) * 5;
  return meanSeconds * 1000 * (0.55 + Math.random() * 0.9);
}

function meanAmbientDurationSeconds(sources) {
  if (!sources.length) return 8;
  const total = sources.reduce((sum, src) => sum + (ambientDurations.get(src) ?? 8), 0);
  return total / sources.length;
}

function ambientVolumeForKey(key) {
  if (key === 'thunder') return 0.2;
  if (key === 'wind') return 0.16;
  return 0.18;
}

function triggerStormWindFeedback(game) {
  emitHapticEvent(game, HAPTIC_EVENTS.AMBIENT_STORM_WIND);
  addCameraShake(game.camera, 0.08, 2.4);
  game.camera.sway = {
    timer: 3.2,
    duration: 3.2,
    phase: Math.random() * Math.PI * 2,
    amplitude: 5.5,
    direction: Math.random() < 0.5 ? -1 : 1,
  };
  const side = game.camera.sway.direction;
  const heading = game.road?.heading ?? 0;
  game.vehicle.vx += Math.cos(heading) * side * 18;
  game.vehicle.vy += Math.sin(heading) * side * 18;
}

function stepAmbientCameraSway(game, dt) {
  const sway = game.camera?.sway;
  if (!sway) return;
  sway.timer = Math.max(0, (sway.timer ?? 0) - dt);
  sway.phase = (sway.phase ?? 0) + dt * 5.4;
  const duration = Math.max(0.001, sway.duration ?? 1);
  const fade = Math.sin(Math.PI * Math.max(0, Math.min(1, sway.timer / duration)));
  sway.offsetX = Math.sin(sway.phase) * (sway.amplitude ?? 0) * fade * (sway.direction ?? 1);
  sway.offsetY = Math.cos(sway.phase * 0.7) * (sway.amplitude ?? 0) * 0.35 * fade;
  if (sway.timer <= 0) {
    sway.offsetX = 0;
    sway.offsetY = 0;
  }
}

function loadPlayerAccount() {
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYER_ACCOUNT_STORAGE_KEY));
    return normalizePrototypePlayerAccountData(saved);
  } catch {
    return createPrototypePlayerAccountData();
  }
}

function savePlayerAccount() {
  localStorage.setItem(PLAYER_ACCOUNT_STORAGE_KEY, JSON.stringify(playerAccount));
}

function loadControlBindings() {
  try {
    return normalizeControlBindings(JSON.parse(localStorage.getItem(CONTROL_BINDINGS_STORAGE_KEY)) ?? DEFAULT_CONTROL_BINDINGS);
  } catch {
    return normalizeControlBindings(DEFAULT_CONTROL_BINDINGS);
  }
}

function loadAiShotLeading() {
  return localStorage.getItem(AI_SHOT_LEADING_STORAGE_KEY) !== 'false';
}

function toggleAiShotLeading() {
  aiShotLeading = !aiShotLeading;
  localStorage.setItem(AI_SHOT_LEADING_STORAGE_KEY, String(aiShotLeading));
  syncAiLeadToggle();
}

function syncAiLeadToggle() {
  aiLeadToggle.setAttribute('aria-pressed', String(aiShotLeading));
  aiLeadToggle.textContent = aiShotLeading ? 'AI LEAD' : `${String.fromCharCode(0x2298)} AI LEAD`;
  aiLeadToggle.setAttribute('aria-label', aiShotLeading ? 'Disable AI shot leading' : 'Enable AI shot leading');
}

function syncTargetCellFocus() {
  const value = GUIDED_TARGET_CELL_TYPES.includes(game.guidedTargetCellType) ? game.guidedTargetCellType : 'auto';
  if (targetCellTypeSelect.value !== value) targetCellTypeSelect.value = value;
  const label = GUIDED_TARGET_CELL_TYPE_LABELS[value] ?? GUIDED_TARGET_CELL_TYPE_LABELS.auto;
  targetCycleButton.title = game.guidedTargetId ? `AI target: ${game.guidedTargetId}` : 'Cycle guided AI enemy target';
  targetCellCycleLabel.textContent = label;
  targetCellCycleButton.setAttribute('aria-label', `Cycle guided AI target part. Current focus: ${label}`);
  targetCellCycleButton.title = `AI focus: ${label}`;
}

function saveControlBindings() {
  localStorage.setItem(CONTROL_BINDINGS_STORAGE_KEY, JSON.stringify(controlBindings));
  keyboard.setBindings(controlBindings);
  gamepad.setBindings(controlBindings);
  renderControlConfig();
}

function renderControlConfig() {
  controlConfigList.replaceChildren(
    ...CONTROL_ACTIONS.map((action) => {
      const row = document.createElement('div');
      row.className = 'control-config-row';
      const label = document.createElement('strong');
      label.textContent = action.label;
      const keyButton = document.createElement('button');
      keyButton.type = 'button';
      keyButton.textContent = keyboardBindingLabel(action.id);
      keyButton.addEventListener('click', () => startControlCapture('keyboard', action.id));
      const padButton = document.createElement('button');
      padButton.type = 'button';
      padButton.textContent = gamepadBindingLabel(action.id);
      padButton.addEventListener('click', () => startControlCapture('gamepad', action.id));
      row.append(label, keyButton, padButton);
      return row;
    }),
  );
}

function keyboardBindingLabel(actionId) {
  const keys = controlBindings.keyboard[actionId] ?? [];
  return keys.length ? keys.map(keyLabel).join(' / ') : 'Bind Key';
}

function gamepadBindingLabel(actionId) {
  const buttons = controlBindings.gamepad[actionId] ?? [];
  return buttons.length ? buttons.map(gamepadButtonLabel).join(' / ') : 'Bind Pad';
}

function startControlCapture(device, actionId) {
  pendingControlCapture = { device, actionId, awaitRelease: device === 'gamepad' };
  controlConfigStatus.textContent = device === 'keyboard' ? 'Press a key for this action.' : 'Release the current button, then press a gamepad button.';
}

function captureKeyboardBinding(event) {
  if (pendingControlCapture?.device !== 'keyboard') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  controlBindings = setKeyboardBinding(controlBindings, pendingControlCapture.actionId, event.code);
  pendingControlCapture = null;
  controlConfigStatus.textContent = 'Keyboard binding updated.';
  saveControlBindings();
}

function pollPendingGamepadBinding() {
  if (pendingControlCapture?.device !== 'gamepad') return;
  const buttons = firstConnectedGamepadButtons();
  if (pendingControlCapture.awaitRelease) {
    if (buttons.some((button) => button.pressed || button.value > 0.55)) return;
    pendingControlCapture.awaitRelease = false;
    controlConfigStatus.textContent = 'Press the gamepad button to bind.';
    return;
  }
  const index = buttons.findIndex((button) => button.pressed || button.value > 0.55);
  if (index < 0) return;
  controlBindings = setGamepadBinding(controlBindings, pendingControlCapture.actionId, index);
  pendingControlCapture = null;
  controlConfigStatus.textContent = 'Gamepad binding updated.';
  saveControlBindings();
}

function firstConnectedGamepadButtons() {
  return Array.from(navigator.getGamepads?.() ?? []).find((pad) => pad?.connected)?.buttons ?? [];
}

function resetControlBindings() {
  pendingControlCapture = null;
  controlBindings = normalizeControlBindings(DEFAULT_CONTROL_BINDINGS);
  controlConfigStatus.textContent = 'Bindings reset to defaults.';
  saveControlBindings();
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
  if (game.sandbox?.enabled) {
    levelName.textContent = `Sandbox: ${game.sandbox.definition.title}`;
    const duration = Math.max(1, game.sandbox.definition.duration ?? LEVEL_TARGET_DURATION);
    const elapsed = Math.max(0, game.time - game.levelStartTime);
    const progress = game.levelComplete ? 1 : Math.min(0.985, elapsed / duration);
    levelProgressFill.style.width = `${progress * 100}%`;
    return;
  }
  levelName.textContent = levelNameFromTrack(game.currentMusic);
  const elapsed = Math.max(0, game.time - game.levelStartTime);
  const progress = game.levelComplete ? 1 : Math.min(0.985, elapsed / LEVEL_TARGET_DURATION);
  const spawnAdjusted = game.enemySpawnQueue.length === 0 ? Math.max(progress, 0.92) : progress;
  levelProgressFill.style.width = `${spawnAdjusted * 100}%`;
}

function levelNameFromTrack(trackName = '') {
  return trackName.replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2') || `Level ${game.level}`;
}

function exposeLocalContentModuleApi() {
  window.WeyfinderContentModules = Object.freeze({
    createBundleFromFiles: createLocalContentBundleFromFiles,
    async installFiles(fileList, options = {}) {
      return installLocalContentFiles(fileList, { storage: localStorage, ...options });
    },
    installBundle(bundle, options = {}) {
      return installLocalContentBundle(bundle, { storage: localStorage, ...options });
    },
    listPacks() {
      return listLocalContentPacks(localStorage);
    },
    removePack(packId) {
      return removeLocalContentPack(packId, localStorage);
    },
    createRegistry() {
      return createRegistryWithLocalContent(localStorage);
    },
    instantiateLevel(levelId, seed = 0) {
      return instantiateLocalLevel(levelId, { storage: localStorage, seed });
    },
  });
}

function exposeSandboxApi() {
  window.WeyfinderSandbox = Object.freeze({
    defaultDefinition() {
      return structuredClone(DEFAULT_SANDBOX_DEFINITION);
    },
    enemies() {
      return sandboxEnemyOptions().map((enemy) => ({ id: enemy.id, displayName: enemy.displayName ?? enemy.id }));
    },
    levels() {
      const runtime = localSandboxRuntimeOptions();
      return [...(runtime.registry.assets.get('level')?.values() ?? [])].map((level) => ({
        id: level.assetId,
        displayName: level.displayName ?? level.title ?? level.assetId,
      }));
    },
    contentReport() {
      const report = createRegistryWithLocalContent(localStorage);
      return {
        ok: report.ok,
        errors: structuredClone(report.errors),
        warnings: structuredClone(report.warnings),
        packs: listLocalContentPacks(localStorage),
      };
    },
    validate: validateSandboxDefinition,
    run(definition) {
      const report = validateSandboxDefinition(definition);
      if (!report.valid) return report;
      syncSandboxScript(report.definition);
      startSandbox(report.definition);
      return report;
    },
    quickSpawn(enemyId, options = {}) {
      const definition = sandboxDefinitionFromEnemy(enemyId, options);
      syncSandboxScript(definition);
      startSandbox(definition);
      return definition;
    },
    runLevel(levelId, options = {}) {
      const runtime = localSandboxRuntimeOptions();
      const runPackage = instantiateLocalLevel(levelId, {
        storage: localStorage,
        registry: runtime.registry,
        seed: options.seed ?? 1147,
      });
      const definition = sandboxDefinitionFromLevel(runPackage.definition, options);
      syncSandboxScript(definition);
      startSandbox(definition, runtime);
      return {
        ok: true,
        definition: structuredClone(definition),
        dependencies: structuredClone(runPackage.dependencies ?? []),
      };
    },
    loadout(options = {}) {
      if (!game.sandbox?.enabled) return { ok: false, error: 'Start a sandbox run before changing its loadout.' };
      const result = configureSandboxLoadout(game, options);
      refreshSandboxLoadoutOptions();
      return { ok: true, ...structuredClone(result) };
    },
    repair(target = 'all') {
      if (!game.sandbox?.enabled) return { ok: false, error: 'Start a sandbox run before repairing its vehicle.' };
      return { ok: true, ...repairSandboxVehicle(game, target) };
    },
    refillAmmo(weapon = 'all') {
      if (!game.sandbox?.enabled) return { ok: false, error: 'Start a sandbox run before refilling its ammo.' };
      return { ok: true, refilled: refillSandboxAmmo(game, weapon) };
    },
    stop: stopSandbox,
    current() {
      return game.sandbox?.definition ? structuredClone(game.sandbox.definition) : null;
    },
  });
}

function exposeEncounterApi() {
  window.WeyfinderEncounters = Object.freeze({
    normalize: normalizeEncounterDefinition,
    validate: validateEncounterDefinition,
    verbs() {
      return {
        conditions: [...ENCOUNTER_CONDITION_TYPES],
        effects: [...ENCOUNTER_EFFECT_TYPES],
      };
    },
    diagnostics() {
      return structuredClone(game.encounters?.diagnostics ?? []);
    },
    start(definitionOrId, options = {}) {
      const instance = beginEncounter(game, definitionOrId, options);
      return structuredClone(instance);
    },
    choose(choiceId) {
      const view = activeEncounterView(game);
      if (!view) return { ok: false, reason: 'inactive' };
      return chooseEncounterChoice(game, view.instanceId, choiceId);
    },
    current() {
      const view = activeEncounterView(game);
      return view ? structuredClone(view) : null;
    },
  });
}

function exposeProceduralMusicApi() {
  window.WeyfinderMusic = Object.freeze({
    snapshot() {
      return structuredClone(game.music ?? {});
    },
    lastCue() {
      return lastProceduralMusicCue ? structuredClone(lastProceduralMusicCue) : null;
    },
    layerAssets() {
      return structuredClone(MUSIC_LAYER_URLS);
    },
  });
}

function exposeNavigationApi() {
  window.WeyfinderNavigation = Object.freeze({
    validate: validateNavigationGraph,
    start(definition, options = {}) {
      const report = validateNavigationGraph(definition);
      if (!report.valid) return report;
      game.navigation = createNavigationRuntime(report.definition, { seed: options.seed ?? 1147 });
      return { ...report, view: navigationView(game.navigation) };
    },
    view(options = {}) {
      return navigationView(game.navigation, options);
    },
    chooseEdge(edgeId, options = {}) {
      return selectNavigationEdge(game.navigation, edgeId, options);
    },
    chooseNode(nodeId, options = {}) {
      return selectNavigationNode(game.navigation, nodeId, options);
    },
    updateSignals(patch = {}) {
      return updateNavigationSignals(game.navigation, patch);
    },
    recordOutcome(outcome = {}) {
      return recordNavigationOutcome(game.navigation, outcome);
    },
  });
}

function exposeHapticApi() {
  window.WeyfinderHaptics = Object.freeze({
    events: Object.freeze({ ...HAPTIC_EVENTS }),
    emit(id, options = {}) {
      emitHapticEvent(game, id, options);
      return { ok: true, id };
    },
    preview(id, options = {}) {
      const event = { id, ...options };
      const pattern = hapticPatternForEvent(event);
      if (!pattern) return { ok: false, reason: 'unknown-event', id };
      if (pattern.kind === 'rolling') {
        queueRollingHaptic(pattern.durationMs, pattern.intervalMs, pattern.weakMagnitude, pattern.strongMagnitude, pattern.pulseMs, pattern.jitterMs);
      } else {
        triggerHapticPulse(pattern);
      }
      return { ok: true, id };
    },
  });
}

function soundPlayerFor(src) {
  if (!soundPlayers.has(src)) {
    const audio = new Audio(src);
    audio.volume = 0.48;
    soundPlayers.set(src, audio);
  }
  return soundPlayers.get(src);
}

function prewarmSoundPlayers() {
  if (soundPlayersPrewarmed) return;
  soundPlayersPrewarmed = true;
  for (const src of Object.values(SOUND_URLS).flat()) {
    if (!src) continue;
    const player = soundPlayerFor(src);
    player.preload = 'auto';
    player.load?.();
  }
  for (const src of Object.values(AMBIENT_SOUND_URLS).flat()) {
    if (!src) continue;
    const player = soundPlayerFor(src);
    player.preload = 'auto';
    player.load?.();
  }
  if (LASER_SCORCH_LOOP_URL) {
    const player = soundPlayerFor(LASER_SCORCH_LOOP_URL);
    player.preload = 'auto';
    player.load?.();
  }
}

function scheduleSoundPrewarm() {
  if (soundPlayersPrewarmed) return;
  if (window.requestIdleCallback) {
    window.requestIdleCallback(() => prewarmSoundPlayers(), { timeout: 2000 });
    return;
  }
  window.setTimeout(() => prewarmSoundPlayers(), 500);
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

function isVirtualPointerEnabled() {
  return (
    titleActive ||
    awaitingLaunch ||
    game.paused ||
    game.levelComplete ||
    game.gameOver ||
    !controlsPanel.classList.contains('hidden') ||
    !controlConfigPanel.classList.contains('hidden') ||
    !achievementsPanel.classList.contains('hidden') ||
    !sandboxPanel.classList.contains('hidden') ||
    !encounterVignette.classList.contains('hidden')
  );
}

function renderModuleStatus() {
  moduleStatusList.replaceChildren(
    ...game.vehicle.cells.map((cell) => {
      const row = document.createElement('div');
      row.className = 'module-status-row';
      const name = document.createElement('span');
      name.textContent = `${cell.id} ${cell.attached ? '' : 'lost'}`;
      const bar = document.createElement('div');
      bar.className = 'module-status-bar';
      const fill = document.createElement('div');
      const integrity = Math.max(0, Math.min(1, Math.min(cell.state.structureIntegrity, cell.state.wiringIntegrity, cell.state.deviceIntegrity)));
      fill.style.width = `${integrity * 100}%`;
      bar.append(fill);
      const value = document.createElement('span');
      value.textContent = `${Math.round(integrity * 100)}%`;
      row.append(name, bar, value);
      return row;
    }),
  );
}

function renderTargetInfo(hoverWorld) {
  const hover = hoverWorld ? enemyAtWorld(hoverWorld) : null;
  const guided = game.enemies.find((enemy) => !enemy.destroyed && enemy.targetId === game.guidedTargetId);
  const enemy = hover ?? guided;
  if (!enemy) {
    targetInfo.textContent = 'No target selected';
    return;
  }
  const living = enemy.cells.filter((cell) => !cell.state.destroyed).length;
  const guns = enemy.cells.filter((cell) => cell.type === 'gun' && !cell.state.destroyed).length;
  const engines = enemy.cells.filter((cell) => cell.type === 'engine' && !cell.state.destroyed).length;
  const focus = GUIDED_TARGET_CELL_TYPE_LABELS[game.guidedTargetCellType ?? 'auto'] ?? GUIDED_TARGET_CELL_TYPE_LABELS.auto;
  targetInfo.textContent = `${enemy.kind ?? 'enemy'} ${hover ? 'hover' : 'target'} | focus ${focus} | cells ${living}/${enemy.cells.length} | guns ${guns} | engines ${engines}`;
}

function enemyAtWorld(point) {
  return game.enemies.find((enemy) => {
    if (enemy.destroyed) return false;
    const dx = point.x - enemy.x;
    const dy = point.y - enemy.y;
    return dx * dx + dy * dy <= enemy.radius * enemy.radius;
  });
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
  for (const type of ['mousedown', 'mouseup', 'click']) {
    target.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: pointer.x,
        clientY: pointer.y,
        view: window,
        button: 0,
        buttons: type === 'mousedown' ? 1 : 0,
      }),
    );
  }
}

function virtualScrollAxes(input) {
  const rightX = input.cursorScrollX ?? 0;
  const rightY = input.cursorScrollY ?? 0;
  if (Math.hypot(rightX, rightY) > 0.18) return { x: rightX, y: rightY };
  return { x: 0, y: 0 };
}

function dispatchVirtualWheel(pointer, x, y, dt) {
  virtualCursor.hidden = true;
  const target = document.elementFromPoint(pointer.x, pointer.y);
  virtualCursor.hidden = false;
  if (!target) return;
  target.dispatchEvent(
    new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: pointer.x,
      clientY: pointer.y,
      deltaX: x * 620 * dt,
      deltaY: y * 620 * dt,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
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
  const y = virtualSelectAxis(input);
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
  flashSelectedOption(select);
}

function virtualSelectAxis(input) {
  const { y: scrollY } = virtualScrollAxes(input);
  if (Math.abs(scrollY) > 0.18) return scrollY;
  return input.cursorY ?? 0;
}

function flashSelectedOption(select) {
  const label = select.selectedOptions?.[0]?.textContent?.trim();
  if (!label) return;
  flashElementLabel(select, label);
}

function flashElementLabel(element, label) {
  const rect = element.getBoundingClientRect();
  selectionFlash.textContent = label;
  selectionFlash.hidden = false;
  selectionFlash.style.left = `${Math.max(12, Math.min(window.innerWidth - 12, rect.left + rect.width / 2))}px`;
  selectionFlash.style.top = `${Math.max(40, rect.top - 8)}px`;
  selectionFlash.classList.remove('visible');
  window.requestAnimationFrame(() => selectionFlash.classList.add('visible'));
  window.clearTimeout(selectionFlashTimer);
  selectionFlashTimer = window.setTimeout(() => {
    selectionFlash.classList.remove('visible');
    window.setTimeout(() => {
      if (!selectionFlash.classList.contains('visible')) selectionFlash.hidden = true;
    }, 140);
  }, 720);
}

function scrollVirtualTarget(pointer, input, dt) {
  const { x, y } = virtualScrollAxes(input);
  if (Math.hypot(x, y) <= 0.2) return;
  virtualCursor.hidden = true;
  const target = document.elementFromPoint(pointer.x, pointer.y);
  virtualCursor.hidden = false;
  const scrollTarget = scrollableAncestor(target);
  if (!scrollTarget) return;
  const beforeX = scrollTarget.scrollLeft;
  const beforeY = scrollTarget.scrollTop;
  scrollTarget.scrollLeft += x * 620 * dt;
  scrollTarget.scrollTop += y * 620 * dt;
  dispatchVirtualWheel(pointer, x, y, dt);
  if (scrollTarget.scrollLeft !== beforeX || scrollTarget.scrollTop !== beforeY) virtualCursor.dataset.mode = 'scroll';
}

function scrollableAncestor(element) {
  for (let current = element; current && current !== document.body; current = current.parentElement) {
    if (current instanceof HTMLSelectElement) return null;
    const style = window.getComputedStyle(current);
    const canScrollY = /(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight + 1;
    const canScrollX = /(auto|scroll)/.test(style.overflowX) && current.scrollWidth > current.clientWidth + 1;
    if (canScrollY || canScrollX) return current;
  }
  return null;
}

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function idlePerformanceCounters() {
  return {
    ...IDLE_PERFORMANCE_COUNTERS,
    audioPlayCalls: frameAudioCounters.audioPlayCalls,
    enemyBulletSoundEvents: frameAudioCounters.enemyBulletSoundEvents,
  };
}

function performanceCounters(game) {
  const enemies = game.enemies ?? [];
  let activeEnemies = 0;
  let enemyCells = 0;
  let liveEnemyCells = 0;
  for (const enemy of enemies) {
    if (!enemy.destroyed) activeEnemies += 1;
    const cells = enemy.cells ?? [];
    enemyCells += cells.length;
    for (const cell of cells) {
      if (!cell.state?.destroyed) liveEnemyCells += 1;
    }
  }
  return {
    playerProjectiles: game.playerProjectiles?.length ?? 0,
    enemyProjectiles: game.enemyProjectiles?.length ?? 0,
    smokeParticles: game.smokeParticles?.length ?? 0,
    scrapPickups: game.scrapPickups?.length ?? 0,
    enemies: activeEnemies,
    enemyCells,
    liveEnemyCells,
    vehicleCells: game.vehicle?.cells?.length ?? 0,
    terrainChunks: game.terrain?.chunks?.size ?? 0,
    terrainCacheBuilds: game.terrain?.stats?.cacheBuildsLastDraw ?? 0,
    terrainPendingChunks: game.terrain?.stats?.pendingChunks ?? 0,
    audioPlayCalls: frameAudioCounters.audioPlayCalls,
    enemyBulletSoundEvents: frameAudioCounters.enemyBulletSoundEvents,
  };
}

const ICON_SHEET_KEYS = Object.freeze({
  weapon: 'weapons',
  weapons: 'weapons',
  system: 'general',
  general: 'general',
  'upgrade-a': 'upgrades_a',
  upgrades_a: 'upgrades_a',
  'upgrade-b': 'upgrades_b',
  upgrades_b: 'upgrades_b',
});
const ICON_ID_ALIASES = Object.freeze({
  upgrades_a: Object.freeze({
    velocity: 'velocity_max_velocity',
    max_velocity: 'velocity_max_velocity',
  }),
});
const ICON_SHEETS = uiIconAtlas?.sheets ?? {};

function iconPositionPercent(value, count) {
  if (!Number.isFinite(value) || count <= 1) return '0%';
  return `${((value / (count - 1)) * 100).toFixed(3)}%`;
}

function atlasIconFor(sheetId, iconId) {
  const sheetKey = ICON_SHEET_KEYS[sheetId] ?? sheetId;
  const sheet = ICON_SHEETS[sheetKey];
  const aliases = ICON_ID_ALIASES[sheetKey] ?? {};
  const normalizedIconId = aliases[iconId] ?? iconId;
  return {
    sheet,
    icon: sheet?.icons?.[normalizedIconId],
  };
}

function weaponIconDescriptor(id = 'none') {
  return { sheet: 'weapon', id: id || 'none' };
}

function systemIconDescriptor(id = 'repair') {
  return { sheet: 'system', id };
}

function upgradeIconDescriptor(upgrade) {
  if (!upgrade) return { sheet: 'upgrade-a', id: 'damage' };
  const explicit = upgradeIconDescriptorMap()[upgrade.id];
  if (explicit) return explicit;
  if (/Accuracy/i.test(upgrade.id)) return { sheet: 'upgrade-a', id: 'accuracy' };
  if (/FireRate/i.test(upgrade.id)) return { sheet: 'upgrade-a', id: 'fire_rate' };
  if (/ImpactDamage/i.test(upgrade.id)) return { sheet: 'upgrade-a', id: 'impact_damage' };
  if (/BlastDamage/i.test(upgrade.id)) return { sheet: 'upgrade-a', id: 'blast_damage' };
  if (/BlastRadius/i.test(upgrade.id)) return { sheet: 'upgrade-a', id: 'blast_radius' };
  if (/Damage/i.test(upgrade.id)) return { sheet: 'upgrade-a', id: 'damage' };
  if (/MaxVelocity|Velocity/i.test(upgrade.id)) return { sheet: 'upgrade-a', id: 'max_velocity' };
  if (/Pierce/i.test(upgrade.id)) return { sheet: 'upgrade-a', id: 'pierce' };
  if (/Knockback/i.test(upgrade.id)) return { sheet: 'upgrade-a', id: 'knockback' };
  if (/Ammo/i.test(upgrade.id)) return { sheet: 'upgrade-a', id: 'ammo_capacity' };
  return { sheet: 'upgrade-a', id: 'damage' };
}

function upgradeIconDescriptorMap() {
  return {
  gunAccuracy: { sheet: 'upgrade-a', id: 'accuracy' },
  gunFireRate: { sheet: 'upgrade-a', id: 'fire_rate' },
  gunDamage: { sheet: 'upgrade-a', id: 'damage' },
  gunVelocity: { sheet: 'upgrade-a', id: 'velocity' },
  trackingFlechetteFireRate: { sheet: 'upgrade-a', id: 'fire_rate' },
  trackingFlechettePierce: { sheet: 'upgrade-a', id: 'pierce' },
  trackingFlechetteAcceleration: { sheet: 'upgrade-a', id: 'acceleration' },
  trackingFlechetteImpactDamage: { sheet: 'upgrade-a', id: 'impact_damage' },
  trackingFlechetteTurningRate: { sheet: 'upgrade-a', id: 'turning_rate' },
  miniBeamLength: { sheet: 'upgrade-a', id: 'beam_length' },
  miniBeamDamage: { sheet: 'upgrade-a', id: 'damage' },
  miniBeamFireRate: { sheet: 'upgrade-a', id: 'fire_rate' },
  miniBeamPierce: { sheet: 'upgrade-a', id: 'pierce' },
  miniBeamHeatSink: { sheet: 'upgrade-a', id: 'heat_sink' },
  miniBeamHeatEfficiency: { sheet: 'upgrade-a', id: 'heat_efficiency' },
  cannonAmmo: { sheet: 'upgrade-a', id: 'ammo_capacity' },
  cannonImpactDamage: { sheet: 'upgrade-a', id: 'impact_damage' },
  cannonBlastDamage: { sheet: 'upgrade-a', id: 'blast_damage' },
  cannonBlastRadius: { sheet: 'upgrade-a', id: 'blast_radius' },
  cannonShrapnelCount: { sheet: 'upgrade-a', id: 'shrapnel_count' },
  cannonShrapnelDamage: { sheet: 'upgrade-a', id: 'shrapnel_damage' },
  cannonKnockback: { sheet: 'upgrade-a', id: 'knockback' },
  cannonVelocity: { sheet: 'upgrade-a', id: 'velocity' },
  cannonFlechettePierce: { sheet: 'upgrade-a', id: 'pierce' },
  cannonFireRate: { sheet: 'upgrade-a', id: 'fire_rate' },
  rocketAmmo: { sheet: 'upgrade-a', id: 'ammo_capacity' },
  rocketImpactDamage: { sheet: 'upgrade-a', id: 'impact_damage' },
  rocketBlastDamage: { sheet: 'upgrade-a', id: 'blast_damage' },
  rocketBlastRadius: { sheet: 'upgrade-a', id: 'blast_radius' },
  rocketMaxVelocity: { sheet: 'upgrade-a', id: 'max_velocity' },
  rocketTurning: { sheet: 'upgrade-a', id: 'turning_rate' },
  rocketKnockback: { sheet: 'upgrade-a', id: 'knockback' },
  rocketFireRate: { sheet: 'upgrade-a', id: 'fire_rate' },
  beamHeatEfficiency: { sheet: 'upgrade-a', id: 'heat_efficiency' },
  beamHeatSink: { sheet: 'upgrade-a', id: 'heat_sink' },
  beamAmmo: { sheet: 'upgrade-a', id: 'ammo_capacity' },
  beamDamage: { sheet: 'upgrade-a', id: 'damage' },
  beamLength: { sheet: 'upgrade-a', id: 'beam_length' },
  beamPierce: { sheet: 'upgrade-a', id: 'pierce' },
  beamWidth: { sheet: 'upgrade-a', id: 'beam_width' },
  beamFireTime: { sheet: 'upgrade-a', id: 'beam_fire_time' },
  beamFireRate: { sheet: 'upgrade-a', id: 'fire_rate' },
  staMissileAmmo: { sheet: 'upgrade-a', id: 'ammo_capacity' },
  staMissileImpactDamage: { sheet: 'upgrade-a', id: 'impact_damage' },
  staMissileBlastDamage: { sheet: 'upgrade-a', id: 'blast_damage' },
  staMissileBlastRadius: { sheet: 'upgrade-a', id: 'blast_radius' },
  orbOfBladesAmmo: { sheet: 'upgrade-a', id: 'ammo_capacity' },
  orbOfBladesEmissionRate: { sheet: 'upgrade-b', id: 'blade_emission_rate' },
  orbOfBladesBladeDamage: { sheet: 'upgrade-b', id: 'blade_damage' },
  orbOfBladesBladesPerCycle: { sheet: 'upgrade-b', id: 'blades_per_cycle' },
  orbOfBladesBladeKnockback: { sheet: 'upgrade-b', id: 'blade_knockback' },
  mortarFireRate: { sheet: 'upgrade-a', id: 'fire_rate' },
  mortarImpactDamage: { sheet: 'upgrade-a', id: 'impact_damage' },
  mortarBlastDamage: { sheet: 'upgrade-a', id: 'blast_damage' },
  mortarBlastRadius: { sheet: 'upgrade-a', id: 'blast_radius' },
  bladeLauncherFireRate: { sheet: 'upgrade-a', id: 'fire_rate' },
  bladeLauncherMaxRicochets: { sheet: 'upgrade-a', id: 'ricochet_count' },
  bladeLauncherImpactDamage: { sheet: 'upgrade-a', id: 'impact_damage' },
  bladeLauncherPierce: { sheet: 'upgrade-a', id: 'pierce' },
  bladeLauncherRicochetFactor: { sheet: 'upgrade-b', id: 'ricochet_factor' },
  bladeLauncherProjectileDeflection: { sheet: 'upgrade-b', id: 'projectile_deflection' },
  repulsorKnockback: { sheet: 'upgrade-a', id: 'knockback' },
  repulsorFireRate: { sheet: 'upgrade-a', id: 'fire_rate' },
  armorToughness: { sheet: 'upgrade-a', id: 'damage' },
  engineAcceleration: { sheet: 'upgrade-a', id: 'acceleration' },
  engineMaxVelocity: { sheet: 'upgrade-a', id: 'max_velocity' },
  wheelInertiaCompensation: { sheet: 'upgrade-a', id: 'turning_rate' },
  boostAcceleration: { sheet: 'upgrade-a', id: 'acceleration' },
  boostDuration: { sheet: 'upgrade-b', id: 'booster_duration' },
  boostEfficiency: { sheet: 'upgrade-b', id: 'booster_efficiency' },
  boostRecharge: { sheet: 'upgrade-b', id: 'booster_recharge' },
  boostCapacity: { sheet: 'upgrade-b', id: 'booster_charge_capacity' },
  boostRamDamage: { sheet: 'upgrade-b', id: 'booster_ram_damage' },
  boostRecoilDamage: { sheet: 'upgrade-b', id: 'booster_recoil_dampening' },
  boostRecoilKnockback: { sheet: 'upgrade-b', id: 'booster_recoil_dampening' },
  boostShielding: { sheet: 'upgrade-b', id: 'booster_shielding' },
  boostCooldown: { sheet: 'upgrade-b', id: 'booster_cooldown' },
  scrapMagnetDistance: { sheet: 'upgrade-b', id: 'scrap_magnet_distance' },
  scrapMagnetStrength: { sheet: 'upgrade-b', id: 'scrap_magnet_strength' },
  scrapCaptureRadius: { sheet: 'upgrade-b', id: 'scrap_capture_radius' },
  };
}

function systemIconDescriptorForUpgrade(upgrade) {
  const requires = upgrade?.requires ?? {};
  if (requires.primary) return weaponIconDescriptor(requires.primary);
  if (requires.secondary) return weaponIconDescriptor(requires.secondary);
  if (requires.module === 'armor') return systemIconDescriptor('armor');
  if (requires.module === 'engine') return systemIconDescriptor('engine');
  if (requires.module === 'wheel') return systemIconDescriptor('wheel');
  if (requires.utility === 'booster') return systemIconDescriptor('boost');
  if (requires.utility === 'scrap_magnet') return systemIconDescriptor('scrap');
  return systemIconDescriptor('repair');
}

function setIconElement(element, descriptor) {
  if (!element) return;
  const sheetId = descriptor?.sheet ?? 'weapon';
  const iconId = descriptor?.id ?? 'none';
  element.dataset.sheet = sheetId;
  element.dataset.icon = iconId;
  const { sheet, icon } = atlasIconFor(sheetId, iconId);
  if (sheet && icon) {
    element.style.backgroundSize = `${sheet.cols * 100}% ${sheet.rows * 100}%`;
    element.style.backgroundPosition = `${iconPositionPercent(icon.col, sheet.cols)} ${iconPositionPercent(icon.row, sheet.rows)}`;
  } else {
    element.style.removeProperty('background-size');
    element.style.removeProperty('background-position');
  }
}

function iconSpan(descriptor) {
  const icon = document.createElement('span');
  icon.className = 'icon-sprite small';
  setIconElement(icon, descriptor);
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

function annotateWeaponOptionIcons() {
  for (const select of [secondarySelect, pauseSecondarySelect, shopAmmoSelect, ...gunLoadoutSelects]) {
    for (const option of select?.options ?? []) option.dataset.icon = option.value || 'none';
  }
}

function populateUpgradeSelect() {
  refreshUpgradeSystems();
  refreshUpgradeOptions();
}

function refreshUpgradeSystems() {
  const selected = shopUpgradeSystemSelect.value;
  const systems = [...new Set(availableShopUpgrades().map((upgrade) => upgrade.system))];
  shopUpgradeSystemSelect.replaceChildren(
    ...systems.map((system) => {
      const option = document.createElement('option');
      const upgrades = availableShopUpgrades().filter((upgrade) => upgrade.system === system);
      const systemLevel = upgrades.reduce((sum, upgrade) => sum + (game.upgrades?.[upgrade.id] ?? 0), 0);
      option.value = system;
      option.textContent = `${system} (${systemLevel})`;
      return option;
    }),
  );
  shopUpgradeSystemSelect.value = systems.includes(selected) ? selected : systems[0] || '';
}

function refreshUpgradeOptions() {
  const selected = shopUpgradeSelect.value;
  const system = shopUpgradeSystemSelect.value;
  const upgrades = availableShopUpgrades().filter((upgrade) => !system || upgrade.system === system);
  shopUpgradeSelect.replaceChildren(
    ...upgrades.map((upgrade) => {
      const option = document.createElement('option');
      const icon = upgradeIconDescriptor(upgrade);
      option.value = upgrade.id;
      option.dataset.icon = icon.id;
      option.dataset.sheet = icon.sheet;
      option.textContent = `${upgrade.label} Lv ${game.upgrades?.[upgrade.id] ?? 0}`;
      return option;
    }),
  );
  shopUpgradeSelect.value = upgrades.some((upgrade) => upgrade.id === selected) ? selected : upgrades[0]?.id || '';
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
  const system = shopUpgradeSystemSelect.value;
  const upgrades = availableShopUpgrades().filter((upgrade) => !system || upgrade.system === system);
  const systemLevel = upgrades.reduce((sum, upgrade) => sum + (game.upgrades?.[upgrade.id] ?? 0), 0);
  for (const details of upgradeSummary.querySelectorAll('details[data-system-key]')) {
    upgradeSummaryOpenState.set(details.dataset.systemKey, details.open);
  }
  upgradeSummary.replaceChildren(
    (() => {
      const details = document.createElement('details');
      const systemKey = system || 'available';
      details.dataset.systemKey = systemKey;
      details.open = upgradeSummaryOpenState.get(systemKey) ?? true;
      details.addEventListener('toggle', () => {
        upgradeSummaryOpenState.set(systemKey, details.open);
      });
      const summary = document.createElement('summary');
      summary.textContent = `${system || 'Available'} upgrades: ${systemLevel}`;
      const list = document.createElement('div');
      list.className = 'upgrade-list';
      for (const upgrade of upgrades) {
        const row = document.createElement('div');
        row.className = 'upgrade-line';
        const icon = iconSpan(upgradeIconDescriptor(upgrade));
        const name = document.createElement('span');
        name.textContent = upgrade.label;
        const level = document.createElement('span');
        level.textContent = `Lv ${game.upgrades?.[upgrade.id] ?? 0}`;
        const cost = document.createElement('span');
        const nextCost = upgradeCost(game, upgrade.id);
        cost.textContent = Number.isFinite(nextCost) ? `${nextCost} scrap` : '-';
        row.append(icon, name, level, cost);
        list.append(row);
      }
      details.append(summary, list);
      return details;
    })(),
  );
}

function updateShopUi(dt = 0) {
  const visible = Boolean(game.levelComplete) && !awaitingLaunch && !titleActive;
  if (!visible) {
    shopUiWasVisible = false;
    uiTimers.shop = 0;
    return;
  }
  if (!shopUiWasVisible) {
    shopUiWasVisible = true;
    uiDirty.shop = true;
    window.requestAnimationFrame(() => {
      if (game.levelComplete && !awaitingLaunch && !titleActive) shopRepairTab.focus({ preventScroll: true });
    });
  }
  uiTimers.shop += dt;
  if (!uiDirty.shop && uiTimers.shop < 0.25) return;
  uiDirty.shop = false;
  uiTimers.shop = 0;
  if (!shopAmmoSelect.value) shopAmmoSelect.value = game.secondary.selected;
  const ammoWeapon = shopAmmoSelect.value;
  const ammoCost = ammoRefillCost(game, ammoWeapon);
  const ammo = game.secondary.ammo[ammoWeapon];
  const ammoCapacity = ammoCapacityWithUpgrades(game, ammoWeapon);
  refreshRepairTargets();
  refreshUpgradeSystems();
  refreshUpgradeOptions();
  const selectedUpgradeCost = upgradeCost(game, shopUpgradeSelect.value);
  const selectedRepairCost = repairCost(game, shopRepairTarget.value);
  const selectedReplacementCost = replacementCost(game);
  const selectedRepairAllReplacement = nextReplaceableDetachedVehicleCell(game.vehicle, shopRepairTarget.value);
  const selectedRepairAllReplacementCost = replacementCost(game, shopRepairTarget.value);
  const selectedUpgrade = availableShopUpgrades().find((upgrade) => upgrade.id === shopUpgradeSelect.value);
  if (selectedUpgrade) {
    setIconElement(shopUpgradeSystemIcon, systemIconDescriptorForUpgrade(selectedUpgrade));
    setIconElement(shopUpgradeIcon, upgradeIconDescriptor(selectedUpgrade));
    shopUpgradeReadoutTitle.textContent = selectedUpgrade.system;
    shopUpgradeLevel.textContent = game.upgrades?.[selectedUpgrade.id] ?? 0;
  } else {
    setIconElement(shopUpgradeSystemIcon, weaponIconDescriptor('none'));
    setIconElement(shopUpgradeIcon, upgradeIconDescriptor(null));
    shopUpgradeReadoutTitle.textContent = 'No upgrade';
    shopUpgradeLevel.textContent = '-';
  }
  refreshUpgradeSummary();
  shopRepairCost.textContent = selectedRepairCost;
  shopReplaceCost.textContent = selectedReplacementCost;
  shopAmmoCost.textContent = Number.isFinite(ammoCost) ? ammoCost : '-';
  shopUpgradeCost.textContent = Number.isFinite(selectedUpgradeCost) ? selectedUpgradeCost : '-';
  shopScrapAvailable.textContent = game.scrap;
  shopSelectedAmmo.textContent = ammoWeapon;
  shopRepairStatus.textContent = repairStatus(game, shopRepairTarget.value);
  shopRepairAllStatus.textContent = repairAllStatus(game, shopRepairTarget.value);
  shopReplaceStatus.textContent = replacementStatus(game);
  shopAmmoStatus.textContent = ammoStatus(game, ammoWeapon);
  shopUpgradeStatus.textContent = upgradeStatus(game, shopUpgradeSelect.value);
  shopRepairButton.disabled = selectedRepairCost <= 0 || game.scrap < selectedRepairCost || !hasRepairableVehicleDamage(game.vehicle, shopRepairTarget.value);
  shopRepairAllButton.disabled = !(
    (selectedRepairAllReplacement && game.scrap >= selectedRepairAllReplacementCost)
    || (selectedRepairCost > 0 && game.scrap >= selectedRepairCost)
  );
  shopReplaceButton.disabled = game.scrap < selectedReplacementCost || countDetachedVehicleCells(game.vehicle) === 0;
  shopRefillAmmoButton.disabled = !Number.isFinite(ammoCost) || game.scrap < ammoCost || ammo == null || ammo >= ammoCapacity;
  shopBuyUpgradeButton.disabled = !Number.isFinite(selectedUpgradeCost) || game.scrap < selectedUpgradeCost;
}

function formatAmmoValue(value) {
  if (value == null) return '-';
  return Number.isFinite(value) ? String(value) : 'unlimited';
}

function availableShopUpgrades() {
  return availableUpgradeDefinitions(game, playerAccount, playerVehicleDefinition ?? game.vehicleDefinition);
}
