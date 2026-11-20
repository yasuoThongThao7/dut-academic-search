import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDownload, LucideHeart, LucideStar, LucideTrash2 } from '@lucide/angular';
import { Document } from '../../core/models/api.models';
import { pageItems } from '../../core/services/api.service';
import { DocumentService } from '../../core/services/document.service';

@Component({
  selector: 'app-favorites',
  imports: [DatePipe, DecimalPipe, RouterLink, LucideDownload, LucideHeart, LucideStar, LucideTrash2],
  template: `
    <div class="manage-page"><div class="page-title-row"><div><span class="eyebrow">BỘ SƯU TẬP CÁ NHÂN</span><h1>Tài liệu yêu thích</h1><p class="muted">Những tài liệu bạn đã lưu để xem lại sau.</p></div><a class="btn btn-outline" routerLink="/documents">Khám phá tài liệu <span>→</span></a></div>
      @if (message()) { <div class="alert alert-error">{{ message() }}</div> }
      @if (loading()) { <div class="document-grid">@for (_ of [1,2,3]; track $index) { <div class="skeleton-card"><span class="skeleton-line"></span><span class="skeleton-line wide"></span><span class="skeleton-line"></span></div> }</div> }
      @else if (documents().length) { <div class="document-grid favorite-grid">@for (doc of documents(); track doc.id) { <article class="document-card"><div class="doc-card-top"><span class="doc-type">{{ doc.category?.name || doc.categoryCode || 'Tài liệu' }}</span><button class="icon-button favorite-button" aria-label="Bỏ yêu thích" (click)="remove(doc)"><svg lucideTrash2></svg></button></div><a class="favorite-title" [routerLink]="['/documents',doc.id]">{{ doc.title }}</a><div class="doc-course">{{ doc.course?.code }}{{ doc.course?.code && doc.course?.name ? ' · ' : '' }}{{ doc.course?.name || 'Chưa gắn môn học' }}</div><div class="doc-card-footer"><span>{{ doc.createdAt | date:'dd/MM/yyyy' }}</span><span class="doc-stats"><span><svg lucideDownload></svg>{{ doc.downloadCount ?? '—' }}</span><span><svg lucideStar></svg>{{ doc.averageRating != null ? (doc.averageRating | number:'1.1-1') : '—' }}</span></span></div></article> }</div><nav class="pagination"><button class="page-button" [disabled]="page() === 0" (click)="changePage(page()-1)">‹</button><span class="muted">Trang {{ page()+1 }} / {{ pageCount() }}</span><button class="page-button" [disabled]="page()+1 >= pageCount()" (click)="changePage(page()+1)">›</button></nav> }
      @else { <div class="empty-state"><span class="empty-icon"><svg lucideHeart></svg></span><strong>Danh sách yêu thích đang trống</strong><p>Lưu lại tài liệu hữu ích để tìm thấy chúng dễ dàng hơn.</p><a class="btn btn-primary" routerLink="/documents">Tìm tài liệu</a></div> }
    </div>
  `,
})
export class FavoritesComponent implements OnInit {
  private readonly service = inject(DocumentService);
  readonly documents = signal<Document[]>([]);
  readonly page = signal(0);
  readonly pageCount = signal(1);
  readonly loading = signal(true);
  readonly message = signal('');
  ngOnInit(): void { this.load(); }
  changePage(page: number): void { if (page >= 0 && page < this.pageCount()) { this.page.set(page); this.load(); } }
  remove(document: Document): void {
    this.service.unfavorite(document.id).subscribe({
      next: () => { this.documents.update((list) => list.filter((item) => item.id !== document.id)); },
      error: () => this.message.set('Không thể bỏ yêu thích. Vui lòng thử lại.'),
    });
  }
  private load(): void {
    this.loading.set(true);
    this.service.favorites(this.page(), 12).subscribe({
      next: (response) => {
        this.documents.set(pageItems(response));
        if (!Array.isArray(response)) this.pageCount.set(response.totalPages || 1);
        this.loading.set(false);
      },
      error: () => { this.documents.set([]); this.loading.set(false); this.message.set('Không thể tải danh sách yêu thích.'); },
    });
  }
}
