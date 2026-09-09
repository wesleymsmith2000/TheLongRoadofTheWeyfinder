import { CANON_STATUSES, CONTENT_SCHEMA_VERSION } from '../core/contentSchema.js';
import {
  LIGHTING_PRESETS,
  MATERIAL_RENDER_DEBUG_MODES,
  MATERIAL_TEXTURE_COORDINATE_MODES,
  MATERIAL_TEXTURE_PATTERNS,
  PHOSPHOR_CHARGE_GRANULARITIES,
  PREVIEW_LIGHT_BANDS,
  normalizeLightingPresetDefinition,
  normalizeMaterialDefinition,
  phosphorChargeAfterExposure,
  previewMaterialColor,
  resolveEnvironmentLighting,
  validateLightingPresetDefinition,
  validateMaterialDefinition,
} from '../core/renderMaterial.js';
import { bindBuildVersion } from './versionBadge.js';
import moonlitBeaconMaterial from '../../content/materials/moonlit_beacon_material.json' with { type: 'json' };
import fateGoldGlitter from '../../content/materials/fate_gold_glitter.json' with { type: 'json' };
import fluorescentHiddenMessageInk from '../../content/materials/fluorescent_hidden_message_ink.json' with { type: 'json' };
import phosphorTrailGreen from '../../content/materials/phosphor_trail_green.json' with { type: 'json' };
import steppesDay from '../../content/lighting/steppes_day.json' with { type: 'json' };
import steppesMoonlight from '../../content/lighting/steppes_moonlight.json' with { type: 'json' };
import voidDarkness from '../../content/lighting/void_darkness.json' with { type: 'json' };

const canvas = document.querySelector('#previewCanvas');
const context = canvas.getContext('2d');
const statusPanel = document.querySelector('#statusPanel');
const materialJsonOutput = document.querySelector('#materialJsonOutput');
const lightingJsonOutput = document.querySelector('#lightingJsonOutput');
const materialExamples = [moonlitBeaconMaterial, fateGoldGlitter, fluorescentHiddenMessageInk, phosphorTrailGreen];
const lightingExamples = [steppesDay, steppesMoonlight, voidDarkness, ...Object.values(LIGHTING_PRESETS)];

const fields = Object.fromEntries(
  [
    'materialSelect',
    'assetIdInput',
    'materialIdInput',
    'displayNameInput',
    'tagsInput',
    'albedoInput',
    'texturePatternSelect',
    'textureScaleInput',
    'textureStrengthInput',
    'textureSeedInput',
    'coordinateModeSelect',
    'pseudoHeightInput',
    'ambientInput',
    'diffuseInput',
    'reflectivityInput',
    'emissiveColorInput',
    'emissiveIntensityInput',
    'lightRadiusInput',
    'pulsePeriodInput',
    'fluorescenceEnabledInput',
    'fluorescenceBandsInput',
    'fluorescenceColorInput',
    'fluorescenceIntensityInput',
    'fluorescenceThresholdInput',
    'phosphorescenceEnabledInput',
    'phosphorescenceBandsInput',
    'phosphorescenceColorInput',
    'chargeRateInput',
    'decayHalfLifeInput',
    'chargeGranularitySelect',
    'lightingSelect',
    'excitationBandSelect',
    'debugModeSelect',
    'lightXInput',
    'lightYInput',
    'timelineInput',
  ].map((id) => [id, document.querySelector(`#${id}`)]),
);

let material = normalizeMaterialDefinition(moonlitBeaconMaterial);
let lighting = normalizeLightingPresetDefinition(steppesDay);

bindBuildVersion();
populateSelect(fields.materialSelect, materialExamples.map((entry) => [entry.assetId, entry.displayName ?? entry.assetId]));
populateSelect(fields.texturePatternSelect, MATERIAL_TEXTURE_PATTERNS);
populateSelect(fields.coordinateModeSelect, MATERIAL_TEXTURE_COORDINATE_MODES);
populateSelect(fields.chargeGranularitySelect, PHOSPHOR_CHARGE_GRANULARITIES);
populateSelect(fields.lightingSelect, lightingExamples.map((entry) => [entry.assetId ?? entry.id, entry.displayName ?? entry.presetId ?? entry.id]));
populateSelect(fields.excitationBandSelect, PREVIEW_LIGHT_BANDS);
populateSelect(fields.debugModeSelect, MATERIAL_RENDER_DEBUG_MODES);

document.querySelector('#resetButton').addEventListener('click', () => loadMaterial(moonlitBeaconMaterial));
document.querySelector('#downloadMaterialButton').addEventListener('click', () => downloadJson(materialJsonOutput.value, `${material.assetId}.json`));
document.querySelector('#downloadLightingButton').addEventListener('click', () => downloadJson(lightingJsonOutput.value, `${lighting.assetId}.json`));
document.querySelector('#applyMaterialJsonButton').addEventListener('click', applyMaterialJson);
document.querySelector('#applyLightingJsonButton').addEventListener('click', applyLightingJson);
document.querySelector('#copyMaterialJsonButton').addEventListener('click', () => navigator.clipboard.writeText(materialJsonOutput.value));
document.querySelector('#copyLightingJsonButton').addEventListener('click', () => navigator.clipboard.writeText(lightingJsonOutput.value));

fields.materialSelect.addEventListener('change', () => {
  const example = materialExamples.find((entry) => entry.assetId === fields.materialSelect.value);
  if (example) loadMaterial(example);
});
fields.lightingSelect.addEventListener('change', () => {
  const example = lightingExamples.find((entry) => (entry.assetId ?? entry.id) === fields.lightingSelect.value);
  if (example) {
    lighting = normalizeLightingPresetDefinition(example);
    syncLightingJson();
    render();
  }
});
for (const field of Object.values(fields)) {
  field.addEventListener('input', renderFromFields);
  field.addEventListener('change', renderFromFields);
}

loadMaterial(material);

function loadMaterial(nextMaterial) {
  material = normalizeMaterialDefinition(nextMaterial);
  syncMaterialFields();
  render();
}

function syncMaterialFields() {
  fields.materialSelect.value = material.assetId;
  fields.assetIdInput.value = material.assetId;
  fields.materialIdInput.value = material.materialId;
  fields.displayNameInput.value = material.displayName;
  fields.tagsInput.value = material.tags.join(', ');
  fields.albedoInput.value = material.render.albedo;
  fields.texturePatternSelect.value = material.render.texture.pattern;
  fields.textureScaleInput.value = material.render.texture.scale;
  fields.textureStrengthInput.value = material.render.texture.strength;
  fields.textureSeedInput.value = material.render.texture.seedOffset;
  fields.coordinateModeSelect.value = material.render.texture.coordinateMode;
  fields.pseudoHeightInput.value = material.render.pseudoHeight;
  fields.ambientInput.value = material.render.shading.ambient;
  fields.diffuseInput.value = material.render.shading.diffuse;
  fields.reflectivityInput.value = material.render.shading.reflectivity;
  fields.emissiveColorInput.value = material.render.emissive.color ?? '#000000';
  fields.emissiveIntensityInput.value = material.render.emissive.intensity;
  fields.lightRadiusInput.value = material.render.emissive.lightRadius ?? 0;
  fields.pulsePeriodInput.value = material.render.emissive.pulsePeriod ?? 0;
  fields.fluorescenceEnabledInput.checked = material.render.fluorescence.enabled;
  fields.fluorescenceBandsInput.value = material.render.fluorescence.excitationBands.join(', ');
  fields.fluorescenceColorInput.value = material.render.fluorescence.emissionColor;
  fields.fluorescenceIntensityInput.value = material.render.fluorescence.emissionIntensity;
  fields.fluorescenceThresholdInput.value = material.render.fluorescence.threshold;
  fields.phosphorescenceEnabledInput.checked = material.render.phosphorescence.enabled;
  fields.phosphorescenceBandsInput.value = material.render.phosphorescence.excitationBands.join(', ');
  fields.phosphorescenceColorInput.value = material.render.phosphorescence.emissionColor;
  fields.chargeRateInput.value = material.render.phosphorescence.chargeRate;
  fields.decayHalfLifeInput.value = material.render.phosphorescence.decayHalfLife;
  fields.chargeGranularitySelect.value = material.render.phosphorescence.chargeGranularity;
  fields.lightingSelect.value = lighting.assetId;
  fields.excitationBandSelect.value = 'BROAD_WHITE';
  fields.debugModeSelect.value = 'finalComposite';
  fields.lightXInput.value = lighting.keyLightDirection.x.toFixed(2);
  fields.lightYInput.value = lighting.keyLightDirection.y.toFixed(2);
  fields.timelineInput.value = 0;
}

function renderFromFields() {
  material = materialFromFields();
  lighting = lightingFromFields();
  render();
}

function materialFromFields() {
  const emissiveColor = fields.emissiveColorInput.value === '#000000' && finiteNumber(fields.emissiveIntensityInput.value, 0) <= 0 ? null : fields.emissiveColorInput.value;
  return normalizeMaterialDefinition({
    schemaVersion: CONTENT_SCHEMA_VERSION,
    assetId: clean(fields.assetIdInput.value) || 'material.creator',
    materialId: clean(fields.materialIdInput.value) || 'creator.material',
    displayName: clean(fields.displayNameInput.value) || 'Creator Material',
    canonStatus: 'EXPERIMENTAL',
    tags: parseTags(fields.tagsInput.value),
    render: {
      albedo: fields.albedoInput.value,
      texture: {
        type: 'procedural',
        pattern: fields.texturePatternSelect.value,
        coordinateMode: fields.coordinateModeSelect.value,
        scale: finiteNumber(fields.textureScaleInput.value, 1),
        strength: finiteNumber(fields.textureStrengthInput.value, 0),
        seedOffset: finiteNumber(fields.textureSeedInput.value, 0),
      },
      shading: {
        ambient: finiteNumber(fields.ambientInput.value, 0.42),
        diffuse: finiteNumber(fields.diffuseInput.value, 0.8),
        roughness: 0.75,
        metallic: 0,
        reflectivity: finiteNumber(fields.reflectivityInput.value, 0.1),
      },
      emissive: {
        color: emissiveColor,
        intensity: finiteNumber(fields.emissiveIntensityInput.value, 0),
        lightRadius: finiteNumber(fields.lightRadiusInput.value, 0),
        pulsePeriod: finiteNumber(fields.pulsePeriodInput.value, 0),
        flicker: 0,
      },
      fluorescence: {
        enabled: fields.fluorescenceEnabledInput.checked,
        excitationBands: parseBands(fields.fluorescenceBandsInput.value),
        emissionColor: fields.fluorescenceColorInput.value,
        emissionIntensity: finiteNumber(fields.fluorescenceIntensityInput.value, 0),
        threshold: finiteNumber(fields.fluorescenceThresholdInput.value, 0.35),
      },
      phosphorescence: {
        enabled: fields.phosphorescenceEnabledInput.checked,
        excitationBands: parseBands(fields.phosphorescenceBandsInput.value),
        emissionColor: fields.phosphorescenceColorInput.value,
        maxCharge: 1,
        chargeRate: finiteNumber(fields.chargeRateInput.value, 0.8),
        decayHalfLife: finiteNumber(fields.decayHalfLifeInput.value, 4),
        minimumVisibleCharge: 0.08,
        chargeGranularity: fields.chargeGranularitySelect.value,
      },
      pseudoHeight: finiteNumber(fields.pseudoHeightInput.value, 1),
    },
  });
}

function lightingFromFields() {
  const selected = lightingExamples.find((entry) => (entry.assetId ?? entry.id) === fields.lightingSelect.value) ?? lighting;
  return normalizeLightingPresetDefinition({
    ...selected,
    keyLightDirection: {
      x: finiteNumber(fields.lightXInput.value, selected.keyLightDirection?.x ?? -0.7),
      y: finiteNumber(fields.lightYInput.value, selected.keyLightDirection?.y ?? -0.7),
    },
  });
}

function render() {
  materialJsonOutput.value = `${JSON.stringify(material, null, 2)}\n`;
  syncLightingJson();
  drawPreview();
  renderStatus();
}

function syncLightingJson() {
  lightingJsonOutput.value = `${JSON.stringify(lighting, null, 2)}\n`;
}

function drawPreview() {
  const width = canvas.width;
  const height = canvas.height;
  const environment = resolveEnvironmentLighting(lighting);
  context.clearRect(0, 0, width, height);
  context.fillStyle = environment.darknessColor;
  context.fillRect(0, 0, width, height);

  drawCluster(72, 70, 5, 66);
  drawComparisonStrip(448, 74, 164, 72);
  drawHiddenMessage(82, 470, 250, 96);
  drawPhosphorTrail(402, 464, 220, 110);
  drawLabels();
}

function drawCluster(originX, originY, count, size) {
  const gap = 5;
  const pseudo = material.render.pseudoHeight * 4;
  const band = fields.excitationBandSelect.value;
  const charge = phosphorChargeAtScrub();
  for (let y = 0; y < count; y += 1) {
    for (let x = 0; x < count; x += 1) {
      const px = originX + x * (size + gap);
      const py = originY + y * (size + gap);
      if (pseudo > 0) {
        context.fillStyle = '#050707';
        context.fillRect(px + pseudo, py + pseudo, size, size);
      }
      context.fillStyle = cellPreviewColor(x, y, band, charge);
      context.fillRect(px, py, size, size);
      context.strokeStyle = 'rgb(244 238 228 / 0.18)';
      context.lineWidth = 1;
      context.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
      drawMicroTexture(px, py, size, x, y, band, charge);
    }
  }
}

function drawMicroTexture(px, py, size, cellX, cellY, band, charge) {
  const step = size / 4;
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      context.fillStyle = previewMaterialColor(material, lighting, {
        x: cellX * 4 + x,
        y: cellY * 4 + y,
        excitationBand: band,
        excitationIntensity: band === 'OFF' ? 0 : 1,
        phosphorCharge: charge,
      });
      context.globalAlpha = 0.36;
      context.fillRect(px + x * step, py + y * step, step, step);
    }
  }
  context.globalAlpha = 1;
}

function drawComparisonStrip(x, y, width, rowHeight) {
  const presets = ['DAY', 'MOONLIGHT', 'VOID'];
  for (const [index, preset] of presets.entries()) {
    const py = y + index * (rowHeight + 12);
    context.fillStyle = previewMaterialColor(material, preset, { x: index * 3, y: 0, excitationBand: 'OFF', phosphorCharge: 0 });
    context.fillRect(x, py, width, rowHeight);
    context.strokeStyle = 'rgb(244 238 228 / 0.18)';
    context.strokeRect(x + 0.5, py + 0.5, width - 1, rowHeight - 1);
    label(`${preset}`, x + 10, py + 24);
  }
}

function drawHiddenMessage(x, y, width, height) {
  context.fillStyle = previewMaterialColor(material, lighting, { x: 1, y: 9, excitationBand: 'OFF' });
  context.fillRect(x, y, width, height);
  const active = material.render.fluorescence.enabled && fields.excitationBandSelect.value !== 'OFF';
  context.fillStyle = active
    ? previewMaterialColor(material, lighting, { x: 1, y: 1, excitationBand: fields.excitationBandSelect.value, excitationIntensity: 1 })
    : 'rgb(244 238 228 / 0.08)';
  context.font = '700 34px Inter, sans-serif';
  context.fillText('LEFT', x + 58, y + 60);
  context.strokeStyle = 'rgb(244 238 228 / 0.18)';
  context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
}

function drawPhosphorTrail(x, y, width, height) {
  const charge = phosphorChargeAtScrub();
  context.fillStyle = '#050707';
  context.fillRect(x, y, width, height);
  for (let i = 0; i < 8; i += 1) {
    const localCharge = Math.max(0, charge - i * 0.08);
    context.beginPath();
    context.fillStyle = previewMaterialColor(material, 'VOID', { x: i, y: 0, phosphorCharge: localCharge, excitationBand: 'OFF' });
    context.arc(x + 24 + i * 24, y + 54 + Math.sin(i * 0.9) * 14, 9 + localCharge * 14, 0, Math.PI * 2);
    context.fill();
  }
  context.strokeStyle = 'rgb(244 238 228 / 0.18)';
  context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
}

function drawLabels() {
  label('5x5 continuous material sample', 72, 50);
  label('reflective vs emissive lighting presets', 448, 50);
  label('hidden message preview', 82, 450);
  label('phosphor trail timeline', 402, 450);
}

function cellPreviewColor(x, y, band, charge) {
  const mode = fields.debugModeSelect.value;
  if (mode === 'albedoOnly') return material.render.albedo;
  if (mode === 'emissive') return material.render.emissive.color ?? '#000000';
  if (mode === 'fluorescence') return material.render.fluorescence.enabled ? material.render.fluorescence.emissionColor : '#18201f';
  if (mode === 'phosphorCharge') return previewMaterialColor(material, 'VOID', { x, y, phosphorCharge: charge, excitationBand: 'OFF' });
  return previewMaterialColor(material, lighting, {
    x,
    y,
    excitationBand: band,
    excitationIntensity: band === 'OFF' ? 0 : 1,
    phosphorCharge: charge,
  });
}

function phosphorChargeAtScrub() {
  if (!material.render.phosphorescence.enabled) return 0;
  return phosphorChargeAfterExposure(material.render.phosphorescence, {
    exposureSeconds: 2,
    elapsedSeconds: finiteNumber(fields.timelineInput.value, 0),
    lightIntensity: fields.excitationBandSelect.value === 'OFF' ? 0.35 : 1,
  });
}

function renderStatus() {
  const materialReport = validateMaterialDefinition(material);
  const lightingReport = validateLightingPresetDefinition(lighting);
  const performanceWarnings = [];
  if ((material.render.emissive.lightRadius ?? 0) > 180) performanceWarnings.push('Large light radius: runtime should treat this as MAJOR/CRITICAL budgeted light.');
  if (material.render.emissive.intensity > 1.6) performanceWarnings.push('High emissive intensity: mobile renderer may clamp glow contribution.');
  if (material.render.phosphorescence.enabled && material.render.phosphorescence.chargeGranularity === 'CELL') {
    performanceWarnings.push('CELL phosphor charge is puzzle-friendly but stateful; use TILE/CHUNK_GRID for large terrain areas.');
  }
  statusPanel.innerHTML = [
    `<strong>${materialReport.valid && lightingReport.valid ? 'Valid material and lighting definitions' : 'Definitions need changes'}</strong>`,
    `<span>${escapeHtml(material.render.texture.pattern)} texture, ${escapeHtml(material.render.texture.coordinateMode)} coordinates, pseudo-height ${escapeHtml(material.render.pseudoHeight)}</span>`,
    ...materialReport.errors.map((error) => `<span class="error">Material: ${escapeHtml(error)}</span>`),
    ...lightingReport.errors.map((error) => `<span class="error">Lighting: ${escapeHtml(error)}</span>`),
    ...materialReport.warnings.map((warning) => `<span class="warning">Material: ${escapeHtml(warning)}</span>`),
    ...lightingReport.warnings.map((warning) => `<span class="warning">Lighting: ${escapeHtml(warning)}</span>`),
    ...performanceWarnings.map((warning) => `<span class="warning">${escapeHtml(warning)}</span>`),
  ].join('');
}

function applyMaterialJson() {
  try {
    loadMaterial(JSON.parse(materialJsonOutput.value));
  } catch (error) {
    statusPanel.innerHTML = `<span class="error">${escapeHtml(error.message)}</span>`;
  }
}

function applyLightingJson() {
  try {
    lighting = normalizeLightingPresetDefinition(JSON.parse(lightingJsonOutput.value));
    fields.lightingSelect.value = lighting.assetId;
    render();
  } catch (error) {
    statusPanel.innerHTML = `<span class="error">${escapeHtml(error.message)}</span>`;
  }
}

function label(text, x, y) {
  context.fillStyle = '#f4eee4';
  context.font = '700 13px Inter, sans-serif';
  context.fillText(text, x, y);
}

function populateSelect(select, values) {
  for (const value of values) {
    const [optionValue, labelText] = Array.isArray(value) ? value : [value, value];
    select.append(new Option(labelText, optionValue));
  }
}

function downloadJson(text, filename) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseTags(value) {
  return String(value ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseBands(value) {
  return parseTags(value).map((band) => band.toUpperCase()).filter((band) => PREVIEW_LIGHT_BANDS.includes(band) && band !== 'OFF');
}

function clean(value) {
  return String(value ?? '').trim();
}

function finiteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
