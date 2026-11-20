import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiEnvelope, Page } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl.replace(/\/$/, '')}/api/v1`;

  get<T>(path: string, query?: object): Observable<T> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<T>(`${this.baseUrl}${path}`, { params }).pipe(map(unwrap<T>));
  }

  post<T>(path: string, body: unknown, options?: { withCredentials?: boolean }): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body, options).pipe(map(unwrap<T>));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body).pipe(map(unwrap<T>));
  }

  put<T>(path: string, body?: unknown): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${path}`, body).pipe(map(unwrap<T>));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`).pipe(map(unwrap<T>));
  }

  upload<T>(path: string, metadata: object, file: File): Observable<T> {
    const body = new FormData();
    body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    body.append('file', file, file.name);
    return this.http.post<T>(`${this.baseUrl}${path}`, body).pipe(map(unwrap<T>));
  }

  patchMultipart<T>(path: string, metadata: object, file?: File): Observable<T> {
    const body = new FormData();
    body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    if (file) body.append('file', file, file.name);
    return this.http.patch<T>(`${this.baseUrl}${path}`, body).pipe(map(unwrap<T>));
  }

  download(path: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}${path}`, { responseType: 'blob' });
  }

  absolute(path: string): string {
    return `${this.baseUrl}${path}`;
  }
}

export function unwrap<T>(value: T | ApiEnvelope<T>): T {
  if (typeof value === 'object' && value !== null && 'data' in value) {
    const response = value as ApiEnvelope<T> & Partial<Page<unknown>>;
    if (Array.isArray(response.data) && typeof response.totalElements === 'number') {
      return {
        content: response.data,
        totalElements: response.totalElements,
        totalPages: response.totalPages ?? 0,
        number: response.page ?? 0,
        size: response.size ?? response.data.length,
      } as T;
    }
    return response.data;
  }
  return value as T;
}

export function pageItems<T>(page: Page<T> | T[]): T[] {
  if (Array.isArray(page)) return page;
  return page.content ?? page.items ?? [];
}
