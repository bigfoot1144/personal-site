---
name: add-project
description: Adds a project to the knowledge constellation as a planet orbiting a topic. Use when the user asks to add, log, or showcase a project on the site, in a curriculum, in the knowledge map, or wants a project rendered as a planet.
---

# Add a Project (Planet)

The Knowledge Constellation (`/knowledge`) renders journal entries of type
`project` (and `note`) as planets orbiting the topic star they are linked to.
A planet appears only when a **child placement** (a topic placed under a stage
with a `parentPlacementId`) for one of the entry's topics is selected.

**Only content files under `knowledge/` are edited.** The Angular app consumes a
generated artifact — never edit `src/app/knowledge/knowledge.runtime.json`
directly. Regenerate it after every content change.

## Files

- `knowledge/topics.json` — canonical topics.
- `knowledge/curricula/<id>.json` — one curriculum: its placements and connections.
- `knowledge/journal.json` — dated journal entries (this is where planets live).
- `src/app/knowledge/knowledge.runtime.json` — GENERATED. Never edit by hand.

## Workflow

1. Gather from the user: project title, a 1–2 sentence `body`, an optional
   `url`, a `date` (`YYYY-MM-DD`), the target curriculum id, and the topic the
   project belongs to. If the topic is ambiguous, pick the best match in
   `topics.json` or ask.

2. Ensure the topic exists in `knowledge/topics.json`. Search first and reuse a
   canonical id when possible. Only if no suitable topic exists, append one:

   ```json
   { "id": "kebab-case-id", "title": "Human Readable Title", "summary": "One or two sentences." }
   ```

   Rules: `id` is lowercase kebab-case, globally unique, stable; `title` and
   `summary` are required.

3. Make the topic planet-capable in the target curriculum
   (`knowledge/curricula/<curriculum>.json`). A planet only renders for a
   **child** placement, i.e. one with a `parentPlacementId`.
   - If the topic already has a child placement under some stage, nothing to do.
   - Otherwise add a placement referencing an existing stage (root placement) as
     its parent:

     ```json
     {
       "id": "place-<curriculum>-<topic-id>",
       "topicId": "<topic-id>",
       "parentPlacementId": "<an existing root placement id in this curriculum>",
       "order": <next free integer among that parent's children>
     }
     ```

     Placement ids are globally unique and stable. Choose the stage the topic
     most naturally belongs to. Do not add prerequisite `connections` unless the
     user asks — a placement without connections still renders.

4. Append the entry to `knowledge/journal.json` (`entries` array; never rewrite
   prior entries):

   ```json
   {
     "id": "proj-<kebab-slug>",
     "date": "YYYY-MM-DD",
     "type": "project",
     "title": "Human Readable Title",
     "body": "One or two sentences about the artifact.",
     "topicIds": ["<topic-id>"],
     "url": "https://..."
   }
   ```

   Validation rules the compiler enforces:
   - `date` matches `YYYY-MM-DD`.
   - `type` is `work`, `note`, or `project` (use `project` here).
   - every id in `topicIds` exists in `topics.json`.
   - entry ids are unique.
   - optional `url` renders an "Open project" link in the detail panel.
   - optional `statusUpdates`: `[{ "topicId": "...", "status": "not-started" | "in-progress" | "completed" }]`;
     each `topicId` must also appear in the entry's `topicIds`.

5. Regenerate and validate:

   ```bash
   npm run knowledge:compile
   npm run validate:knowledge
   ```

   `npm start` / `npm run build` also compile automatically; the build's
   validation fails if the runtime file is stale.

6. Report where the planet will appear: in `/knowledge`, open the curriculum's
   stage (galaxy), then click the topic star — the project orbits it as a
   planet. Planet size and color are derived automatically (`project` is
   amber); there are no per-planet position fields to set.

## Notes

- One project can list multiple `topicIds`; it then appears as a planet in each
  topic's solar view and in each topic's activity list.
- Keep `body` to 1–2 sentences: planet visual size scales with `body` length.
- If the user wants the project to count as progress, add a `statusUpdates`
  entry; otherwise omit it so the topic stays `not-started`.
