import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BLOG_POSTS_PATH = join(process.cwd(), 'src/app/blog/blog-posts.ts');
const POSTS_DIR = join(process.cwd(), 'src/assets/blog/posts');

const args = parseArgs(process.argv.slice(2));

if (!isNonEmptyString(args.slug)) {
  fail('Missing required argument: --slug <slug>');
}

const slug = sanitizeSlug(args.slug);
if (!slug) {
  fail('Slug is invalid after sanitization. Use lowercase letters, numbers, and hyphens.');
}

const title = readOptionalStringArg(args, 'title') ?? slugToTitle(slug);
const date = readOptionalStringArg(args, 'date') ?? formatDate(new Date());
const summary = readOptionalStringArg(args, 'summary') ?? 'New blog post summary.';
const dryRun = Boolean(args['dry-run']);

const markdownRelPath = `src/assets/blog/posts/${slug}.md`;
const markdownAbsPath = join(process.cwd(), markdownRelPath);

if (existsSync(markdownAbsPath)) {
  fail(`Markdown file already exists: ${markdownRelPath}`);
}

const blogPostsContent = readFileSync(BLOG_POSTS_PATH, 'utf8');
if (blogPostsContent.includes(`slug: '${escapeSingleQuote(slug)}'`)) {
  fail(`A blog post with slug '${slug}' already exists in blog-posts.ts`);
}

const markdownTemplate = [
  `# ${title}`,
  '',
  'Write your intro paragraph here.',
  '',
  '## Section Heading',
  '',
  '- Point one',
  '- Point two',
  '',
  '```ts',
  '// Example code block',
  'console.log("hello blog");',
  '```',
  ''
].join('\n');

const postEntry = [
  '  {',
  `    slug: '${escapeSingleQuote(slug)}',`,
  `    title: '${escapeSingleQuote(title)}',`,
  `    date: '${escapeSingleQuote(date)}',`,
  `    summary: '${escapeSingleQuote(summary)}',`,
  `    markdownPath: '/assets/blog/posts/${escapeSingleQuote(slug)}.md'`,
  '  }'
].join('\n');

const updatedBlogPosts = appendPostEntry(blogPostsContent, postEntry);

if (dryRun) {
  console.log('Dry run complete. No files were written.');
  console.log(`Would create: ${markdownRelPath}`);
  console.log('Would append entry to: src/app/blog/blog-posts.ts');
  process.exit(0);
}

mkdirSync(POSTS_DIR, { recursive: true });
writeFileSync(markdownAbsPath, markdownTemplate, 'utf8');
writeFileSync(BLOG_POSTS_PATH, updatedBlogPosts, 'utf8');

console.log(`Created markdown file: ${markdownRelPath}`);
console.log('Updated metadata: src/app/blog/blog-posts.ts');
console.log(`New route available at: /blog/${slug}`);

function parseArgs(argv) {
  const result = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      result[key] = true;
      continue;
    }

    result[key] = next;
    i += 1;
  }

  return result;
}

function readOptionalStringArg(args, key) {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }

  if (!isNonEmptyString(value)) {
    fail(`Flag --${key} requires a value`);
  }

  return value.trim();
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function sanitizeSlug(rawSlug) {
  return rawSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function slugToTitle(value) {
  return value
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatDate(dateValue) {
  return dateValue.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function appendPostEntry(source, postEntryText) {
  const declarationMatch = source.match(/export const BLOG_POSTS: BlogPost\[\]\s*=\s*\[([\s\S]*?)\];/);
  if (!declarationMatch) {
    fail('Could not find BLOG_POSTS declaration in src/app/blog/blog-posts.ts');
  }

  const declarationText = declarationMatch[0];
  const currentBody = declarationMatch[1];
  const hasItems = currentBody.trim().length > 0;

  const newBody = hasItems ? `${currentBody.trimEnd()},\n${postEntryText}\n` : `\n${postEntryText}\n`;
  const updatedDeclaration = `export const BLOG_POSTS: BlogPost[] = [${newBody}];`;

  return source.replace(declarationText, updatedDeclaration);
}

function escapeSingleQuote(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
