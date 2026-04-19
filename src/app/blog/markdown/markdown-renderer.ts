export class MarkdownRenderer {
  static render(markdown: string): string {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const html: string[] = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];

      if (isBlank(line)) {
        index += 1;
        continue;
      }

      if (isFence(line)) {
        const codeBlock = readCodeBlock(lines, index);
        html.push(`<pre><code>${escapeHtml(codeBlock.content)}</code></pre>`);
        index = codeBlock.nextIndex;
        continue;
      }

      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        html.push(`<h${level}>${renderInline(headingMatch[2].trim())}</h${level}>`);
        index += 1;
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
        html.push('<hr>');
        index += 1;
        continue;
      }

      if (isUnorderedListItem(line)) {
        const list = readUnorderedList(lines, index);
        html.push('<ul>');
        for (const item of list.items) {
          html.push(`<li>${renderInline(item)}</li>`);
        }
        html.push('</ul>');
        index = list.nextIndex;
        continue;
      }

      if (isOrderedListItem(line)) {
        const list = readOrderedList(lines, index);
        html.push('<ol>');
        for (const item of list.items) {
          html.push(`<li>${renderInline(item)}</li>`);
        }
        html.push('</ol>');
        index = list.nextIndex;
        continue;
      }

      if (isBlockQuote(line)) {
        const quote = readBlockQuote(lines, index);
        html.push('<blockquote>');
        html.push(`<p>${renderInline(quote.text)}</p>`);
        html.push('</blockquote>');
        index = quote.nextIndex;
        continue;
      }

      const paragraph = readParagraph(lines, index);
      html.push(`<p>${renderInline(paragraph.text)}</p>`);
      index = paragraph.nextIndex;
    }

    return html.join('\n');
  }
}

function readCodeBlock(lines: string[], startIndex: number): { content: string; nextIndex: number } {
  let index = startIndex + 1;
  const codeLines: string[] = [];

  while (index < lines.length && !isFence(lines[index])) {
    codeLines.push(lines[index]);
    index += 1;
  }

  if (index < lines.length && isFence(lines[index])) {
    index += 1;
  }

  return {
    content: codeLines.join('\n'),
    nextIndex: index
  };
}

function readUnorderedList(lines: string[], startIndex: number): { items: string[]; nextIndex: number } {
  const items: string[] = [];
  let index = startIndex;

  while (index < lines.length && isUnorderedListItem(lines[index])) {
    const match = lines[index].match(/^\s*[-*]\s+(.+)$/);
    if (match) {
      items.push(match[1].trim());
    }
    index += 1;
  }

  return { items, nextIndex: index };
}

function readOrderedList(lines: string[], startIndex: number): { items: string[]; nextIndex: number } {
  const items: string[] = [];
  let index = startIndex;

  while (index < lines.length && isOrderedListItem(lines[index])) {
    const match = lines[index].match(/^\s*\d+\.\s+(.+)$/);
    if (match) {
      items.push(match[1].trim());
    }
    index += 1;
  }

  return { items, nextIndex: index };
}

function readBlockQuote(lines: string[], startIndex: number): { text: string; nextIndex: number } {
  const quoteLines: string[] = [];
  let index = startIndex;

  while (index < lines.length && isBlockQuote(lines[index])) {
    quoteLines.push(lines[index].replace(/^\s*>\s?/, '').trim());
    index += 1;
  }

  return {
    text: quoteLines.join(' ').trim(),
    nextIndex: index
  };
}

function readParagraph(lines: string[], startIndex: number): { text: string; nextIndex: number } {
  const paragraphLines: string[] = [];
  let index = startIndex;

  while (index < lines.length && !isParagraphTerminator(lines[index])) {
    paragraphLines.push(lines[index].trim());
    index += 1;
  }

  return {
    text: paragraphLines.join(' ').trim(),
    nextIndex: index
  };
}

function renderInline(text: string): string {
  const codeTokens: string[] = [];

  const tokenized = text.replace(/`([^`]+)`/g, (_match, code: string) => {
    const token = `__CODE_TOKEN_${codeTokens.length}__`;
    codeTokens.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  let rendered = escapeHtml(tokenized);
  rendered = rendered.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  rendered = rendered.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  for (let i = 0; i < codeTokens.length; i += 1) {
    rendered = rendered.replace(`__CODE_TOKEN_${i}__`, codeTokens[i]);
  }

  return rendered;
}

function isParagraphTerminator(line: string): boolean {
  return (
    isBlank(line) ||
    isFence(line) ||
    isUnorderedListItem(line) ||
    isOrderedListItem(line) ||
    isBlockQuote(line) ||
    /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim()) ||
    /^(#{1,6})\s+(.+)$/.test(line)
  );
}

function isFence(line: string): boolean {
  return /^\s*```/.test(line);
}

function isUnorderedListItem(line: string): boolean {
  return /^\s*[-*]\s+.+/.test(line);
}

function isOrderedListItem(line: string): boolean {
  return /^\s*\d+\.\s+.+/.test(line);
}

function isBlockQuote(line: string): boolean {
  return /^\s*>\s?.+/.test(line);
}

function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
