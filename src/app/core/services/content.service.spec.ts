import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ContentService } from './content.service';

describe('ContentService', () => {
  let service: ContentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ContentService]
    });
    
    service = TestBed.inject(ContentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should load content structure', () => {
    const mockStructure = [
      {
        name: 'getting-started',
        path: '/getting-started',
        type: 'directory',
        children: [
          {
            name: 'installation',
            path: '/getting-started/installation',
            type: 'file',
            metadata: { title: 'Installation' }
          }
        ]
      }
    ];

    service.getContentStructure().subscribe(structure => {
      expect(structure.length).toBe(1);
      expect(structure[0].name).toBe('getting-started');
      expect(structure[0].children?.[0].name).toBe('installation');
    });

    const req = httpMock.expectOne('/assets/content/structure.json');
    expect(req.request.method).toBe('GET');
    req.flush(mockStructure);
  });

  it('should handle empty structure', () => {
    service.getContentStructure().subscribe(structure => {
      expect(structure).toEqual([]);
    });

    const req = httpMock.expectOne('/assets/content/structure.json');
    req.flush(null, { status: 404, statusText: 'Not Found' });
  });
});
