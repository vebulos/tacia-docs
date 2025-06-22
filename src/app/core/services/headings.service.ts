import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Heading {
  text: string;
  level: number;
  id: string;
}

@Injectable({
  providedIn: 'root'
})
export class HeadingsService {
  private headingsSource = new BehaviorSubject<Heading[]>([]);
  currentHeadings = this.headingsSource.asObservable();

  updateHeadings(headings: Heading[]) {
    this.headingsSource.next(headings);
  }
}
