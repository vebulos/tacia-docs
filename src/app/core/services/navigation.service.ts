import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NavItem } from '../models/nav-item.model';

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  private readonly NAVIGATION_JSON = 'assets/content/structure.json';

  constructor(private http: HttpClient) { }

  getNavigation(): Observable<NavItem[]> {
    return this.http.get<NavItem[]>(this.NAVIGATION_JSON);
  }
}
