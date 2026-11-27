import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ToastService } from '../services/toast.service';
import { isAppError } from './app-error';

/**
 * Last-resort handler for errors nobody caught (template exceptions, thrown promises, ...).
 * HTTP failures are already reported once by the error interceptor, so AppErrors are only logged here.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly toast = inject(ToastService);

  handleError(error: unknown): void {
    if (isAppError(error)) {
      console.warn('[app-error]', error.code, error.message);
      return;
    }
    console.error('[unhandled]', error);
    this.toast.error('Something went wrong. Please try again.');
  }
}
