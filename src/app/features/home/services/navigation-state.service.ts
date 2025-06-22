import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NavigationStateService {
  private activeCategory = new BehaviorSubject<string | null>(null);
  
  // Observable pour suivre la catégorie active
  activeCategory$ = this.activeCategory.asObservable();

  // Définir la catégorie active
  setActiveCategory(path: string | null): void {
    this.activeCategory.next(path);
  }

  // Vérifier si une catégorie est active ou parente d'une catégorie active
  isCategoryOrParentActive(path: string | null): boolean {
    const current = this.activeCategory.value;
    return !!current && (current === path || current.startsWith(path + '/'));
  }
}
