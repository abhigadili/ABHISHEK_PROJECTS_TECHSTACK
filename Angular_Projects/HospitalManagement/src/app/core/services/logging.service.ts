import { Injectable, inject } from '@angular/core';
import { LOGGER, type Logger } from '../configuration/app-config';

/** Logging service: thin facade over the injected Logger (useClass per environment); also the target of `useExisting` reporter tokens. */
@Injectable({ providedIn: 'root' })
export class LoggingService implements Logger {
  private readonly logger = inject(LOGGER);
  debug(m: string, ...d: unknown[]) { this.logger.debug(m, ...d); }
  info(m: string, ...d: unknown[]) { this.logger.info(m, ...d); }
  warn(m: string, ...d: unknown[]) { this.logger.warn(m, ...d); }
  error(m: string, ...d: unknown[]) { this.logger.error(m, ...d); }
}
