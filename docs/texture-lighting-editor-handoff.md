# Texture And Lighting Editor Handoff v0.1

Runtime now supports a Canvas 2D 2.5D render-material and dynamic-lighting layer without WebGL.

## Runtime Files

- `src/core/renderMaterial.js`
  - Lighting presets: `DAY`, `SUNSET`, `NIGHT`, `MOONLIGHT`, `STORM`, `VOID`.
  - Render material normalization and validation.
  - Deterministic procedural texture sampling.
  - Exposed-neighbor, AO, and directional shade helpers.
  - Visual material and lighting preset asset validators.
  - Fluorescence and phosphorescence schema support for upcoming puzzle cues.
- `src/core/dynamicLighting.js`
  - Capped dynamic light collection from player, boost, projectiles, and light-tagged particles.
- `src/render/canvasRenderer.js`
  - Intact cells now use small cached sprites.
  - Damaged cells still use live microvoxel rendering.
  - A low-resolution screen-space light buffer composites dynamic lights after world rendering.
- `src/render/terrainRenderer.js`
  - Cached terrain fallback tiles use deterministic procedural material variation.

## Construct Cell Fields

Editors may add a render block to any construct cell:

```json
{
  "id": "beacon-core",
  "type": "core",
  "gridX": 0,
  "gridY": 0,
  "render": {
    "albedo": "#728094",
    "texture": {
      "type": "procedural",
      "pattern": "mottle",
      "scale": 0.35,
      "strength": 0.2,
      "seedOffset": 7
    },
    "shading": {
      "ambient": 0.42,
      "diffuse": 0.8,
      "roughness": 0.75,
      "metallic": 0,
      "reflectivity": 0.2
    },
    "emissive": {
      "color": "#bffcff",
      "intensity": 0.5
    },
    "pseudoHeight": 2
  }
}
```

All fields are optional. Defaults preserve current appearance.

Supported procedural patterns in v0.1:

```text
none
noise
mottle
grain
brushed
diagonal_weave
speckle
strata
scorch
```

## Terrain Material Fields

Terrain material definitions may also include the same `render` object. This is separate from `physics`, `systems`, and `hazardTags`.

## Visual Material Assets

The canon content pack now accepts standalone `materials` and `lightingPresets` manifest keys.

Initial sample material assets:

```text
content/materials/fate_gold_glitter.json
content/materials/moonlit_beacon_material.json
content/materials/fluorescent_hidden_message_ink.json
content/materials/phosphor_trail_green.json
```

Initial sample lighting presets:

```text
content/lighting/steppes_day.json
content/lighting/steppes_moonlight.json
content/lighting/void_darkness.json
```

## Level Lighting Fields

Levels may define:

```json
{
  "lighting": {
    "preset": "MOONLIGHT",
    "ambientIntensity": 0.42,
    "keyLightDirection": { "x": -0.5, "y": -1 },
    "keyLightIntensity": 0.35,
    "darknessOverlay": 0.3,
    "dynamicLightScale": 1.2
  }
}
```

Use presets first, then override only the values needed for the zone.

## Spectral Puzzle Fields

Materials may define:

```json
{
  "fluorescence": {
    "enabled": true,
    "excitationBands": ["UV", "VIOLET"],
    "emissionColor": "#53ffd8",
    "emissionIntensity": 1.05,
    "threshold": 0.28
  },
  "phosphorescence": {
    "enabled": true,
    "excitationBands": ["UV", "BLUE"],
    "emissionColor": "#9dff7a",
    "maxCharge": 1,
    "chargeRate": 0.82,
    "decayHalfLife": 4,
    "minimumVisibleCharge": 0.08,
    "chargeGranularity": "CELL"
  }
}
```

Encounter effects now validate lighting/puzzle verbs such as `setLightingPreset`, `transitionLightingPreset`, `changeLightBand`, `revealFluorescentLayer`, `chargeMaterial`, and `clearPhosphorCharge`.

## Notes

- Texture coordinates for construct cells are construct-local, so neighboring cells can have continuous deterministic surface variation.
- Dynamic lights should stay semantic and sparse. Do not emit hundreds of small light objects from editor-authored effects.
- Emissive material should be used for objects that remain visibly self-lit at night. High reflectivity alone will brighten under daylight but darken under moon/night presets.
- Image atlas material support is intentionally deferred until procedural material behavior is stable.
