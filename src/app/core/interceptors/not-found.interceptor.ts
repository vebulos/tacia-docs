import { 
  HttpRequest, 
  HttpHandlerFn, 
  HttpInterceptorFn, 
  HttpErrorResponse 
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

/**
 * Interceptor function that handles 404 errors for document content requests
 * and redirects to the 404 page
 */
export const notFoundInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<any> => {
  const router = inject(Router);
  
  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      // Only handle 404 errors
      if (error.status === 404) {
        console.warn(`[NotFoundInterceptor] 404 error detected for URL: ${request.url}`);
        
        // Check if this is a document content request
        if (request.url.includes('/api/content/') && !request.url.includes('search')) {
          console.warn('[NotFoundInterceptor] Document not found, redirecting to 404 page');
          
          // Navigate to the 404 page
          // We use setTimeout to avoid "Navigation triggered outside Angular zone" warnings
          setTimeout(() => {
            router.navigate(['/docs/404']);
          });
        }
      }
      
      // Always propagate the error so the original error handling can still occur
      return throwError(() => error);
    })
  );
};
