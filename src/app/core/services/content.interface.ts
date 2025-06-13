/**
 * Represents a content item in the documentation structure.
 * Can be either a directory or a file.
 */
export interface ContentItem {
  /** The name of the item */
  name: string;
  
  /** The path of the item relative to its parent */
  path: string;
  
  /** The full path of the item from the root */
  fullPath?: string;
  
  /** Whether this item is a directory */
  isDirectory: boolean;
  
  /** Child items, if this is a directory */
  children?: ContentItem[];
  
  /** Additional metadata about the item */
  metadata?: {
    title?: string;
    categories?: string[];
    tags?: string[];
    [key: string]: any;
  };
}
