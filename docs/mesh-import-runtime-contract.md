# Mesh Import Runtime Contract

Runtime checkpoint: `v1.0.9.1`

This contract is the game-facing target for mesh voxelizer output. Conversion remains editor-owned; the runtime consumes ordinary construct, material, image, pose-rig, and animation data.

## Cell Surfaces

Surface cells may provide `render.surfaces` entries named `top`, `bottom`, `left`, `right`, `front`, or `back`:

```json
{
  "render": {
    "surfaces": {
      "top": {
        "materialId": "material.imported.body_paint",
        "normal": [0.12, -0.18, 0.98],
        "uvOrigin": [0.31, 0.42],
        "uvStepX": [0.015, 0.002],
        "uvStepY": [-0.001, 0.014]
      }
    }
  }
}
```

UV values are normalized atlas coordinates. The Canvas renderer currently samples the `top` face into its intact-cell sprite cache. Other face mappings are validated and preserved for later side-face rendering. Missing materials or images fall back to the cell material.

## Imported Materials

Material `render.pbr` supports `baseColorFactor`, `baseColorTexture`, `metallicFactor`, `roughnessFactor`, `emissiveFactor`, `emissiveTexture`, `normalTexture`, `alphaMode`, `alphaCutoff`, and `doubleSided`. Texture references use a local `atlasAssetId`; remote URLs should not be emitted.

Pass a content registry to `CanvasRenderer` as `contentRegistry`, or provide a compatible `renderAssets` resolver with `material(id)` and `image(id)` methods. Atlas sampling uses `drawImage` while building cached cell sprites and never performs per-frame `getImageData` reads.

## Imported Animation Clips

Native clips live in `poseRig.clips`. The supported first-pass coordinate mode is explicitly `XY_Z_UP`; glTF quaternion rotations are flattened to rotation around the runtime Z axis.

```json
{
  "poseRig": {
    "clips": [{
      "id": "walk",
      "displayName": "Walk",
      "duration": 1.2,
      "loop": true,
      "coordinateMode": "XY_Z_UP",
      "tracks": [{
        "joint": "leftLeg",
        "path": "translation",
        "interpolation": "LINEAR",
        "times": [0, 0.6, 1.2],
        "values": [[0, 0, 0], [3, 0, 1], [0, 0, 0]]
      }]
    }],
    "animations": [{
      "id": "play-walk",
      "kind": "clip",
      "clip": "walk",
      "driver": "time",
      "speed": 1
    }]
  }
}
```

Tracks support `translation`, quaternion `rotation` (`[x, y, z, w]`), and `scale`, with `STEP` or `LINEAR` interpolation. Parent-joint transforms are inherited by weighted cell bindings. Scale changes cell-center placement but leaves each cell visually crisp.

The top-level alias `animationClips` normalizes to `poseRig.clips`. Existing `oscillate`, `poseCycle`, and `aimAtTarget` animations remain supported.

## Gameplay Policy

Imported poses remain visual-only for this checkpoint. Collision, projectile hits, damage, connectivity, and center-of-mass calculations continue using rest-space cells. Posed hit testing is the next separate runtime milestone.
