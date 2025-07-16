import { TestBed } from '@angular/core/testing';
import { RelatedDocumentsService } from './related-documents.service';
import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { of, throwError, firstValueFrom } from 'rxjs';

// Mock console.error
const originalConsoleError = console.error;
console.error = vi.fn();

describe('RelatedDocumentsService', () => {
  let service: RelatedDocumentsService;
  let mockHttpClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHttpClient = {
      get: vi.fn()
    };
    TestBed.configureTestingModule({
      providers: [
        RelatedDocumentsService,
        { provide: 'HttpClient', useValue: mockHttpClient }
      ]
    });
    // Manually inject because of string token usage
    service = new RelatedDocumentsService(mockHttpClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return empty related if no documentPath is given', async () => {
    const result = await firstValueFrom(service.getRelatedDocuments('', 3));
    expect(result).toEqual({ related: [] });
  });

  it('should add .md extension if missing', async () => {
    mockHttpClient.get.mockReturnValueOnce(of({ related: [{ path: 'foo.md', title: 't', commonTags: [], commonTagsCount: 0 }] }));
    const result = await firstValueFrom(service.getRelatedDocuments('foo', 1));
    expect(result.related[0].path).toBe('foo.md');
    expect(mockHttpClient.get).toHaveBeenCalled();
    const callArgs = mockHttpClient.get.mock.calls[0][1].params;
    expect(callArgs.path.endsWith('.md')).toBe(true);
  });

  it('should remove leading slash and add .md', async () => {
    mockHttpClient.get.mockReturnValueOnce(of({ related: [{ path: 'bar.md', title: 't', commonTags: [], commonTagsCount: 0 }] }));
    const result = await firstValueFrom(service.getRelatedDocuments('/bar', 2));
    expect(result.related[0].path).toBe('bar.md');
    const callArgs = mockHttpClient.get.mock.calls[0][1].params;
    expect(callArgs.path).toBe('bar.md');
    expect(callArgs.limit).toBe('2');
  });

  it('should pass limit as string param', async () => {
    mockHttpClient.get.mockReturnValueOnce(of({ related: [] }));
    await firstValueFrom(service.getRelatedDocuments('baz.md', 7));
    const callArgs = mockHttpClient.get.mock.calls[0][1].params;
    expect(callArgs.limit).toBe('7');
  });

  it('should return related documents from API', async () => {
    mockHttpClient.get.mockReturnValueOnce(of({ related: [{ path: 'a.md', title: 'A', commonTags: ['x'], commonTagsCount: 1 }] }));
    const result = await firstValueFrom(service.getRelatedDocuments('a.md'));
    expect(result.related.length).toBe(1);
    expect(result.related[0].title).toBe('A');
  });

  it('should return empty array if API errors', async () => {
    mockHttpClient.get.mockReturnValueOnce(throwError(() => new Error('fail')));
    const result = await firstValueFrom(service.getRelatedDocuments('fail.md'));
    expect(result).toEqual({ related: [] });
  });
});

