import { CANON_STATUSES, CONTENT_SCHEMA_VERSION } from '../core/contentSchema.js';
import { PATTERN_EMITTER_KINDS, validatePatternDefinition } from '../core/patternDefinition.js';
import { STATUS_EFFECT_DEFINITIONS, STATUS_EFFECT_TYPES, validateStatusEffectDefinition } from '../core/statusEffects.js';
import { PROJECTILE_BEHAVIORS, validateWeaponDefinition } from '../core/weaponDefinition.js';
import rocketDefinition from '../../content/weapons/rocket.json' with { type: 'json' };
import cannonDefinition from '../../content/weapons/cannon.json' with { type: 'json' };
import beamDefinition from '../../content/weapons/beam.json' with { type: 'json' };
import trackingFlechetteDefinition from '../../content/weapons/tracking_flechette.json' with { type: 'json' };
import mortarDefinition from '../../content/weapons/mortar.json' with { type: 'json' };
import miniBeamDefinition from '../../content/weapons/mini_beam.json' with { type: 'json' };
import tractorBeamDefinition from '../../content/weapons/tractor_beam.json' with { type: 'json' };
import repulsorBeamDefinition from '../../content/weapons/repulsor_beam.json' with { type: 'json' };
import staMissileDefinition from '../../content/weapons/sta_missile.json' with { type: 'json' };
import orbOfBladesDefinition from '../../content/weapons/orb_of_blades.json' with { type: 'json' };
import aimedPatternDefinition from '../../content/patterns/enemy_aimed_shot.json' with { type: 'json' };
import radialPatternDefinition from '../../content/patterns/enemy_radial_burst.json' with { type: 'json' };
import { CELL_SIZE } from '../core/voxelMask.js';

const canonAssets = {
  weapon: [
    rocketDefinition,
    cannonDefinition,
    beamDefinition,
    trackingFlechetteDefinition,
    mortarDefinition,
    miniBeamDefinition,
    tractorBeamDefinition,
    repulsorBeamDefinition,
    staMissileDefinition,
    orbOfBladesDefinition,
  ],
  pattern: [aimedPatternDefinition, radialPatternDefinition],
  statusEffect: Object.values(STATUS_EFFECT_DEFINITIONS).map((definition) => ({
    schemaVersion: CONTENT_SCHEMA_VERSION,
    id: definition.id,
    displayName: definition.label,
    type: definition.id,
    intensity: 1,
    duration: definition.defaultDuration,
    stackMode: definition.stackMode,
    materialRules: {},
    editorTags: definition.editorTags,
    canonStatus: 'EXPERIMENTAL',
    tags: ['status-effect', ...definition.editorTags],
  })),
};

const canvas = document.querySelector('#previewCanvas');
const context = canvas.getContext('2d');
const weaponModeButton = document.querySelector('#weaponModeButton');
const patternModeButton = document.querySelector('#patternModeButton');
const statusEffectModeButton = document.querySelector('#statusEffectModeButton');
const assetSelect = document.querySelector('#assetSelect');
const downloadButton = document.querySelector('#downloadButton');
const copyJsonButton = document.querySelector('#copyJsonButton');
const applyJsonButton = document.querySelector('#applyJsonButton');
const jsonOutput = document.querySelector('#jsonOutput');
const statusPanel = document.querySelector('#statusPanel');
const statsTitle = document.querySelector('#statsTitle');
const weaponFields = document.querySelector('#weaponFields');
const patternFields = document.querySelector('#patternFields');
const statusEffectFields = document.querySelector('#statusEffectFields');

const fields = Object.fromEntries(
  [
    'assetIdInput',
    'displayNameInput',
    'schemaInput',
    'canonStatusSelect',
    'tagsInput',
    'ammoInput',
    'heatInput',
    'cooldownInput',
    'weaponBehaviorSelect',
    'weaponSpeedInput',
    'weaponRadiusInput',
    'weaponDamageInput',
    'weaponImpulseInput',
    'weaponLifetimeInput',
    'weaponLengthInput',
    'weaponTurnRateInput',
    'weaponAccelerationInput',
    'weaponMaxSpeedInput',
    'weaponPierceInput',
    'weaponPierceDamageScaleInput',
    'weaponPierceDamageFalloffInput',
    'weaponVerticalVelocityInput',
    'weaponGravityInput',
    'weaponMaxArcHeightInput',
    'weaponShadowRadiusInput',
    'weaponBlastRadiusInput',
    'weaponBlastDamageInput',
    'weaponBlastKnockbackInput',
    'weaponTargetHintInput',
    'weaponDetonateAtTargetInput',
    'weaponZCollisionInput',
    'weaponSpriteInput',
    'weaponLandingMarkerSpriteInput',
    'weaponEmitsProjectilesInput',
    'patternKindSelect',
    'patternTargetSelect',
    'patternBehaviorSelect',
    'initialDelayInput',
    'intervalInput',
    'countInput',
    'patternSpeedInput',
    'spreadInput',
    'jitterInput',
    'sequenceRestInput',
    'delayBeforeAccelerationInput',
    'stopBeforeAccelerationInput',
    'accelerationInput',
    'accelerationDurationInput',
    'accelerationSpreadInput',
    'maxSpeedInput',
    'explodeAfterAccelerationInput',
    'patternRadiusInput',
    'patternDamageInput',
    'patternImpulseInput',
    'patternPierceInput',
    'patternPierceDamageScaleInput',
    'patternPierceDamageFalloffInput',
    'patternColorInput',
    'absorbsPlayerProjectilesInput',
    'absorbHpInput',
    'patternVerticalVelocityInput',
    'patternGravityInput',
    'patternMaxArcHeightInput',
    'patternShadowRadiusInput',
    'blastRadiusInput',
    'blastDamageInput',
    'blastImpulseInput',
    'patternLifetimeInput',
    'patternSpriteInput',
    'patternLandingMarkerSpriteInput',
    'statusEffectTypeSelect',
    'statusEffectIntensityInput',
    'statusEffectDurationInput',
    'statusEffectMaterialRulesInput',
  ].map((id) => [id, document.querySelector(`#${id}`)]),
);

let mode = 'weapon';
let asset = clone(canonAssets.weapon[0]);

for (const status of CANON_STATUSES) fields.canonStatusSelect.append(new Option(status, status));
for (const behavior of PROJECTILE_BEHAVIORS) fields.weaponBehaviorSelect.append(new Option(behavior, behavior));
for (const behavior of PROJECTILE_BEHAVIORS) fields.patternBehaviorSelect.append(new Option(behavior, behavior));
for (const kind of PATTERN_EMITTER_KINDS) fields.patternKindSelect.append(new Option(kind, kind));
for (const type of STATUS_EFFECT_TYPES) fields.statusEffectTypeSelect.append(new Option(STATUS_EFFECT_DEFINITIONS[type].label, type));

weaponModeButton.addEventListener('click', () => setMode('weapon'));
patternModeButton.addEventListener('click', () => setMode('pattern'));
statusEffectModeButton.addEventListener('click', () => setMode('statusEffect'));
assetSelect.addEventListener('change', () => loadSelectedAsset());
downloadButton.addEventListener('click', downloadJson);
copyJsonButton.addEventListener('click', async () => navigator.clipboard.writeText(jsonOutput.value));
applyJsonButton.addEventListener('click', applyJson);
for (const field of Object.values(fields)) field.addEventListener('input', renderFromFields);

setMode('weapon');

function setMode(nextMode) {
  mode = nextMode;
  weaponModeButton.setAttribute('aria-pressed', String(mode === 'weapon'));
  patternModeButton.setAttribute('aria-pressed', String(mode === 'pattern'));
  statusEffectModeButton.setAttribute('aria-pressed', String(mode === 'statusEffect'));
  weaponFields.hidden = mode !== 'weapon';
  patternFields.hidden = mode !== 'pattern';
  statusEffectFields.hidden = mode !== 'statusEffect';
  statsTitle.textContent = mode === 'weapon' ? 'Weapon Stats' : mode === 'pattern' ? 'Pattern Stats' : 'Status Effect';
  populateAssetSelect();
  loadSelectedAsset();
}

function populateAssetSelect() {
  assetSelect.replaceChildren(...canonAssets[mode].map((definition) => new Option(definition.displayName ?? definition.label ?? definition.assetId ?? definition.id, definition.assetId ?? definition.id)));
}

function loadSelectedAsset() {
  asset = clone(canonAssets[mode].find((definition) => (definition.assetId ?? definition.id) === assetSelect.value) ?? canonAssets[mode][0]);
  syncAssetToFields();
  render();
}

function syncAssetToFields() {
  fields.assetIdInput.value = asset.assetId ?? asset.id ?? '';
  fields.displayNameInput.value = asset.displayName ?? asset.label ?? '';
  fields.schemaInput.value = asset.schemaVersion ?? CONTENT_SCHEMA_VERSION;
  fields.canonStatusSelect.value = asset.canonStatus ?? 'EXPERIMENTAL';
  fields.tagsInput.value = (asset.tags ?? []).join(', ');
  if (mode === 'weapon') syncWeaponToFields();
  if (mode === 'pattern') syncPatternToFields();
  if (mode === 'statusEffect') syncStatusEffectToFields();
}

function syncWeaponToFields() {
  const projectile = asset.projectile ?? {};
  fields.ammoInput.value = asset.ammo ?? 0;
  fields.heatInput.value = asset.heat ?? 0;
  fields.cooldownInput.value = asset.cooldown ?? 0;
  fields.weaponBehaviorSelect.value = projectile.behavior ?? 'ballistic';
  fields.weaponSpeedInput.value = projectile.projectileSpeed ?? projectile.speed ?? 0;
  fields.weaponRadiusInput.value = projectile.radius ?? 0;
  fields.weaponDamageInput.value = projectile.damage ?? 0;
  fields.weaponImpulseInput.value = projectile.impulse ?? 0;
  fields.weaponLifetimeInput.value = projectile.lifetime ?? 0;
  fields.weaponLengthInput.value = projectile.length ?? 0;
  fields.weaponTurnRateInput.value = projectile.turnRate ?? 0;
  fields.weaponAccelerationInput.value = projectile.acceleration ?? 0;
  fields.weaponMaxSpeedInput.value = projectile.maxSpeed ?? 0;
  fields.weaponPierceInput.value = projectile.pierce ?? 0;
  fields.weaponPierceDamageScaleInput.value = projectile.pierceDamageScale ?? 0.7;
  fields.weaponPierceDamageFalloffInput.value = projectile.pierceDamageFalloff ?? 0.68;
  fields.weaponVerticalVelocityInput.value = projectile.verticalVelocity ?? projectile.vz ?? 0;
  fields.weaponGravityInput.value = projectile.gravity ?? 0;
  fields.weaponMaxArcHeightInput.value = projectile.maxArcHeight ?? projectile.arcHeight ?? 1;
  fields.weaponShadowRadiusInput.value = projectile.shadowRadius ?? projectile.radius ?? 0;
  fields.weaponBlastRadiusInput.value = projectile.blastRadiusCells ?? (projectile.blastRadius != null ? projectile.blastRadius / CELL_SIZE : 0);
  fields.weaponBlastDamageInput.value = projectile.blastDamage ?? 0;
  fields.weaponBlastKnockbackInput.value = projectile.blastKnockback ?? 0;
  fields.weaponTargetHintInput.value = projectile.targetHint ?? '';
  fields.weaponDetonateAtTargetInput.checked = Boolean(projectile.detonateAtTarget);
  fields.weaponZCollisionInput.checked = Boolean(projectile.zCollision);
  fields.weaponSpriteInput.value = projectile.sprite ? JSON.stringify(projectile.sprite, null, 2) : '';
  fields.weaponLandingMarkerSpriteInput.value = projectile.landingMarkerSprite ? JSON.stringify(projectile.landingMarkerSprite, null, 2) : '';
  fields.weaponEmitsProjectilesInput.value = projectile.emitsProjectiles ? JSON.stringify(projectile.emitsProjectiles, null, 2) : '';
}

function syncPatternToFields() {
  const emitter = asset.emitter ?? {};
  const projectile = emitter.projectile ?? {};
  fields.patternKindSelect.value = emitter.kind ?? 'aimed';
  fields.patternTargetSelect.value = emitter.target ?? 'player';
  fields.patternBehaviorSelect.value = projectile.behavior ?? 'ballistic';
  fields.initialDelayInput.value = asset.initialDelay ?? 0;
  fields.intervalInput.value = asset.interval ?? 1;
  fields.countInput.value = emitter.count ?? 1;
  fields.patternSpeedInput.value = emitter.speed ?? 0;
  fields.spreadInput.value = emitter.spreadRadians ?? 0;
  fields.jitterInput.value = emitter.jitterRadians ?? 0;
  fields.sequenceRestInput.value = emitter.sequenceRest ?? 0;
  fields.delayBeforeAccelerationInput.value = projectile.delayBeforeAcceleration ?? 0;
  fields.stopBeforeAccelerationInput.checked = Boolean(projectile.stopBeforeAcceleration);
  fields.accelerationInput.value = projectile.acceleration ?? 0;
  fields.accelerationDurationInput.value = projectile.accelerationDuration ?? 0;
  fields.accelerationSpreadInput.value = projectile.accelerationSpreadRadians ?? 0;
  fields.maxSpeedInput.value = projectile.maxSpeed ?? 0;
  fields.explodeAfterAccelerationInput.checked = Boolean(projectile.explodeAfterAcceleration);
  fields.patternRadiusInput.value = projectile.radius ?? 0;
  fields.patternDamageInput.value = projectile.damage ?? 0;
  fields.patternImpulseInput.value = projectile.impulse ?? 0;
  fields.patternPierceInput.value = projectile.pierce ?? 0;
  fields.patternPierceDamageScaleInput.value = projectile.pierceDamageScale ?? 0.7;
  fields.patternPierceDamageFalloffInput.value = projectile.pierceDamageFalloff ?? 0.68;
  fields.patternColorInput.value = projectile.color ?? '#ffb25f';
  fields.absorbsPlayerProjectilesInput.checked = Boolean(projectile.absorbsPlayerProjectiles);
  fields.absorbHpInput.value = projectile.absorbHp ?? 0;
  fields.patternVerticalVelocityInput.value = projectile.verticalVelocity ?? projectile.vz ?? 0;
  fields.patternGravityInput.value = projectile.gravity ?? 0;
  fields.patternMaxArcHeightInput.value = projectile.maxArcHeight ?? projectile.arcHeight ?? 1;
  fields.patternShadowRadiusInput.value = projectile.shadowRadius ?? projectile.radius ?? 0;
  fields.blastRadiusInput.value = projectile.blastOnExpire?.radius ?? 0;
  fields.blastDamageInput.value = projectile.blastOnExpire?.damage ?? 0;
  fields.blastImpulseInput.value = projectile.blastOnExpire?.impulse ?? 0;
  fields.patternLifetimeInput.value = projectile.lifetime ?? 0;
  fields.patternSpriteInput.value = projectile.sprite ? JSON.stringify(projectile.sprite, null, 2) : '';
  fields.patternLandingMarkerSpriteInput.value = projectile.landingMarkerSprite ? JSON.stringify(projectile.landingMarkerSprite, null, 2) : '';
}

function syncStatusEffectToFields() {
  fields.statusEffectTypeSelect.value = asset.type ?? STATUS_EFFECT_TYPES[0];
  fields.statusEffectIntensityInput.value = asset.intensity ?? 1;
  fields.statusEffectDurationInput.value = asset.duration ?? STATUS_EFFECT_DEFINITIONS[asset.type]?.defaultDuration ?? 1;
  fields.statusEffectMaterialRulesInput.value = JSON.stringify(asset.materialRules ?? {}, null, 2);
}

function renderFromFields() {
  asset = mode === 'weapon' ? weaponFromFields() : mode === 'pattern' ? patternFromFields() : statusEffectFromFields();
  render();
}

function render() {
  drawPreview();
  renderJson();
  renderStatus();
}

function baseMetadataFromFields() {
  return {
    schemaVersion: fields.schemaInput.value.trim(),
    assetId: fields.assetIdInput.value.trim(),
    displayName: fields.displayNameInput.value.trim(),
    author: asset.author,
    provenance: asset.provenance,
    canonStatus: fields.canonStatusSelect.value,
    dependencies: asset.dependencies,
    derivedFrom: asset.derivedFrom,
    tags: fields.tagsInput.value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
}

function weaponFromFields() {
  const projectile = { ...(asset.projectile ?? {}) };
  Object.assign(projectile, {
    weapon: fields.assetIdInput.value.trim(),
    behavior: fields.weaponBehaviorSelect.value,
    projectileSpeed: readNumber(fields.weaponSpeedInput),
    radius: readNumber(fields.weaponRadiusInput),
    damage: readNumber(fields.weaponDamageInput),
    impulse: readNumber(fields.weaponImpulseInput),
    lifetime: readNumber(fields.weaponLifetimeInput),
    length: readNumber(fields.weaponLengthInput),
  });
  assignOptionalNumber(projectile, 'turnRate', fields.weaponTurnRateInput, asset.projectile?.turnRate);
  assignOptionalNumber(projectile, 'acceleration', fields.weaponAccelerationInput, asset.projectile?.acceleration);
  assignOptionalNumber(projectile, 'maxSpeed', fields.weaponMaxSpeedInput, asset.projectile?.maxSpeed);
  assignOptionalNumber(projectile, 'pierce', fields.weaponPierceInput, asset.projectile?.pierce);
  assignOptionalNumber(projectile, 'pierceDamageScale', fields.weaponPierceDamageScaleInput, asset.projectile?.pierceDamageScale, 0.7);
  assignOptionalNumber(projectile, 'pierceDamageFalloff', fields.weaponPierceDamageFalloffInput, asset.projectile?.pierceDamageFalloff, 0.68);
  assignOptionalNumber(projectile, 'blastRadiusCells', fields.weaponBlastRadiusInput, asset.projectile?.blastRadiusCells);
  assignOptionalNumber(projectile, 'blastDamage', fields.weaponBlastDamageInput, asset.projectile?.blastDamage);
  assignOptionalNumber(projectile, 'blastKnockback', fields.weaponBlastKnockbackInput, asset.projectile?.blastKnockback);
  assignOptionalString(projectile, 'targetHint', fields.weaponTargetHintInput, asset.projectile?.targetHint);
  assignOptionalBoolean(projectile, 'detonateAtTarget', fields.weaponDetonateAtTargetInput, asset.projectile?.detonateAtTarget);
  assignOptionalBoolean(projectile, 'zCollision', fields.weaponZCollisionInput, asset.projectile?.zCollision);
  assignOptionalObject(projectile, 'sprite', fields.weaponSpriteInput, asset.projectile?.sprite);
  assignOptionalObject(projectile, 'landingMarkerSprite', fields.weaponLandingMarkerSpriteInput, asset.projectile?.landingMarkerSprite);
  assignOptionalObject(projectile, 'emitsProjectiles', fields.weaponEmitsProjectilesInput, asset.projectile?.emitsProjectiles);
  assignArcFields(projectile, {
    behavior: fields.weaponBehaviorSelect.value,
    previousProjectile: asset.projectile,
    verticalVelocityInput: fields.weaponVerticalVelocityInput,
    gravityInput: fields.weaponGravityInput,
    maxArcHeightInput: fields.weaponMaxArcHeightInput,
    shadowRadiusInput: fields.weaponShadowRadiusInput,
  });
  return {
    ...baseMetadataFromFields(),
    ammo: readNumber(fields.ammoInput),
    heat: readNumber(fields.heatInput),
    cooldown: readNumber(fields.cooldownInput),
    projectile,
  };
}

function patternFromFields() {
  const emitterKind = fields.patternKindSelect.value;
  const previousProjectile = asset.emitter?.projectile ?? {};
  const projectile = {
    ...previousProjectile,
    team: 'enemy',
    weapon: 'bullet',
    behavior: fields.patternBehaviorSelect.value,
    radius: readNumber(fields.patternRadiusInput),
    damage: readNumber(fields.patternDamageInput),
    impulse: readNumber(fields.patternImpulseInput),
    lifetime: readNumber(fields.patternLifetimeInput),
  };
  assignOptionalString(projectile, 'color', fields.patternColorInput, previousProjectile.color, '#ffb25f');
  assignOptionalBoolean(projectile, 'absorbsPlayerProjectiles', fields.absorbsPlayerProjectilesInput, previousProjectile.absorbsPlayerProjectiles);
  assignOptionalNumber(projectile, 'absorbHp', fields.absorbHpInput, previousProjectile.absorbHp);
  assignOptionalNumber(projectile, 'delayBeforeAcceleration', fields.delayBeforeAccelerationInput, previousProjectile.delayBeforeAcceleration);
  assignOptionalBoolean(projectile, 'stopBeforeAcceleration', fields.stopBeforeAccelerationInput, previousProjectile.stopBeforeAcceleration);
  assignOptionalNumber(projectile, 'acceleration', fields.accelerationInput, previousProjectile.acceleration);
  assignOptionalNumber(projectile, 'accelerationDuration', fields.accelerationDurationInput, previousProjectile.accelerationDuration);
  assignOptionalNumber(projectile, 'maxSpeed', fields.maxSpeedInput, previousProjectile.maxSpeed);
  assignOptionalNumber(projectile, 'accelerationSpreadRadians', fields.accelerationSpreadInput, previousProjectile.accelerationSpreadRadians);
  assignOptionalBoolean(projectile, 'explodeAfterAcceleration', fields.explodeAfterAccelerationInput, previousProjectile.explodeAfterAcceleration);
  assignOptionalNumber(projectile, 'pierce', fields.patternPierceInput, previousProjectile.pierce);
  assignOptionalNumber(projectile, 'pierceDamageScale', fields.patternPierceDamageScaleInput, previousProjectile.pierceDamageScale, 0.7);
  assignOptionalNumber(projectile, 'pierceDamageFalloff', fields.patternPierceDamageFalloffInput, previousProjectile.pierceDamageFalloff, 0.68);
  assignOptionalObject(projectile, 'sprite', fields.patternSpriteInput, previousProjectile.sprite);
  assignOptionalObject(projectile, 'landingMarkerSprite', fields.patternLandingMarkerSpriteInput, previousProjectile.landingMarkerSprite);
  assignArcFields(projectile, {
    behavior: fields.patternBehaviorSelect.value,
    previousProjectile,
    verticalVelocityInput: fields.patternVerticalVelocityInput,
    gravityInput: fields.patternGravityInput,
    maxArcHeightInput: fields.patternMaxArcHeightInput,
    shadowRadiusInput: fields.patternShadowRadiusInput,
  });
  const blastOnExpire = optionalBlastOnExpire(previousProjectile.blastOnExpire);
  if (blastOnExpire) projectile.blastOnExpire = blastOnExpire;

  const sequenceRest = readNumber(fields.sequenceRestInput);
  return {
    ...baseMetadataFromFields(),
    initialDelay: readNumber(fields.initialDelayInput),
    interval: readNumber(fields.intervalInput),
    emitter: {
      kind: emitterKind,
      target: fields.patternTargetSelect.value,
      count: readNumber(fields.countInput),
      speed: readNumber(fields.patternSpeedInput),
      ...(emitterKind === 'sequentialRadial' || sequenceRest > 0 ? { sequenceRest } : {}),
      spreadRadians: readNumber(fields.spreadInput),
      jitterRadians: readNumber(fields.jitterInput),
      projectile,
    },
  };
}

function statusEffectFromFields() {
  const type = fields.statusEffectTypeSelect.value;
  const defaults = STATUS_EFFECT_DEFINITIONS[type];
  const materialRules = parseJsonObject(fields.statusEffectMaterialRulesInput.value, asset.materialRules ?? {});
  return {
    schemaVersion: fields.schemaInput.value.trim(),
    id: fields.assetIdInput.value.trim(),
    displayName: fields.displayNameInput.value.trim(),
    type,
    intensity: readNumber(fields.statusEffectIntensityInput),
    duration: readNumber(fields.statusEffectDurationInput),
    stackMode: asset.stackMode ?? defaults.stackMode,
    materialRules,
    editorTags: asset.editorTags ?? defaults.editorTags,
    canonStatus: fields.canonStatusSelect.value,
    tags: fields.tagsInput.value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
}

function assignArcFields(projectile, options) {
  const previousProjectile = options.previousProjectile ?? {};
  const shouldEmit = options.behavior === 'arc' || previousProjectile.behavior === 'arc';
  assignArcNumber(projectile, 'verticalVelocity', options.verticalVelocityInput, previousProjectile.verticalVelocity ?? previousProjectile.vz, shouldEmit);
  assignArcNumber(projectile, 'gravity', options.gravityInput, previousProjectile.gravity, shouldEmit);
  assignArcNumber(projectile, 'maxArcHeight', options.maxArcHeightInput, previousProjectile.maxArcHeight ?? previousProjectile.arcHeight, shouldEmit);
  assignArcNumber(projectile, 'shadowRadius', options.shadowRadiusInput, previousProjectile.shadowRadius, shouldEmit);
}

function assignArcNumber(target, key, input, previousValue, force) {
  const value = readNumber(input);
  if (force || value > 0 || previousValue != null) target[key] = value;
}

function assignOptionalNumber(target, key, input, previousValue, defaultValue = 0) {
  const value = readNumber(input);
  if (value !== defaultValue || previousValue != null) target[key] = value;
}

function assignOptionalBoolean(target, key, input, previousValue) {
  if (input.checked || previousValue != null) target[key] = input.checked;
}

function assignOptionalString(target, key, input, previousValue, defaultValue = '') {
  const value = input.value.trim();
  if (value !== defaultValue || previousValue != null) target[key] = value;
}

function assignOptionalObject(target, key, input, previousValue) {
  const value = input.value.trim();
  if (!value) {
    delete target[key];
    return;
  }
  const parsed = parseJsonObject(value, previousValue ?? null);
  if (parsed) target[key] = parsed;
}

function optionalBlastOnExpire(previousBlast) {
  const blast = {
    radius: readNumber(fields.blastRadiusInput),
    damage: readNumber(fields.blastDamageInput),
    impulse: readNumber(fields.blastImpulseInput),
  };
  if (blast.radius > 0 || blast.damage > 0 || blast.impulse > 0 || previousBlast != null) return blast;
  return null;
}

function drawPreview() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#0d1010';
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  if (mode === 'weapon') drawWeaponPreview();
  if (mode === 'pattern') drawPatternPreview();
  if (mode === 'statusEffect') drawStatusEffectPreview();
}

function drawGrid() {
  context.strokeStyle = 'rgb(244 238 228 / 0.08)';
  context.lineWidth = 1;
  for (let x = 40; x < canvas.width; x += 40) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  for (let y = 40; y < canvas.height; y += 40) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }
}

function drawWeaponPreview() {
  const projectile = asset.projectile ?? {};
  const origin = { x: 120, y: canvas.height / 2 };
  context.fillStyle = '#f7c06a';
  context.beginPath();
  context.arc(origin.x, origin.y, 13, 0, Math.PI * 2);
  context.fill();
  const length = projectile.behavior === 'beam' ? Math.min(560, projectile.length ?? 360) : Math.min(560, (projectile.projectileSpeed ?? 100) * 2.2);
  context.strokeStyle = projectile.behavior === 'beam' ? '#83f7ff' : '#ffb25f';
  context.lineWidth = projectile.behavior === 'beam' ? Math.max(2, (projectile.radius ?? 1) * 5) : 3;
  if (projectile.behavior === 'arc') drawArcProjectilePath(origin, origin.x + length, origin.y, projectile);
  else {
    context.beginPath();
    context.moveTo(origin.x, origin.y);
    context.lineTo(origin.x + length, origin.y);
    context.stroke();
  }
  context.fillStyle = '#f4eee4';
  context.beginPath();
  context.arc(origin.x + length, origin.y, Math.max(3, projectile.radius ?? 3), 0, Math.PI * 2);
  context.fill();
  drawProjectileBlastPreview(origin.x + length, origin.y, projectile);
  if (projectile.behavior === 'homing') drawArc(origin.x + length * 0.45, origin.y - 54, 70, 0.4, 2.6, '#6fe0bf');
}

function drawPatternPreview() {
  const emitter = asset.emitter ?? {};
  const origin = { x: canvas.width / 2, y: canvas.height / 2 };
  context.fillStyle = '#ff8f70';
  context.beginPath();
  context.arc(origin.x, origin.y, 12, 0, Math.PI * 2);
  context.fill();
  const count = Math.max(0, Math.floor(emitter.count ?? 0));
  const speedLength = Math.max(26, Math.min(210, (emitter.speed ?? 80) * 1.5));
  for (let index = 0; index < count; index += 1) {
    const angle =
      emitter.kind === 'radial' || emitter.kind === 'sequentialRadial'
        ? (Math.PI * 2 * index) / Math.max(1, count)
        : aimedSpreadOffset(index, count, emitter.spreadRadians ?? 0);
    drawArrow(origin, angle, speedLength, index);
  }
  if (emitter.kind === 'aimed' || emitter.kind === 'sequentialRadial') {
    context.strokeStyle = 'rgb(111 224 191 / 0.5)';
    context.setLineDash([8, 8]);
    context.beginPath();
    context.moveTo(origin.x, origin.y);
    context.lineTo(canvas.width - 80, origin.y);
    context.stroke();
    context.setLineDash([]);
  }
}

function drawArrow(origin, angle, length, index) {
  const projectile = asset.emitter?.projectile ?? {};
  const color = projectile.color ?? (index % 2 === 0 ? '#fff1a8' : '#9be5ff');
  const end = { x: origin.x + Math.cos(angle) * length, y: origin.y + Math.sin(angle) * length };
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 3;
  if (projectile.behavior === 'arc') drawArcProjectilePath(origin, end.x, end.y, projectile);
  else {
    context.beginPath();
    context.moveTo(origin.x, origin.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }
  context.beginPath();
  context.arc(end.x, end.y, Math.max(3, projectile.radius ?? 4), 0, Math.PI * 2);
  context.fill();
  drawProjectileBlastPreview(end.x, end.y, projectile, 0.72);
}

function drawProjectileBlastPreview(x, y, projectile, scale = 1) {
  const blastRadius = projectileBlastRadius(projectile);
  if (blastRadius <= 0) return;
  const radius = Math.min(120, Math.max(12, blastRadius * 5 * scale));
  context.save();
  context.strokeStyle = 'rgb(255 143 97 / 0.62)';
  context.fillStyle = 'rgb(255 143 97 / 0.1)';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  drawBlastTunnelPreview(x - radius * 0.42, y, scale);
  context.restore();
}

function drawBlastTunnelPreview(x, y, scale) {
  const size = 10 * scale;
  for (let index = 0; index < 5; index += 1) {
    context.globalAlpha = 0.82 - index * 0.12;
    context.fillStyle = index < 3 ? '#ff8f70' : '#f7c06a';
    context.fillRect(x + index * size * 0.82, y - size / 2, size, size);
  }
  context.globalAlpha = 1;
}

function drawArcProjectilePath(origin, endX, endY, projectile) {
  const height = Math.min(150, Math.max(24, projectile.maxArcHeight ?? projectile.verticalVelocity ?? 40));
  const midX = (origin.x + endX) / 2;
  const midY = (origin.y + endY) / 2 - height;
  context.beginPath();
  context.moveTo(origin.x, origin.y);
  context.quadraticCurveTo(midX, midY, endX, endY);
  context.stroke();
  context.save();
  context.strokeStyle = 'rgb(244 238 228 / 0.3)';
  context.fillStyle = 'rgb(0 0 0 / 0.32)';
  context.beginPath();
  context.ellipse(endX, endY, Math.max(4, projectile.shadowRadius ?? projectile.radius ?? 4), Math.max(2, (projectile.shadowRadius ?? projectile.radius ?? 4) * 0.45), 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function drawStatusEffectPreview() {
  const colors = {
    fire: '#ff7a1a',
    acid: '#9cff4a',
    frost: '#83f7ff',
    ionSurge: '#c6a7ff',
    shield: '#6fe0bf',
    refractive: '#f4eee4',
    reflective: '#ffd166',
  };
  const color = colors[asset.type] ?? '#f4eee4';
  const center = { x: canvas.width / 2, y: canvas.height / 2 };
  const intensity = Math.max(0.2, asset.intensity ?? 1);
  context.fillStyle = color;
  context.strokeStyle = color;
  context.globalAlpha = 0.18;
  context.beginPath();
  context.arc(center.x, center.y, 70 * intensity, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 0.86;
  context.lineWidth = 4;
  context.beginPath();
  context.arc(center.x, center.y, 42, 0, Math.PI * 2);
  context.stroke();
  context.globalAlpha = 1;
  context.fillStyle = '#f4eee4';
  context.font = '700 18px Inter, sans-serif';
  context.textAlign = 'center';
  context.fillText(asset.displayName ?? STATUS_EFFECT_DEFINITIONS[asset.type]?.label ?? asset.type, center.x, center.y + 7);
}

function drawArc(x, y, radius, start, end, color) {
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(x, y, radius, start, end);
  context.stroke();
}

function renderJson() {
  jsonOutput.value = `${JSON.stringify(asset, null, 2)}\n`;
}

function renderStatus() {
  const report = mode === 'weapon' ? validateWeaponDefinition(asset) : mode === 'pattern' ? validatePatternDefinition(asset) : validateStatusEffectDefinition(asset);
  const lines = [
    `<span><strong>${report.valid ? 'Valid runtime asset' : 'Asset needs changes'}</strong></span>`,
    `<span>${mode === 'weapon' ? weaponSummary(asset) : mode === 'pattern' ? patternSummary(asset) : statusEffectSummary(asset)}</span>`,
  ];
  lines.push(...report.errors.map((error) => `<span class="error">Error: ${escapeHtml(error)}</span>`));
  lines.push(...report.warnings.map((warning) => `<span class="warning">Warning: ${escapeHtml(warning)}</span>`));
  statusPanel.innerHTML = lines.join('');
}

function weaponSummary(definition) {
  return `${definition.projectile?.behavior ?? 'unknown'} projectile, ${definition.projectile?.damage ?? 0} damage, ${definition.ammo ?? 0} ammo${pierceSummary(definition.projectile)}${blastSummary(definition.projectile)}`;
}

function patternSummary(definition) {
  return `${definition.emitter?.kind ?? 'unknown'} emitter, ${definition.emitter?.projectile?.behavior ?? 'unknown'} projectile, ${definition.emitter?.count ?? 0} shots every ${definition.interval ?? 0}s${pierceSummary(definition.emitter?.projectile)}${blastSummary(definition.emitter?.projectile)}`;
}

function statusEffectSummary(definition) {
  return `${definition.type ?? 'unknown'} effect, intensity ${definition.intensity ?? 0}, ${definition.duration ?? 0}s duration`;
}

function applyJson() {
  try {
    const parsed = JSON.parse(jsonOutput.value);
    mode = parsed.emitter ? 'pattern' : STATUS_EFFECT_TYPES.includes(parsed.type) ? 'statusEffect' : 'weapon';
    weaponModeButton.setAttribute('aria-pressed', String(mode === 'weapon'));
    patternModeButton.setAttribute('aria-pressed', String(mode === 'pattern'));
    statusEffectModeButton.setAttribute('aria-pressed', String(mode === 'statusEffect'));
    weaponFields.hidden = mode !== 'weapon';
    patternFields.hidden = mode !== 'pattern';
    statusEffectFields.hidden = mode !== 'statusEffect';
    statsTitle.textContent = mode === 'weapon' ? 'Weapon Stats' : mode === 'pattern' ? 'Pattern Stats' : 'Status Effect';
    asset = parsed;
    syncAssetToFields();
    render();
  } catch (error) {
    statusPanel.innerHTML = `<span class="error">Error: ${escapeHtml(error.message)}</span>`;
  }
}

function downloadJson() {
  const blob = new Blob([jsonOutput.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${asset.assetId || asset.id || mode}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function aimedSpreadOffset(index, count, spread) {
  if (count <= 1) return 0;
  return ((index / (count - 1)) - 0.5) * spread * 2;
}

function projectileBlastRadius(projectile = {}) {
  return projectile.blastOnExpire?.radius ?? projectile.blastRadius ?? (projectile.blastRadiusCells != null ? projectile.blastRadiusCells * CELL_SIZE : 0);
}

function blastSummary(projectile = {}) {
  const radius = projectileBlastRadius(projectile);
  if (radius <= 0) return '';
  const damage = projectile.blastOnExpire?.damage ?? projectile.blastDamage ?? 0;
  return `, blast r${roundMetric(radius)} d${roundMetric(damage)} with overkill propagation`;
}

function pierceSummary(projectile = {}) {
  const pierce = projectile.pierce ?? 0;
  if (pierce <= 0) return '';
  return `, pierces ${roundMetric(pierce)} voxel hits`;
}

function roundMetric(value) {
  return Number(value).toFixed(2).replace(/\.?0+$/, '');
}

function readNumber(input) {
  return Number(input.value);
}

function parseJsonObject(value, fallback = {}) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
