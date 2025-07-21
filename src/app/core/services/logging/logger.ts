export class Logger {
  constructor(private readonly name: string) {}

  debug(msg: string, ctx?: any) {
    this.log('DEBUG', msg, ctx);
  }
  info(msg: string, ctx?: any) {
    this.log('INFO', msg, ctx);
  }
  warn(msg: string, ctx?: any) {
    this.log('WARN', msg, ctx);
  }
  error(msg: string, ctx?: any) {
    this.log('ERROR', msg, ctx);
  }

  private log(level: string, msg: string, ctx?: any) {
    const timestamp = new Date().toISOString();
    let logEntry = `[${timestamp}] [${level}] [${this.name}] ${msg}`;
    if (ctx) {
      try {
        logEntry += ' ' + JSON.stringify(ctx, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        );
      } catch {}
    }
    // Remplacer par l'intégration avec Bun ou autre selon besoin
    console.log(logEntry);
  }
}

// Helper to instancier un logger plus facilement
export const getLogger = (name: string) => new Logger(name);
