# Performance / Spatial Broadphase / GPU Research Results

Runtime checkpoint: `v1.0.8.1`

Source handoff: `GOOGLE_AI_HANDOFF_JS_PERFORMANCE_GPU_RESEARCH.md`

## Executive Recommendation

Top path:

1. Profile on-device first with native `performance.now()` rolling metrics.
2. Remove quadratic projectile/projectile and projectile/construct scans with a custom uniform spatial grid.
3. Add adaptive thresholds: direct loops for small counts, spatial grid for high estimated work.
4. Reduce allocation with projectile pools or typed-array stores only after measuring the broadphase win.
5. Prototype PixiJS/WebGL rendering for bullets/particles/cell sprites after CPU collision is under control.
6. Defer WebGPU compute until the CPU data model is typed-array-backed and event-buffer-oriented.

No package should be installed for the first optimization pass.

## Current Research Summary

Native browser performance APIs are enough for the first profiler. `performance.now()` is monotonic, high resolution, and available in workers. `PerformanceObserver` can collect browser timeline entries asynchronously. Long task/long animation frame entries can be layered in later.

Canvas 2D remains viable for now, but current costs are likely draw-call count, save/restore churn, high-DPI backing surfaces, and per-cell microvoxel loops. MDN's Canvas guidance still points to batching calls, avoiding unnecessary state changes, avoiding expensive text/shadows, and using `requestAnimationFrame`.

High-DPI mobile is a real multiplier. `window.devicePixelRatio` can exceed 2 on phones, which means the backing canvas can quietly become several times larger than the CSS viewport. Add quality profiles later:

```text
quality: high        DPR cap 2
quality: balanced    DPR cap 1.5
quality: performance DPR cap 1
```

OffscreenCanvas is broadly available and can run in workers, but it will not fix bad collision algorithms. It is a good later fit for terrain chunk cache generation or a separate renderer experiment.

WebGPU is useful long-term but should not be the first fix. It is available in modern Chrome Android, but MDN still marks the API as limited availability because browser support is uneven. A GPU path should keep high-volume projectile state resident on the GPU and only return compact hit/expire events; uploading and downloading all projectile state every frame would recreate the stall in a different outfit.

## Package Decisions

| Area | Recommendation | Why |
| --- | --- | --- |
| Projectile broadphase | Write custom uniform grid | The workload is many similarly sized, fast-moving points/circles updated every frame. A small cell-linked grid avoids tree maintenance and can support swept AABBs directly. |
| Static point lookup | Watch `kdbush` / `flatbush` | Good for static terrain/scenery/resource queries, not every-frame bullets. |
| Dynamic rectangles | Prototype `rbush` only for comparison | Maintained and excellent for rectangle queries, but R-tree updates are extra machinery for uniform bullets. |
| Shape collision | Avoid full adoption of `check2d`/`detect-collisions` for bullets | Useful SAT/BVH package, but likely more geometry and allocation than simple circle/swept segment checks need. |
| Full physics | Avoid Matter/Planck/p2/Rapier for main projectile broadphase | They bring world ownership, collider state, unit conventions, and integration cost. Rapier is worth watching for future isolated query/soft-contact experiments. |
| Rendering | Prototype PixiJS WebGL later | Strong incremental renderer candidate for sprites/particles. Use WebGL renderer for production; WebGPU renderer is still best treated as experimental. |
| Workers | Native Worker first; Comlink only if RPC complexity grows | Broadphase in a worker is not first-pass because 60 Hz sync can erase the gain. Good later targets are terrain generation and non-authoritative cache work. |
| WebGPU compute | Defer; watch TypeGPU | TypeGPU looks like the most interesting ergonomic wrapper, but compute should wait until projectiles use typed buffers and compact event output. |
| GPU.js | Watch/later, not now | It has renewed activity and WebGPU work, but its async model and kernel abstraction are not a clean first fit for deterministic gameplay collision. |

## Spatial Broadphase Answers

1. A custom uniform spatial grid is likely faster and simpler than `rbush` or quadtree packages for dense projectile waves. Bullet radii are small, objects are dynamic every frame, and query ranges are local.
2. Maintained JS HSHG/cell-linked-list packages do not appear strong enough to beat a small custom grid for this workload. Use packages only as benchmark baselines.
3. No bullet-hell package found should own authoritative projectile collision. Borrow patterns: pooling, packed arrays, visual/projectile separation, lane hazards.
4. Rapier/Planck/Matter are overkill for broadphase-only use right now. Rapier has rich queries and determinism options, but moving game state into a WASM physics world would be a larger migration than the bottleneck justifies.
5. PixiJS is the strongest incremental renderer candidate for many sprites on Android. Use it after profiling proves render time is a large slice.
6. Pixi WebGPU exists in v8, but the Pixi docs still recommend WebGL for production and label WebGPU experimental/maturing.
7. TypeGPU is the WebGPU wrapper worth watching because it can be partially adopted and can generate WGSL from TypeScript-style shader functions.
8. GPU.js is not the first recommendation in 2026. It has renewed modernization work, but gameplay collision needs deterministic event pipelines more than high-level numeric kernels.
9. WebGPU compute can be an optional fast path on Galaxy S22-class Chrome, but not a baseline requirement. It needs runtime feature detection and a CPU fallback.
10. OffscreenCanvas plus Worker is worthwhile after algorithms are fixed, especially for terrain/render-cache work. It will not cure quadratic scans.
11. Worker-built broadphase is risky at 60 Hz unless state is shared or transferred as typed buffers. Start on the main thread with better algorithms.
12. Initial crossover estimate: direct scan below roughly 2,000-5,000 estimated pair checks; grid above roughly 8,000-12,000. Tune with on-device profiling.
13. Benchmark on mobile with sandbox boss barrages and record avg/p95/max frame, simulation, render, candidate checks, broadphase build time, projectile counts, and slow frames over 33/50/100 ms.
14. Packages that allocate result arrays per query can create GC issues. Prefer callback/result-buffer APIs or custom reusable arrays.
15. Deterministic replay is cleanest with custom JS structures, stable iteration order, fixed bucket sorting, typed arrays, and seeded behavior already in the repo.

## Implementation Handoff

### Phase 0: Instrumentation

Added in this checkpoint:

```text
src/debug/performanceMonitor.js
src/debug/debugOverlay.js
src/main.js
```

The debug overlay now shows rolling frame avg/p95/max, simulation/UI/render slice averages, slow-frame buckets, projectile counts, particle counts, terrain chunks, and live/total enemy cell counts.

### Phase 1: Custom Spatial Grid

Added in `v1.0.8.1`:

```text
src/core/spatialHash.js
tests/spatialHash.test.js
```

The first pass provides a deterministic, allocation-light uniform grid with circle, swept-circle, AABB, category-mask, reusable-output-array, and query stats support. It is ready for adaptive collision integration in Phase 2.

Add a small reusable grid:

```text
src/core/spatialHash.js
```

Required API:

```js
const grid = createSpatialHash({ cellSize: 48 });
grid.clear();
grid.insertCircle(id, x, y, radius, category);
grid.insertSweptCircle(id, x0, y0, x1, y1, radius, category);
grid.queryAabb(minX, minY, maxX, maxY, mask, out);
grid.queryCircle(x, y, radius, mask, out);
```

Implementation notes:

- Bucket key: integer `x,y` packed into a string first; typed/int packing can come later.
- Stable insertion order.
- Reuse output arrays.
- Insert swept projectile AABB, keep existing segment/circle narrowphase.
- Add counters: build ms, candidate count, exact narrowphase count.

### Phase 2: Adaptive Collision

Use direct loops under low estimated work. Enable grid with hysteresis:

```text
enable when estimated pair work > 10000
disable when estimated pair work < 4000
```

Start with projectile families:

```text
enemy projectile vs destructible/absorbing player projectiles
player projectile vs enemy hull broad candidate list
enemy projectile vs player hull candidate list
```

### Phase 3: Construct-Local Cell Lookup

Large bosses need local cell lookup:

```text
world broadphase -> candidate enemy
enemy-local transform -> local cell grid -> exact voxel damage
```

Build lazily per enemy when cell count exceeds a threshold, and invalidate when cells detach or layers are stripped.

### Phase 4: Allocation Pass

After broadphase metrics show candidate reduction:

- pool projectile objects,
- avoid per-frame `.filter()` in hot paths,
- convert high-volume projectile state to struct-of-arrays only if object pooling is not enough.

### Phase 5: Rendering Pass

Measure render p95 first. If render is a large slice:

- cache intact cell sprites,
- draw damaged cells with microvoxels only,
- cap mobile DPR by quality mode,
- prototype PixiJS WebGL for projectiles/particles first, then cells.

### Phase 6: Worker/GPU Experiments

Only after Phase 1-5:

- Worker terrain chunk generation with transferable buffers.
- OffscreenCanvas render-cache generation.
- PixiJS WebGL production renderer experiment.
- TypeGPU/WebGPU compute prototype for projectile packets after projectile state is typed-buffer-backed.

## Sources

- MDN Performance API: https://developer.mozilla.org/docs/Web/API/Performance_API
- MDN `performance.now()`: https://developer.mozilla.org/en-US/docs/Web/API/Performance/now
- MDN Canvas optimization: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- MDN `devicePixelRatio`: https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
- MDN OffscreenCanvas: https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas
- MDN WebGPU API: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API
- PixiJS rendering docs: https://pixijs.download/dev/docs/rendering.html
- PixiJS v8 migration docs: https://pixijs.com/8.x/guides/migrations/v8
- RBush: https://github.com/mourner/rbush
- KDBush npm: https://www.npmjs.com/package/kdbush
- Rapier JS docs: https://rapier.rs/docs/user_guides/javascript/getting_started/
- Rapier broadphase docs: https://www.rapier.rs/javascript2d/classes/BroadPhase.html
- Planck broadphase docs: https://piqnt.com/planck.js/docs/api/classes/BroadPhase
- Matter.js release notes: https://github.com/liabru/matter-js/blob/master/RELEASE.md
- check2d/detect-collisions npm: https://www.npmjs.com/package/detect-collisions
- TypeGPU: https://github.com/software-mansion/TypeGPU
- GPU.js modernization notes: https://github.com/gpujs/gpu.js/wiki/Modernization-Updates-2026
- MDN Web Worker transferables: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
- Comlink: https://github.com/GoogleChromeLabs/comlink
