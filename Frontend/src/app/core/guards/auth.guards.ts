import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authenticatedGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureSession().pipe(map((authenticated) => authenticated ? true : router.createUrlTree(['/login'])));
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureSession().pipe(map((authenticated) => authenticated
    ? router.createUrlTree([auth.user()?.role === 'ADMIN' ? '/admin/dashboard' : '/'])
    : true));
};

export const roleGuard = (role: 'STUDENT' | 'ADMIN'): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureSession().pipe(map((authenticated) => {
    if (!authenticated) return router.createUrlTree(['/login']);
    const user = auth.user();
    if (user?.forcePasswordChange) return router.createUrlTree(['/change-password']);
    if (user?.role === role) return true;
    return router.createUrlTree([user?.role === 'ADMIN' ? '/admin/dashboard' : '/']);
  }));
};

export const passwordChangedGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureSession().pipe(map((authenticated) => {
    if (!authenticated) return router.createUrlTree(['/login']);
    return auth.user()?.forcePasswordChange ? router.createUrlTree(['/change-password']) : true;
  }));
};
