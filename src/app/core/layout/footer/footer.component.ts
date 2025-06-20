import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      <div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row justify-between items-center">
          <div class="text-sm text-gray-500 dark:text-gray-400">
            © {{ currentYear }} TaciaNet Foundation. All rights reserved.
          </div>
          <div class="mt-4 md:mt-0">
            <a 
              href="https://mxc.org" 
              target="_blank" 
              rel="noopener noreferrer"
              class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Visit TaciaNet Website
            </a>
          </div>
        </div>
      </div>
    </footer>
  `,
  styles: []
})
export class FooterComponent {
  get currentYear(): number {
    return new Date().getFullYear();
  }
}
