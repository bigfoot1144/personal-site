# Lantern Lane storefront

## Experience and routes

The homepage (`/`) is a full-viewport Three.js scene exported from the authored Blender streetscape. It is not a photograph on a plane and does not build replacement buildings in JavaScript.

| Shop | Destination |
|---|---|
| Learning Curriculum | `/knowledge` |
| Blog | `/blog` |
| About Me | `/about` — the former homepage, including its timeline and drawing background |
| Projects | `https://github.com/bigfoot1144`, same tab after the approach |

The default desktop camera is the original frame-1 camera. A normal activation approaches the selected storefront for 900 ms, then navigates. Escape cancels; reduced motion skips travel. Portrait visitors swipe horizontally across the original scene. A drag, canceled pointer, or multi-touch gesture must never activate a shop. There is no free orbit, autoplay tour, permanent navigation overlay, sparkle cursor, or old starfield on the homepage.

Four real links mirror the scene targets. Keyboard focus is visible and pans off-screen shops into view. Native modified clicks remain native links. The same scene's poster appears during loading, without JavaScript, or when WebGL/model loading fails. Fallback links and a retry action remain usable; a load receives a 20-second foreground-time budget (hidden tabs pause it).

## Code map

- `src/app/storefront/storefront.component.*`: SSR-safe shell, accessible links, loading/retry/cancellation and route handoff.
- `storefront.runtime.ts`: lazy browser-only Three.js/GLTF runtime, proxy picking, on-demand frames, camera travel, disposal and context loss.
- `storefront.math.ts`: testable camera framing and pointer-state math.
- `storefront.types.ts`: the four IDs, destination map and runtime/manifest contracts.
- `storefront.scene.json`: generated, build-imported asset URLs, source hash and camera/picking metadata.
- `src/app/content-layout/`: original starfield/biography/blog/knowledge shell, lazy and absent on `/`.
- `scripts/storefront-cameras.json`: source camera/picking metadata in glTF Y-up meters. Camera poses were sampled from Blender frames **1, 97, 289, 481, 673**. Re-sample after deliberately changing the tour, do not guess screen-space hotspots.

No browser-specific code executes during SSR. The old ONNX drawing runtime is loaded only inside the content layout. Long-lived animation work runs outside Angular's zone, and route disposal cancels callbacks and releases GPU/inference resources.

## Asset source and regeneration

Canonical source: `blender/scene/lantern_lane.blend`, scene `Lantern Lane • storefront tour`.

Normal `npm start` / `npm run build` consumes published files in `src/assets/storefront/`; **it does not require Blender or rebaking**. Both variants and their decoder files must be committed with the manifest.

The workspace relocation updates source paths only. Published `sourceSha256` and baked-asset hashes still identify the last real export; they are not recomputed from newer scene edits or historical intermediate bakes. Rebuild those hashes only as part of a matched bake/export/publication.

Regeneration requires the existing Blender session, Node 22+, installed npm development dependencies, and [KTX Software 4.4.2](https://github.com/KhronosGroup/KTX-Software/releases/tag/v4.4.2). Set `KTX_BIN` to its `bin/` directory, or place it at `.tmp/storefront/ktx/bin/`.

Read `blender/AGENTS.md` before Blender work. Use DeepSeek Harness's connected Blender MCP tools, keep safe mode enabled, do not launch another Blender instance, and save a new numbered checkpoint. Confirm the open host `.blend` location; the transport container's `/workspace` path is not a host Blender path. The optional Blender-only transport is documented in `blender/mcp/README.md`.

### Blender stages

Helpers are in `blender/scripts/export_storefront.py`. They are intentionally **not automatically executed**. Use the connected session in small stages, or load them in Blender's own Text Editor. MCP safe mode requires explicit supported Python code, not `exec()` of an external script.

1. Save a **new numbered safety checkpoint** under `blender/.checkpoints/`, then `prepare()`. It copies evaluated visible source meshes, private materials, lights and world into a separate export scene. Source collections, construction inputs, font, camera animation and original scene remain intact.
2. `preserve_coordinates()` retains per-source-object Generated/Object coordinates as geometry attributes, with private shader-group copies, before joining meshes. This prevents procedural textures from changing scale across an entire merged building.
3. `reduce_foliage(0.16)` simplifies only export-copy curved leaves. Batch the eight bake groups and glass with `batch_group(id)`. The default skips UV unwrapping for **foliage and glass**; the other seven groups receive the explicit `WEB_UV` layer.
4. `repair_normals(id)` clears custom split normals and recalculates normals outside for **all eight non-glass export batches**. The source has inward cube normals; leaving those in place corrupts illumination and road normal maps. Do **not** repair glass or edit the canonical meshes. Global recalc also reverses open striped cloth: run `restore_awning_faces('learning')` and `restore_awning_faces('about')` as described below. Inspect both corrected awnings, then save a new geometry checkpoint **before any bake**.
5. For Learning, Blog, About, Projects, Street, Road and Environment, run `bake_group(id, resolution=2048, samples=32)` **one section at a time**. These are `COMBINED` image bakes using `WEB_UV` explicitly. Glossy contribution is enabled except for the road. Wait for `bpy.app.is_job_running('OBJECT_BAKE')` to become false, inspect the result, then `save_bake(id)` before advancing. Baking hundreds of separate objects is dramatically slower because Cycles restarts per object.
6. `bake_foliage_vertex(samples=32)` instead bakes `COMBINED` illumination into active `WEB_Light`, a `FLOAT_COLOR`/`POINT` color attribute, with `render.bake.target='VERTEX_COLORS'`. **There is no foliage texture atlas.** After the job completes, `save_foliage_vertex()` restores `IMAGE_TEXTURES` and converts the illumination as described below. It sets both `baked_foliage_vertex` and `baked_foliage`.
7. Run `bake_road_maps()` after outward repair and the combined road bake. Its **1024² NORMAL and ROUGHNESS** maps use `WEB_UV`; they are Non-Color data saved without AgX. Verify all eight `baked_<group>` statuses, plus `baked_foliage_vertex` and `baked_road_data`, and save a bake checkpoint. Keep the copied source shaders until the HDR is also complete.
8. Only then, `capture_environment()` renders **512×256, 32-sample** equirectangular HDR using the existing reflection-camera setup. It uses **Raw / None / exposure 0 / gamma 1** to preserve linear radiance. Wait for `RENDER` to finish and inspect the newly written `environment.hdr`; `finish_environment()` verifies the file, records completion and restores the overview camera/resolution. Save another numbered checkpoint.
9. `finish_materials()` assigns the seven texture-based groups (`WEB baked • …`, with the existing reflective-road exception), thin PBR glass, and `WEB baked vertex • foliage`. Foliage uses `ShaderNodeVertexColor` (`WEB_Light`) → Emission → Output; all foliage UV layers and the temporary `WEB_Generated`/`WEB_Object` attributes are removed, while `WEB_Light` remains the active color and render color index 0. PNGs are reloaded with **`check_existing=False`** so an earlier failed bake cannot survive in Blender's image cache. The final export preview uses **Standard / None / exposure 0 / gamma 1**.
10. `export_glb()` writes the real geometry to `renders/web-export/lantern-lane.baked.glb`. **`export_vertex_color='ACTIVE'` is required**: the default `MATERIAL` mode misses color used through the foliage Emission shader. Normals and tangents are exported; only the reflective road requires tangents, and warnings for unlit material data subsequently discarded by optimization are not missing-lighting errors. Inspect the overview and close approaches, save a numbered final checkpoint, and restore the original source scene in the UI. **Never save the derivative over the canonical source.**

The current final review checkpoint is `blender/.checkpoints/159_web_final_review.blend`; future runs must use a new number, not overwrite it.

#### Open-cloth normal correction

After global outward recalc, match Learning/About awning faces by **Blender world Y/Z**, not glTF coordinates:

| World Y | World Z |
|---:|---:|
| -0.830 | 3.730 |
| -1.015 | 3.590 |
| -1.260 | 3.395 |
| -1.445 | 3.290 |

Use Y tolerance **0.001**, Z tolerance **0.007**, face area **> 0.01**, and world normal Z **< 0**. Flip the matching BMesh faces upward. There must be **exactly 64 faces for Learning and 64 for About**; the helper checks counts before changing them. If the source changes and counts differ, inspect the geometry instead of widening the test or flipping arbitrary faces. Repair is restricted to the derived copies.

#### Baked color and vertex-lighting conversion

Saved PNG image bakes contain the source **AgX / Medium High Contrast / exposure 0.5** treatment. For foliage, pack the linear `WEB_Light.color` samples into a float image of width **1024** and height `ceil(vertex_count / 1024)`, then `save_render()` a PNG with the same source display treatment. Reload that PNG with `check_existing=False`, set its color space to **Non-Color**, and read pixels in Blender's **bottom-left** order (no row flip). Decode each RGB channel from sRGB with `v / 12.92` for `v <= 0.04045`, otherwise `((v + 0.055) / 1.055) ** 2.4`; set alpha to **1** and write the colors back with `foreach_set('color', ...)`. This yields display-toned **linear vertex colors**, not a texture atlas.

Baked unlit materials and the baked-lit road opt out of a second runtime tone map; live PBR glass/reflections remain separate. Road data maps and the HDR do **not** receive the display transform. The final Standard Blender preview avoids applying AgX twice. This preserves the authored scene and lighting mood; Three.js is not a pixel-identical EEVEE renderer.

### Publish optimized browser assets

The poster input is `blender/renders/review/lower_surface_weathering/final_wide.png`. If that ignored render is absent in a fresh clone, render the original frame-1 overview at 1600×1200 to that location first, preserving/restoring the source settings. Normal website builds use the already-published WebP and do not need this intermediate.

From the website root:

```bash
KTX_BIN=/path/to/KTX-Software/bin npm run assets:storefront
npm run validate:storefront
npm run build
```

The optimizer consolidates geometry/materials, removes redundant unlit normals, preserves the foliage `COLOR_0` lighting, creates two LOD/texture profiles, and compresses textures with KTX2/ETC1S. **Meshopt geometry compression must run last, after the KTX CLI steps**: the CLI otherwise decodes previously compressed geometry while rewriting the model. Use **12-bit color quantization** so the point-baked foliage retains its tonal detail. Three's Basis transcoders are copied locally; no runtime CDN is required.

| Profile | Simplification ratio | Error | Maximum texture size | ETC1S quality |
|---|---:|---:|---:|---:|
| Desktop | 0.9 | 0.0001 | 4096 | 255 |
| Mobile | 0.3 | 0.001 | 1536 | 220 |

The texture sizes are profile caps, not a request to create a foliage atlas.

Outputs use content hashes because the SSR server gives static files a long cache lifetime. The build-imported manifest points to the matching model, poster and optional HDR environment; routes stay in TypeScript, not Blender data. `src/assets/storefront/asset-report.json` records source hashes, tools, transfer sizes and geometry counts. Intermediates, EXRs, checkpoints, temporary tooling and browser reports remain ignored.

Transfer targets are 12 MB desktop / 6 MB mobile including the poster and reflection environment. The corrected published pipeline records:

| Variant | GLB bytes | Triangles | GLB + HDR + poster bytes |
|---|---:|---:|---:|
| Desktop | 10,358,620 | 1,111,615 | 10,847,590 |
| Mobile | 5,378,708 | 378,135 | 5,867,678 |

The shared HDR is **295,064 bytes** and the poster **193,906 bytes**. The existing 1 MB initial JavaScript build limit remains unchanged. These size/geometry figures are not GPU performance measurements: inspect real draw calls, texture memory, loading time and movement on representative devices.

## Verification

```bash
npm run test:unit
npm run test:knowledge
npm run test:markdown
npm run validate:storefront
npm run test:e2e
```

Karma and Playwright honor `CHROME_BIN`; on this workstation they can use `/opt/google/chrome/chrome`. Otherwise install a Playwright Chromium browser or supply a Chrome executable. Playwright starts the production SSR app at `http://127.0.0.1:4300` for tests and keeps reports under `.tmp/`.

Latest local verification: **103 unit tests, 8 knowledge tests, 2 Markdown fixtures, and all 11 Chromium end-to-end tests passed**, including a fresh production SSR build and asset validation. Durable local results are in `.tmp/storefront/verification.log` and `.tmp/playwright-report/results.json`; desktop and portrait captures are in `.tmp/storefront/home-desktop.png` and `home-mobile.png`.

The suite covers SSR/no-JavaScript links, failed assets, actual GLB loading, exact destinations, delayed route handoff, Back, reduced motion, Escape, real CDP touch capture/swiping, keyboard orientation changes and context loss. Unit tests cover hidden-tab deadlines, late loads, resource disposal and old constellation transitions without a real GPU or ONNX model.

Compare desktop/portrait and each close approach to the Blender reference. Inspect `data-state`, `data-draw-calls`, `data-triangles`, `data-rendered-frames`, `data-camera`, `data-fov` and `data-pan` on `app-storefront` for diagnostics; these attributes do not add visible UI. Idle frame count should stop. Physical iPhone/Safari and mid-range-phone frame-rate verification remains a separate device check from headless Chromium.
