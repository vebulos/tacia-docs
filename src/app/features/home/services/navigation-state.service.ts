import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NavigationStateService {
  private activeCategory = new BehaviorSubject<string | null>(null);
  
  // Observable to track the active category
  activeCategory$ = this.activeCategory.asObservable();

  // Set the active category
  setActiveCategory(path: string | null): void {
    this.activeCategory.next(path);
  }

  // Check if a category is active or a parent of an active category
  isCategoryOrParentActive(path: string | null): boolean {
    const current = this.activeCategory.value;
    return !!current && (current === path || current.startsWith(path + '/'));
  }
}
