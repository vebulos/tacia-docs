import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MarkdownService } from './markdown.service';

describe('MarkdownService', () => {
  let service: MarkdownService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [MarkdownService]
    });
    
    service = TestBed.inject(MarkdownService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should parse markdown with frontmatter', () => {
    const markdownContent = `---
title: Test Title
categories: [test, docs]
---
# Heading 1
Some content`;

    const expectedHtml = '<h1 id="heading-1">Heading 1</h1>\n<p>Some content</p>\n';

    service.getMarkdownFile('test/path').subscribe(result => {
      expect(result.metadata.title).toBe('Test Title');
      expect(result.metadata.categories).toEqual(['test', 'docs']);
      expect(result.html.trim()).toContain(expectedHtml.trim());
      expect(result.path).toBe('test/path');
      expect(result.headings.length).toBe(1);
      expect(result.headings[0].text).toBe('Heading 1');
    });

    const req = httpMock.expectOne('/assets/content/test/path.md');
    expect(req.request.method).toBe('GET');
    req.flush(markdownContent);
  });

  it('should handle markdown without frontmatter', () => {
    const markdownContent = '# Heading 1\nSome content';

    service.getMarkdownFile('test/path').subscribe(result => {
      expect(result.metadata).toEqual({});
      expect(result.html).toContain('<h1 id="heading-1">Heading 1</h1>');
      expect(result.path).toBe('test/path');
    });

    const req = httpMock.expectOne('/assets/content/test/path.md');
    req.flush(markdownContent);
  });

  it('should handle error when loading markdown', () => {
    service.getMarkdownFile('invalid/path').subscribe({
      next: () => fail('should have failed with 404'),
      error: (error) => {
        expect(error.status).toBe(404);
      }
    });

    const req = httpMock.expectOne('/assets/content/invalid/path.md');
    req.flush('Not Found', { status: 404, statusText: 'Not Found' });
  });
});
