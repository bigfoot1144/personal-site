import { MarkdownRenderer } from './markdown-renderer';

export class MarkdownConverter {
  static convert(markdown: string): string {
    return MarkdownRenderer.render(markdown);
  }
}
