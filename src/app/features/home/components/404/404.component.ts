import { Component, OnInit } from '@angular/core';
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
  errorMessage: string | null = null;
  originalUrl: string | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Get error message and original URL from navigation state
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state) {
      this.errorMessage = navigation.extras.state['error'] || null;
      this.originalUrl = navigation.extras.state['originalUrl'] || null;
    }
  }
}
