import { Injectable, OnDestroy } from '@angular/core';
import slugify from 'slugify';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { BehaviorSubject, Observable, of, from, ReplaySubject } from 'rxjs';
import { map, catchError, takeUntil, shareReplay } from 'rxjs/operators';
import { LOG } from './logging/bun-logger.service';

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
    return this.initializationSubject.asObservable().pipe(
      takeUntil(this.destroy$),
      shareReplay(1)
    );
  }

  /**
   * Extracts YAML front matter from a Markdown document
   * @param content Raw Markdown content
   */
  private extractFrontMatter(content: string): { metadata: Record<string, any>, markdown: string } {
    const frontMatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    
    if (!frontMatterMatch) {
      return { metadata: {}, markdown: content };
    }

    const yamlContent = frontMatterMatch[1];
    const markdown = frontMatterMatch[2];
    const metadata: Record<string, any> = {};

    yamlContent.split('\n').forEach(line => {
      if (line.includes(':')) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        
        // Handle arrays
        if (value.startsWith('[') && value.endsWith(']')) {
          metadata[key.trim()] = value
            .slice(1, -1)
            .split(',')
            .map((item: string) => item.trim().replace(/^['"]|['"]$/g, ''));
        } else {
          metadata[key.trim()] = value.replace(/^['"]|['"]$/g, '');
        }
      }
    });

    return { metadata, markdown };
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
          slug = slugify(preSlug, { lower: true, strict: true, locale: 'de' });
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
  public parseMarkdown(fileContent: string, filePath?: string): Observable<MarkdownParseResult> {
    return new Observable<MarkdownParseResult>(subscriber => {
      const process = async () => {
        try {
          const result = await this.processMarkdown(fileContent, filePath);
          subscriber.next(result);
          subscriber.complete();
        } catch (error) {
          subscriber.error(error);
        }
      };

      if (!this.isInitialized) {
        this.isReady().subscribe({
          next: () => process(),
          error: (err) => subscriber.error(err)
        });
      } else {
        process();
      }
    }).pipe(
      takeUntil(this.destroy$),
      shareReplay(1)
    );
  }

  private async processMarkdown(fileContent: string, filePath?: string): Promise<MarkdownParseResult> {
    try {
      const { metadata, markdown: content } = this.extractFrontMatter(fileContent);
      const html = await this.markdownToHtml(content);
      const headings = this.extractHeadings(html);
      const htmlWithIds = this.injectHeadingIds(html, headings);
      const sanitizedHtml = this.sanitizer.bypassSecurityTrustHtml(htmlWithIds);
      
      return {
        html: sanitizedHtml,
        metadata,
        headings,
        rawContent: content,
        path: filePath,
        name: filePath ? filePath.split('/').pop() || '' : ''
      };
    } catch (error) {
      LOG.error('Error processing markdown', error);
      return {
        html: this.sanitizer.bypassSecurityTrustHtml(`<pre>${fileContent}</pre>`),
        metadata: {},
        headings: [],
        rawContent: fileContent,
        path: filePath,
        name: filePath ? filePath.split('/').pop() || '' : ''
      };
    }
  }

  /**
   * Sanitizes HTML content
   * @param html HTML content to sanitize
   */
  public sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
