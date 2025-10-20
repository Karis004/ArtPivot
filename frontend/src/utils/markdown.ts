const CODE_BLOCK_PLACEHOLDER_PREFIX = '__CODE_BLOCK_';

const escapeHtml = (input: string): string => {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const buildCodeBlockPlaceholder = (index: number): string => `${CODE_BLOCK_PLACEHOLDER_PREFIX}${index}__`;

const restoreCodeBlocks = (html: string, codeBlocks: string[]): string => {
  let result = html;
  codeBlocks.forEach((code, index) => {
    const placeholder = buildCodeBlockPlaceholder(index);
    const blockHtml = `<pre><code>${code}</code></pre>`;
    result = result.replace(placeholder, blockHtml);
  });
  return result;
};

const transformInlineMarkdown = (input: string): string => {
  let output = input;

  output = output.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  output = output.replace(/__(.+?)__/g, '<strong>$1</strong>');

  output = output.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?=[^*]|$)/g, (_match, prefix, value) => `${prefix}<em>${value}</em>`);
  output = output.replace(/(^|[^_])_([^_\s][^_]*)_(?=[^_]|$)/g, (_match, prefix, value) => `${prefix}<em>${value}</em>`);

  output = output.replace(/`([^`]+)`/g, '<code>$1</code>');

  output = output.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" />');
  output = output.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  return output;
};

const transformBlocks = (input: string): string => {
  const lines = input.split('\n');
  const html: string[] = [];

  let paragraph: string[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let blockquote: string[] | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const content = paragraph.join('<br/>').trim();
    if (content) html.push(`<p>${content}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!currentList) return;
    html.push(`<${currentList.type}>${currentList.items.join('')}</${currentList.type}>`);
    currentList = null;
  };

  const flushBlockquote = () => {
    if (!blockquote) return;
    const inner = transformBlocks(blockquote.join('\n'));
    html.push(`<blockquote>${inner}</blockquote>`);
    blockquote = null;
  };

  lines.forEach(rawLine => {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushBlockquote();
      return;
    }

    if (trimmed.startsWith(CODE_BLOCK_PLACEHOLDER_PREFIX)) {
      flushParagraph();
      flushList();
      flushBlockquote();
      html.push(trimmed);
      return;
    }

    if (/^<h\d>/.test(trimmed) || trimmed.startsWith('<pre') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol')) {
      flushParagraph();
      flushList();
      flushBlockquote();
      html.push(trimmed);
      return;
    }

    if (trimmed === '<hr />') {
      flushParagraph();
      flushList();
      flushBlockquote();
      html.push(trimmed);
      return;
    }

    if (trimmed.startsWith('>')) {
      flushParagraph();
      flushList();
      if (!blockquote) blockquote = [];
      blockquote.push(trimmed.replace(/^>\s?/, ''));
      return;
    }

    const isUnordered = /^[-*+]\s+/.test(trimmed);
    const isOrdered = /^\d+\.\s+/.test(trimmed);

    if (isUnordered || isOrdered) {
      flushParagraph();
      flushBlockquote();
      const type = isUnordered ? 'ul' : 'ol';
      const clean = trimmed.replace(isUnordered ? /^[-*+]\s+/ : /^\d+\.\s+/, '');
      if (!currentList || currentList.type !== type) {
        flushList();
        currentList = { type, items: [] };
      }
      currentList.items.push(`<li>${clean}</li>`);
      return;
    }

    flushList();
    flushBlockquote();
    paragraph.push(trimmed);
  });

  flushParagraph();
  flushList();
  flushBlockquote();

  return html.join('');
};

export const markdownToHtml = (markdown: string): string => {
  if (!markdown) return '';

  const escaped = escapeHtml(markdown);

  const codeBlocks: string[] = [];
  const withPlaceholders = escaped.replace(/```([\s\S]*?)```/g, (_match, code) => {
    const index = codeBlocks.length;
    codeBlocks.push(code.trim());
    return buildCodeBlockPlaceholder(index);
  });

  let processed = withPlaceholders;

  processed = processed.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>');
  processed = processed.replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>');
  processed = processed.replace(/^####\s+(.*)$/gm, '<h4>$1</h4>');
  processed = processed.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>');
  processed = processed.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
  processed = processed.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');

  processed = processed.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '<hr />');

  processed = transformInlineMarkdown(processed);

  processed = transformBlocks(processed);

  processed = restoreCodeBlocks(processed, codeBlocks);

  return processed.trim();
};
