import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MarkdownConverter } from '../src/app/blog/markdown/markdown-converter';

interface FixtureCase {
  name: string;
  markdownPath: string;
  expectedHtmlPath: string;
}

const FIXTURES: FixtureCase[] = [
  {
    name: 'basic formatting',
    markdownPath: 'src/assets/blog-fixtures/basic-formatting.md',
    expectedHtmlPath: 'src/assets/blog-fixtures/basic-formatting.expected.html'
  },
  {
    name: 'lists and code',
    markdownPath: 'src/assets/blog-fixtures/lists-and-code.md',
    expectedHtmlPath: 'src/assets/blog-fixtures/lists-and-code.expected.html'
  }
];

for (const fixture of FIXTURES) {
  const markdown = readFixture(fixture.markdownPath);
  const expected = readFixture(fixture.expectedHtmlPath);
  const actual = MarkdownConverter.convert(markdown);

  assert.equal(
    normalizeHtml(actual),
    normalizeHtml(expected),
    `Fixture failed: ${fixture.name}`
  );

  console.log(`PASS: ${fixture.name}`);
}

console.log(`All ${FIXTURES.length} markdown conversion fixtures passed.`);

function readFixture(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

function normalizeHtml(html: string): string {
  return html
    .replace(/\r\n/g, '\n')
    .replace(/>\s+</g, '><')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
