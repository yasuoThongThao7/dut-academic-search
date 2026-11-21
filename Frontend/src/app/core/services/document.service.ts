import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  AccessLink,
  Document,
  DocumentMetadata,
  DocumentQuery,
  DocumentReport,
  Page,
  ReportReason,
  Review,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly api = inject(ApiService);

  search(query: DocumentQuery): Observable<Page<Document> | Document[]> {
    return this.api.get<Page<Document> | Document[]>('/documents', query);
  }
  get(id: number): Observable<Document> {
    return this.api.get<Document>(`/documents/${id}`);
  }
  /** Chia sẻ tài liệu bằng liên kết ngoài (JSON, không còn upload file). */
  create(metadata: DocumentMetadata): Observable<Document> {
    return this.api.post<Document>('/documents', metadata);
  }
  update(id: number, body: Partial<DocumentMetadata>): Observable<Document> {
    return this.api.patch<Document>(`/documents/${id}`, body);
  }
  remove(id: number): Observable<void> {
    return this.api.delete<void>(`/documents/${id}`);
  }
  registerView(id: number): Observable<void> {
    return this.api.post<void>(`/documents/${id}/views`, {});
  }
  /** Ghi nhận lượt truy cập liên kết và nhận về link ngoài để mở. */
  access(id: number): Observable<AccessLink> {
    return this.api.post<AccessLink>(`/documents/${id}/access`, {});
  }
  reviews(id: number, page = 0, size = 10): Observable<Page<Review> | Review[]> {
    return this.api.get<Page<Review> | Review[]>(`/documents/${id}/reviews`, { page, size });
  }
  /** rating: 1 = Hữu ích, 0 = Không hữu ích. */
  submitReview(id: number, rating: number, content: string): Observable<Review> {
    return this.api.post<Review>(`/documents/${id}/reviews`, {
      rating,
      content: content.trim() || undefined,
    });
  }
  updateReview(id: number, rating: number, content: string): Observable<Review> {
    return this.api.patch<Review>(`/reviews/${id}`, { rating, content: content.trim() });
  }
  deleteReview(id: number): Observable<void> {
    return this.api.delete<void>(`/reviews/${id}`);
  }
  report(id: number, reason: ReportReason, description: string): Observable<DocumentReport> {
    return this.api.post<DocumentReport>(`/documents/${id}/reports`, {
      reason,
      description: description.trim() || undefined,
    });
  }
  favorite(id: number): Observable<void> {
    return this.api.put<void>(`/me/favorites/${id}`);
  }
  unfavorite(id: number): Observable<void> {
    return this.api.delete<void>(`/me/favorites/${id}`);
  }
  myDocuments(page = 0, size = 12, status?: string): Observable<Page<Document> | Document[]> {
    return this.api.get<Page<Document> | Document[]>('/me/documents', { page, size, status });
  }
  favorites(page = 0, size = 12): Observable<Page<Document> | Document[]> {
    return this.api.get<Page<Document> | Document[]>('/me/favorites', { page, size });
  }
}
