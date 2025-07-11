import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-not-found-404',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './404.component.html',
  styleUrls: ['./404.component.css']
})
export class NotFound404Component implements OnInit {
  @Input() errorMessage: string | null = null;
  @Input() originalUrl: string | null = null;
  @Output() action = new EventEmitter<'home'>();

  constructor() {}

  ngOnInit(): void {
    // if the inputs are not provided, try to get them from the navigation state
    if ((!this.errorMessage || !this.originalUrl) && typeof window !== 'undefined') {
      const navigation = window.history.state;
      if (navigation) {
        this.errorMessage = this.errorMessage || navigation.error || 'The requested page does not exist or has been moved.';
        this.originalUrl = this.originalUrl || navigation.originalUrl || null;
      }
    }
  }

  onGoHome(): void {
    this.action.emit('home');
  }
}
