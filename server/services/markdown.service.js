/**
 * MarkdownService - provides markdown parsing, front matter extraction, and heading extraction.
 */
const marked = require('marked');
const hljs = require('highlight.js');
const { JSDOM } = require('jsdom');

// Configure marked with highlight.js for syntax highlighting
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  langPrefix: 'hljs language-',
  gfm: true,
  breaks: true,
  silent: true
});

class MarkdownService {
  /**
   * Extract YAML front matter and markdown content from a file.
   * @param {string} content - Raw markdown file content
   * @returns {{ metadata: object, markdown: string }}
   */
  static extractFrontMatter(content) {
    const frontMatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!frontMatterMatch) {
      return { metadata: {}, markdown: content };
    }
    const yamlContent = frontMatterMatch[1];
    const markdown = frontMatterMatch[2];
    const metadata = {};
    yamlContent.split('\n').forEach(line => {
      if (line.includes(':')) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        // Handle array values
        if (value.startsWith('[') && value.endsWith(']')) {
          metadata[key.trim()] = value
            .slice(1, -1)
            .split(',')
            .map(item => item.trim().replace(/^['"]|['"]$/g, ''));
        } else {
          metadata[key.trim()] = value.replace(/^['"]|['"]$/g, '');
        }
      }
    });
    return { metadata, markdown };
  }

  /**
   * Parse markdown to HTML.
   * @param {string} markdown - Markdown content
   * @returns {string} - HTML content
   */
  static markdownToHtml(markdown) {
    return marked.parse(markdown);
  }

  /**
   * Extract headings from HTML content.
   * @param {string} html - HTML content
   * @returns {Array<{ text: string, level: number, id: string }>} - Array of heading objects
   */
  static extractHeadings(html) {
    const dom = new JSDOM(html);
    const headings = Array.from(dom.window.document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    return headings.map(h => ({
      text: h.textContent,
      level: parseInt(h.tagName.substring(1)),
      id: h.id || h.textContent.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
    }));
  }

  /**
   * Parse a markdown file: extract metadata, convert to HTML, and extract headings.
   * @param {string} fileContent - Raw markdown file content
   * @returns {{ html: string, metadata: object, headings: Array }}
   */
  static parseMarkdownFile(fileContent) {
    const { metadata, markdown } = this.extractFrontMatter(fileContent);
    const html = this.markdownToHtml(markdown);
    const headings = this.extractHeadings(html);
    return { html, metadata, headings };
  }
}

module.exports = MarkdownService;
