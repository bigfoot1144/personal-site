# PersonalSite

## Storefront homepage

`/` is the interactive Lantern Lane scene rendered with Three.js. Select a shop to zoom in and enter:

- **Learning Curriculum** → `/knowledge`
- **Blog** → `/blog`
- **About Me** → `/about` (the former homepage)
- **Projects** → [GitHub](https://github.com/bigfoot1144)

Portrait screens swipe horizontally between shops. Keyboard navigation, reduced motion, and a same-scene poster/link fallback are supported. The original starfield and drawing experience remain on the content pages, not the storefront.

See [Storefront implementation and asset workflow](docs/storefront.md) for Blender export, optimization, debugging and browser checks. Normal development uses the published web assets and does not require Blender.

## Local development

Use Node 22+ and run these commands from the repository root:

```bash
npm ci
npm start
```

Then open `http://localhost:4200`. Angular CLI is installed locally with the project dependencies; no global CLI or agent container is required.

## DeepSeek Harness and Blender

Open this repository in DeepSeek Harness and use its configured Blender MCP tools with your existing desktop Blender session. The editable project lives in `blender/`; read [blender/AGENTS.md](blender/AGENTS.md) before scene work.

The optional [Blender-only MCP bridge](blender/mcp/README.md) supplies the transport container and a portable Harness connector example. Model selection, authentication and machine-local Harness settings are managed outside this repository. Normal website builds use the published assets and do not require Blender.

## Useful Commands

```bash
npm start            # Run dev server
npm run build        # Production build
npm run test         # Angular/Karma tests
npm run test:markdown # Markdown converter fixture tests
npm run test:knowledge # Knowledge compiler and performance tests
npm run test:unit     # Complete headless unit suite
npm run test:e2e      # Production SSR/browser checks
npm run validate:storefront # Validate published scene assets and budgets
```

## Git and scene revisions

Keep scene/site work on your feature branch (currently `3d-storefront`). **Save in Blender before committing**: Git only records the file on disk, not unsaved scene edits.

Commit these together when publishing a scene revision:

- The editable master, `blender/scene/lantern_lane.blend`, and its original reference, `blender/references/Scene.png`.
- Website code, tests, documentation, export scripts, camera metadata, `package.json`, and `package-lock.json`.
- **All published files in `src/assets/storefront/`**, including both GLBs, poster, HDR, decoder files and asset report, plus `src/app/storefront/storefront.scene.json`. These are intentionally versioned so a fresh checkout can run without Blender.

Dependencies, build caches, test reports, raw bakes/renders, automatic `.blend1` backups, `.checkpoints/`, and machine-local environment/configuration files are ignored. Shared OpenCode skills and safe environment templates remain versioned. `.gitattributes` marks scene/media assets as ordinary Git binaries; no Git LFS setup is required for the current files.

Checkpoints stay on your machine; they are **not a remote backup**. Commit important milestones of the master `.blend`. Do not use `git clean -fdx` to tidy this workspace: it would delete ignored checkpoints and other local recovery data.

From the repository root, review and commit:

```bash
git status --short --branch
npm run validate:storefront
git diff --check
git add --dry-run .       # Preview: no caches, credentials or raw renders
git add .
git diff --cached --stat  # Review the exact staged changes
git commit -m "Add interactive Blender storefront homepage"
```

For later scene-only work-in-progress commits, the existing web assets can stay unchanged; [publish a new web revision](docs/storefront.md#publish-optimized-browser-assets) when ready. Blender edits do not live-sync to the site.

## Blog Workflow

Create a new blog post:

```bash
npm run new-post -- --slug your-post-slug --title "Your Post Title" --date "February 14, 2026" --summary "Short summary"
```

This will:

1. Create `src/assets/blog/posts/your-post-slug.md`
2. Add metadata in `src/app/blog/blog-posts.ts`
3. Make the post available at `/blog/your-post-slug`

Delete a blog post:

1. Open `src/app/blog/blog-posts.ts`
2. Remove the object with the matching `slug`
3. Delete the markdown file:

```bash
rm src/assets/blog/posts/<slug>.md
```

4. Verify:

```bash
npm run test:markdown
npm run test:knowledge # Knowledge compiler and performance tests
npm run build
```

## Knowledge Constellation

The read-only constellation at `/knowledge` is generated from:

- `knowledge/topics.json` and `knowledge/curricula/*.json` for canonical topics, curricula, placements, and connections
- `knowledge/journal.json` for dated work, notes, projects, and status updates

After editing a topic, curriculum, or journal file, compile, validate, and preview it:

```bash
npm run knowledge:compile
npm run validate:knowledge
npm run start
```

Topic IDs are stable references. Shared topics should remain single canonical topics listed in each relevant curriculum.

Detailed authoring instructions for humans and agents: [Knowledge Constellation Authoring Guide](knowledge/README.md)

## TODO

- Figure out Firebase Hosting deployment flow
- Debug behavoir on iphone (scrolling doesnt work)
- Add RSS feed generator for blog posts
