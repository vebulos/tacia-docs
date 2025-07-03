import { HeadingsService } from './headings.service';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('HeadingsService', () => {
  let service: HeadingsService;
  
  // Sample test data
  const mockHeadings = [
    { text: 'Introduction', level: 1, id: 'introduction' },
    { text: 'Getting Started', level: 2, id: 'getting-started' },
    { text: 'Installation', level: 3, id: 'installation' },
  ];

  beforeEach(() => {
    service = new HeadingsService();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with empty headings', async () => {
    // First value should be the initial empty array
    const firstValue = await firstValueFrom(service.currentHeadings);
    expect(firstValue).toEqual([]);
  });

  it('should update and emit new headings', async () => {
    // Skip the initial empty value
    const testPromise = firstValueFrom(service.currentHeadings.pipe(skip(1)));
    
    // Update the headings
    service.updateHeadings(mockHeadings);
    
    // Wait for the value
    const value = await testPromise;
    expect(value).toEqual(mockHeadings);
  });

  it('should emit only the latest values to subscribers', async () => {
    const testHeadings1 = [{ text: 'Test 1', level: 1, id: 'test1' }];
    const testHeadings2 = [{ text: 'Test 2', level: 1, id: 'test2' }];
    
    // Set up a promise that will resolve with the next value after updates
    const lastValuePromise = new Promise<typeof testHeadings2>((resolve) => {
      const subscription = service.currentHeadings.pipe(
        skip(1) // Skip the initial value
      ).subscribe({
        next: (value) => {
          // Only resolve on the second update
          if (value[0]?.id === 'test2') {
            subscription.unsubscribe();
            resolve(value);
          }
        }
      });
    });
    
    // Trigger updates
    service.updateHeadings(testHeadings1);
    service.updateHeadings(testHeadings2);
    
    // Wait for the value with a timeout to prevent hanging
    const lastValue = await Promise.race([
      lastValuePromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout waiting for value')), 1000)
      )
    ]);
    
    // Should get the latest value (testHeadings2)
    expect(lastValue).toEqual(testHeadings2);
  });

  it('should handle empty arrays', async () => {
    // Skip initial empty value
    const testPromise = firstValueFrom(service.currentHeadings.pipe(skip(1)));
    
    service.updateHeadings([]);
    
    const value = await testPromise;
    expect(value).toEqual([]);
  });
});

// Helper function to collect all values from an observable
function collectAllValues<T>(
  obs: Observable<T>,
  action: () => void
): Promise<T[]> {
  return new Promise((resolve) => {
    const values: T[] = [];
    const subscription = obs.subscribe({
      next: (value) => {
        values.push(value);
      },
      complete: () => {
        resolve(values);
      }
    });
    
    // Execute the action after subscription is set up
    action();
    
    // Complete the subscription after a short delay
    setTimeout(() => {
      subscription.unsubscribe();
      resolve(values);
    }, 100);
  });
}

// RxJS imports
import { Observable, firstValueFrom, lastValueFrom } from 'rxjs';
import { skip, take } from 'rxjs/operators';
