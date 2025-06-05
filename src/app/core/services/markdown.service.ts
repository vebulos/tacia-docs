import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';
import { marked } from 'marked';
import hljs from 'highlight.js';

// Extend the marked types to include our custom options
declare module 'marked' {
  namespace marked {
    interface MarkedOptions {
      highlight?: (code: string, language: string) => string;
      langPrefix?: string;
      gfm?: boolean;
      breaks?: boolean;
      silent?: boolean;
    }
  }
}

export interface MarkdownFile {
  content: string;
  metadata: {
    title?: string;
    categories?: string[];
    tags?: string[];
    [key: string]: any;
  };
  html: string;
  path: string;
  headings: { text: string; level: number; id: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class MarkdownService {
  private basePath = '/assets/content';
  private cache = new Map<string, Observable<MarkdownFile>>();

  constructor(private http: HttpClient) {
    // Configure marked with highlight.js
    const markedOptions: marked.MarkedOptions = {
      highlight: (code: string, lang: string) => {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        try {
          return hljs.highlight(code, { language }).value;
        } catch (err) {
          return code; // Return as-is if highlighting fails
        }
      },
      langPrefix: 'hljs language-',
      gfm: true,
      breaks: true,
      silent: true // Don't throw on errors
    };
    
    marked.setOptions(markedOptions);
  }

  getMarkdownFile(path: string): Observable<MarkdownFile> {
    const fullPath = `${this.basePath}${path}.md`;
    
    // Return cached observable if available
    if (this.cache.has(fullPath)) {
      return this.cache.get(fullPath)!;
    }

    const request = this.http.get(fullPath, { responseType: 'text' }).pipe(
      map(markdown => this.parseMarkdown(markdown, path)),
      shareReplay(1), // Cache the result
      catchError(error => {
        console.error(`Error loading markdown file: ${path}`, error);
        return of({
          content: `# Error loading content\n\nUnable to load the requested document.`,
          metadata: { title: 'Error' },
          html: '<h1>Error loading content</h1><p>Unable to load the requested document.</p>',
          path,
          headings: []
        });
      })
    );

    this.cache.set(fullPath, request);
    return request;
  }

  private parseMarkdown(markdown: string, path: string): MarkdownFile {
    // Parse frontmatter
    const frontMatterRegex = /^---\n([\s\S]*?)\n---\n/;
    const match = markdown.match(frontMatterRegex);
    let content = markdown;
    const metadata: Record<string, any> = {};
    const headings: { text: string; level: number; id: string }[] = [];

    if (match) {
      content = markdown.slice(match[0].length);
      const frontMatter = match[1];
      
      // Parse YAML frontmatter
      frontMatter.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim();
          let value: any = line.slice(colonIndex + 1).trim();
          
          // Parse arrays like [item1, item2]
          if (value.startsWith('[') && value.endsWith(']')) {
            value = value.slice(1, -1).split(',').map((item: string) => item.trim());
          }
          
          metadata[key] = value;
        }
      });
    }

    // Parse markdown to HTML
    const html = marked.parse(content, { async: false }) as string;

    // Extract headings from the content
    const headingRegex = /<h([1-6])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h[1-6]>/g;
    let headingMatch: RegExpExecArray | null;
    while ((headingMatch = headingRegex.exec(html)) !== null) {
      const level = parseInt(headingMatch[1], 10);
      const id = headingMatch[2];
      const text = headingMatch[3].replace(/<[^>]*>/g, ''); // Remove any HTML tags from the heading text
      headings.push({ text, level, id });
    }

    return {
      content,
      metadata,
      html,
      path,
      headings
    };
  }
}
