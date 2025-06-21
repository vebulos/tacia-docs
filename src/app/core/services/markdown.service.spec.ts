import { of, throwError, lastValueFrom } from 'rxjs';
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
    
    let error: any;
    try {
      await lastValueFrom(service.getMarkdownFile('invalid/path'));
      throw new Error('Expected an error to be thrown');
    } catch (e) {
      error = e;
    }
    
    expect(error).toBeTruthy();
    expect(error.message).toBe(expectedErrorMessage);
  });

  it('should clear cache for a specific path', async () => {
    // Test du nettoyage du cache pour un chemin spécifique
    const path = 'test/path';
    const mockResponse = {
      html: '<h1>Test</h1>',
      metadata: {},
      headings: [],
      path: path,
      name: 'test'
    };

    // Vérifier directement si la méthode clearCache supprime l'élément du cache
    const serviceAny = service as any;
    const cacheKey = serviceAny.normalizePath(path);
    
    // Réinitialiser le cache d'abord
    serviceAny.cache.clear();
    
    // Ajouter l'élément dans le cache
    const mockObservable = of(mockResponse);
    serviceAny.cache.set(cacheKey, mockObservable);
    
    // Vérifier que l'élément est dans le cache avant suppression
    expect(serviceAny.cache.has(cacheKey)).toBe(true);
    
    // Supprimer du cache
    await lastValueFrom(service.clearCache(path));
    
    // Vérifier que l'élément a été supprimé du cache
    expect(serviceAny.cache.has(cacheKey)).toBe(false);
  });

  it('should ensure HTTP request after cache clear', async () => {
    // Ce test vérifie spécifiquement le comportement HTTP après le vidage du cache
    const path = 'test/path';
    const mockResponse = {
      html: '<h1>Test</h1>',
      metadata: {},
      headings: [],
      path: path,
      name: 'test'
    };
    
    // Réinitialiser complètement tous les mocks avant de commencer
    vi.resetAllMocks();
    // Réinitialiser complètement le cache du service
    const serviceAny = service as any;
    serviceAny.cache.clear();
    serviceAny.cacheHits = 0;
    serviceAny.cacheMisses = 0;
    
    // Configurer le mock HTTP pour qu'il retourne toujours une nouvelle copie 
    // de la réponse à chaque appel - important pour le test de cache
    httpGetSpy.mockImplementation(() => {
      return of({...mockResponse});
    });
    
    // Premier appel - devrait faire un appel HTTP
    await lastValueFrom(service.getMarkdownFile(path, false));
    expect(httpGetSpy).toHaveBeenCalledTimes(1);
    httpGetSpy.mockClear();
    
    // Deuxième appel - devrait venir du cache
    await lastValueFrom(service.getMarkdownFile(path, false));
    expect(httpGetSpy).toHaveBeenCalledTimes(0);
    
    // Vérifier que la deuxième requête n'a pas déclenché d'appel HTTP, donc provient du cache
    const cacheKey = serviceAny.normalizePath(path);
    // Optionnel : on peut vérifier que le cache contient bien une entrée, mais certains environnements
    // peuvent la purger rapidement selon le TTL. Nous nous contentons donc de vérifier l'absence
    // d'appel HTTP supplémentaire comme preuve d'un cache hit.
    
    // Vider le cache
    await lastValueFrom(service.clearCache(path));
    
    // Après vidage, le cache ne doit plus contenir l'entrée
    // (si jamais l'environnement de test possède encore la clé)
    expect(serviceAny.cache.has(cacheKey)).toBe(false);
    
    // Troisième appel - doit maintenant faire un nouvel appel HTTP
    await lastValueFrom(service.getMarkdownFile(path, false));
    expect(httpGetSpy).toHaveBeenCalledTimes(1);
  });

  it('should clear entire cache', async () => {
    const path1 = 'test/path1';
    const path2 = 'test/path2';
    const mockResponse = {
      html: '<h1>Test</h1>',
      metadata: {},
      headings: [],
      path: 'test/path',
      name: 'test'
    };
    
    httpGetSpy.mockReturnValue(of(mockResponse));

    // Cache first path
    await lastValueFrom(service.getMarkdownFile(path1));
    
    // Clear entire cache
    await lastValueFrom(service.clearCache());
    
    // This should make a new HTTP request
    await lastValueFrom(service.getMarkdownFile(path1));
    
    expect(httpGetSpy).toHaveBeenCalledTimes(2);
  });

  it('should normalize paths correctly', () => {
    const serviceAny = service as any; // Access private method for testing
    
    expect(serviceAny.normalizePath('/test/path/')).toBe('test/path');
    expect(serviceAny.normalizePath('test/path.md')).toBe('test/path');
    expect(serviceAny.normalizePath('/test/path.md')).toBe('test/path');
    expect(serviceAny.normalizePath('test//path')).toBe('test//path');
  });

  it('should use getCachedOrLoad to get markdown', async () => {
    const path = 'test/path';
    const mockResponse = {
      html: '<h1>Test</h1>',
      metadata: {},
      headings: [],
      path: path,
      name: 'test'
    };
    
    httpGetSpy.mockReturnValue(of(mockResponse));
    
    const result = await lastValueFrom(service.getCachedOrLoad(path));
    expect(result).toEqual(mockResponse);
    
    // Vérifie que l'URL contient le bon chemin, en gérant l'encodage
    const calledUrl = httpGetSpy.mock.calls[0][0];
    expect(decodeURIComponent(calledUrl)).toContain('test/path.md');
    
    // Vérifier juste que l'URL contient le chemin et que les headers sont corrects
    expect(httpGetSpy).toHaveBeenCalledWith(
      expect.stringContaining('test%2Fpath.md'),
      { headers: { 'Cache-Control': 'no-cache' } }
    );
  });

  it('should preload markdown', async () => {
    const path = 'test/path';
    const mockResponse = {
      html: '<h1>Test</h1>',
      metadata: {},
      headings: [],
      path: path,
      name: 'test'
    };

    httpGetSpy.mockReturnValue(of(mockResponse));

    await lastValueFrom(service.preloadMarkdown(path));
    
    // The markdown should now be in the cache
    const result = await lastValueFrom(service.getMarkdownFile(path));
    expect(result).toEqual(mockResponse);
    expect(httpGetSpy).toHaveBeenCalledTimes(1); // Should only make one HTTP call
  });

  it('should get cache statistics', async () => {
    const path = 'test/path';
    const mockResponse = {
      html: '<h1>Test</h1>',
      metadata: {},
      headings: [],
      path: path,
      name: 'test'
    };
    
    httpGetSpy.mockReturnValue(of(mockResponse));
    
    // First request - should be a miss
    await lastValueFrom(service.getMarkdownFile(path));
    
    // Second request - should be a hit
    await lastValueFrom(service.getMarkdownFile(path));
    
    const stats = service.getCacheStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe('50.00%');
  });

  it('should clean up on destroy', () => {
    // Crée un espion sur cache.clear avant d'appeler ngOnDestroy
    const cacheClearSpy = vi.spyOn((service as any).cache, 'clear');
    
    // Crée un espion sur destroy$
    const nextSpy = vi.spyOn((service as any).destroy$, 'next');
    const completeSpy = vi.spyOn((service as any).destroy$, 'complete');
    
    // Call ngOnDestroy
    service.ngOnDestroy();
    
    // Vérifie que cache.clear a été appelé
    expect(cacheClearSpy).toHaveBeenCalled();
    
    // Vérifie que next() et complete() ont été appelés sur destroy$
    expect(nextSpy).toHaveBeenCalled();
    expect(completeSpy).toHaveBeenCalled();
    
    // Vérifie que le sujet destroy$ a été complété en vérifiant que complete a été appelé
    // Dans RxJS, after complete is called we cannot emit more values, but calling next() might not throw
    expect(completeSpy).toHaveBeenCalled();
    
    // Restaure les implémentations originales
    cacheClearSpy.mockRestore();
    nextSpy.mockRestore();
    completeSpy.mockRestore();
  });

  it('should handle cleanup of old cache entries', () => {
    const serviceAny = service as any;
    
    // Mock the cache to be at max size
    serviceAny.cache = {
      size: serviceAny.maxCacheSize + 1,
      clear: vi.fn()
    };
    
    // Call the cleanup method
    serviceAny.cleanupOldCacheEntries();
    
    // Check that clear was called
    expect(serviceAny.cache.clear).toHaveBeenCalled();
  });
});
