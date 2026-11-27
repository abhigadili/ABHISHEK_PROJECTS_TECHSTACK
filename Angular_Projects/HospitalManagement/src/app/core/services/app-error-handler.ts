import { ErrorHandler, Injectable, inject } from '@angular/core';
import { LoggingService } from './logging.service';

/** Global error handling: replaces Angular's default ErrorHandler (registered with `{ provide: ErrorHandler, useClass: AppErrorHandler }`). */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly log = inject(LoggingService);
  handleError(error: unknown): void {
    this.log.error('Unhandled application error', error);
  }
}
