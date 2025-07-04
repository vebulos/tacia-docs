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
    
    // Listen for changes to apply them immediately
    this.currentTheme$.subscribe(theme => {
      if (theme !== this.currentThemeValue) {
        this.loadTheme(theme, false);
      }
    });
  }

  public get currentThemeValue(): Theme {
    return this.currentThemeSubject.value;
  }

  public loadTheme(theme: Theme, initialLoad: boolean = false): void {
    if (theme === this.currentThemeValue && !initialLoad) return;

    // Remove existing theme link if it exists
    if (this.themeLink && this.themeLink.parentNode) {
      document.head.removeChild(this.themeLink);
      this.themeLink = null;
    }

    // Only load the theme if it's not the default theme
    if (theme !== 'default') {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = `assets/themes/${theme}.css`;
      link.onload = () => {
        this.themeLink = link;
        if (!initialLoad) {
          this.currentThemeSubject.next(theme);
        }
        localStorage.setItem('markdown-theme', theme);
      };
      document.head.appendChild(link);
    } else {
      if (!initialLoad) {
        this.currentThemeSubject.next(theme);
      }
      localStorage.setItem('markdown-theme', theme);
    }
  }

  public toggleTheme(): void {
    const newTheme = this.currentThemeValue === 'default' ? 'leger' : 'default';
    this.loadTheme(newTheme);
  }
}
