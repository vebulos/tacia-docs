import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ContentItem } from '../../../../core/services/content.service';
import { animate, state, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-navigation-item',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navigation-item.component.html',
  styleUrls: ['./navigation-item.component.css'],
  animations: [
    trigger('slideInOut', [
      state('expanded', style({
        height: '*',
        opacity: 1,
        visibility: 'visible'
      })),
      state('collapsed', style({
        height: '0',
        opacity: 0,
        visibility: 'hidden',
        overflow: 'hidden'
      })),
      transition('expanded <=> collapsed', [
        animate('200ms ease-in-out')
      ])
    ])
  ]
})
export class NavigationItemComponent {
  @Input() item!: ContentItem & { isOpen?: boolean };
  @Input() level: number = 0;
  @Input() activePath: string = '';

  toggleItem(event: Event): void {
    event.stopPropagation();
    if (this.hasChildren) {
      this.item.isOpen = !this.item.isOpen;
    }
  }

  trackByFn(index: number, item: any): string {
    return item.path || index.toString();
  }

  get hasChildren(): boolean {
    return !!this.item.children?.length;
  }

  get paddingLeft(): string {
    return `${this.level * 12}px`;
  }

  get isActive(): boolean {
    return this.activePath.startsWith(this.item.path);
  }
}
