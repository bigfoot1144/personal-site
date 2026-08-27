# Knowledge Constellation Authoring Guide

The files in this directory are the source of truth. The Angular application consumes a generated runtime artifact; never edit `knowledge.runtime.json` directly.

## Files

- `topics.json`: canonical topic definitions. Progress always attaches to a topic ID.
- `curricula/<id>.json`: one visual curriculum, its placements, and its connections.
- `shared-galaxies.json`: top-level placements shared directly by multiple curricula, their canonical children, and path insertion points.
- `journal.json`: dated work, notes, projects, and status updates.

Curriculum modules omit redundant `curriculumIds` and `topicIds`. The compiler adds the module curriculum ID to each placement and connection, then derives membership from the placements.

## Workflow

After any knowledge edit, run:

```bash
npm run knowledge:compile
npm run validate:knowledge
```

`npm start` and `npm run build` compile automatically. Validation fails when the generated runtime file is missing or stale.

## Canonical topics

Search `topics.json` before adding a topic. IDs must be stable, globally unique, lowercase kebab-case, and semantic rather than curriculum-specific. Reuse one canonical ID in multiple curriculum placements so journal status propagates everywhere.

Required topic fields are `id`, `title`, and `summary`. Optional fields are `tags`, `duration`, `completionCriteria`, and `resources`. A curriculum's designated goal topic must have a `goal` tag.

## Curriculum modules

Each file contains:

```json
{
  "version": 1,
  "curriculum": {
    "id": "example",
    "title": "Example Curriculum",
    "description": "A concise purpose statement.",
    "color": "#68d7a7",
    "goalTopicId": "example-goal"
  },
  "placements": [],
  "connections": []
}
```

A root placement is a stage in the overview. A placement with `parentPlacementId` is a topic inside that stage. Sibling `order` values control display order. Placement IDs are globally unique and remain stable because connections reference them.

Connections use placement IDs. Use `prerequisite` only for a true directed dependency and `related` for a useful non-blocking association. The compiler rejects cycles and unknown endpoints.

## Shared galaxies

Use `shared-galaxies.json` when several curricula genuinely traverse the same body of knowledge. The compiler merges duplicate canonical child placements beneath one top-level galaxy, preserves curriculum membership on each child, and inserts the shared placement into each configured prerequisite path. Shared galaxies therefore appear once in the overview while remaining part of multiple curricula.

## Journal updates

Append entries to `journal.json`; do not rewrite prior history. Entry IDs are stable and dates use `YYYY-MM-DD`.

- `work`: activity shown in the detail panel.
- `note`: durable content rendered as a planet.
- `project`: an artifact, optionally with a URL, rendered as a planet.

Allowed statuses are `not-started`, `in-progress`, and `completed`. Every status update topic must also appear in the entry's `topicIds`. The latest dated update wins, and canonical status automatically appears in every curriculum placement.

## Completion checklist

- Reused canonical topics rather than cloning concepts.
- Kept placement IDs and journal IDs stable.
- Used prerequisites only for genuine dependencies.
- Ran `npm run knowledge:compile`, `npm run validate:knowledge`, and `npm run build`.
