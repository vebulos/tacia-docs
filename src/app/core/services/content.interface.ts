/**
 * Represents a content item in the documentation structure.
 * Can be either a directory or a file.
 */
export interface ContentItem {
  /** The name of the item */
  name: string;
  
  /** The full path of the item from the root, including extension for files */
  path: string;
  
  /** Whether this item is a directory */
  isDirectory: boolean;
  
  /** Child items, if this is a directory */
  children?: ContentItem[];
  
  /** Additional metadata about the item */
  metadata?: {
    /** Display title (falls back to name without extension if not provided) */
    title?: string;
    
    /** List of tags for categorization and search */
    tags?: string[];
    
    /** Allow any additional metadata */
    [key: string]: any;
  };
}
