import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoginResponse, User } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = `${environment.apiBaseUrl.replace(/\/$/, '')}/api/v1/auth`;
  private readonly currentUser = signal<User | null>(null);
  readonly user = this.currentUser.asReadonly();
  readonly token = signal<string | null>(null);
  readonly isAuthenticated = computed(() => this.token() !== null && this.currentUser() !== null);
  private refreshRequest: Observable<string | null> | null = null;
  private sessionRequest: Observable<boolean> | null = null;

  login(studentId: string, password: string): Observable<LoginResponse> {
    return this.http.post<{ data: LoginResponse } | LoginResponse>(`${this.apiUrl}/login`, {
      studentId,
      password,
    }, { withCredentials: true }).pipe(
      map((response) => 'data' in response ? response.data : response),
      tap((response) => {
        this.token.set(response.accessToken);
        this.currentUser.set(response.user);
      }),
    );
  }

  refresh(): Observable<string | null> {
    if (!this.refreshRequest) {
      this.refreshRequest = this.http.post<{ data?: { accessToken: string } } | { accessToken: string }>(
        `${this.apiUrl}/refresh`,
        {},
        { withCredentials: true },
      ).pipe(
        map((response) => {
          const result = ('data' in response ? response.data : response) as { accessToken?: string } | undefined;
          if (!result?.accessToken) return null;
          this.token.set(result.accessToken);
          return result.accessToken;
        }),
        catchError(() => of(null)),
        finalize(() => { this.refreshRequest = null; }),
        shareReplay(1),
      );
    }
    return this.refreshRequest;
  }

  ensureSession(): Observable<boolean> {
    if (this.isAuthenticated()) return of(true);
    if (!this.sessionRequest) {
      this.sessionRequest = this.refresh().pipe(
        switchMap((token) => token
          ? this.loadCurrentUser().pipe(map(() => true), catchError(() => of(false)))
          : of(false)),
        tap((authenticated) => {
          if (!authenticated) {
            this.token.set(null);
            this.currentUser.set(null);
          }
        }),
        finalize(() => { this.sessionRequest = null; }),
        shareReplay(1),
      );
    }
    return this.sessionRequest;
  }

  loadCurrentUser(): Observable<User> {
    return this.http.get<{ data: User } | User>(`${this.apiUrl}/me`).pipe(
      map((response) => 'data' in response ? response.data : response),
      tap((user) => this.currentUser.set(user)),
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/password`, { currentPassword, newPassword }).pipe(
      tap(() => this.currentUser.update((user) => user ? { ...user, forcePasswordChange: false } : user)),
    );
  }

  logout(): void {
    this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true }).pipe(
      catchError(() => of(null)),
      finalize(() => {
        this.token.set(null);
        this.currentUser.set(null);
        void this.router.navigateByUrl('/login');
      }),
    ).subscribe();
  }

  expireSession(): void {
    this.token.set(null);
    this.currentUser.set(null);
    void this.router.navigateByUrl('/login');
  }
}
