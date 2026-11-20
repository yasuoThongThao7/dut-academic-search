import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const apiBase = `${environment.apiBaseUrl.replace(/\/$/, '')}/api/v1/`;
  const apiRequest = request.url.startsWith(apiBase);
  const token = auth.token();
  const authenticatedRequest = token && apiRequest
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      const isAuthEndpoint = request.url.includes('/auth/login') || request.url.includes('/auth/refresh');
      if (!apiRequest || !(error instanceof HttpErrorResponse) || error.status !== 401 || isAuthEndpoint) {
        return throwError(() => error);
      }
      return auth.refresh().pipe(
        switchMap((newToken) => {
          if (!newToken) {
            auth.expireSession();
            return throwError(() => error);
          }
          return next(request.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }));
        }),
      );
    }),
  );
};
