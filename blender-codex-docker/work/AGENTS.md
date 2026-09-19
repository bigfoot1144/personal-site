# Blender workspace

Codex runs in Docker. Blender runs on the host computer.

- This directory is /workspace in the container. Its host path is provided by the BLENDER_PROJECT_DIR environment variable. Read that variable before choosing Blender output paths. A /workspace path inside Blender Python does not refer to this folder on the host.
- Use the connected Blender MCP tools to inspect and edit the running scene. Do not launch a second MCP server or another Blender instance.
- Inspect the scene and take a viewport screenshot before significant changes. Keep a 3D Viewport editor open in Blender for screenshot capture.
- Preserve existing work. Save a new numbered .blend checkpoint before substantial edits and after each completed stage.
- Keep outputs within the host BLENDER_PROJECT_DIR folder unless the user specifies another location. This is a workflow instruction, not an operating-system security boundary.
- Work in stages: blockout, geometry, materials and lighting, then camera and animation. Inspect screenshots between stages.
- Prefer instancing for repeated assets, descriptive names, and organized collections. Use explicit units and a fixed random seed for procedural work.
- Start with low-resolution preview renders. Blender's socket has an approximately 180-second command timeout, so divide expensive operations into smaller tasks. If a call times out, inspect Blender before repeating a mutation.
- The screenshot path adapter only handles viewport screenshots. Python file paths, imports, exports, and render output paths must be valid on the host. Load a completed render from /workspace in Codex to inspect it.
- Keep Blender MCP safe mode and telemetry settings as configured by the user. If validation rejects code, rewrite it within the supported Blender API operations.

## Project layout

- The canonical editable source is `scene/lantern_lane.blend`; the original reference is `references/Scene.png`.
- Put generated stills, animation frames, and video under `renders/`, which is ignored by Git.
- Put numbered safety checkpoints under `.checkpoints/`, which is ignored by Git. Keep the project root free of preview files and numbered working copies.
- Blender paths beginning with `//` resolve relative to `scene/lantern_lane.blend`; use `//../renders/` for output.

## Scene hierarchy

Use the existing building and assembly hierarchy for all scene edits. Inspect the live collection tree and object parents before choosing where new or edited objects belong. The active scene is `Lantern Lane • storefront tour`; preserve the separate original `Scene`.

| Top-level collection | Ownership |
|---|---|
| `01 Learning Curriculum` | Complete Learning building |
| `02 Blog` | Complete Blog building, including its fire escape, balcony pots and canopy baskets |
| `03 About Me` | Complete About Me building |
| `04 Projects` | Complete Projects building, including its masonry lettering bay |
| `05 Street` | Pavement, crosswalk, bench, streetlamp, taxi, trees and loose sidewalk pots |
| `06 Environment` | Water tower, distant buildings, moon, stars and shared scene lighting |
| `07 Cameras & Animation` | Tour camera and animation |
| `08 Asset Libraries` | Hidden shared plant source meshes |

- Organize building contents beneath their owner: exterior, interiors, rooms, attached planting, local lighting and construction. Keep room objects and their lights inside the room branch. Add subcollections only when they represent a useful assembly or editing group; reuse existing branches and descriptive names.
- Maintain both collection membership and object parenting. Collections organize the Outliner; parent controls make assemblies move together. Every building-owned object, including its hidden cutters and lights, must descend from that building's `BUILDING • …` control. Each editable scene object should have one owning collection.
- Parent new objects to the nearest appropriate assembly control, and put them in its corresponding collection branch. Use existing `GROUP • …` controls and named storefront, window-box and fire-escape parents. For a new independently movable assembly, create one parent control inside its collection and attach it to the enclosing assembly.
- Move, rotate or scale a complete building through its `BUILDING • …` control. Transform a room or other subassembly through its group control. Preserve existing pivots and supporting-assembly relationships; avoid transforming both a parent and its descendants separately.
- Blog's hanging baskets belong beneath its storefront canopy, and its balcony pots beneath the fire escape. Keep their collection branches and parent chains aligned so the supporting assembly carries all attached parts.
- The water tower belongs to `06 Environment` → `Water tower`. Its tank, roof, hoops and legs descend from `GROUP • Water tower`, which has no building parent. Do not attach it to About Me or another building.
- Keep loose sidewalk pots, trees and street furniture in Street. Shared environment lights, the camera and asset libraries remain outside building parent chains. Preserve shared mesh data unless the requested edit requires independent geometry.
- During organizational moves or reparenting, preserve world transforms, visibility and modifier references. Keep window and masonry cutters with the building they affect; preserve their existing hiding behavior and avoid excluding required construction inputs from the view layer.
- After changing ownership or parenting, verify that the control's descendants match its assembly's collection branch. Temporarily translate or rotate the affected control to check that all intended parts follow and unrelated assemblies stay put, then restore the exact original transform before saving.
- Keep the eight top-level branches unless the user requests a different structure. Put review outputs in `renders/` and historical alternatives in numbered checkpoints; do not accumulate revision archives, review-camera collections or loose objects at the scene root. Update `README.md` when the hierarchy or controls change.
