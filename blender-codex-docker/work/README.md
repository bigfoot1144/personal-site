# Lantern Lane

An editable Blender streetscape with four storefronts: Learning Curriculum, Blog, About Me, and Projects. The scene includes recessed upstairs windows, warm interiors, procedural materials, vegetation, wet pavement, and a continuous camera tour.

## Project layout

```text
scene/lantern_lane.blend   Canonical editable source
references/Scene.png      Original visual reference
scripts/                  Frame assembly and video validation helpers
renders/                  Generated output; ignored by Git
.checkpoints/             Local safety history; ignored by Git
```

Open `scene/lantern_lane.blend` in Blender 5.2.1 LTS or a compatible newer release. The active scene is `Lantern Lane • storefront tour`; `Scene` preserves the original default scene. The lettering font is embedded, and materials are procedural. The file has no dependency on the archived preview images or animation frames.

Units are meters; procedural seed is 42. Hidden construction objects drive editable masonry cuts.

## Building hierarchy

The four buildings are complete movable assemblies. Expand a building collection, select its **`BUILDING • …` object**, and press **G** to move it (or R to rotate). `BUILDING • Blog` is selected in the saved file.

Each building contains nested exterior, interior, local-lighting and construction branches, with attached planting organized under the building or its supporting assembly. Interior branches contain a ground-floor shop and individually named upstairs rooms; each room contains its objects and lights. `GROUP • …` controls move these subassemblies. Existing storefront, window-box and fire-escape parent objects remain usable.

| Top-level collection | Contents |
|---|---|
| 01 Learning Curriculum | Complete Learning building |
| 02 Blog | Complete Blog building, fire escape, balcony pots and canopy baskets |
| 03 About Me | Complete About Me building |
| 04 Projects | Complete Projects building, including the masonry lettering bay |
| 05 Street | Pavement, crosswalk, bench, streetlamp, taxi, trees and loose sidewalk pots |
| 06 Environment | Water tower, distant buildings, moon, stars and shared scene lighting |
| 07 Cameras & Animation | The 46 mm animated Tour camera |
| 08 Asset Libraries | Hidden shared street and upper plant source meshes |

For example, Blog's parent hierarchy includes `BUILDING • Blog` → `GROUP • Blog • Interiors` → `GROUP • Blog writing` → room objects. The collection hierarchy follows the same ownership. Hanging baskets are nested beneath the storefront canopy, and balcony pots beneath the fire escape, so they also follow those supporting assemblies.

The complete water tower is under `06 Environment` → `Water tower`. Select `GROUP • Water tower` to move its tank, roof, hoops and four legs together; it has no building parent.

Building pivots sit at the front ground level. Window and masonry cutters travel with their owning building. Keep the masonry cutter collections and plant libraries hidden, and preserve the per-object hiding on window opening cutters. Collection exclusion can disable required modifier inputs.

The scene contains **3,683 objects**, in **97 collections beneath eight top-level branches** (the 97 includes those eight branches). Fixture repairs added 30 iron hardware objects and complete controls for the sidewalk planters and bench. The original default `Scene`, shared plant meshes, materials, visibility, camera tour and production render settings are preserved. The prior cleanup removed 2,253 obsolete geometry objects and 57 unused review cameras.

Recovery:
- `.checkpoints/106_before_building_hierarchy.blend` preserves the previous organization.
- Checkpoints 107–109 preserve the hierarchy, attachment refinement and verified scene.
- Checkpoints 110–111 preserve the water tower's move into Environment; all nine parts retain their world transforms.
- `.checkpoints/102_before_collection_cleanup.blend` contains the historical alternatives and review cameras removed earlier.
- Checkpoints are local, ignored files; use Git history for shared recovery. Historical archive collections described below are no longer in the working file.

Verification covers independent translation and rotation of all four building parents, an interior group, an individual room, and both Blog planting subassemblies. Each move affects only its descendants and restores exactly; all 69 building controls match their collection branches. Existing assembly parents remain ancestors of their original parts. Five 400 × 300 before/after renders at frames 1, 97, 289, 481 and 673 show no visible change, with small pixel differences recorded in `renders/review/building_hierarchy/verification.json`. Preview images and an Outliner screenshot are in the same folder. No animation export was regenerated.

## Fixture repairs and sidewalk controls

All six sign-lamp arms reach the masonry, bridging the former gaps of 17.45–17.66 cm. Each has an iron mounting plate with two fixings, parented to its existing complete storefront frame. The subsequent sill-clearance repair below lowers the complete lamps, including their mounts, while preserving masonry contact.

In `05 Street → Sidewalk pots`, select `GROUP • Sidewalk pot 01`–`04` or `06`–`10` to move a complete round planter. Pot 05 retains `Blog • bench-side flowering pot assembly`. Each control carries its container, open rim, soil and six plant objects. `GROUP • Wooden sidewalk planter 01`–`04` each carries its wooden container, decorative slats and bands, soil and eight plant objects.

The four wooden planters moved 25 cm toward the curb, preserving their aligned row. Round pot 01 moved 6 cm left, and the bench-side pot moved 7 cm right. All planter parts moved together without changing their geometry. Round pots lowered 9.5 mm and wooden planters lowered 4.5 mm to contact the actual 0.1705 m flagstone surface. Solid container clearance is at least 5.94 cm; the bench-side pot clears the bench by at least 7.06 cm. The wooden containers retain 21.75 cm clearance from the kerbstones. Foliage overlaps naturally.

`05 Street → Bench → GROUP • Bench` moves the complete bench. Two iron back uprights join the existing side frames to all five back slats, with ten visible fasteners. The four feet extend to the paving. All original wooden slats and their dimensions remain unchanged. The water tower's independent Environment ownership was also restored from the live scene's About Me parent, with all nine parts retaining their world transforms.

Verification checked evaluated solid geometry separately from foliage: conservative bounding-box clearance bounds, triangle intersection tests and nearest surface samples for nearby pairs. All 14 planter supports and four bench feet contact the paving within 1 mm; all six arm-to-plate connections and both uprights' connections to every back slat and side frame pass. Temporary translation and rotation checks passed for 20 affected controls, with no unrelated movement and exact restoration. Original object transforms outside the planter assemblies, bench wood vertices and light settings were verified unchanged.

Review images and measurements are in `renders/review/fixture_repairs/`: five 640 × 480 tour views (`wide`, `learning`, `blog`, `about_me`, `projects`), 800 × 600 bench front/oblique and lamp detail views, and `verification.json`. The production 1600 × 1200, 128-sample settings, original output path and frame 1 were restored; temporary review cameras were removed. The animation export was not regenerated. Checkpoint 112 preserves the baseline; 113 preserves the lamp mounts, 115 the corrected planter placement, 116 the bench, 117 the verified hierarchy, and 118 the completed repairs. Checkpoint 114 is a provisional grouping state superseded by 115.

## Sill-mounted planters and lowered sign lamps

All six complete sign lamps are lowered **9 cm** to clear the window bases. Arms, shades, bulbs, wall plates, fixings and light sources move together. Their mounts clear the lower sill moulding by at least **2.5 cm**, and the arms clear it by at least 7.6 cm where they pass beneath it. Masonry contact and all lamp joints remain connected. The previous 13 cm outward head extension is retained; materials, orientation, size and light settings are preserved.

The twelve upper planter supports attach directly to the front faces of the six projecting limestone window sills. Each pair remains 52 cm either side of its planter center. The compact iron fixing plates span Z 5.075–5.19 and seat 0.5 mm into the measured sill face at Y −0.545. Straight 55 mm wide, 38 mm thick shelves extend to Y −1.175, with their tops contacting the unchanged planter bottoms at Z 5.1275. Slim braces reinforce the shelves. The previous supports below the sill have been replaced; original aged-iron materials and 3 mm bevels remain in use.

Evaluated mesh checks confirm all twelve sill-to-planter connections and six lamp assemblies are connected within 1 mm. Lamps clear the window sills and sign trim; planter hardware clears unrelated stonework and lamp hardware. Hardware is named `… • sill-mounted shelf`, `… • sill fixing plate` and `… • sill support brace` under the existing window-box controls and collections.

All existing controls, parents, collection memberships and object counts are preserved. Temporary translation and rotation tests passed for 18 building, storefront, window-box and local-lighting controls, with no unrelated movement and exact restoration. Planters, plants, windows, stonework, bench repairs, sidewalk clearances and the independent Environment water tower are unchanged.

Current review output is in `renders/review/sill_fixture_attachments/`: three 800 × 600 fixture details, five 640 × 480 tour views, and `verification.json`. The original Tour camera, frame 1, 1600 × 1200 resolution, 128 samples and production output path are restored; the temporary review camera is removed. Animation was preserved and no video was regenerated. Checkpoints 124–127 cover the baseline, lowered lamps, sill attachments and verified delivery. The earlier bracket design is preserved in checkpoints 119–123 and `renders/review/fixture_clearances/`.

## Lower facade and street weathering

All four storefronts retain their ivory, green, blue and red palette with fine paint grain, roughly 4% tonal variation, satin roughness variation and faint dirt at their bases. The changes cover 147 painted objects and ten lower stone cornices, joints and Projects plinth/string-course pieces. Upper masonry and its original weathering shader remain unchanged.

All 75 sidewalk flagstones, 26 kerbstones and the raised sidewalk base have mineral grain, shallow pores, irregular staining and darker joint edges. Each stone samples continuous meter-scale textures with individual wear variation. Asphalt combines fine aggregate with rougher areas and smoother dark damp patches, breaking up the existing storefront reflections. The seven crosswalk bars retain their layout and have scattered asphalt-colored abrasion; a rendered mask measures **7.48%** worn area.

Select a targeted surface and edit its `Weathering • editable controls` material node. Four shared shader groups, `Lower surfaces • Storefront paint`, `Ground stone`, `Asphalt` and `Road paint`, expose **Texture strength**, **Wear**, **Dampness**, dry/damp roughness and base splash controls. Road paint Wear is an area fraction (default 0.075); the other Wear controls govern accumulated staining. Stone roughness centers on 0.77 dry and 0.32 damp; asphalt uses 0.66 and 0.23. Paint stays near its original 0.45 satin finish. Seed 42 is fixed in procedural textures. Facade coordinates are anchored to each existing building control; street coordinates use world meters.

The 21 new materials use object-slot overrides on 267 objects, preserving shared meshes and every original material. Awnings, lettering, glass, interiors, plants, furniture, vehicles and fixture hardware keep their original assignments. Geometry, transforms, modifier references, parenting, collection membership, lights, world and camera actions compare unchanged against the baseline; existing fixture clearances are consequently preserved. No hierarchy or assembly controls changed.

Matched 640 × 480 before/after previews and seven **1600 × 1200, 128-sample** final stills are in `renders/review/lower_surface_weathering/`: `final_wide.png`, four `final_<shop>.png` images, `final_paving.png` and `final_road.png`. `verification.json` records the checks and wear measurement. Checkpoints 128–132 preserve the baseline, facades, sidewalk, road and verified delivery. The production Tour camera, frame 1, render settings and output path are restored; the temporary review camera is removed. No animation export was regenerated.

## Rendering

The tour uses the fixed 46 mm `Tour camera`, frames 1–768 at 24 fps, and a 1600 × 1200 frame size. It visits the storefronts from left to right, holding the wide view for one second, approaching for three seconds, holding for two seconds, and returning over two seconds per shop. Only the camera moves. Current EEVEE still settings use 128 samples.

The default output path is `//../renders/stills/shop_repair_wide.png`. Blender resolves `//` relative to the saved `.blend`, so paths work when the repository is moved. Use `//../renders/frames/tour_` for an animation sequence. The render format remains PNG, with overwrite disabled for resumable output. Restore the full 1–768 timeline after rendering a frame batch.

In the Docker/MCP workflow, Blender runs on the host. Resolve absolute paths from `BLENDER_PROJECT_DIR`, or use Blender-relative paths; `/workspace` is a container path. Use the connected Blender instance and short render batches as described in `AGENTS.md`.

The four ground-floor shops now have fitted lower panels, joined posts and headers, display sill rails, and continuous top closures. Each shop has seven individually fitted glass sheets: two displays, a door, a door transom, and three narrow upper panes. Their edges seat 10 mm inside the frames; all 112 edge checks passed, and no pane overlaps were found. Concealed liners beneath the striped canopies close light leaks at the valance seams. Existing ivory, green, blue, and red frame designs and interior layouts remain intact.

Shop glass uses clear straight-through transmission and subtle Fresnel reflections (IOR 1.45, reflection roughness 0.09) in EEVEE’s Blended mode. This thin-sheet approximation avoids the distorted highlights and grain encountered with screen-space refraction; it does not simulate thick-glass refraction. Shadow rays transmit through the panes. Interior ceiling and rear fills are broader and less orange, pavement spill is reduced, and four concealed canopy lights illuminate the exterior frame faces. Soft-shadow jitter is enabled on the shop lights, including the widened sign lamps. Upstairs lighting is preserved.

Current 1600 × 1200, 128-sample stills are `renders/stills/shop_repair_wide.png`, `shop_repair_learning.png`, `shop_repair_blog.png`, `shop_repair_about_me.png`, and `shop_repair_projects.png` in the same folder. Front, oblique, upper-opening cutaways, glass comparisons, and camera-tour checks are under `renders/stills/review/shop_repair/`; `renders/stills/shop_repair_verification.json` records the measurements. The glass-on/off pavement difference was negligible, and consecutive tour hold frames were virtually identical. Full-size final stills were inspected after enabling soft shadows. Checkpoints 97–101 preserve the repair stages. The repaired fire escape, awning-mounted baskets, ground pots, and 46 mm camera action are preserved; animation video was not regenerated.

Blog’s hanging baskets are now suspended from plates and iron eyes on the underside of the timber canopy. The former wall brackets are preserved in the pre-cleanup checkpoint; the chains stay entirely below the canopy and connect to the pot rims. Both baskets are lowered 0.14 m and shifted 0.05 m toward the wall from their previous positions, preserving their inward spacing from the neighboring awnings. Foliage clears the canopy by 0.157 m. Geometry checks confirm the full canopy-to-pot connections and no unintended intersections for the 24 basket plant meshes. The small pot beside the bench retains its clearance, and the fire escape, balcony pots, existing cameras, and lights are preserved. Current 1600 × 1200 stills are `renders/stills/awning_baskets_detail.png` and `renders/stills/awning_baskets_wide.png`; verification is `renders/stills/awning_baskets_verification.json`. Checkpoints 92–96 preserve the stages. Animation exports have not been regenerated.

The upper landing’s narrow right-hand projection has been removed: the 0.70 m extension is trimmed back to the main landing, its right support and side tie are shortened, and the front and side rails meet at a closed corner. The upper flowerpot stays in place with 0.077 m clearance from the front rail. The lower balcony, stair flight, lighting, and camera tour are preserved. Current 1600 × 1200 stills are `renders/stills/upper_right_trim_close.png` and `renders/stills/upper_right_trim_wide.png`; previews and verification are under `renders/stills/review/upper_right_trim/`. Safety checkpoints run from 82 through 86. Animation exports have not been regenerated.

The upper stair connection is now flat: the two projecting handrail returns terminate at the existing landing posts, and their fixing plates are flush with the 8.305 m landing surface. Both rails retain contact with the posts. Latest 1600 × 1200 stills are `renders/stills/stair_junction_flat.png` and `renders/stills/stair_junction_wide.png`; before/after previews and the verification record are under `review/stair_junction/`. The remaining balcony geometry, pots, signs, lighting, camera, and animation exports are unchanged.

The fire escape now projects 1.60 m toward the road while retaining its 3.75 m width, 0.64 m flight, seventeen open treads, eighteen equal risers, and floor levels of 5.215 m and 8.305 m. The stair flight and front rails move outward by 0.54 m; the rear landing surfaces, upper opening, and supports are refitted. Both continuous ledgers remain attached to the masonry. The four exterior Blog boxes and their mounting rails have been replaced by two freestanding aged terracotta pots inside the balconies: cream flowers at lower left and pink/lavender flowers at upper right. The two pots use 34 dense foliage and flower groups with seed 42 and are parented to the complete escape assembly. Their foliage clears the stairs and guards by at least 0.169 m; checks found no intersections with windows, architecture, signs, lamp stems, or shades. The six other matching green window boxes, adjacent ivy, storefronts, lighting, interiors, and brick weathering are preserved. The cat and all its parts are removed from the visible scene. Current 1600 × 1200 stills in `renders/stills/` are `balcony_interior_pots_wide.png`, `balcony_extended_oblique.png`, `balcony_lower_left_pot.png`, and `balcony_upper_right_pot.png`. Previews are under `review/balcony_pots/`; `balcony_interior_pots_verification.json` records the checks. Earlier compact and upstairs stills remain as revision history. The 46 mm camera tour and animation exports are unchanged.

The storefront frames have separate 0.10 m recessed masonry joints and distinct construction: fluted ivory posts and layered cornices for Learning, recessed green panels and canopy corbels for Blog, slim chamfered blue posts for About Me, and raised red panels with heavier bases and capitals for Projects. Each complete frame is grouped under its own named parent, including its sign and canopy. The right Blog hanging basket moves forward 0.22 m with an extended iron hanger to clear the new corbel. Current 1600 × 1200 stills are `storefront_frames_wide.png`, `storefront_frame_learning.png`, `storefront_frame_blog.png`, `storefront_frame_about_me.png`, and `storefront_frame_projects.png` in `renders/stills/`. Frontal, oblique, and tour previews are under `review/storefront_frames/`; `storefront_frames_verification.json` records the checks. Existing lettering, upstairs rooms, masonry weathering, lighting, and the 46 mm camera tour are preserved. Animation exports have not been regenerated.

Exterior masonry retains twenty chipped brick corners, pitted mineral grain, patchy discoloration, and rain staining. The long cracks have been removed. Corner chips remain editable through each building’s `Construction` → `Masonry wear cutters` branch. The eleven facade materials and their `Facade • weathered masonry` shader are preserved (Age 0.86 for brick and 0.58 for stone). Current 1600 × 1200 stills are `renders/stills/weathered_bricks_wide.png` and `renders/stills/weathered_bricks_detail.png`; previous weathering stills remain as revision history. Camera, lighting, interiors, and animation exports are unchanged.

The crosswalk now runs across the street, with seven bars parallel to the curb and a 0.50 m curb gap. The existing stripe dimensions, spacing, and paint material are preserved. Current stills are `renders/stills/crosswalk_wide.png` and `renders/stills/crosswalk_detail.png`, both 1600 × 1200; previews are under `renders/stills/review/crosswalk/`.

Upstairs stills are in `renders/stills/`: `upstairs_wide.png`, `upstairs_learning.png`, `upstairs_blog.png`, `upstairs_about.png`, `upstairs_projects.png`, `upstairs_blog_top.png`, and `upstairs_electronics_detail.png`, all at 1600 × 1200. Ten distinct rooms now provide a sage study, terracotta writing rooms, a blue personal studio, and a neutral electronics lab with test and assembly benches; the Blog top floor contains reference shelves and an editing desk. Blog’s lower pair now matches its rectangular upper windows, About Me has paired casements, and Projects has three-pane fanlights. Curtains, blinds, furniture, artwork, and upstairs lighting vary by room. `upstairs_verification.json` records geometry and camera checks; review images are under `review/upstairs/`. Ground-floor interiors, exterior lighting, vegetation, and the 46 mm camera tour are preserved. Animation exports have not been regenerated.

Earlier vine stills are in `renders/stills/`: `organic_vines_wide.png`, `organic_vines_roof.png`, `organic_vines_detail.png`, and `organic_vines_window.png`, all at 1600 × 1200. The vines now form dense, irregular branching patches with overlapping leaf sprays, varied roof cascades, and fuller trails from window boxes and hanging baskets. `organic_vines_verification.json` records the clearance and tour checks; preview images are under `review/vines/`. The camera action and lighting are unchanged, and animation exports have not been regenerated.

Earlier planting stills are in `renders/stills/`: `planting_wide.png`, `planting_window_front.png`, `planting_window_oblique.png`, `planting_street_detail.png`, and `planting_ivy_detail.png`, all at 1600 × 1200. `planting_verification.json` records the geometry and camera checks; planting previews are under `review/planting/`. The revision adds twelve linked plant variants, varied arrangements, open pots with soil, branching ivy, and curved tree leaves. Ten window boxes sit 0.38 m farther forward with extended brackets to clear the sills. Keep `08 Asset Libraries` → `Street plant library` hidden; visible arrangements link to the library meshes. Existing lighting and the camera action are unchanged, and animation exports have not been regenerated.

Earlier sign-repair stills are in `renders/stills/`: `wide_repaired.png`, `wall_lettering_front.png`, `wall_lettering_oblique.png`, `streetlamp_banner_front.png`, and `streetlamp_banner_oblique.png`, all at 1600 × 1200. Earlier facade stills (`wide.png`, `window_front.png`, and `window_oblique.png`) remain available. Preview renders are in `renders/stills/review/`; `sign_repair_verification.json` records the checks. The Projects wall has a 1.1 m masonry extension and recessed plaster lettering; the banner has two clamped supports and a 15.3 cm pole gap. The wide camera retreats 3.23 m, preserving the four close poses, easing, 46 mm lens, and 32-second duration. The older video in `renders/legacy/storefront_tour_pre_facade.mp4` predates the window refinements. Generate a new video from the current scene when those refinements are approved; the archived raw frames also belong to the older facade.

## Rendering helpers

Both helpers use Python's standard library and resolve paths from this repository, independent of the current working directory.

- `python3 scripts/complete_frames.py` assembles matching camera poses for this specific 32-second tour, checks all 768 PNG dimensions, and writes `renders/validation.json`. It expects the required source frames in `renders/frames/`. Use its reuse mapping only while the camera timing is unchanged and the scene is stationary; otherwise render every frame normally.
- `python3 scripts/verify_video.py` validates `renders/storefront_tour.mp4` as a 32-second, 1600 × 1200, 768-frame video and adds the result to that report. It expects the silent H.264 export and the frame validation report to exist.

## Version control

Commit the canonical `.blend`, reference, scripts, and documentation. Renders, checkpoints, automatic backups, and caches are ignored. `.gitattributes` marks Blender and image files as binary to prevent text merging or line-ending changes.

The current source and reference are small enough for ordinary Git; Git LFS is not required or configured. If binary history becomes large, enable Git LFS before adding substantially larger assets. Coordinate edits to the `.blend` because binary scene changes cannot be merged automatically.

Save numbered safety checkpoints under `.checkpoints/` before substantial edits, then save completed work back to `scene/lantern_lane.blend`. Historical working files and notes are preserved in `.checkpoints/history.zip` and `.checkpoints/legacy_artifacts/`. The old 768-frame sequence is preserved in `.checkpoints/legacy_frames/`. These are local archives and are not part of a clone. Use Git commits for shared project history.

This repository is initialized locally. No remote is configured and nothing has been published.
