import { of, throwError } from 'rxjs';
import { ContentService } from './content.service';

describe('ContentService', () => {
  let service: ContentService;
  
  // Mock content structure
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

  beforeEach(() => {
    // Create a new instance of the service
    service = new ContentService();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should load content structure', (done) => {
    // Mock the loadContentStructure method
    spyOn(service as any, 'loadContentStructure').and.returnValue(of(mockStructure));
    
    service.getContentStructure().subscribe(structure => {
      expect(structure.length).toBe(1);
      expect(structure[0].name).toBe('getting-started');
      expect(structure[0].children?.[0].name).toBe('installation');
      done();
    });
  });

  it('should handle error when loading content structure', (done) => {
    const errorMessage = 'Failed to load content structure';
    // Mock the loadContentStructure method to return an error
    spyOn(service as any, 'loadContentStructure').and.returnValue(
      throwError(() => new Error(errorMessage))
    );
    
    service.getContentStructure().subscribe({
      next: () => fail('should have failed with an error'),
      error: (error) => {
        expect(error).toBeTruthy();
        expect(error.message).toContain(errorMessage);
        done();
      }
    });
  });
});
