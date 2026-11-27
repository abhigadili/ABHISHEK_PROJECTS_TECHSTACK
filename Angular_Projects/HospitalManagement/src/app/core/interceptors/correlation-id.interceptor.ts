import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * CLASS-BASED interceptor (isolated example, registered through HTTP_INTERCEPTORS + withInterceptorsFromDi()).
 * Adds X-Correlation-Id so a request can be followed through the gateway, every microservice and Kafka.
 */
@Injectable()
export class CorrelationIdInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now());
    return next.handle(req.clone({ setHeaders: { 'X-Correlation-Id': id } }));
  }
}
