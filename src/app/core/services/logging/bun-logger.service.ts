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

// Get the file name from the call stack
const getCallerFile = (): string => {
  const error = new Error();
  const stack = error.stack?.split('\n') || [];
  // The 4th line in the stack trace is the caller of the log function
  const callerLine = stack[3] || '';
  // Extract file name from the stack line
  const match = callerLine.match(/\/([^/]+\.[tj]s):\d+:\d+/);
  return match ? match[1] : 'unknown';
};

// Format log message
const formatLog = (level: string, message: string, context?: any): string => {
  const timestamp = new Date().toISOString();
  const callerFile = getCallerFile();
  let logEntry = `[${timestamp}] [${level.toUpperCase()}] [${callerFile}] ${message}`;
  
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
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'debug'; // Default to debug in development
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
  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[this.logLevel] <= levels[level];
  }

  debug(message: string, context?: any): void {
    if (!this.shouldLog('debug')) return;
    const logEntry = formatLog('debug', message, context);
    // Always show debug logs in browser
    if (isBrowser) {
      // Use console.debug for debug level
      console.debug(logEntry);
    } else {
      // Node/Bun: write to file and also log to console
      console.debug(logEntry);
      if (typeof Bun !== 'undefined') {
        writeToFile('debug', message, context).catch(console.error);
      }
    }
  }

  info(message: string, context?: any): void {
    if (!this.shouldLog('info')) return;
    const logEntry = formatLog('info', message, context);
    console.log(logEntry);
    if (!isBrowser) {
      writeToFile('info', message, context).catch(console.error);
    }
  }

  warn(message: string, context?: any): void {
    if (!this.shouldLog('warn')) return;
    const logEntry = formatLog('warn', message, context);
    console.warn(logEntry);
    if (!isBrowser) {
      writeToFile('warn', message, context).catch(console.error);
    }
  }

  error(message: string, context?: any): void {
    if (!this.shouldLog('error')) return;
    const logEntry = formatLog('error', message, context);
    console.error(logEntry);
    if (!isBrowser) {
      writeToFile('error', message, context).catch(console.error);
    }
  }
}

// Export a singleton instance
export const LOG = new BunLoggerService();
