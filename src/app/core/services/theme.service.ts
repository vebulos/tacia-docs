import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

type Theme = 'default' | 'leger';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private currentThemeSubject: BehaviorSubject<Theme>;
  public currentTheme$: Observable<Theme>;
  private themeLink: HTMLLinkElement | null = null;

  constructor() {
    // Load saved theme or default to 'default'
    const savedTheme = (localStorage.getItem('markdown-theme') as Theme) || 'default';
    this.currentThemeSubject = new BehaviorSubject<Theme>(savedTheme);
    this.currentTheme$ = this.currentThemeSubject.asObservable();
    
    // Apply the theme immediately
    this.loadTheme(savedTheme, true);
    

  }

  public get currentThemeValue(): Theme {
    return this.currentThemeSubject.value;
  }

  public loadTheme(theme: Theme, initialLoad: boolean = false): Promise<void> {
    return new Promise((resolve, reject) => {
    if (theme === this.currentThemeValue && !initialLoad) {
      resolve();
      return;
    }

    // Remove existing theme link if it exists
    if (this.themeLink && this.themeLink.parentNode) {
      document.head.removeChild(this.themeLink);
      this.themeLink = null;
    }

    // Always load the theme stylesheet, including for default theme
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = `assets/themes/${theme}.css`;
    
    link.onload = () => {
      this.themeLink = link;
      this.currentThemeSubject.next(theme);
      localStorage.setItem('markdown-theme', theme);
      resolve();
    };
    
    link.onerror = () => {
      console.error(`Failed to load theme: ${theme}`);
      // Do not update theme on failure, the old theme remains active.
      reject(new Error(`Failed to load theme: ${theme}`));
    };
    
    document.head.appendChild(link);
    });
  }

  public toggleTheme(): Promise<void> {
    const newTheme = this.currentThemeValue === 'default' ? 'leger' : 'default';
    return this.loadTheme(newTheme);
  }
}
