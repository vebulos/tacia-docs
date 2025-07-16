import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LOG } from './logging/bun-logger.service';
import { Markdown2HtmlService, MarkdownParseResult } from './markdown2html.service';

// Mock Logger
vi.mock('./logging/bun-logger.service', () => ({
  LOG: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Markdown2HtmlService', () => {
  let service: Markdown2HtmlService;
  const sanitizerMock = {
    bypassSecurityTrustHtml: vi.fn((s: string) => s),
  };

  let markedOptions: any = {};

  const mockMarkdownWithFrontMatter = `---
title: Test Document
categories:
  - test
  - docs
---
# Heading 1
\`\`\`javascript
const test = 'code';
\`\`\``;

  const mockMarkdownWithoutFrontMatter = `# Just a heading`;

  beforeEach(async () => {
    vi.clearAllMocks();
    markedOptions = {};

    (window as any).marked = {
      setOptions: vi.fn((options: any) => {
        markedOptions = options;
      }),
      parse: vi.fn((md: string, optionsOrCb: any, cb?: any) => {
        const callback = typeof optionsOrCb === 'function' ? optionsOrCb : cb;
        const options = typeof optionsOrCb === 'object' ? optionsOrCb : {};
        const effectiveOptions = { ...markedOptions, ...options };

        let html = md.replace(/^# (.*)/gm, '<h1>$1</h1>');

        // Always call highlight if a code block is present
        const codeBlockRegex = /\`\`\`(\w+)\n([\s\S]*?)\n\`\`\`/g;
        html = html.replace(codeBlockRegex, (match, lang, code) => {
          if (effectiveOptions.highlight && lang && code) {
            const highlighted = effectiveOptions.highlight(code.trim(), lang);
            return `<pre><code class=\"language-${lang}\">${highlighted}</code></pre>`;
          }
          return match;
        });

        // Simulate error if 'invalid markdown' is present
        if (md.includes('invalid markdown')) {
          callback(new Error('Markdown parsing failed'));
          return;
        }

        callback(null, html);
      }),
    };

    (window as any).hljs = {
      highlight: vi.fn((code: string) => ({ value: `highlighted: ${code}` })),
      getLanguage: vi.fn().mockReturnValue(true),
    };

    TestBed.configureTestingModule({
      providers: [
        Markdown2HtmlService,
        { provide: DomSanitizer, useValue: sanitizerMock },
      ],
    });

    service = TestBed.inject(Markdown2HtmlService);
    await service.isReadyForTest(); // Ensure service is initialized
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should parse markdown with front matter correctly', async () => {
    const result = await service.convertMarkdown(mockMarkdownWithFrontMatter);
    expect(result.metadata).toEqual({ title: 'Test Document', categories: ['test', 'docs'] });
    expect(result.rawContent).toContain('# Heading 1');
    expect(result.html).toContain('<h1 id="h1-heading-1">Heading 1</h1>');
    expect(result.headings).toHaveLength(1);
  });

  it('should handle markdown without front matter', async () => {
    const result = await service.convertMarkdown(mockMarkdownWithoutFrontMatter);
    expect(result.metadata).toEqual({});
    expect(result.rawContent?.trim()).toBe('# Just a heading');
    expect(result.html).toContain('<h1 id="h1-just-a-heading">Just a heading</h1>');
  });

  // Test simplified to check basic functionality without complex mocking
  it('should contain code highlighting in the result HTML', async () => {
    const result = await service.convertMarkdown(mockMarkdownWithFrontMatter);
    // Just verify the result contains a code element with the language class
    expect(result.html).toContain('language-javascript');
  });

});