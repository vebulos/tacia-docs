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
        breaks: true,
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
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const headingIds = new Map<string, number>();
      
      return Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(heading => {
        const text = heading.textContent || '';
        let id = this.createHeadingId(text);
        
        // Handle duplicate IDs by appending a number
        if (id) {
          const count = (headingIds.get(id) || 0) + 1;
          headingIds.set(id, count);
          
          if (count > 1) {
            id = `${id}-${count}`;
          }
        }
        
        return {
          text,
          level: parseInt(heading.tagName.substring(1), 10),
          id
        };
      });
    } catch (error) {
      LOG.error('Error extracting headings', error);
      return [];
    }
  }

  /**
   * Parses a complete Markdown document (main method)
   * @param fileContent Markdown file content
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
      const sanitizedHtml = this.sanitizer.bypassSecurityTrustHtml(html);
      const headings = this.extractHeadings(html);
      
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
