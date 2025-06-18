import { Routes, UrlSegment, UrlSegmentGroup, Route, UrlMatchResult } from '@angular/router';
import { NotFound404Component } from './components/404/404.component';

// Custom URL matcher to handle paths with slashes
export function contentPathMatcher(
  segments: UrlSegment[],
  group: UrlSegmentGroup,
  route: Route
): UrlMatchResult | null {
  if (segments.length === 0) {
    return null;
  }

  // Combine all segments into a single path
  const fullPath = segments.map(s => s.path).join('/');
  
  // Return the matched segments
  return {
    consumed: segments,
    posParams: {
      path: new UrlSegment(fullPath, {})
    }
  };
}

export const DOCS_ROUTES: Routes = [
  {
    path: '404',
    component: NotFound404Component
  },
  {
    path: '',
    loadComponent: () => import('./components/document/document.component').then(m => m.DocumentComponent)
  },
  {
    matcher: contentPathMatcher,
    loadComponent: () => import('./components/document/document.component').then(m => m.DocumentComponent)
  },
  {
    path: '**',
    redirectTo: '404',
    pathMatch: 'full'
  }
];
