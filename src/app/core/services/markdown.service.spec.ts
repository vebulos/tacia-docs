import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, MockInstance } from 'vitest';
import { HttpClient } from '@angular/common/http';
import { MarkdownService } from './markdown.service';

describe('MarkdownService', () => {
  let service: MarkdownService;
  let httpClientMock: HttpClient;
  let httpGetSpy: any; // Using any to simplify the type for the test
  
  // Mock markdown content with frontmatter
  const mockMarkdownWithFrontmatter = `---
title: Test Title
categories: [test, docs]
---
# Heading 1
Some content`;

  // Mock markdown content without frontmatter
  const mockMarkdownWithoutFrontmatter = '# Heading 1\nSome content';

  beforeEach(() => {
    // Create a mock HttpClient with a get method
    httpClientMock = {
      get: vi.fn()
    } as any;
    
    // Create a new instance of the service with the mocked HttpClient
    service = new MarkdownService(httpClientMock);
    
    // Set up the spy for the get method
    httpGetSpy = vi.spyOn(httpClientMock, 'get');
    
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should parse markdown with frontmatter', async () => {
    // Mock the HTTP response
    const mockResponse = {
      html: '<h1 id="heading-1">Heading 1</h1>\n<p>Some content</p>',
      metadata: {
        title: 'Test Title',
        categories: ['test', 'docs']
      },
      headings: [{ text: 'Heading 1', level: 1, id: 'heading-1' }],
      path: 'test/path',
      name: 'test'
    };
    
    // Setup the mock to return our response
    httpGetSpy.mockReturnValue(of(mockResponse));
    
    return new Promise<void>((done) => {
      service.getMarkdownFile('test/path').subscribe(result => {
        expect(result.metadata.title).toBe('Test Title');
        expect(result.metadata.categories).toEqual(['test', 'docs']);
        expect(result.html).toContain('<h1 id="heading-1">');
        expect(result.html).toContain('Some content');
        expect(result.path).toBe('test/path');
        expect(result.headings.length).toBe(1);
        expect(result.headings[0].text).toBe('Heading 1');
        done();
      });
    });
  });

  it('should handle markdown without frontmatter', async () => {
    // Mock the HTTP response without frontmatter
    const mockResponse = {
      html: '<h1 id="heading-1">Heading 1</h1>\n<p>Some content</p>',
      metadata: {},
      headings: [{ text: 'Heading 1', level: 1, id: 'heading-1' }],
      path: 'test/path',
      name: 'test'
    };
    
    // Setup the mock to return our response
    httpGetSpy.mockReturnValue(of(mockResponse));
    
    return new Promise<void>((done) => {
      service.getMarkdownFile('test/path').subscribe(result => {
        // Check for required metadata properties
        expect(result.metadata).toBeDefined();
        expect(result.metadata.title).toBeUndefined(); // No title in markdown without frontmatter
        
        expect(result.html).toContain('<h1 id="heading-1">');
        expect(result.html).toContain('Some content');
        expect(result.path).toBe('test/path');
        expect(result.headings.length).toBe(1);
        expect(result.headings[0].text).toBe('Heading 1');
        done();
      });
    });
  });

  it('should handle error when loading markdown file', async () => {
    const statusCode = 404;
    const statusText = 'Not Found';
    const expectedErrorMessage = `Failed to load markdown: ${statusCode} ${statusText}`;
    
    // Setup the mock to return an error
    httpGetSpy.mockReturnValue(throwError(() => ({
      status: statusCode,
      statusText: statusText,
      error: 'File not found'
    })));
    
    return new Promise<void>((done) => {
      service.getMarkdownFile('invalid/path').subscribe({
        next: () => {
          throw new Error('should have failed with an error');
        },
        error: (error) => {
          expect(error).toBeTruthy();
          expect(error.message).toBe(expectedErrorMessage);
          done();
        }
      });
    });
  });
});
