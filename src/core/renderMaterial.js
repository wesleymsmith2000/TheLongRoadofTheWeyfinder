import { clamp } from './math.js';
import { CANON_STATUSES, CONTENT_SCHEMA_VERSION, isCompatibleSchemaVersion, isNonEmptyString, isPlainObject, isStringArray } from './contentSchema.js';

export const MATERIAL_TEXTURE_PATTERNS = ['none', 'noise', 'mottle', 'grain', 'brushed', 'diagonal_weave', 'speckle', 'strata', 'scorch'];
export const MATERIAL_TEXTURE_COORDINATE_MODES = ['WORLD_SPACE', 'CONSTRUCT_LOCAL', 'CELL_LOCAL'];
export const SPECTRAL_BANDS = ['UV', 'VIOLET', 'BLUE', 'GREEN', 'RED', 'IR', 'BROAD_WHITE'];
export const PREVIEW_LIGHT_BANDS = ['OFF', 'BROAD_WHITE', 'UV', 'VIOLET', 'BLUE', 'GREEN', 'RED', 'IR'];
export const LIGHT_SOURCE_TYPES = ['point', 'spot', 'pulse'];
export const LIGHT_PRIORITIES = ['CRITICAL', 'MAJOR', 'MINOR'];
export const PHOSPHOR_CHARGE_GRANULARITIES = ['CELL', 'TILE', 'CHUNK_GRID'];
export const MATERIAL_RENDER_DEBUG_MODES = [
  'finalComposite',
  'albedoOnly',
  'textureOnly',
  'staticLight',
  'emissive',
  'dynamicLight',
  'spectralBand',
  'fluorescence',
  'phosphorCharge',
];

export const LIGHTING_PRESETS = Object.freeze({
  DAY: Object.freeze({
    id: 'DAY',
    ambientIntensity: 1,
    keyLightDirection: Object.freeze({ x: -0.7, y: -0.7 }),
    keyLightIntensity: 0.78,
    keyLightColor: '#fff1c8',
    darknessOverlay: 0.025,
    darknessColor: '#07090d',
    dynamicLightScale: 0.65,
  }),
  SUNSET: Object.freeze({
    id: 'SUNSET',
    ambientIntensity: 0.76,
    keyLightDirection: Object.freeze({ x: -0.85, y: -0.28 }),
    keyLightIntensity: 0.72,
    keyLightColor: '#ffc46f',
    darknessOverlay: 0.12,
    darknessColor: '#10080a',
    dynamicLightScale: 0.95,
  }),
  NIGHT: Object.freeze({
    id: 'NIGHT',
    ambientIntensity: 0.34,
    keyLightDirection: Object.freeze({ x: -0.45, y: -0.88 }),
    keyLightIntensity: 0.28,
    keyLightColor: '#b5c8ff',
    darknessOverlay: 0.42,
    darknessColor: '#03050a',
    dynamicLightScale: 1.45,
  }),
  MOONLIGHT: Object.freeze({
    id: 'MOONLIGHT',
    ambientIntensity: 0.48,
    keyLightDirection: Object.freeze({ x: 0.42, y: -0.9 }),
    keyLightIntensity: 0.42,
    keyLightColor: '#c9d8ff',
    darknessOverlay: 0.32,
    darknessColor: '#03070d',
    dynamicLightScale: 1.25,
  }),
  STORM: Object.freeze({
    id: 'STORM',
    ambientIntensity: 0.54,
    keyLightDirection: Object.freeze({ x: -0.62, y: -0.78 }),
    keyLightIntensity: 0.32,
    keyLightColor: '#b5c0cc',
    darknessOverlay: 0.24,
    darknessColor: '#071014',
    dynamicLightScale: 1.15,
  }),
  VOID: Object.freeze({
    id: 'VOID',
    ambientIntensity: 0.2,
    keyLightDirection: Object.freeze({ x: 0, y: -1 }),
    keyLightIntensity: 0.16,
    keyLightColor: '#97a6ff',
    darknessOverlay: 0.56,
    darknessColor: '#010106',
    dynamicLightScale: 1.7,
  }),
});

export const DEFAULT_RENDER_MATERIAL = Object.freeze({
  id: 'default',
  albedo: '#bcc2b1',
  texture: Object.freeze({ type: 'procedural', pattern: 'none', coordinateMode: 'CONSTRUCT_LOCAL', scale: 1, strength: 0, seedOffset: 0, orientation: 0 }),
  shading: Object.freeze({ ambient: 0.42, diffuse: 0.8, roughness: 0.75, metallic: 0, reflectivity: 0.1 }),
  emissive: Object.freeze({ color: null, intensity: 0, lightRadius: 0, pulsePeriod: 0, flicker: 0 }),
  fluorescence: Object.freeze({ enabled: false, excitationBands: Object.freeze([]), emissionColor: '#53ffd8', emissionIntensity: 0, threshold: 0.35 }),
  phosphorescence: Object.freeze({
    enabled: false,
    excitationBands: Object.freeze([]),
    emissionColor: '#9dff7a',
    maxCharge: 1,
    chargeRate: 0.8,
    decayHalfLife: 4,
    minimumVisibleCharge: 0.08,
    chargeGranularity: 'CELL',
  }),
  pseudoHeight: 1,
});

const COLOR_CACHE = new Map();
const MAX_COLOR_CACHE_ENTRIES = 384;

export function resolveEnvironmentLighting(source = 'DAY') {
  if (typeof source === 'string') return LIGHTING_PRESETS[source.toUpperCase()] ?? LIGHTING_PRESETS.DAY;
  const preset = LIGHTING_PRESETS[String(source?.preset ?? source?.id ?? 'DAY').toUpperCase()] ?? LIGHTING_PRESETS.DAY;
  return {
    ...preset,
    ...finiteLightingPatch(source),
    keyLightDirection: normalizeDirection(source?.keyLightDirection ?? preset.keyLightDirection),
    keyLightColor: validHex(source?.keyLightColor) ? source.keyLightColor : preset.keyLightColor,
    darknessColor: validHex(source?.darknessColor) ? source.darknessColor : preset.darknessColor,
  };
}

export function normalizeRenderMaterial(source = {}, fallback = {}) {
  const render = source?.render ?? source ?? {};
  const base = {
    ...DEFAULT_RENDER_MATERIAL,
    id: render.id ?? source?.materialId ?? source?.material ?? source?.type ?? fallback.id ?? DEFAULT_RENDER_MATERIAL.id,
    albedo: validHex(render.albedo) ? render.albedo : fallback.albedo ?? DEFAULT_RENDER_MATERIAL.albedo,
  };
  const texture = render.texture ?? {};
  const shading = render.shading ?? {};
  const emissive = render.emissive ?? {};
  const fluorescence = render.fluorescence ?? {};
  const phosphorescence = render.phosphorescence ?? {};
  return {
    id: base.id,
    albedo: base.albedo,
    texture: {
      ...DEFAULT_RENDER_MATERIAL.texture,
      ...texture,
      type: texture.type === 'atlas' ? 'atlas' : 'procedural',
      atlasAssetId: typeof texture.atlasAssetId === 'string' ? texture.atlasAssetId : null,
      pattern: normalizeTexturePattern(texture.pattern),
      coordinateMode: normalizeCoordinateMode(texture.coordinateMode),
      scale: finiteOr(texture.scale, DEFAULT_RENDER_MATERIAL.texture.scale),
      strength: clamp(finiteOr(texture.strength, DEFAULT_RENDER_MATERIAL.texture.strength), 0, 1),
      seedOffset: Math.trunc(finiteOr(texture.seedOffset, 0)),
      orientation: finiteOr(texture.orientation, DEFAULT_RENDER_MATERIAL.texture.orientation),
    },
    shading: {
      ...DEFAULT_RENDER_MATERIAL.shading,
      ...shading,
      ambient: clamp(finiteOr(shading.ambient, DEFAULT_RENDER_MATERIAL.shading.ambient), 0, 1.5),
      diffuse: clamp(finiteOr(shading.diffuse, DEFAULT_RENDER_MATERIAL.shading.diffuse), 0, 1.5),
      roughness: clamp(finiteOr(shading.roughness, DEFAULT_RENDER_MATERIAL.shading.roughness), 0, 1),
      metallic: clamp(finiteOr(shading.metallic, DEFAULT_RENDER_MATERIAL.shading.metallic), 0, 1),
      reflectivity: clamp(finiteOr(shading.reflectivity ?? render.reflectivity, DEFAULT_RENDER_MATERIAL.shading.reflectivity), 0, 1.5),
    },
    emissive: {
      color: validHex(emissive.color ?? render.emissiveColor) ? (emissive.color ?? render.emissiveColor) : null,
      intensity: clamp(finiteOr(emissive.intensity ?? render.emissiveIntensity, DEFAULT_RENDER_MATERIAL.emissive.intensity), 0, 3),
      lightRadius: Math.max(0, finiteOr(emissive.lightRadius, DEFAULT_RENDER_MATERIAL.emissive.lightRadius)),
      pulsePeriod: Math.max(0, finiteOr(emissive.pulsePeriod, DEFAULT_RENDER_MATERIAL.emissive.pulsePeriod)),
      flicker: clamp(finiteOr(emissive.flicker, DEFAULT_RENDER_MATERIAL.emissive.flicker), 0, 1),
    },
    fluorescence: {
      enabled: fluorescence.enabled === true,
      excitationBands: normalizeBands(fluorescence.excitationBands),
      emissionColor: validHex(fluorescence.emissionColor) ? fluorescence.emissionColor : DEFAULT_RENDER_MATERIAL.fluorescence.emissionColor,
      emissionIntensity: clamp(finiteOr(fluorescence.emissionIntensity, DEFAULT_RENDER_MATERIAL.fluorescence.emissionIntensity), 0, 3),
      threshold: clamp(finiteOr(fluorescence.threshold, DEFAULT_RENDER_MATERIAL.fluorescence.threshold), 0, 1),
    },
    phosphorescence: {
      enabled: phosphorescence.enabled === true,
      excitationBands: normalizeBands(phosphorescence.excitationBands),
      emissionColor: validHex(phosphorescence.emissionColor) ? phosphorescence.emissionColor : DEFAULT_RENDER_MATERIAL.phosphorescence.emissionColor,
      maxCharge: Math.max(0, finiteOr(phosphorescence.maxCharge, DEFAULT_RENDER_MATERIAL.phosphorescence.maxCharge)),
      chargeRate: Math.max(0, finiteOr(phosphorescence.chargeRate, DEFAULT_RENDER_MATERIAL.phosphorescence.chargeRate)),
      decayHalfLife: Math.max(0.001, finiteOr(phosphorescence.decayHalfLife, DEFAULT_RENDER_MATERIAL.phosphorescence.decayHalfLife)),
      minimumVisibleCharge: clamp(finiteOr(phosphorescence.minimumVisibleCharge, DEFAULT_RENDER_MATERIAL.phosphorescence.minimumVisibleCharge), 0, 1),
      chargeGranularity: PHOSPHOR_CHARGE_GRANULARITIES.includes(phosphorescence.chargeGranularity)
        ? phosphorescence.chargeGranularity
        : DEFAULT_RENDER_MATERIAL.phosphorescence.chargeGranularity,
    },
    pseudoHeight: clamp(finiteOr(render.pseudoHeight, DEFAULT_RENDER_MATERIAL.pseudoHeight), 0, 3),
  };
}

export function sampleMaterialVariation(material, x, y) {
  const texture = material?.texture ?? DEFAULT_RENDER_MATERIAL.texture;
  const strength = texture.strength ?? 0;
  if (strength <= 0 || texture.pattern === 'none') return 0;
  const scale = Math.max(0.001, texture.scale ?? 1);
  const sx = x * scale;
  const sy = y * scale;
  const seed = texture.seedOffset ?? 0;
  let value = 0;
  if (texture.pattern === 'grain' || texture.pattern === 'brushed') {
    value = Math.sin(sx * 0.41 + hashUnit(Math.floor(sy), seed, 17) * Math.PI * 2) * 0.55 + (hashUnit(Math.floor(sx), Math.floor(sy), seed) * 2 - 1) * 0.45;
  } else if (texture.pattern === 'diagonal_weave') {
    const a = Math.sin((sx + sy) * 1.7);
    const b = Math.sin((sx - sy) * 1.3 + seed);
    value = (a + b) * 0.5;
  } else if (texture.pattern === 'speckle' || texture.pattern === 'scorch') {
    const roll = hashUnit(Math.floor(sx * 2), Math.floor(sy * 2), seed);
    value = roll > (texture.pattern === 'scorch' ? 0.76 : 0.86) ? -1 : roll * 0.55;
  } else if (texture.pattern === 'strata') {
    value = Math.sin(sy * 0.9 + hashUnit(Math.floor(sx * 0.2), seed, 43) * 1.5);
  } else {
    value =
      (hashUnit(Math.floor(sx), Math.floor(sy), seed) +
        hashUnit(Math.floor(sx * 0.5), Math.floor(sy * 0.5), seed + 101) +
        hashUnit(Math.floor(sx * 2), Math.floor(sy * 2), seed + 211)) /
        1.5 -
      1;
  }
  return clamp(value * strength, -1, 1);
}

export function computeVoxelSurfaceLight(mask, vx, vy, environment = LIGHTING_PRESETS.DAY) {
  const key = normalizeDirection(environment.keyLightDirection ?? LIGHTING_PRESETS.DAY.keyLightDirection);
  let exposed = 0;
  let edgeLight = 0;
  let orthogonalNeighbors = 0;
  let diagonalNeighbors = 0;
  const cardinal = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  for (const side of cardinal) {
    if (isOccupied(mask, vx + side.x, vy + side.y)) {
      orthogonalNeighbors += 1;
    } else {
      exposed += 1;
      edgeLight += side.x * key.x + side.y * key.y;
    }
  }
  for (const side of [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
  ]) {
    if (isOccupied(mask, vx + side.x, vy + side.y)) diagonalNeighbors += 1;
  }
  const ao = clamp((orthogonalNeighbors + diagonalNeighbors * 0.5) / 6, 0, 1);
  const directional = clamp(edgeLight / Math.max(1, exposed), -1, 1);
  return { exposed, ao, directional };
}

export function shadeMaterialColor(baseColor, amount = 0) {
  const rounded = Math.round(amount);
  const key = `${baseColor}:${rounded}`;
  const cached = COLOR_CACHE.get(key);
  if (cached) return cached;
  const rgb = parseHex(baseColor);
  if (!rgb) return baseColor;
  const color = `rgb(${clampColor(rgb.r + rounded)} ${clampColor(rgb.g + rounded)} ${clampColor(rgb.b + rounded)})`;
  if (COLOR_CACHE.size >= MAX_COLOR_CACHE_ENTRIES) COLOR_CACHE.delete(COLOR_CACHE.keys().next().value);
  COLOR_CACHE.set(key, color);
  return color;
}

export function renderMaterialBrightness(material, environmentInput = 'DAY') {
  const environment = resolveEnvironmentLighting(environmentInput);
  const reflected = environment.ambientIntensity * 0.45 + environment.keyLightIntensity * (material.shading?.reflectivity ?? 0.1);
  const emitted = material.emissive?.intensity ?? 0;
  return reflected + emitted;
}

export function validateMaterialDefinition(definition) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(definition)) return { valid: false, errors: ['Material definition must be an object.'], warnings };
  if (!isCompatibleSchemaVersion(definition.schemaVersion)) errors.push(`Unsupported material schemaVersion "${definition.schemaVersion ?? 'missing'}". Expected 0.x.`);
  if (!isNonEmptyString(definition.assetId)) errors.push('assetId must be a non-empty string.');
  if (!isNonEmptyString(definition.materialId ?? definition.id)) errors.push('materialId must be a non-empty string.');
  if (definition.canonStatus != null && !CANON_STATUSES.includes(definition.canonStatus)) errors.push(`canonStatus must be one of: ${CANON_STATUSES.join(', ')}.`);
  if (definition.tags != null && !isStringArray(definition.tags)) warnings.push('tags should be an array of strings.');
  errors.push(...validateRenderMaterialFields(definition.render, 'render'));
  if (definition.lightSource != null) errors.push(...validateLightSourceFields(definition.lightSource, 'lightSource'));
  return { valid: errors.length === 0, errors, warnings };
}

export function normalizeMaterialDefinition(definition = {}) {
  const source = isPlainObject(definition) ? definition : {};
  const materialId = nonEmptyString(source.materialId ?? source.id, 'material.unnamed');
  return {
    schemaVersion: source.schemaVersion ?? CONTENT_SCHEMA_VERSION,
    assetId: nonEmptyString(source.assetId, `material.${materialId}`),
    materialId,
    displayName: nonEmptyString(source.displayName, materialId),
    canonStatus: nonEmptyString(source.canonStatus, 'EXPERIMENTAL'),
    tags: Array.isArray(source.tags) ? source.tags.filter((tag) => typeof tag === 'string') : [],
    render: normalizeRenderMaterial({ materialId, render: source.render }),
    lightSource: source.lightSource ? normalizeLightSource(source.lightSource) : null,
  };
}

export function validateLightingPresetDefinition(definition) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(definition)) return { valid: false, errors: ['Lighting preset definition must be an object.'], warnings };
  if (!isCompatibleSchemaVersion(definition.schemaVersion)) errors.push(`Unsupported lighting preset schemaVersion "${definition.schemaVersion ?? 'missing'}". Expected 0.x.`);
  if (!isNonEmptyString(definition.assetId)) errors.push('assetId must be a non-empty string.');
  if (!isNonEmptyString(definition.presetId ?? definition.id)) errors.push('presetId must be a non-empty string.');
  if (definition.canonStatus != null && !CANON_STATUSES.includes(definition.canonStatus)) errors.push(`canonStatus must be one of: ${CANON_STATUSES.join(', ')}.`);
  if (definition.tags != null && !isStringArray(definition.tags)) warnings.push('tags should be an array of strings.');
  for (const key of ['ambientIntensity', 'keyLightIntensity', 'darknessOverlay', 'dynamicLightScale']) {
    validateFiniteNumber(definition[key] ?? LIGHTING_PRESETS.DAY[key], key, errors, { min: 0, max: key === 'darknessOverlay' ? 1 : undefined });
  }
  if (!validHex(definition.keyLightColor ?? LIGHTING_PRESETS.DAY.keyLightColor)) errors.push('keyLightColor must be a #rrggbb color.');
  const direction = definition.keyLightDirection ?? LIGHTING_PRESETS.DAY.keyLightDirection;
  if (!isPlainObject(direction) || !Number.isFinite(direction.x) || !Number.isFinite(direction.y)) errors.push('keyLightDirection must be an object with finite x and y numbers.');
  return { valid: errors.length === 0, errors, warnings };
}

export function normalizeLightingPresetDefinition(definition = LIGHTING_PRESETS.DAY) {
  const source = isPlainObject(definition) ? definition : LIGHTING_PRESETS.DAY;
  const presetId = nonEmptyString(source.presetId ?? source.id, 'DAY');
  const resolved = resolveEnvironmentLighting({ preset: presetId, ...source });
  return {
    schemaVersion: source.schemaVersion ?? CONTENT_SCHEMA_VERSION,
    assetId: nonEmptyString(source.assetId, `lighting.preset.${presetId.toLowerCase()}`),
    presetId,
    id: presetId,
    displayName: nonEmptyString(source.displayName, presetId),
    canonStatus: nonEmptyString(source.canonStatus, 'EXPERIMENTAL'),
    tags: Array.isArray(source.tags) ? source.tags.filter((tag) => typeof tag === 'string') : [],
    ambientIntensity: resolved.ambientIntensity,
    keyLightDirection: resolved.keyLightDirection,
    keyLightIntensity: resolved.keyLightIntensity,
    keyLightColor: resolved.keyLightColor,
    darknessOverlay: resolved.darknessOverlay,
    darknessColor: resolved.darknessColor,
    dynamicLightScale: resolved.dynamicLightScale,
  };
}

export function normalizeLightSource(source = {}) {
  return {
    type: LIGHT_SOURCE_TYPES.includes(source.type) ? source.type : 'point',
    color: validHex(source.color) ? source.color : '#ffffff',
    radius: Math.max(0, finiteOr(source.radius, 64)),
    intensity: Math.max(0, finiteOr(source.intensity, 1)),
    falloff: Math.max(0, finiteOr(source.falloff, 1)),
    flicker: clamp(finiteOr(source.flicker, 0), 0, 1),
    pulsePeriod: Math.max(0, finiteOr(source.pulsePeriod, 0)),
    spectralBand: SPECTRAL_BANDS.includes(source.spectralBand) ? source.spectralBand : 'BROAD_WHITE',
    priority: LIGHT_PRIORITIES.includes(source.priority) ? source.priority : 'MAJOR',
    semanticImportance: typeof source.semanticImportance === 'string' ? source.semanticImportance : '',
  };
}

export function previewMaterialColor(materialInput, environmentInput = 'DAY', options = {}) {
  const material = normalizeRenderMaterial(materialInput);
  const environment = resolveEnvironmentLighting(environmentInput);
  const variation = sampleMaterialVariation(material, options.x ?? 0, options.y ?? 0);
  const base = parseHex(material.albedo) ?? parseHex(DEFAULT_RENDER_MATERIAL.albedo);
  const textured = scaleRgb(base, 1 + variation * 0.45);
  const reflected = renderMaterialBrightness(material, environment);
  let color = scaleRgb(textured, clamp(reflected, 0.025, 1.65));
  if (material.emissive.color && material.emissive.intensity > 0) color = addRgb(color, scaleRgb(parseHex(material.emissive.color), material.emissive.intensity));
  const excitationBand = options.excitationBand ?? 'BROAD_WHITE';
  const excitationIntensity = finiteOr(options.excitationIntensity, 1);
  if (material.fluorescence.enabled && bandMatches(material.fluorescence.excitationBands, excitationBand) && excitationIntensity >= material.fluorescence.threshold) {
    color = addRgb(color, scaleRgb(parseHex(material.fluorescence.emissionColor), material.fluorescence.emissionIntensity * excitationIntensity));
  }
  const phosphorCharge = clamp(finiteOr(options.phosphorCharge, 0), 0, 1);
  if (material.phosphorescence.enabled && phosphorCharge >= material.phosphorescence.minimumVisibleCharge) {
    color = addRgb(color, scaleRgb(parseHex(material.phosphorescence.emissionColor), phosphorCharge * material.phosphorescence.maxCharge));
  }
  return rgbHex(color);
}

export function phosphorChargeAfterExposure(phosphorescenceInput, options = {}) {
  const phosphorescence = normalizeRenderMaterial({ render: { phosphorescence: phosphorescenceInput } }).phosphorescence;
  const existingCharge = clamp(finiteOr(options.existingCharge, 0), 0, phosphorescence.maxCharge);
  const exposureSeconds = Math.max(0, finiteOr(options.exposureSeconds, 0));
  const elapsedSeconds = Math.max(0, finiteOr(options.elapsedSeconds, 0));
  const lightIntensity = Math.max(0, finiteOr(options.lightIntensity, 1));
  const charged = Math.min(phosphorescence.maxCharge, existingCharge + exposureSeconds * phosphorescence.chargeRate * lightIntensity);
  return charged * Math.pow(0.5, elapsedSeconds / phosphorescence.decayHalfLife);
}

export function validateRenderMaterialFields(render, label = 'render') {
  const errors = [];
  if (render == null) return errors;
  if (typeof render !== 'object' || Array.isArray(render)) return [`${label} must be an object when provided.`];
  if (render.albedo != null && !validHex(render.albedo)) errors.push(`${label}.albedo must be a #rrggbb color when provided.`);
  if (render.pseudoHeight != null && !Number.isFinite(render.pseudoHeight)) errors.push(`${label}.pseudoHeight must be a finite number when provided.`);
  if (render.emissiveColor != null && !validHex(render.emissiveColor)) errors.push(`${label}.emissiveColor must be a #rrggbb color when provided.`);
  if (render.emissiveIntensity != null && !Number.isFinite(render.emissiveIntensity)) errors.push(`${label}.emissiveIntensity must be a finite number when provided.`);
  validateTextureFields(render.texture, `${label}.texture`, errors);
  validateShadingFields(render.shading, `${label}.shading`, errors);
  validateEmissiveFields(render.emissive, `${label}.emissive`, errors);
  validateFluorescenceFields(render.fluorescence, `${label}.fluorescence`, errors);
  validatePhosphorescenceFields(render.phosphorescence, `${label}.phosphorescence`, errors);
  return errors;
}

export function hashUnit(a, b = 0, c = 0) {
  let x = Math.trunc(a) | 0;
  x = Math.imul(x ^ (Math.trunc(b) | 0), 0x45d9f3b);
  x = Math.imul(x ^ (Math.trunc(c) | 0), 0x45d9f3b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967295;
}

function isOccupied(mask, x, y) {
  const voxel = mask?.[y]?.[x];
  return Boolean(voxel && voxel.hp > 0);
}

function finiteLightingPatch(source) {
  if (!source || typeof source !== 'object') return {};
  const patch = {};
  for (const key of ['ambientIntensity', 'keyLightIntensity', 'darknessOverlay', 'dynamicLightScale']) {
    if (Number.isFinite(source[key])) patch[key] = Math.max(0, source[key]);
  }
  return patch;
}

function validateTextureFields(texture, label, errors) {
  if (texture == null) return;
  if (!isPlainObject(texture)) {
    errors.push(`${label} must be an object when provided.`);
    return;
  }
  if (texture.type != null && !['procedural', 'atlas'].includes(texture.type)) errors.push(`${label}.type must be procedural or atlas when provided.`);
  if (texture.atlasAssetId != null && !isNonEmptyString(texture.atlasAssetId)) errors.push(`${label}.atlasAssetId must be a non-empty string when provided.`);
  if (texture.pattern != null && !MATERIAL_TEXTURE_PATTERNS.includes(texture.pattern)) errors.push(`${label}.pattern must be one of: ${MATERIAL_TEXTURE_PATTERNS.join(', ')}.`);
  if (texture.coordinateMode != null && !MATERIAL_TEXTURE_COORDINATE_MODES.includes(texture.coordinateMode)) {
    errors.push(`${label}.coordinateMode must be one of: ${MATERIAL_TEXTURE_COORDINATE_MODES.join(', ')}.`);
  }
  validateFiniteNumber(texture.scale ?? 1, `${label}.scale`, errors, { min: 0 });
  validateFiniteNumber(texture.strength ?? 0, `${label}.strength`, errors, { min: 0, max: 1 });
  validateFiniteNumber(texture.seedOffset ?? 0, `${label}.seedOffset`, errors);
  validateFiniteNumber(texture.orientation ?? 0, `${label}.orientation`, errors);
}

function validateShadingFields(shading, label, errors) {
  if (shading == null) return;
  if (!isPlainObject(shading)) {
    errors.push(`${label} must be an object when provided.`);
    return;
  }
  for (const key of ['ambient', 'diffuse', 'roughness', 'metallic', 'reflectivity']) {
    validateFiniteNumber(shading[key] ?? DEFAULT_RENDER_MATERIAL.shading[key], `${label}.${key}`, errors, { min: 0 });
  }
}

function validateEmissiveFields(emissive, label, errors) {
  if (emissive == null) return;
  if (!isPlainObject(emissive)) {
    errors.push(`${label} must be an object when provided.`);
    return;
  }
  if (emissive.color != null && !validHex(emissive.color)) errors.push(`${label}.color must be a #rrggbb color when provided.`);
  validateFiniteNumber(emissive.intensity ?? 0, `${label}.intensity`, errors, { min: 0 });
  validateFiniteNumber(emissive.lightRadius ?? 0, `${label}.lightRadius`, errors, { min: 0 });
  validateFiniteNumber(emissive.pulsePeriod ?? 0, `${label}.pulsePeriod`, errors, { min: 0 });
  validateFiniteNumber(emissive.flicker ?? 0, `${label}.flicker`, errors, { min: 0, max: 1 });
}

function validateFluorescenceFields(fluorescence, label, errors) {
  if (fluorescence == null) return;
  if (!isPlainObject(fluorescence)) {
    errors.push(`${label} must be an object when provided.`);
    return;
  }
  if (fluorescence.enabled != null && typeof fluorescence.enabled !== 'boolean') errors.push(`${label}.enabled must be boolean when provided.`);
  if (fluorescence.excitationBands != null && !bandsAreValid(fluorescence.excitationBands)) errors.push(`${label}.excitationBands must contain only: ${SPECTRAL_BANDS.join(', ')}.`);
  if (fluorescence.emissionColor != null && !validHex(fluorescence.emissionColor)) errors.push(`${label}.emissionColor must be a #rrggbb color when provided.`);
  validateFiniteNumber(fluorescence.emissionIntensity ?? 0, `${label}.emissionIntensity`, errors, { min: 0 });
  validateFiniteNumber(fluorescence.threshold ?? 0.35, `${label}.threshold`, errors, { min: 0, max: 1 });
}

function validatePhosphorescenceFields(phosphorescence, label, errors) {
  if (phosphorescence == null) return;
  if (!isPlainObject(phosphorescence)) {
    errors.push(`${label} must be an object when provided.`);
    return;
  }
  if (phosphorescence.enabled != null && typeof phosphorescence.enabled !== 'boolean') errors.push(`${label}.enabled must be boolean when provided.`);
  if (phosphorescence.excitationBands != null && !bandsAreValid(phosphorescence.excitationBands)) errors.push(`${label}.excitationBands must contain only: ${SPECTRAL_BANDS.join(', ')}.`);
  if (phosphorescence.emissionColor != null && !validHex(phosphorescence.emissionColor)) errors.push(`${label}.emissionColor must be a #rrggbb color when provided.`);
  for (const key of ['maxCharge', 'chargeRate', 'decayHalfLife', 'minimumVisibleCharge']) {
    validateFiniteNumber(phosphorescence[key] ?? DEFAULT_RENDER_MATERIAL.phosphorescence[key], `${label}.${key}`, errors, { min: 0 });
  }
  if (phosphorescence.chargeGranularity != null && !PHOSPHOR_CHARGE_GRANULARITIES.includes(phosphorescence.chargeGranularity)) {
    errors.push(`${label}.chargeGranularity must be one of: ${PHOSPHOR_CHARGE_GRANULARITIES.join(', ')}.`);
  }
}

function validateLightSourceFields(lightSource, label) {
  const errors = [];
  if (!isPlainObject(lightSource)) return [`${label} must be an object when provided.`];
  if (!LIGHT_SOURCE_TYPES.includes(lightSource.type)) errors.push(`${label}.type must be one of: ${LIGHT_SOURCE_TYPES.join(', ')}.`);
  if (!validHex(lightSource.color)) errors.push(`${label}.color must be a #rrggbb color.`);
  validateFiniteNumber(lightSource.radius, `${label}.radius`, errors, { min: 0 });
  validateFiniteNumber(lightSource.intensity, `${label}.intensity`, errors, { min: 0 });
  validateFiniteNumber(lightSource.falloff ?? 1, `${label}.falloff`, errors, { min: 0 });
  validateFiniteNumber(lightSource.flicker ?? 0, `${label}.flicker`, errors, { min: 0, max: 1 });
  validateFiniteNumber(lightSource.pulsePeriod ?? 0, `${label}.pulsePeriod`, errors, { min: 0 });
  if (lightSource.spectralBand != null && !SPECTRAL_BANDS.includes(lightSource.spectralBand)) errors.push(`${label}.spectralBand must be one of: ${SPECTRAL_BANDS.join(', ')}.`);
  if (lightSource.priority != null && !LIGHT_PRIORITIES.includes(lightSource.priority)) errors.push(`${label}.priority must be one of: ${LIGHT_PRIORITIES.join(', ')}.`);
  return errors;
}

function validateFiniteNumber(value, label, errors, options = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${label} must be a finite number.`);
    return;
  }
  if (options.min != null && value < options.min) errors.push(`${label} must be at least ${options.min}.`);
  if (options.max != null && value > options.max) errors.push(`${label} must be at most ${options.max}.`);
}

function normalizeDirection(direction) {
  const x = Number(direction?.x ?? 0);
  const y = Number(direction?.y ?? -1);
  const length = Math.hypot(x, y);
  if (length <= 0.000001) return { x: 0, y: -1 };
  return { x: x / length, y: y / length };
}

function normalizeTexturePattern(pattern) {
  return MATERIAL_TEXTURE_PATTERNS.includes(pattern) ? pattern : DEFAULT_RENDER_MATERIAL.texture.pattern;
}

function normalizeCoordinateMode(mode) {
  return MATERIAL_TEXTURE_COORDINATE_MODES.includes(mode) ? mode : DEFAULT_RENDER_MATERIAL.texture.coordinateMode;
}

function normalizeBands(bands) {
  return Array.isArray(bands) ? bands.filter((band) => SPECTRAL_BANDS.includes(band)) : [];
}

function bandsAreValid(bands) {
  return Array.isArray(bands) && bands.every((band) => SPECTRAL_BANDS.includes(band));
}

function bandMatches(bands, band) {
  return bands.includes(band);
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function nonEmptyString(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function validHex(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

function parseHex(hex) {
  if (!validHex(hex)) return null;
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: n >> 16, g: (n >> 8) & 255, b: n & 255 };
}

function scaleRgb(color, amount) {
  return {
    r: color.r * amount,
    g: color.g * amount,
    b: color.b * amount,
  };
}

function addRgb(a, b) {
  return {
    r: a.r + b.r,
    g: a.g + b.g,
    b: a.b + b.b,
  };
}

function rgbHex(color) {
  return `#${[color.r, color.g, color.b].map((value) => clampColor(value).toString(16).padStart(2, '0')).join('')}`;
}

function clampColor(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
