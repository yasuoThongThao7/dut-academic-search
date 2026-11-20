import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Document, DocumentMetadata, DocumentQuery, DocumentReport, Page, Review } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly api = inject(ApiService);

  search(query: DocumentQuery): Observable<Page<Document> | Document[]> {
    return this.api.get<Page<Document> | Document[]>('/documents', query);
  }
  get(id: number): Observable<Document> { return this.api.get<Document>(`/documents/${id}`); }
  upload(metadata: DocumentMetadata, file: File): Observable<Document> {
    return this.api.upload<Document>('/documents', metadata, file);
  }
  update(id: number, body: Partial<DocumentMetadata>): Observable<Document> {
    return this.api.patchMultipart<Document>(`/documents/${id}`, body);
  }
  remove(id: number): Observable<void> { return this.api.delete<void>(`/documents/${id}`); }
  registerView(id: number): Observable<void> { return this.api.post<void>(`/documents/${id}/views`, {}); }
  download(id: number): Observable<Blob> { return this.api.download(`/documents/${id}/download`); }
  preview(id: number): Observable<Blob> { return this.api.download(`/documents/${id}/preview`); }
  reviews(id: number, page = 0, size = 10): Observable<Page<Review> | Review[]> {
    return this.api.get<Page<Review> | Review[]>(`/documents/${id}/reviews`, { page, size });
  }
  submitReview(id: number, rating: number, content: string): Observable<Review> {
    return this.api.post<Review>(`/documents/${id}/reviews`, { rating, content });
  }
  updateReview(id: number, rating: number, content: string): Observable<Review> {
    return this.api.patch<Review>(`/reviews/${id}`, { rating, content });
  }
  deleteReview(id: number): Observable<void> { return this.api.delete<void>(`/reviews/${id}`); }
  report(id: number, reason: DocumentReport['reason'], description: string): Observable<DocumentReport> {
    return this.api.post<DocumentReport>(`/documents/${id}/reports`, { reason, description: description.trim() || undefined });
  }
  favorite(id: number): Observable<void> { return this.api.put<void>(`/me/favorites/${id}`); }
  unfavorite(id: number): Observable<void> { return this.api.delete<void>(`/me/favorites/${id}`); }
  myDocuments(page = 0, size = 12, status?: string): Observable<Page<Document> | Document[]> {
    return this.api.get<Page<Document> | Document[]>('/me/documents', { page, size, status });
  }
  favorites(page = 0, size = 12): Observable<Page<Document> | Document[]> {
    return this.api.get<Page<Document> | Document[]>('/me/favorites', { page, size });
  }
}
