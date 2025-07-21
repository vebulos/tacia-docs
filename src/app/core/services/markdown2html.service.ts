import { Injectable, OnDestroy } from '@angular/core';
import slugify from '@sindresorhus/slugify';
import * as yaml from 'js-yaml';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { BehaviorSubject, ReplaySubject, Observable, from, lastValueFrom } from 'rxjs';
import { filter, take, shareReplay, takeUntil, map, catchError } from 'rxjs/operators';
import { getLogger } from './logging/logger';
const LOG = getLogger('Markdown2HtmlService');

// Type declarations for external libraries
declare global {
  interface Window {
    marked: any;
    hljs: any;
  }
}

// Import marked and its types
import { marked } from 'marked';
import type { MarkedOptions } from 'marked';

// Import types for highlight.js
import * as HighlightJS from 'highlight.js';

export interface Heading {
  text: string;
  level: number;
  id: string;
}

export interface MarkdownParseResult {
  html: string | SafeHtml;  // Can be either string or SafeHtml
  metadata: Record<string, any>;
  headings: Heading[];
  rawContent: string;      // Raw markdown content
  path?: string;
  name?: string;
}

/**
 * Service for client-side Markdown to HTML conversion.
 * Replicates the logic from backend-js/services/markdown.service.js
 */
@Injectable({
  providedIn: 'root'
})
export class Markdown2HtmlService implements OnDestroy {
  private destroy$ = new ReplaySubject<boolean>(1);
  private isInitialized = false;
  private initializationSubject = new BehaviorSubject<boolean>(false);

  constructor(private sanitizer: DomSanitizer) {
    this.initializeLibraries();
  }

  ngOnDestroy(): void {
    this.destroy$.next(true);
    this.destroy$.complete();
  }

  /**
   * Initializes required libraries asynchronously
   */
  private async initializeLibraries(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Configure marked with proper typing
      const markedOptions: any = {
        gfm: true,
        breaks: false, // Disable conversion of line breaks to <br> tags
        silent: true,
        // Marked v4+ requires these options to be set this way
        langPrefix: 'hljs language-',
        highlight: (code: string, lang: string): string => {
          const hljs = (window as any).hljs;
          if (hljs) {
            if (lang && hljs.getLanguage(lang)) {
              return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
          }
          return code;
        }
      };
      
      marked.setOptions(markedOptions);

      // Load highlight.js if needed
      if (!(window as any).hljs) {
        const hljsModule = await import('highlight.js');
        (window as any).hljs = hljsModule.default || hljsModule;
      }

      this.isInitialized = true;
      this.initializationSubject.next(true);
      LOG.debug('Markdown2HtmlService initialized successfully');
    } catch (error) {
      LOG.error('Error initializing Markdown2HtmlService', error);
      this.initializationSubject.error(error);
    }
  }

  /**
   * Checks if the service is ready to be used
   */
  public isReady(): Observable<boolean> {
    return this.initializationSubject.asObservable().pipe(filter((isReady: boolean) => isReady));
  }

  /**
   * A test-only method to await initialization.
   */
  public isReadyForTest(): Promise<boolean> {
    return lastValueFrom(this.isReady().pipe(take(1)));
  }

  /**
   * Extracts YAML front matter from a Markdown document
   * @param content Raw Markdown content
   */
  private extractFrontMatter(content: string): { metadata: Record<string, any>, markdown: string } {
    const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n/);
    if (match) {
      const frontMatter = match[1];
      try {
        const metadata = yaml.load(frontMatter) as Record<string, any> || {};
        const markdown = content.substring(match[0].length);
        return { metadata, markdown };
      } catch (e) {
        LOG.error('Error parsing front matter:', e);
        // Return content as-is if front matter parsing fails
        return { metadata: {}, markdown: content };
      }
    }
    return { metadata: {}, markdown: content };
  }

  /**
   * Converts Markdown to HTML
   * @param markdown Markdown content to convert
   */
  private async markdownToHtml(markdown: string): Promise<string> {
    if (!marked) {
      throw new Error('Marked.js is not loaded');
    }
    
    try {
      // Ensure we're using the latest marked version's parse method
      const html = await marked.parse(markdown);
      return typeof html === 'string' ? html : '';
    } catch (error) {
      LOG.error('Error parsing markdown', error);
      return markdown; // Return original markdown on error
    }
  }

  private extractHeadings(html: string): Heading[] {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const headingIds = new Map<string, number>();
      const headingsArr = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((heading) => {
        const text = heading.textContent || '';
        const level = parseInt(heading.tagName.substring(1), 10);
        let slug = '';
        try {
          const preSlug = text.replace(/ß/g, 'ss');
          slug = slugify(preSlug, {
            lowercase: true,
            separator: '-',
            customReplacements: [
              ['ä', 'ae'],
              ['ö', 'oe'],
              ['ü', 'ue'],
              ['ß', 'ss']
            ]
          });
        } catch (e) {
          
        }
        let id = `h${level}-${slug}`;
        const count = (headingIds.get(id) || 0) + 1;
        headingIds.set(id, count);
        if (count > 1) id = `${id}-${count}`;
        
        return { text, level, id };
      });
      
      return headingsArr;
    } catch (err) {
      console.error('[extractHeadings] Error during heading extraction', err);
      return [];
    }
  }

  /**
   * Injects heading IDs into the HTML string for headings (h1-h6)
   * @param html HTML string
   * @param headings Array of heading objects with id, level, text
   * @returns HTML string with IDs injected
   */
  private injectHeadingIds(html: string, headings: { id: string, level: number, text: string }[]): string {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      let headingIdx = 0;
      const headingTags = ['H1','H2','H3','H4','H5','H6'];
      const allHeadings = Array.from(doc.body.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      for (let i = 0; i < allHeadings.length; i++) {
        const el = allHeadings[i];
        if (headingIdx < headings.length) {
          el.setAttribute('id', headings[headingIdx].id);
          headingIdx++;
        }
      }
      return doc.body.innerHTML;
    } catch (err) {
      console.error('[injectHeadingIds] Error injecting heading IDs', err); // Keep this one for actual error tracking
      return html;
    }
  }

  /**
   * Parses Markdown content and returns the result
   * @param fileContent Markdown content to parse
   * @param filePath File path (optional)
   */
  public parseMarkdown(markdown: string, path?: string): Observable<MarkdownParseResult> {
    // Wrap the async logic in a promise and convert it to an observable
    return from((async () => {
      try {
        await this.isReadyForTest(); // Ensure initialization is complete
        const { metadata, markdown: content } = this.extractFrontMatter(markdown);
        const html = await this.markdownToHtml(content);
        const headings = this.extractHeadings(html);
        const finalHtml = this.injectHeadingIds(html, headings);
        const safeHtml = this.sanitizer.bypassSecurityTrustHtml(finalHtml);
        return {
          html: safeHtml,
          metadata,
          headings,
          rawContent: content,
          path,
          name: path?.split('/').pop() || 'document'
        };
      } catch (error) {
        LOG.error('Error in parseMarkdown:', error);
        throw error; // Re-throw the error to be caught by the caller
      }
    })());
  }

  // Alias for backward compatibility if needed, can be removed later
  public convertMarkdown = (markdown: string, path?: string): Promise<MarkdownParseResult> => {
    return lastValueFrom(this.parseMarkdown(markdown, path));
  };

  /**
   * Sanitizes HTML content
   * @param html HTML content to sanitize
   */
  public sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
