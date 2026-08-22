# Knowledge Constellation Authoring Guide

This guide is the source of truth for humans and agents adding curricula, journal activity, notes, and projects. Content changes belong in the JSON data files; do not hard-code curriculum content or positions in the Angular component.

## Files and validation

- `curricula.json`: canonical topics, curriculum membership, visual placements, and connections.
- `journal.json`: dated activity and status changes.
- `../../app/knowledge/knowledge.types.ts`: TypeScript interfaces consumed by the UI.
- `../../../scripts/validate-knowledge.mjs`: executable validation rules.

From the repository root, run this after every data edit:

```bash
npm run validate:knowledge
npm run build
```

Both JSON files must remain valid JSON with `"version": 1`. JSON does not support comments.

## Mental model

The graph has four distinct concepts:

1. A **topic** is the canonical identity for a subject such as `linear-algebra`. Progress and journal entries attach to this ID.
2. A **curriculum** is a named collection of topic IDs with one goal topic.
3. A **placement** says where a canonical topic appears in the visual hierarchy. Connections join placement IDs, not topic IDs.
4. A **journal entry** records dated work against one or more canonical topic IDs.

Never create duplicate canonical topics just because two curricula use the same knowledge. For example, Physics and ML should both reference the existing `linear-algebra` topic. One journal update to that topic is then reflected in both curricula.

Create another placement for the same canonical topic only when it must appear under a genuinely different parent or context. If the topic has the same parent/context in multiple curricula, reuse one placement and include every relevant curriculum ID in its `curriculumIds`.

## Visual hierarchy

- Root placement: a major curriculum stage shown in the overview constellation.
- Child placement: a subtopic shown as a star in that stage's galaxy.
- Journal `note` and `project` entries: planets around the selected subtopic star.
- Journal `work` entries: activity shown in the detail panel, but not rendered as planets.

The `order` of sibling placements controls their journey order, especially inside a galaxy. Use consecutive integers starting at zero. Root prerequisite connections determine the overview journey; root order is the deterministic tie-breaker.

## Add a curriculum

### 1. Reuse or add canonical topics

Search `topics` by ID and meaning before adding anything. IDs must be globally unique, stable, lowercase kebab-case, and semantic rather than curriculum-specific.

```json
{
  "id": "optimization",
  "title": "Optimization",
  "summary": "Objectives, gradients, constraints, and numerical optimization methods.",
  "tags": ["math", "optimization"],
  "duration": "4–6 weeks",
  "completionCriteria": "You can choose and analyze an optimization method for a new objective.",
  "resources": [
    { "label": "Primary textbook" },
    { "label": "Course notes", "url": "https://example.com/course" }
  ]
}
```

Only `id`, `title`, and `summary` are required. Tags, duration, completion criteria, and resources are optional. Give goal topics a `"goal"` tag.

### 2. Add the curriculum record

Every topic used by any placement in this curriculum must appear exactly once in `topicIds`, including shared topics and the goal.

```json
{
  "id": "data-science",
  "title": "Data Science",
  "description": "Statistical foundations through production analysis.",
  "color": "#68d7a7",
  "goalTopicId": "data-science-goal",
  "topicIds": [
    "mathematical-methods",
    "probability",
    "optimization",
    "data-science-goal"
  ]
}
```

### 3. Add placements

Create root placements for major stages and the goal. Create child placements for galaxy-level subtopics.

```json
{
  "id": "place-optimization",
  "topicId": "optimization",
  "curriculumIds": ["data-science"],
  "order": 1
},
{
  "id": "place-gradient-descent-data-science",
  "topicId": "gradient-descent",
  "parentPlacementId": "place-optimization",
  "curriculumIds": ["data-science"],
  "order": 0,
  "contextLabel": "Optimization methods"
}
```

Placement IDs must be globally unique. A placement's topic must be listed in every curriculum named by that placement. The optional `contextLabel` disambiguates alternate placements in the UI.

For an existing shared placement, update both sides of the relationship:

- Add the new curriculum ID to the placement's `curriculumIds`.
- Add that placement's canonical `topicId` to the curriculum's `topicIds`.

### 4. Connect root stages

Connections use placement IDs:

```json
{
  "id": "data-science-math-optimization",
  "source": "place-mathematical-methods",
  "target": "place-optimization",
  "relation": "prerequisite",
  "curriculumIds": ["data-science"]
}
```

- `prerequisite`: directed journey from source to target. It must remain acyclic.
- `related`: a non-sequential conceptual link, rendered more subtly.

Both endpoint placements must include every curriculum named by the connection. Connect the last stage to the goal placement. Do not add arrow-like reverse duplicates.

### 5. Validate

Run `npm run validate:knowledge`. Fix every reported error rather than weakening the validator. Then run `npm run build` to catch template/type regressions.

## Add journal activity, notes, and projects

Append entries to `journal.json`; preserve existing entries. Entry IDs must be globally unique and stable. Dates use UTC-style `YYYY-MM-DD` strings.

### Work entry

Use `work` for a study session or progress log that should appear in Activity but does not need a planet:

```json
{
  "id": "2026-08-22-linear-algebra-study",
  "date": "2026-08-22",
  "type": "work",
  "title": "Reviewed eigendecomposition",
  "body": "Derived the characteristic polynomial and diagonalized three example matrices.",
  "topicIds": ["linear-algebra", "eigenvectors"],
  "statusUpdates": [
    { "topicId": "linear-algebra", "status": "in-progress" },
    { "topicId": "eigenvectors", "status": "in-progress" }
  ]
}
```

### Note entry

Use `note` for a durable note. It becomes a planet around every linked subtopic:

```json
{
  "id": "2026-08-22-eigenvector-notes",
  "date": "2026-08-22",
  "type": "note",
  "title": "Eigenvector intuition",
  "body": "A basis of eigenvectors turns the transformation into independent scalar actions.",
  "topicIds": ["eigenvectors"]
}
```

### Project entry

Use `project` for an artifact. Include `url` when one exists:

```json
{
  "id": "2026-08-22-pca-visualizer",
  "date": "2026-08-22",
  "type": "project",
  "title": "PCA visualizer",
  "body": "Built an interactive visualization of covariance eigenvectors and projected data.",
  "topicIds": ["linear-algebra", "eigenvectors", "probability"],
  "url": "https://example.com/pca",
  "statusUpdates": [
    { "topicId": "linear-algebra", "status": "completed" }
  ]
}
```

Allowed statuses are `not-started`, `in-progress`, and `completed`. The latest dated status update for a canonical topic wins. Avoid contradictory updates for the same topic on the same date.

Parent-stage status rolls up automatically:

- Explicitly completing a stage marks it completed.
- Completing every child marks the parent stage completed.
- Activity or partial child completion marks the parent in progress.
- If nothing is explicitly in progress, the UI infers the earliest unfinished prerequisite as Next Up without writing a status change.

## Instructions for an activity-ingestion agent

When a user describes what they did today:

1. Read both JSON files before editing and preserve unrelated content.
2. Resolve each activity to existing canonical topic IDs by meaning, not just exact wording.
3. Prefer shared existing topics. Add a new topic only when the activity genuinely has no canonical match.
4. Create separate entries for distinct durable notes, projects, or work sessions; link one entry to multiple topics when appropriate.
5. Record only status changes supported by the user's statement. Work does not automatically mean completed.
6. Do not invent project URLs, completion claims, resources, dates, or notes.
7. If the date is not supplied, use the current workspace date and state that choice in the handoff.
8. Run validation and the production build, then summarize entries added and statuses changed.

A useful request format is:

> Update my knowledge journal for 2026-08-22. I studied eigendecomposition for 90 minutes, wrote notes on eigenvector intuition, and built a PCA visualizer at [URL]. Linear algebra is still in progress. Resolve this against existing topics, append the appropriate entries, validate the knowledge data, and summarize the changes.

## Agent completion checklist

- Reused canonical topics wherever meanings overlap.
- Added all new topic IDs to the correct curriculum records.
- Used topic IDs for journal entries and placement IDs for connections.
- Kept placement hierarchy and prerequisites acyclic.
- Used unique IDs and valid dates, entry types, relations, and statuses.
- Preserved existing entries and unrelated curriculum data.
- Ran `npm run validate:knowledge` and `npm run build` successfully.
