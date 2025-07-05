import { Injectable, OnDestroy } from '@angular/core';
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

// Import types for marked and highlight.js
import * as Marked from 'marked';
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
      // Dynamically load marked
      const markedModule = await import('marked');
      window.marked = markedModule.marked;
      
      // Configure marked
      window.marked.setOptions({
        highlight: (code: string, lang: string) => {
          if (lang && window.hljs?.getLanguage(lang)) {
            return window.hljs.highlight(code, { language: lang }).value;
          }
          return window.hljs ? window.hljs.highlightAuto(code).value : code;
        },
        langPrefix: 'hljs language-',
        gfm: true,
        breaks: true,
        silent: true
      });

      // Load highlight.js if needed
      if (!window.hljs) {
        const hljsModule = await import('highlight.js');
        window.hljs = hljsModule.default || hljsModule;
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
  private markdownToHtml(markdown: string): string {
    if (!window.marked) {
      throw new Error('Marked.js is not loaded');
    }
    return window.marked.parse(markdown);
  }

  /**
   * Creates a URL-friendly ID from text
   * @param text Text to convert to ID
   */
  private createId(text: string): string {
    if (!text || typeof text !== 'string') return '';
    
    // Special characters mapping
    const umlautMap: Record<string, string> = {
      'ä': 'a', 'ö': 'o', 'ü': 'u', 'ß': 'ss',
      'Ä': 'A', 'Ö': 'O', 'Ü': 'U',
      'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'å': 'a',
      'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
      'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
      'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ø': 'o',
      'ù': 'u', 'ú': 'u', 'û': 'u',
      'ý': 'y', 'ÿ': 'y',
      'ñ': 'n', 'ç': 'c', 'æ': 'ae', 'œ': 'oe'
    };
    
    // Create regex pattern for all special characters
    const umlautRegex = new RegExp(`[${Object.keys(umlautMap).join('')}]`, 'g');
    
    // Process text to create ID
    let id = text
      // Remplacement des caractères spéciaux
      .replace(umlautRegex, match => umlautMap[match] || match)
      // Convert to lowercase
      .toLowerCase()
      // Replace special characters with hyphens
      .replace(/[^\w\s-]/g, '-')
      // Replace spaces with hyphens
      .replace(/\s+/g, '-')
      // Replace multiple hyphens with single hyphen
      .replace(/-+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Truncate to 50 characters
      .substring(0, 50)
      // Remove trailing hyphen if exists
      .replace(/-+$/, '');
    
    // If ID is empty, use default value
    if (!id) {
      id = 'section';
    }
    
    return id;
  }

  /**
   * Extracts headings from HTML content
   * @param html The HTML content to extract headings from
   * @returns Array of heading objects with text, level, and id
   */
  /**
   * Creates a URL-friendly ID from a heading text
   * @param text The heading text
   * @returns A URL-friendly ID
   */
  private createHeadingId(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')  // Remove special characters
      .replace(/\s+/g, '-')       // Replace spaces with hyphens
      .replace(/-+/g, '-')        // Replace multiple hyphens with one
      .replace(/^-+|-+$/g, '')    // Remove leading/trailing hyphens
      .substring(0, 50)           // Truncate to 50 chars
      .replace(/-+$/, '');        // Remove any trailing hyphen
  }

  /**
   * Extracts headings from HTML content
   * @param html The HTML content to extract headings from
   * @returns Array of heading objects with text, level, and id
   */
  private extractHeadings(html: string): Heading[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    const headingIds = new Map<string, number>();
    
    return headings.map((heading) => {
      const text = heading.textContent || '';
      let id = heading.id || this.createHeadingId(text);
      
      // Handle duplicate IDs by appending a number
      if (id) {
        const count = (headingIds.get(id) || 0) + 1;
        headingIds.set(id, count);
        
        if (count > 1) {
          id = `${id}-${count}`;
        }
        
        // Update ID in virtual DOM
        heading.id = id;
      }
      
      return {
        text,
        level: parseInt(heading.tagName.substring(1), 10),
        id
      };
    });
  }

  /**
   * Parses a complete Markdown document (main method)
   * @param fileContent Markdown file content
   * @param filePath File path (optional)
   */
  public parseMarkdown(fileContent: string, filePath?: string): Observable<MarkdownParseResult> {
    return new Observable<MarkdownParseResult>(subscriber => {
      if (!this.isInitialized) {
        this.isReady().subscribe({
          next: () => this.processMarkdown(fileContent, filePath).subscribe(subscriber),
          error: (err) => subscriber.error(err)
        });
      } else {
        this.processMarkdown(fileContent, filePath).subscribe(subscriber);
      }
    }).pipe(
      takeUntil(this.destroy$),
      shareReplay(1)
    );
  }

  private processMarkdown(fileContent: string, filePath?: string): Observable<MarkdownParseResult> {
    try {
      const { metadata, markdown: content } = this.extractFrontMatter(fileContent);
      
      // Parse markdown to HTML
      const html = this.markdownToHtml(content);
      
      // Sanitize HTML for security
      const sanitizedHtml = this.sanitizer.bypassSecurityTrustHtml(html);
      
      // Extract headings from the HTML
      const headings = this.extractHeadings(html);
      
      // Prepare the result
      const result: MarkdownParseResult = {
        html: sanitizedHtml,
        metadata,
        headings,
        rawContent: content,
        path: filePath,
        name: filePath ? filePath.split('/').pop() : ''
      };
      
      return of(result);
    } catch (error) {
      LOG.error('Error processing markdown', error);
      return of({
        html: `<pre>${fileContent}</pre>`,
        metadata: {},
        headings: [],
        rawContent: fileContent,
        path: filePath,
        name: filePath ? filePath.split('/').pop() : ''
      });
    }
  }

  /**
   * Sanitizes and secures generated HTML
   */
  public sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
