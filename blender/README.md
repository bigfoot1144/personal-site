# Lantern Lane

An editable Blender streetscape with four main navigation storefronts—Learning Curriculum, Blog, About Me, and Projects—and three decorative neighbors: The Daily Brew, Petal & Post, and The Book Nook. The scene includes recessed upstairs windows, warm furnished interiors, procedural materials, vegetation, wet pavement, street furniture, a layered low-detail background city, and the original continuous four-shop camera tour.

## Working with DeepSeek Harness

Use the existing Blender MCP connection in DeepSeek Harness to work on this scene. The minimal transport, local profile example and connection checks are documented in [mcp/README.md](mcp/README.md). Agent/model credentials and Harness profile state are not part of the project.

The project, including ignored renders and recovery history, now lives directly in the repository's `blender/` folder. Checkpoints **205–206** preserve the before/after workspace migration. The live Blender file is saved at the new canonical location, with the original tour camera and geometry preserved. Historical baked checkpoints may contain absolute image links from earlier locations: when resuming one, use Blender's **Find Missing Files** against `renders/web-export/` if needed. Do not rewrite or delete historical files merely to validate this move.

## Project layout

```text
scene/lantern_lane.blend   Canonical editable source
references/Scene.png      Original visual reference
scripts/                  Blender export and legacy frame/video helpers
mcp/                      Blender-only MCP bridge for DeepSeek Harness
renders/                  Generated output; ignored by Git
.checkpoints/             Local safety history; ignored by Git
```

Open `scene/lantern_lane.blend` in Blender 5.2.1 LTS or a compatible newer release. The active scene is `Lantern Lane • storefront tour`; `Scene` preserves the original default scene. The lettering font is embedded, and materials are procedural. The file has no dependency on the archived preview images or animation frames.

Units are meters; procedural seed is 42. Hidden construction objects drive editable masonry cuts.

## Building hierarchy

The four main buildings remain complete movable assemblies. Expand a building collection, select its **`BUILDING • …` object**, and press **G** to move it (or R to rotate). The three new decorative buildings have independent controls under Environment, described in **Decorative street extension and website framing** below. The saved viewport shows the extended street; the original Tour camera remains the production camera.

Each building contains nested exterior, interior, local-lighting and construction branches, with attached planting organized under the building or its supporting assembly. Interior branches contain a ground-floor shop and individually named upstairs rooms; each room contains its objects and lights. `GROUP • …` controls move these subassemblies. Existing storefront, window-box and fire-escape parent objects remain usable.

| Top-level collection | Contents |
|---|---|
| 01 Learning Curriculum | Complete Learning building |
| 02 Blog | Complete Blog building, fire escape, balcony pots and canopy baskets |
| 03 About Me | Complete About Me building |
| 04 Projects | Complete Projects building, including the masonry lettering bay |
| 05 Street | Pavement, crosswalk, bench, one café seating set, lanterns, six loose round pots, one florist display and independent edge-tree controls |
| 06 Environment | Water tower, original backdrop and 80-building skyline, moon, stars, shared scene lighting and the three decorative neighboring buildings |
| 07 Cameras & Animation | The 46 mm animated Tour camera |
| 08 Asset Libraries | Hidden shared street and upper plant source meshes |

For example, Blog's parent hierarchy includes `BUILDING • Blog` → `GROUP • Blog • Interiors` → `GROUP • Blog writing` → room objects. The collection hierarchy follows the same ownership. Hanging baskets are nested beneath the storefront canopy, and balcony pots beneath the fire escape, so they also follow those supporting assemblies.

The complete water tower is under `06 Environment` → `Water tower`. Select `GROUP • Water tower` to move its tank, roof, hoops and four legs together; it has no building parent.

Building pivots sit at the front ground level. Window and masonry cutters travel with their owning building. Keep the masonry cutter collections and plant libraries hidden, and preserve the per-object hiding on window opening cutters. Collection exclusion can disable required modifier inputs.

The current scene contains **5,331 objects** beneath the same **eight top-level branches**. The natural-background pass adds 84 host-parented detail meshes and one distant ground-return mesh to the 5,246-object scene; its temporary front-review camera is archived rather than kept in the master. The initial background-city pass added 80 lightweight building objects and five assembly controls to the 5,145-object cleaned streetscape. The earlier sparse-window pass added 16 child meshes, now superseded and hidden. The sidewalk cleanup removed 327 objects from the 5,471-object extended scene and added one complete florist-display control. All 3,146 objects belonging to the original four buildings remain unchanged. Before the street extension the scene contained 3,683 objects and 97 collections. Earlier fixture repairs added 30 iron hardware objects and complete controls for the sidewalk planters and bench. The original default `Scene`, shared source meshes/materials, camera tour and production render settings remain preserved. The earlier organizational cleanup removed 2,253 obsolete geometry objects and 57 unused review cameras.

Recovery:
- `.checkpoints/106_before_building_hierarchy.blend` preserves the previous organization.
- Checkpoints 107–109 preserve the hierarchy, attachment refinement and verified scene.
- Checkpoints 110–111 preserve the water tower's move into Environment; all nine parts retain their world transforms.
- `.checkpoints/102_before_collection_cleanup.blend` contains the historical alternatives and review cameras removed earlier.
- Checkpoints are local, ignored files; use Git history for shared recovery. Historical archive collections described below are no longer in the working file.

Verification covers independent translation and rotation of all four building parents, an interior group, an individual room, and both Blog planting subassemblies. Each move affects only its descendants and restores exactly; all 69 building controls match their collection branches. Existing assembly parents remain ancestors of their original parts. Five 400 × 300 before/after renders at frames 1, 97, 289, 481 and 673 show no visible change, with small pixel differences recorded in `renders/review/building_hierarchy/verification.json`. Preview images and an Outliner screenshot are in the same folder. No animation export was regenerated.

## Fixture repairs and sidewalk controls

**Historical repair record:** the sidewalk cleanup below supersedes the former 14-planter layout and its control list. The retained bench hardware and surviving planter assemblies keep these repairs.

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

## Decorative street extension and website framing

The extension adds **The Daily Brew** and its ivy-covered connecting bay to the left of Learning, then **Petal & Post** and **The Book Nook** beyond Projects' existing lettering bay. These are real editable buildings with clear glazing, furnished ground-floor and upstairs rooms, local lighting, recessed windows, masonry, cornices, awnings and planting. New details include café seating and an espresso counter, flower displays, bookshelves, chalkboards, a Maple St. sign, hydrant, waste basket, bollards, lanterns, a bicycle/rack, and fallen leaves. Existing plant meshes and the embedded lettering font are reused without editing their source data; new paint and masonry materials are private to the extension.

### New controls

- `06 Environment → EXT • Neighboring buildings → EXT • Daily Brew / Petal & Post / Book Nook`: select **`BUILDING • Daily Brew`**, **`BUILDING • Petal & Post`**, or **`BUILDING • Book Nook`**. Their branches contain 488, 572 and 306 objects respectively, with matching descendant/collection ownership. Architecture, Interiors (including individual rooms), Planting, Lighting and hidden Construction inputs travel together. The connecting bay belongs to Daily Brew, not Learning.
- `05 Street → EXT • Street extension → GROUP • Street extension` carries the appended paving and remaining loose street furniture. Child collections/controls independently move the retained café table/chairs, café chalkboard, florist display, lanterns, hydrant, waste basket and bollards. The bicycle/rack, other chalkboards, second café seating set and eight street urns were removed during the sidewalk cleanup below.
- `05 Street → Trees`: **`GROUP • West edge tree`** and **`GROUP • East edge tree`** each carry one complete original tree. The west tree moved −5.8 m in X and the east tree +7.4 m. Their mesh/curve data remain unchanged.
- The original **`Streetlamp • move complete assembly`** moved −8.2 m in X to X −16.85, including its poetry banner and light. Its geometry and light settings remain unchanged. The east lantern is a new assembly with independent light data.

Only the two original trees and original streetlamp were relocated. The four main buildings, their interiors, local lights, attached planting, signs, hidden cutters and materials were not edited. The original bench, taxi, loose planters, roadway, crosswalk, water tower, world, and camera animation remain unchanged. New sidewalk segments append to the old 20 m sidewalk; they do not resize or replace it. At the building junctions, only the new café cornices were shortened and the new florist wall notched, providing 2 mm clearance around the original stonework.

### Website framing—not a website publication

The existing website treats the original overview pose and **32.711634° vertical FOV** as authoritative. The extension fills the additional horizontal view on wide screens; it does **not** zoom the four main shops out or promise all seven shops will fit at 4:3 or 16:9. Decorative neighbors are naturally cropped at narrower ratios. The four navigation hitboxes, approach endpoints, initial portrait Learning view and portrait pan range remain unchanged.

Website-matched reviews used a temporary **46 mm / VERTICAL sensor-fit / 27 mm sensor-height** camera. Simply widening the original AUTO-fit Blender render would change its vertical FOV and would not match the website. Square/near-square landscape previews apply the website's FOV expansion; portrait previews translate the same overview camera along X. The temporary review camera has been removed. Production remains `Tour camera`, frame 1, 1600 × 1200, 128 samples, AgX Medium High Contrast, exposure 0.5, with the original output path and 1–768 animation.

**No website code, camera metadata, GLBs, poster, or navigation destinations were changed or republished.** The website still consumes its existing baked assets. Publishing the extension requires a deliberate subsequent bake/export and asset rebuild, not merely changing the source hash or scene bounds.

### Verification and recovery

`renders/review/street_extension/verification.json` records the source-only checks at checkpoint 172, before the background simplification described below. All 3,146 protected building objects, 2,735 original geometry/light/camera datablocks, 125 original materials, original shader groups and protected collections pass comparison against the baseline. The only changed original object records are the 58 components/control records of the approved trees and streetlamp. Nine independent control translation/rotation tests pass with exact world-matrix restoration. Evaluated BVH testing between 2,516 protected solid mesh objects and 947 new solid mesh objects finds no surface intersections; foliage and non-mesh objects are excluded from that test.

Earlier extension review images in `renders/review/street_extension/` include the following. These images and `lantern_lane_extension_reviews.zip` preserve the checkpoint-172 appearance, before the background simplification. The latest wide render is listed below.
- `final_wide.png` — 1974 × 797, showing the complete extended row.
- `final_desktop_16x9.png` and `final_native_4x3.png` — 1920 × 1080 and 1600 × 1200.
- `review_desktop_16x10.png` and `review_square.png` — additional aspect checks.
- `final_portrait_<shop>.png` — 390 × 844 at each original shop; `final_portrait_west_limit.png` and `final_portrait_east_limit.png` test the existing pan limits.
- `review_approach_<shop>.png` — 800 × 600 at the four original approach endpoints.

Checkpoint **161** preserves the pre-extension scene. Checkpoints **162–170** record blockout, architecture, interiors, planting, street dressing, refinements and reviews. **171** records delivery; **172_extension_final_verified.blend** includes the final florist-control recheck and wide inspection viewport. The canonical source is saved at `scene/lantern_lane.blend`. The scene custom properties `EXT • baseline` and `EXT • verification` retain the detailed preservation records. No animation video was regenerated.

### Background simplification

The small blue background block above Petal & Post is now a plain silhouette matching the other distant buildings. Its two glowing window panes, two frames, two glazing bars and projecting roof cap were deleted (seven objects). The block itself, the foreground storefront roof/cornice, every other surviving object and their recorded geometry remain unchanged. All 3,146 protected main-building objects and all shared materials pass the before/after comparison. Petal & Post's collection and descendant hierarchy still match, now with 572 objects.

Checkpoint **173_before_background_simplification.blend** preserves the prior state, **174_background_simplified.blend** records the removal, and **175_background_simplification_verified.blend** records the saved and reviewed result. The current canonical scene is `scene/lantern_lane.blend`. The latest 1974 × 797 review is `renders/review/background_simplification/final_wide.png`, with its checks in `verification.json` alongside it and in scene property `BG • simplification verification`. The original Tour camera and render settings were restored and the temporary review camera removed. Website assets were not changed.

## Taxi removal and sidewalk cleanup

The taxi and all 22 of its components are removed. The 22 freestanding sidewalk planters are reduced to **six small round pots**; all four wooden planters, eight street urns and four surplus round pots are removed. Window boxes, balcony pots, hanging baskets, ivy and the building interiors are unchanged.

Current controls and layout:
- `05 Street → Sidewalk pots`: `GROUP • Sidewalk pot 01`, `03`, `04`, `07`, `08`, and `09` carry complete containers, rims, soil and planting. They are spaced along the café, Learning, Learning/Blog boundary, About/Projects boundary, Projects lettering bay and Book Nook respectively. Original control IDs are retained; the other pot controls no longer exist.
- `05 Street → Bench → GROUP • Bench`: the intact bench sits toward Blog's right-hand display rather than across its door.
- `05 Street → EXT • Street extension`: one two-chair café table sits beside Daily Brew's right display, and its welcome board is tucked at the west edge. The second seating set, florist/bookshop boards and bicycle/rack are removed to avoid pinch points.
- `EXT • Florist display → GROUP • Florist display`: one compact 15-part flower crate replaces the former three loose displays. This new control and its owning subcollection match, with the control parented to `GROUP • Street extension`.

A conservative footprint check, including low foliage, verifies a **1.22 m clear route serving all seven storefronts**, spanning X −17.35 to 16.50 m. It stays within the existing raised sidewalk, at least 50 mm inside its outer edge. All seven existing 0.92 m doorway connections and the crosswalk landing are unobstructed. The route ends before the pre-existing east-end lantern/ivy pinch; it is not a claim of a 1.22 m route beyond that endpoint or an accessibility-code assessment. Fixed lamps, bollards, hydrant, trees, paving and doorway thresholds are unchanged.

Verification finds no surface intersections between the moved assemblies and unrelated visible geometry across 851 candidate pairs. All 12 affected assembly controls pass translation/rotation and exact-restoration checks (within floating-point tolerance); their supports contact paving within 2 mm. All 5,007 protected object records, 3,955 original geometry datablock signatures, shared materials, light settings, original default `Scene`, world and camera-action inventory compare unchanged. Each scene object retains one owning collection. The source now contains 5,145 objects: 327 removed and one control added, with 137 surviving object/control records repositioned or regrouped.

Current review output is `renders/review/sidewalk_cleanup/`: `final_wide.png` (1974 × 797, 128 samples), a sidewalk-oblique review, four original storefront-tour views and `verification.json`. Checkpoints **176–180** preserve the baseline, prop removal, arrangement, clearance verification and final delivery. The canonical source is saved at `scene/lantern_lane.blend`; the temporary review camera is removed, and the original Tour camera, frame 1, 1600 × 1200 resolution, 128 samples and production output path are restored. The original saved inspection viewport is retained. No website assets or animation exports were regenerated.

## Expanded low-detail background city

**Initial skyline record:** the controls below remain in use; the [natural-background revision](#natural-background-buildings-current-source) supersedes the original proportions, palettes and sparse-window appearance.

The original skyline has **80 low-detail building masses**: 52 plain blocks, 20 single-setback forms and 8 shallow pitched-roof silhouettes. Width, depth, height and spacing vary with deterministic seed **42**. All 80 building objects share just **three closed, manifold mesh templates**, totaling **1,312 evaluated triangles**, with no modifiers, modeled openings, doors, interiors, image textures or light objects. The separate tiny window quads described below add just 164 triangles. Four private blue-gray materials provide restrained face shading, per-building tone variation and distance fading without changing the original `Distant blue brick` material or adding volumetric fog. Their small ambient-color component keeps distant faces readable without illuminating the street.

### Skyline controls

Expand `06 Environment → Distant buildings → CITY • Expanded skyline`. **`GROUP • Expanded skyline`** moves the entire addition; its four child controls each move one 20-building layer:

| Layer collection / control suffix | Building-center Y band | Approximate horizontal span |
|---|---|---|
| `Near skyline` | 12–18 m | X ±32 m |
| `Mid skyline` | 24–32 m | X ±44 m |
| `Far skyline` | 42–52 m | X ±60 m |
| `Horizon skyline` | 66–80 m | X ±78 m |

The layer collections are named `CITY • …`; their controls are named `GROUP • …`. Individual building objects are named `CITY • <layer> • <number> • <profile>` and have ground-level pivots at Z = 0. Their heights range approximately 9.8–27.25 m, with a deliberately lower gap behind the moon and water tower. These are distant backdrop masses, not a newly modeled walkable city or ground surface. Editing one linked mesh changes every building of that profile; make it single-user first for a unique geometry edit. Material overrides are per-object, while each layer's palette material remains shared.

All original background blocks, their sparse lit windows, and the simplified florist rooftop pavilion are unchanged. The moon was left unchanged during the initial skyline pass and was subsequently repositioned as described below. The **80 existing star meshes** were moved to Y ≈ 140 m, beyond the new skyline, and uniformly scaled along rays from the original overview camera. This preserves their overview positions and apparent sizes to under **0.001 pixel** at the final wide resolution, while allowing buildings to hide stars correctly. Their mesh data and materials are unchanged; these star transforms were the only intentional changes to existing object records during the initial skyline pass.

### Verification and reviews

Ray tests find **37 new buildings with visible roofline samples** in the wide overview: Near 10, Mid 10, Far 10, Horizon 7. Projected triangle checks find no new geometry in the expanded moon/water-tower clear zones, and the highest new roof leaves approximately **4.2% of the image height** as sky above it. Broad-phase checks across 395,400 new/existing object pairs find no bounding-box intersections. All five control/collection branches match and pass temporary translation/rotation tests with exact transform restoration; every object has one owning collection.

Preservation checks compare unchanged **5,065 protected object records**, **3,955 original geometry datablock signatures**, **164 original material graphs**, both original camera actions, all light settings, the world and the separate default `Scene`. The corrected café chairs, cleared walkway and all seven detailed storefronts are preserved. The 80 star transforms are the explicit exception. At completion of that initial skyline pass, the scene contained **5,230 objects and 168 materials**.

Windowless skyline reviews are in `renders/review/background_city/`:
- `final_wide.png`: 1974 × 797, 128 samples, website-matched overview framing.
- `final_desktop_16x9.png`: 1600 × 900, 128 samples.
- `review_city_layers.png`: elevated layout inspection; `review_native_4x3.png`: native-format overview.
- Four `review_<shop>.png` images at the original tour frames 97, 289, 481 and 673.
- `verification.json`: geometry, projection, preservation and delivery checks. Intermediate blockout/material previews and the matched before image are retained in the same ignored review folder.

Checkpoints **183–189** preserve the baseline, blockout, materials, geometry verification, composition adjustment, preservation verification and delivery. The canonical source remains `scene/lantern_lane.blend`. Temporary review cameras are removed, and the original Tour camera, frame 1 and production render settings/output path are restored. The latest live inspection viewport is retained rather than resetting navigation to the session-start view. No website assets, code, APIs or animation exports were changed.

### Tiny glowing background windows

**82 tiny emissive window quads** now appear on **16 of the 80 skyline buildings**; the other 64 stay plain. The selected buildings are distributed across the Near/Mid/Far/Horizon layers (5/3/5/3). There are 64 fully visible window centers in the wide overview; other lights occupy lower façades for alternate views. Warm amber and soft ivory materials use emission strengths 2.0 and 1.5 with the existing, unchanged fog-glow compositor. No light objects, window frames, openings, interiors or image textures were added.

The windows add only **16 mesh objects and 164 triangles**, bringing the complete new-city geometry to **1,476 triangles**. Each selected building has one child named `CITY • … • tiny windows`, in the same layer collection as its host. Move the host building or its existing layer/master control to carry the lights with it. Each window cluster remains separately editable; the 80 linked building meshes and their silhouette/material variations are untouched. Window layout uses seed **2042**.

All 82 panels pass center-and-corner support tests against their host façade (410 tests), at a 12 mm anti-z-fighting offset. Each of the 16 host-building controls passes a temporary translation/rotation test, with unrelated assemblies stationary. The window pass preserved all original **5,230 object records**, **3,958 geometry datablock signatures**, **168 material graphs**, camera actions, lights, world, compositor, original default scene and eight top-level branches. The scene now contains **5,246 objects and 170 materials**; production camera/render settings are restored and the temporary review camera is removed.

Window-pass previews are `renders/review/background_windows/final_wide.png` (1974 × 797) and `final_desktop_16x9.png` (1600 × 900), both rendered at 128 samples. `verification.json` records the checks. Checkpoints **190–192** retain the pre-window scene, added windows, and verified delivery. The canonical `.blend` contains `WIN • layout` and `WIN • verification` for this addition; the earlier `CITY • verification` remains the historical skyline-pass audit. Website assets and animation exports were not regenerated.

### Moon placement

The moon now sits in the distant sky at approximately **(7.578, 120.000, 37.217) m**, behind every background building and in front of the star field. Its former Y = 6.2 m placement put it at rooftop depth, in front of the expanded city. It remains in `06 Environment → Moon & stars`, without a building parent.

Its center is raised from normalized overview V ≈ 0.874 to **0.950**, keeping the same horizontal framing. A uniform scale factor of **4.4574** preserves its main-camera diameter at approximately **29 pixels** in the 1974 × 797 overview; its mesh and `Moon emission` material are unchanged. The disc has 25 pixels of top-edge clearance. All 33 disc visibility rays and 32 surrounding clearance rays pass without architectural obstruction.

Only the moon's transform changed: **5,245 unrelated object records**, all **170 material graphs**, both camera actions, lights, world, compositor, original scene and production camera settings are preserved. Object/material counts remain **5,246 / 170**. Checkpoints **193–195** retain the before state, distant-sky placement and verified delivery. Current wide and 16:9 previews, a native-camera 4:3 review and `verification.json` are under `renders/review/moon_placement/`; the source contains the `MOON • verification` audit. Temporary review cameras are removed. Website assets and animation exports are unchanged.

## Natural background buildings (current source)

The approved natural-background revision is consolidated into **`scene/lantern_lane.blend`**, the only source file in `scene/`. The original animated `Tour camera` is active again at frame 1, with the production 1600 × 1200, 128-sample settings and original output path restored. The temporary front-review camera is removed from the master. The exact front-view setup is preserved in `.checkpoints/203_natural_background_front_review.blend` and recorded in scene property `NAT • front review settings`.

The 80 expanded skyline masses have subtly varied widths, heights and setbacks (seed **74291**). These and the four original distant blocks now use muted slate, dusty masonry and blue-gray palettes with gentle surface variation and face shading. Low-detail coping, roof cabins, chimneys, occasional aerials and shallow pitched-roof coverings break up the outlines. Each of the 84 hosts owns one `NAT • … • windows and roof details` child in its existing collection. Aligned window rows include mostly dark rooms, varied dim amber/linen lights and occasional blinds; there are 3,947 front/side windows, of which 414 are lit. Superseded tiny-window meshes are retained but hidden. The new details total 40,815 faces. A single dark ground-return quad, parented to `GROUP • Expanded skyline` in `CITY • Expanded skyline`, closes the visible gap beneath the distant buildings without altering the original street. No new lights, external textures, volumetric fog or foreground edits were introduced.

All **5,118 non-background object records** match the before state for transforms, geometry-data identity, materials, parenting and render visibility. All 84 new detail objects have one owning collection and the correct host parent. Translation/restoration checks pass for the skyline master, all four layer controls and all four original distant blocks. The eight top-level collection branches remain unchanged. These are object-record and hierarchy checks, not a full mesh-content or collision audit.

Reviews are in `renders/review/natural_background/`: `preview_front.png` (1200 × 550), `final_front.png` (2400 × 1100, 128 EEVEE samples), and `verification.json`. These are ignored local outputs, not required checkout assets. Checkpoints **196–201** preserve the original, blockout, architecture, materials/camera, verified variant and final surface/ground refinement. **202** preserves the exact previous canonical file; **203** preserves the front-render variant; **204** preserves the commit-ready master. Older automatic backups are organized under `.checkpoints/commit-prep-backups/`. Duplicate files were removed from `scene/` only after comparison against their byte-identical recovery copies. The protected-object comparison passed again after restoring the tour settings. Website assets and animation exports were not changed or republished.

## Rendering

The tour uses the fixed 46 mm `Tour camera`, frames 1–768 at 24 fps, and a 1600 × 1200 frame size. It visits the storefronts from left to right, holding the wide view for one second, approaching for three seconds, holding for two seconds, and returning over two seconds per shop. Only the camera moves. Current EEVEE still settings use 128 samples.

The default output path is `//../renders/stills/shop_repair_wide.png`. Blender resolves `//` relative to the saved `.blend`, so paths work when the repository is moved. Use `//../renders/frames/tour_` for an animation sequence. The render format remains PNG, with overwrite disabled for resumable output. Restore the full 1–768 timeline after rendering a frame batch.

In the DeepSeek Harness workflow, Blender runs on the host. Resolve paths from the confirmed open `.blend` location; `/workspace` and `BLENDER_PROJECT_DIR` belong to the transport's path mapping. Use the existing MCP connection and short render batches as described in `AGENTS.md`, then inspect the rendered files under `blender/renders/` through Harness.

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

## Legacy rendering helpers

These optional helpers target the original fixed 32-second delivery. They use Python's standard library and resolve paths from this workspace, independent of the current working directory. The commands below assume you are in `blender/`. They mutate frame/video outputs and require an explicitly prepared delivery; they are **not** migration checks. Existing historical frames and video stay under `.checkpoints/legacy_frames/`, `.checkpoints/legacy_artifacts/` and `renders/legacy/` until a deliberate new render is requested.

- `python3 scripts/complete_frames.py` assembles matching camera poses for this specific 32-second tour, checks all 768 PNG dimensions, and writes `renders/validation.json`. It expects the required source frames in `renders/frames/`. Use its reuse mapping only while the camera timing is unchanged and the scene is stationary; otherwise render every frame normally.
- `python3 scripts/verify_video.py` validates `renders/storefront_tour.mp4` as a 32-second, 1600 × 1200, 768-frame video and adds the result to that report. It expects the silent H.264 export and the frame validation report to exist.

## Version control

Commit the canonical `.blend`, reference, scripts, and documentation. Renders, checkpoints, automatic backups, and caches are ignored. `.gitattributes` marks Blender and image files as binary to prevent text merging or line-ending changes.

The current source and reference are small enough for ordinary Git; Git LFS is not required or configured. If binary history becomes large, enable Git LFS before adding substantially larger assets. Coordinate edits to the `.blend` because binary scene changes cannot be merged automatically.

Save numbered safety checkpoints under `.checkpoints/` before substantial edits, then save completed work back to `scene/lantern_lane.blend`. Historical working files and notes are preserved in `.checkpoints/history.zip` and `.checkpoints/legacy_artifacts/`. The old 768-frame sequence is preserved in `.checkpoints/legacy_frames/`. These are local archives and are not part of a clone. Use Git commits for shared project history.

Run Git commands from the containing `personal-site` repository; this Blender workspace is not a separate repository. Follow the root README's commit checklist. Commit only the canonical scene and authored project files; keep review variants and renders in the ignored recovery/output folders. Blender source commits do not update the published website assets automatically.
