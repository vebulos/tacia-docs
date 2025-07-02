import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

export interface NavigationState {
  activePath: string | null;
  expandedPaths: Set<string>;
  loadingPaths: Set<string>;
  errorPaths: Map<string, Error>;
}

@Injectable({
  providedIn: 'root'
})
export class NavigationStateService {
  private initialState: NavigationState = {
    activePath: null,
    expandedPaths: new Set<string>(),
    loadingPaths: new Set<string>(),
    errorPaths: new Map<string, Error>()
  };

  private state = new BehaviorSubject<NavigationState>(this.initialState);
  state$ = this.state.asObservable();

  // Selectors for state observables
  activePath$ = this.state.pipe(
    map(state => state.activePath),
    distinctUntilChanged()
  );

  expandedPaths$ = this.state.pipe(
    map(state => state.expandedPaths),
    distinctUntilChanged()
  );

  loadingPaths$ = this.state.pipe(
    map(state => state.loadingPaths),
    distinctUntilChanged()
  );

  errorPaths$ = this.state.pipe(
    map(state => state.errorPaths),
    distinctUntilChanged()
  );

  // State mutation methods
  setActivePath(path: string | null): void {
    this.updateState({ activePath: path });
  }

  addExpandedPath(path: string): void {
    const expandedPaths = new Set(this.state.value.expandedPaths);
    expandedPaths.add(path);
    this.updateState({ expandedPaths });
  }

  removeExpandedPath(path: string): void {
    const expandedPaths = new Set(this.state.value.expandedPaths);
    expandedPaths.delete(path);
    this.updateState({ expandedPaths });
  }

  setLoading(path: string, isLoading: boolean): void {
    const loadingPaths = new Set(this.state.value.loadingPaths);
    if (isLoading) {
      loadingPaths.add(path);
    } else {
      loadingPaths.delete(path);
    }
    this.updateState({ loadingPaths });
  }

  setError(path: string, error: Error | null): void {
    const errorPaths = new Map(this.state.value.errorPaths);
    if (error) {
      errorPaths.set(path, error);
    } else {
      errorPaths.delete(path);
    }
    this.updateState({ errorPaths });
  }

  /** Check if a path is currently expanded */
  isExpanded(path: string): boolean {
    return this.state.value.expandedPaths.has(path);
  }

  /** Check if a path is currently loading */
  isLoading(path: string): boolean {
    return this.state.value.loadingPaths.has(path);
  }

  /** Get error for a specific path, if any */
  getError(path: string): Error | undefined {
    return this.state.value.errorPaths.get(path);
  }

  /** Internal method to update the state */
  private updateState(partialState: Partial<NavigationState>): void {
    this.state.next({
      ...this.state.value,
      ...partialState
    });
  }
}
