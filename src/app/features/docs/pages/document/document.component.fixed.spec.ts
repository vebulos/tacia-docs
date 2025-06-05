import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocumentComponent } from './document.component';
import { MarkdownService } from '../../../../core/services/markdown.service';
import { of, throwError } from 'rxjs';
import { By } from '@angular/platform-browser';

describe('DocumentComponent', () => {
  let component: DocumentComponent;
  let fixture: ComponentFixture<DocumentComponent>;
  let markdownService: jasmine.SpyObj<MarkdownService>;

  beforeEach(async () => {
    // Create a spy for the MarkdownService
    const markdownServiceSpy = jasmine.createSpyObj('MarkdownService', ['getMarkdownFile']);

    await TestBed.configureTestingModule({
      imports: [DocumentComponent],
      providers: [
        { provide: MarkdownService, useValue: markdownServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentComponent);
    component = fixture.componentInstance;
    markdownService = TestBed.inject(MarkdownService) as jasmine.SpyObj<MarkdownService>;
  });

  it('should create', () => {
    // Arrange
    markdownService.getMarkdownFile.and.returnValue(of({
      content: '# Test',
      metadata: { title: 'Test' },
      html: '<h1>Test</h1>',
      path: 'test',
      headings: []
    }));

    // Act
    fixture.detectChanges();

    // Assert
    expect(component).toBeTruthy();
  });


  it('should display markdown content', () => {
    // Arrange
    const testHtml = '<h1>Test Title</h1><p>Test content</p>';
    markdownService.getMarkdownFile.and.returnValue(of({
      content: '# Test Title\nTest content',
      metadata: { title: 'Test' },
      html: testHtml,
      path: 'test',
      headings: [{ text: 'Test Title', level: 1, id: 'test-title' }]
    }));

    // Act
    fixture.detectChanges();
    const contentElement = fixture.debugElement.query(By.css('.markdown-content'));

    // Assert
    expect(contentElement).toBeTruthy();
    expect(contentElement.nativeElement.innerHTML).toContain(testHtml);
  });

  it('should handle loading error', () => {
    // Arrange
    spyOn(console, 'error');
    markdownService.getMarkdownFile.and.returnValue(throwError(() => new Error('Test Error')));

    // Act
    fixture.detectChanges();

    // Assert
    expect(console.error).toHaveBeenCalled();
  });
});
