import { Routes, UrlSegment, UrlSegmentGroup, Route, UrlMatchResult } from '@angular/router';

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
    path: '',
    redirectTo: 'getting-started/introduction',
    pathMatch: 'full'
  },
  {
    matcher: contentPathMatcher,
    loadComponent: () => import('./components/document/document.component').then(m => m.DocumentComponent)
  },
  {
    path: '**',
    redirectTo: 'getting-started/introduction'
  }
];
