import { MarkdownConverter } from './markdown-converter';

interface FixtureCase {
  markdownPath: string;
  expectedHtmlPath: string;
}

const FIXTURES: FixtureCase[] = [
  {
    markdownPath: '/assets/blog-fixtures/basic-formatting.md',
    expectedHtmlPath: '/assets/blog-fixtures/basic-formatting.expected.html'
  },
  {
    markdownPath: '/assets/blog-fixtures/lists-and-code.md',
    expectedHtmlPath: '/assets/blog-fixtures/lists-and-code.expected.html'
  }
];

describe('MarkdownConverter', () => {
  for (const fixture of FIXTURES) {
    it(`renders ${fixture.markdownPath} accurately`, async () => {
      const markdown = await loadFixture(fixture.markdownPath);
      const expected = await loadFixture(fixture.expectedHtmlPath);

      const rendered = MarkdownConverter.convert(markdown);

      expect(normalizeHtml(rendered)).toBe(normalizeHtml(expected));
    });
  }
});

async function loadFixture(path: string): Promise<string> {
  const response = await fetch(path);
  expect(response.ok).withContext(`Failed to load fixture: ${path}`).toBeTrue();
  return response.text();
}

function normalizeHtml(html: string): string {
  return html
    .replace(/\r\n/g, '\n')
    .replace(/>\s+</g, '><')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
