import { ContentItem } from '@app/core/services/content.interface';

export interface NavigationItem extends ContentItem {
  isOpen?: boolean;
  isLoading?: boolean;
  hasError?: boolean;
  childrenLoaded?: boolean;
  children?: NavigationItem[];
  isActive?: boolean;
}
