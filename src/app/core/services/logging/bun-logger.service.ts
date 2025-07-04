import { Injectable } from '@angular/core';

// Type declaration for Bun
declare const Bun: {
  write(path: string, data: string | Uint8Array): Promise<number>;
  file(path: string): {
    text(): Promise<string>;
    text(encoding: 'utf8'): Promise<string>;
    size(): Promise<number>;
    exists(): Promise<boolean>;
  };
  // Add mkdirSync to Bun type
  mkdirSync(path: string, options?: { recursive: boolean }): void;
};

// Configuration
const LOG_FILE = './logs/application.log';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 5;
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

// Format log message
const formatLog = (level: string, message: string, context?: any): string => {
  const timestamp = new Date().toISOString();
  let logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  if (context) {
    try {
      logEntry += ' ' + JSON.stringify(context, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value
      );
    } catch (e) {
      logEntry += ' [Failed to stringify context]';
    }
  }
  
  return logEntry;
};

// Rotate logs if needed
const rotateLogsIfNeeded = async (): Promise<void> => {
  if (isBrowser || typeof Bun === 'undefined') return;

  try {
    const file = Bun.file(LOG_FILE);
    const exists = await file.exists();
    
    if (!exists) return;
    
    const fileSize = await file.size();
    
    if (fileSize > MAX_FILE_SIZE) {
      // Read current log content
      const logContent = await file.text();
      
      // Create backup with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = `${LOG_FILE}.${timestamp}`;
      
      // Write backup and clear current log
      await Promise.all([
        Bun.write(backupFile, logContent),
        Bun.write(LOG_FILE, '')
      ]);
    }
  } catch (error) {
    console.error('Log rotation failed:', error);
  }
};

// Write to log file
const writeToFile = async (level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: any): Promise<void> => {
  const logMessage = formatLog(level, message, context);
  
  if (isBrowser || typeof Bun === 'undefined') {
    // Fallback for browser or if Bun is not available
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](logMessage);
    return;
  }

  try {
    // Write to log file with append mode
    await Bun.write(LOG_FILE, logMessage + '\n');
    
    // Rotate logs if needed
    await rotateLogsIfNeeded();
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
};

@Injectable({
  providedIn: 'root'
})
export class BunLoggerService {
  constructor() {
    // Ensure log directory exists
    if (!isBrowser && typeof Bun !== 'undefined') {
      try {
        // @ts-ignore - mkdirSync is available in Bun
        Bun.mkdirSync('./logs', { recursive: true });
      } catch (error) {
        console.error('Failed to create logs directory:', error);
      }
    }
  }

  // Public logging methods
  debug(message: string, context?: any): void {
    const isDev = !isBrowser && 
      (typeof process !== 'undefined' && 
       process.env && 
       process.env['NODE_ENV'] !== 'production');
    
    if (typeof Bun !== 'undefined' || isDev) {
      writeToFile('debug', message, context);
    }
  }

  info(message: string, context?: any): void {
    writeToFile('info', message, context);
  }

  warn(message: string, context?: any): void {
    writeToFile('warn', message, context);
  }

  error(message: string, context?: any): void {
    writeToFile('error', message, context);
  }
}

// Export a singleton instance
export const LOG = new BunLoggerService();
