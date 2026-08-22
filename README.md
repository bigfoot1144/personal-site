# PersonalSite

## Local Dev (Docker)

To serve locally, run:

```bash
docker run --rm -it \
  -v "$PWD":/workspace \
  -w /workspace \
  benyamin/codex-sandbox:latest
```

Inside the container, start the app:

```bash
npm install -g ng
cd /workspace/personal-site
npm install
npm run start -- --host 0.0.0.0
```

Then open: `http://localhost:4200`

## Useful Commands

```bash
npm start            # Run dev server
npm run build        # Production build
npm run test         # Angular/Karma tests
npm run test:markdown # Markdown converter fixture tests
```

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
npm run build
```

## Knowledge Constellation

The read-only constellation at `/knowledge` is generated from:

- `src/assets/knowledge/curricula.json` for canonical topics, curricula, and connections
- `src/assets/knowledge/journal.json` for dated work, notes, projects, and status updates

After editing or generating either file, validate and preview it:

```bash
npm run validate:knowledge
npm run start
```

Topic IDs are stable references. Shared topics should remain single canonical topics listed in each relevant curriculum.

## TODO

- Figure out Firebase Hosting deployment flow
- Debug behavoir on iphone (scrolling doesnt work)
- Add RSS feed generator for blog posts
