import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-not-found-404',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './404.component.html',
  styleUrls: ['./404.component.css']
})
export class NotFound404Component {
  constructor() { }
}
