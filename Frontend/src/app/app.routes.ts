import { Routes } from '@angular/router';
import { authenticatedGuard, guestGuard, passwordChangedGuard, roleGuard } from './core/guards/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/auth-page.component').then((m) => m.AuthPageComponent),
  },
  {
    path: 'change-password',
    canActivate: [authenticatedGuard],
    loadComponent: () => import('./features/auth/change-password.component').then((m) => m.ChangePasswordComponent),
  },
  {
    path: '',
    canActivate: [roleGuard('STUDENT')],
    canActivateChild: [passwordChangedGuard],
    loadComponent: () => import('./layouts/student-layout/student-layout.component').then((m) => m.StudentLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent) },
      { path: 'documents', loadComponent: () => import('./features/documents/search.component').then((m) => m.SearchComponent) },
      { path: 'documents/upload', loadComponent: () => import('./features/documents/upload.component').then((m) => m.UploadComponent) },
      { path: 'documents/:id', loadComponent: () => import('./features/documents/detail.component').then((m) => m.DetailComponent) },
      { path: 'my-documents', loadComponent: () => import('./features/documents/my-documents.component').then((m) => m.MyDocumentsComponent) },
      { path: 'favorites', loadComponent: () => import('./features/favorites/favorites.component').then((m) => m.FavoritesComponent) },
      { path: 'profile', loadComponent: () => import('./features/profile/profile.component').then((m) => m.ProfileComponent) },
    ],
  },
  {
    path: 'admin',
    canActivate: [roleGuard('ADMIN')],
    canActivateChild: [passwordChangedGuard],
    loadComponent: () => import('./layouts/admin-layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./features/admin/admin-page.component').then((m) => m.AdminPageComponent), data: { view: 'dashboard' } },
      { path: 'dashboard', loadComponent: () => import('./features/admin/admin-page.component').then((m) => m.AdminPageComponent), data: { view: 'dashboard' } },
      { path: 'users', loadComponent: () => import('./features/admin/admin-page.component').then((m) => m.AdminPageComponent), data: { view: 'users' } },
      { path: 'documents', loadComponent: () => import('./features/admin/admin-page.component').then((m) => m.AdminPageComponent), data: { view: 'moderation' } },
      { path: 'reports', loadComponent: () => import('./features/admin/admin-page.component').then((m) => m.AdminPageComponent), data: { view: 'reports' } },
      { path: 'catalog/:resource', loadComponent: () => import('./features/admin/admin-page.component').then((m) => m.AdminPageComponent), data: { view: 'catalog' } },
    ],
  },
  { path: '**', redirectTo: '' },
];
