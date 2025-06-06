import { of, throwError } from 'rxjs';
import { MarkdownService } from './markdown.service';

describe('MarkdownService', () => {
  let service: MarkdownService;
  
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
    // Create a new instance of the service
    service = new MarkdownService();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should parse markdown with frontmatter', (done) => {
    // Mock the loadMarkdownFile method
    spyOn(service as any, 'loadMarkdownFile').and.returnValue(of(mockMarkdownWithFrontmatter));
    
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

  it('should handle markdown without frontmatter', (done) => {
    // Mock the loadMarkdownFile method
    spyOn(service as any, 'loadMarkdownFile').and.returnValue(of(mockMarkdownWithoutFrontmatter));
    
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

  it('should handle error when loading markdown file', (done) => {
    const errorMessage = 'Failed to load markdown file';
    // Mock the loadMarkdownFile method to return an error
    spyOn(service as any, 'loadMarkdownFile').and.returnValue(
      throwError(() => new Error(errorMessage))
    );
    
    service.getMarkdownFile('invalid/path').subscribe({
      next: () => fail('should have failed with an error'),
      error: (error) => {
        expect(error).toBeTruthy();
        expect(error.message).toContain(errorMessage);
        done();
      }
    });
  });
});
