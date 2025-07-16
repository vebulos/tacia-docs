import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpRequest, HttpEventType, HttpResponse } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

/**
 * Generic HTTP interceptor for request/response logging and monitoring
 */
export function httpLoggingInterceptor(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> {
  const startTime = Date.now();
  const url = request.urlWithParams || request.url;
  const method = request.method;
  
  // Log outgoing request
  console.debug(`[HTTP Request] ${method} ${url}`, {
    method: request.method,
    url: request.url,
    params: request.params,
    headers: request.headers
  });
  
  return next(request).pipe(
    tap({
      next: (event: HttpEvent<unknown>) => {
        // Log successful responses
        if (event.type === HttpEventType.Response) {
          const response = event as HttpResponse<unknown>;
          const elapsed = Date.now() - startTime;
          
          console.debug(`[HTTP Response] ${method} ${url} (${response.status} ${response.statusText})`, {
            status: response.status,
            statusText: response.statusText,
            time: `${elapsed}ms`,
            url: response.url
          });
        }
      },
      error: (error: HttpErrorResponse) => {
        const elapsed = Date.now() - startTime;
        
        // Log error responses
        console.error(`[HTTP Error] ${method} ${url} (${error.status || 'No status'})`, {
          error,
          status: error.status,
          statusText: error.statusText,
          time: `${elapsed}ms`,
          url: error.url || request.url
        });
        
        // You can add additional error handling here if needed
        // For example, you could implement retry logic for certain status codes
        // or show notifications for server errors
      }
    })
  );
}
