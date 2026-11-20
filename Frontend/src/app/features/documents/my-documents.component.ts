import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideArrowRight, LucideFileText, LucidePencil, LucideTrash2, LucideX } from '@lucide/angular';
import { Document, DocumentStatus } from '../../core/models/api.models';
import { pageItems } from '../../core/services/api.service';
import { DocumentService } from '../../core/services/document.service';

type DocumentTab = { label: string; value: DocumentStatus | '' };

@Component({
  selector: 'app-my-documents',
  imports: [DatePipe, FormsModule, RouterLink, LucideArrowRight, LucideFileText, LucidePencil, LucideTrash2, LucideX],
  template: `
    <div class="manage-page"><div class="page-title-row"><div><span class="eyebrow">KHO CỦA BẠN</span><h1>Tài liệu của tôi</h1><p class="muted">Theo dõi và quản lý những tài liệu bạn đã chia sẻ.</p></div><a class="btn btn-primary" routerLink="/documents/upload">＋ Đăng tài liệu</a></div>
      @if (message()) { <div class="alert" [class.alert-error]="isError()" [class.alert-success]="!isError()">{{ message() }}</div> }
      <div class="tabs">@for (tab of tabs; track tab.label) { <button [class.tab-active]="status() === tab.value" (click)="selectStatus(tab.value)">{{ tab.label }}</button> }</div>
      @if (loading()) { <div class="table-skeleton"><span></span><span></span><span></span><span></span></div> }
      @else if (documents().length) { <div class="table-wrap"><table class="data-table"><thead><tr><th>TÀI LIỆU</th><th>MÔN HỌC</th><th>LOẠI</th><th>NGÀY ĐĂNG</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr></thead><tbody>@for (doc of documents(); track doc.id) { <tr><td><a class="table-title" [routerLink]="['/documents',doc.id]"><span class="table-file-icon"><svg lucideFileText></svg></span><span><strong>{{ doc.title }}</strong>@if (doc.rejectionReason) { <small class="rejection-reason">{{ doc.rejectionReason }}</small> }</span></a></td><td>{{ doc.course?.name || '—' }}</td><td>{{ doc.category?.name || doc.categoryCode || '—' }}</td><td>{{ doc.createdAt | date:'dd/MM/yyyy' }}</td><td><span class="status-badge" [class.status-pending]="doc.status === 'PENDING'" [class.status-approved]="doc.status === 'APPROVED'" [class.status-rejected]="doc.status === 'REJECTED'" [class.status-hidden]="doc.status === 'HIDDEN'">{{ statusLabel(doc.status) }}</span></td><td><div class="table-actions"><a class="icon-button" [routerLink]="['/documents',doc.id]" aria-label="Xem chi tiết"><svg lucideArrowRight></svg></a><button class="icon-button" aria-label="Chỉnh sửa tài liệu" (click)="startEdit(doc)"><svg lucidePencil></svg></button><button class="icon-button danger-icon" aria-label="Xóa tài liệu" (click)="remove(doc)"><svg lucideTrash2></svg></button></div></td></tr> }</tbody></table></div><nav class="pagination"><button class="page-button" [disabled]="page() === 0" (click)="changePage(page()-1)">‹</button><span class="muted">Trang {{ page()+1 }} / {{ pageCount() }}</span><button class="page-button" [disabled]="page()+1 >= pageCount()" (click)="changePage(page()+1)">›</button></nav> }
      @else { <div class="empty-state"><span class="empty-icon"><svg lucideFileText></svg></span><strong>Chưa có tài liệu trong danh mục này</strong><p>Tài liệu bạn đăng sẽ được quản lý tại đây.</p><a class="btn btn-outline" routerLink="/documents/upload">Đăng tài liệu đầu tiên</a></div> }
      @if (editingDoc()) { <div class="modal-backdrop" (click)="editingDoc.set(null)"><section class="modal-card" (click)="$event.stopPropagation()"><div class="modal-heading"><div><span class="eyebrow">CHỈNH SỬA NỘI DUNG</span><h2>Cập nhật tài liệu</h2></div><button class="icon-button" aria-label="Đóng" (click)="editingDoc.set(null)"><svg lucideX></svg></button></div><form (ngSubmit)="saveEdit()"><label class="field-label">Tên tài liệu<input class="form-input" name="editTitle" [(ngModel)]="editTitle" required maxlength="180" /></label><label class="field-label spaced-label">Mô tả<textarea class="form-input textarea" name="editDescription" [(ngModel)]="editDescription" rows="4"></textarea></label>@if (editError()) { <div class="field-error">{{ editError() }}</div> }<div class="modal-actions"><button class="btn btn-outline" type="button" (click)="editingDoc.set(null)">Hủy</button><button class="btn btn-primary" type="submit" [disabled]="saving()">{{ saving() ? 'Đang lưu…' : 'Lưu thay đổi' }}</button></div></form></section></div> }
    </div>
  `,
})
export class MyDocumentsComponent implements OnInit {
  private readonly service = inject(DocumentService);
  readonly tabs: DocumentTab[] = [
    { label: 'Tất cả', value: '' }, { label: 'Chờ duyệt', value: 'PENDING' },
    { label: 'Đã duyệt', value: 'APPROVED' }, { label: 'Bị từ chối', value: 'REJECTED' }, { label: 'Đã ẩn', value: 'HIDDEN' },
  ];
  readonly documents = signal<Document[]>([]);
  readonly loading = signal(true);
  readonly message = signal('');
  readonly isError = signal(false);
  readonly status = signal<DocumentStatus | ''>('');
  readonly page = signal(0);
  readonly pageCount = signal(1);
  readonly editingDoc = signal<Document | null>(null);
  readonly saving = signal(false);
  readonly editError = signal('');
  editTitle = '';
  editDescription = '';

  ngOnInit(): void { this.load(); }
  selectStatus(status: DocumentStatus | ''): void { this.status.set(status); this.page.set(0); this.load(); }
  changePage(page: number): void { if (page >= 0 && page < this.pageCount()) { this.page.set(page); this.load(); } }
  statusLabel(status?: DocumentStatus): string {
    const labels: Partial<Record<DocumentStatus, string>> = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Bị từ chối', HIDDEN: 'Đã ẩn' };
    return status ? labels[status] || 'Không rõ' : 'Không rõ';
  }
  startEdit(doc: Document): void {
    this.editingDoc.set(doc);
    this.editTitle = doc.title;
    this.editDescription = doc.description || '';
    this.editError.set('');
  }
  saveEdit(): void {
    const doc = this.editingDoc();
    if (!doc || !this.editTitle.trim()) { this.editError.set('Tên tài liệu là bắt buộc.'); return; }
    this.saving.set(true);
    this.service.update(doc.id, { title: this.editTitle.trim(), description: this.editDescription.trim() }).subscribe({
      next: () => { this.saving.set(false); this.editingDoc.set(null); this.load(); },
      error: (error: { error?: { message?: string } }) => {
        this.saving.set(false);
        this.editError.set(error.error?.message || 'Không thể cập nhật tài liệu.');
      },
    });
  }
  remove(doc: Document): void {
    if (!window.confirm(`Bạn có chắc muốn xóa tài liệu “${doc.title}”?`)) return;
    this.service.remove(doc.id).subscribe({
      next: () => { this.message.set('Đã xóa tài liệu.'); this.isError.set(false); this.load(); },
      error: (error: { error?: { message?: string } }) => { this.message.set(error.error?.message || 'Không thể xóa tài liệu.'); this.isError.set(true); },
    });
  }
  private load(): void {
    this.loading.set(true); this.message.set('');
    this.service.myDocuments(this.page(), 12, this.status() || undefined).subscribe({
      next: (response) => {
        this.documents.set(pageItems(response));
        if (!Array.isArray(response)) this.pageCount.set(response.totalPages || 1);
        this.loading.set(false);
      },
      error: () => { this.documents.set([]); this.loading.set(false); this.message.set('Không thể tải tài liệu của bạn.'); this.isError.set(true); },
    });
  }
}
