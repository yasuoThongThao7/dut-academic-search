import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideArrowLeft, LucideBookmark, LucideEye, LucideExternalLink, LucideHeart } from '@lucide/angular';
import { Document, ReportReason, Review } from '../../core/models/api.models';
import { pageItems } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { DocumentService } from '../../core/services/document.service';
import { helpfulPercent, trustClass, trustLabel } from '../../core/utils/document-ui.utils';

@Component({
  selector: 'app-document-detail',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, LucideArrowLeft, LucideBookmark, LucideEye, LucideExternalLink, LucideHeart],
  template: `
    <div class="detail-page">
      <a class="back-link" routerLink="/documents"><svg lucideArrowLeft></svg> Quay lại kết quả tìm kiếm</a>
      @if (loading()) { <div class="detail-skeleton"><span class="skeleton-line short"></span><span class="skeleton-line wide"></span><span class="skeleton-line"></span><span class="skeleton-line"></span></div> }
      @else if (error()) { <div class="empty-state"><strong>{{ error() }}</strong><p>Tài liệu có thể đã bị ẩn hoặc không còn khả dụng.</p><a class="btn btn-outline" routerLink="/documents">Về kho tài liệu</a></div> }
      @else if (document(); as doc) {
        <div class="detail-layout">
          <main>
            <section class="detail-hero"><div class="detail-tags"><span class="doc-type">{{ doc.category?.name || doc.categoryCode || 'Tài liệu' }}</span><span class="status-badge status-approved">Đã duyệt</span><span [class]="trustClass(doc)">{{ trustLabel(doc) }}</span></div><h1>{{ doc.title }}</h1>@if (doc.description) { <p>{{ doc.description }}</p> }<div class="detail-author"><span class="avatar">{{ uploaderInitials(doc) }}</span><span><strong>{{ doc.uploader?.fullName || 'Sinh viên DUT' }}</strong><small>Đăng ngày {{ doc.createdAt | date:'dd/MM/yyyy' }}</small></span></div><div class="detail-actions"><button class="btn btn-primary" (click)="openLink()"><svg lucideExternalLink></svg> Mở liên kết</button><button class="btn btn-outline" (click)="toggleFavorite()"><svg lucideHeart></svg>{{ doc.isFavorite ? 'Đã yêu thích' : 'Thêm yêu thích' }}</button><button class="btn btn-outline" (click)="reportOpen.set(true)">Báo cáo</button></div>@if (linkMessage()) { <div class="alert alert-error">{{ linkMessage() }}</div> }@if (reportMessage()) { <div class="alert" [class.alert-success]="reportSubmitted()" [class.alert-error]="!reportSubmitted()">{{ reportMessage() }}</div> }</section>
            <section class="detail-section"><div class="section-heading detail-section-heading"><div><span class="eyebrow">THÔNG TIN ĐÀO TẠO</span><h2>Thông tin học thuật</h2></div><svg lucideBookmark></svg></div><div class="academic-grid">
              <div><small>KHOA</small><strong>{{ doc.major?.faculty?.name || 'Chưa có dữ liệu' }}</strong></div><div><small>CHUYÊN NGÀNH</small><strong>{{ doc.major?.name || 'Chưa có dữ liệu' }}</strong></div><div><small>MÃ MÔN HỌC</small><strong>{{ doc.course?.code || 'Chưa có dữ liệu' }}</strong></div><div><small>TÊN MÔN HỌC</small><strong>{{ doc.course?.name || 'Chưa có dữ liệu' }}</strong></div>
              @if (doc.courseOffering?.lecturer?.fullName) { <div><small>GIẢNG VIÊN</small><strong>{{ doc.courseOffering?.lecturer?.fullName }}</strong></div> }
              @if (doc.courseOffering?.academicTerm?.name) { <div><small>HỌC KỲ</small><strong>{{ doc.courseOffering?.academicTerm?.name }}</strong></div> }
              @if (doc.courseOffering?.classCode) { <div><small>LỚP HỌC PHẦN</small><strong>{{ doc.courseOffering?.classCode }}</strong></div> }
            </div></section>
            <section class="detail-section file-section"><div><span class="eyebrow">LIÊN KẾT TÀI LIỆU</span><h2>{{ doc.storageSource || 'Nguồn tài liệu' }}</h2></div>
              @if (doc.accessNote) { <p>{{ doc.accessNote }}</p> }
              <button class="btn btn-primary" (click)="openLink()"><svg lucideExternalLink></svg> Mở liên kết tài liệu</button>
            </section>
            <section class="detail-section review-section"><div class="section-heading detail-section-heading"><div><span class="eyebrow">CỘNG ĐỒNG PHẢN HỒI</span><h2>Đánh giá mức độ hữu ích</h2></div><div class="rating-summary"><strong>{{ helpfulPercent(doc) }}</strong><small>{{ doc.helpfulCount ?? 0 }} hữu ích · {{ doc.notHelpfulCount ?? 0 }} không hữu ích</small></div></div>
              @if (reviewMessage()) { <div class="alert" [class.alert-success]="reviewSaved()" [class.alert-error]="!reviewSaved()">{{ reviewMessage() }}</div> }
              <form class="review-form" [formGroup]="reviewForm" (ngSubmit)="submitReview()"><label class="field-label">Tài liệu này có hữu ích không?</label><div class="review-submit"><button class="btn btn-outline" type="button" [class.vote-selected]="reviewForm.controls.rating.value === 1" (click)="reviewForm.controls.rating.setValue(1)">Hữu ích</button><button class="btn btn-outline" type="button" [class.vote-selected]="reviewForm.controls.rating.value === 0" (click)="reviewForm.controls.rating.setValue(0)">Không hữu ích</button><button class="btn btn-primary" type="submit" [disabled]="reviewLoading()">{{ editingReview() ? 'Cập nhật đánh giá' : 'Gửi đánh giá' }}</button></div><textarea class="form-input textarea" formControlName="content" rows="3" placeholder="Nhận xét thêm (không bắt buộc)..."></textarea></form>
              @if (reviewsLoading()) { <div class="review-placeholder">Đang tải nhận xét…</div> } @else if (reviews().length) { @for (review of reviews(); track review.id) { <article class="review-card"><div class="review-head"><span class="avatar">{{ review.user.fullName.slice(0, 1) }}</span><div><strong>{{ review.user.fullName }}</strong><small>{{ review.createdAt | date:'dd/MM/yyyy' }}</small></div><span class="review-stars">{{ review.rating === 1 ? 'Hữu ích' : 'Không hữu ích' }}</span></div>@if (review.content) { <p>{{ review.content }}</p> }@if (review.user.id === auth.user()?.id) { <div class="review-owner-actions"><button class="text-button" (click)="editReview(review)">Chỉnh sửa</button><button class="text-button danger-text" (click)="deleteReview(review)">Xóa</button></div> }</article> } } @else { <div class="review-placeholder">Chưa có đánh giá. Hãy là người đầu tiên phản hồi.</div> }
              @if (reviewPages() > 1) { <nav class="pagination"><button class="page-button" [disabled]="reviewPage() === 0" (click)="loadReviews(reviewPage()-1)">‹</button><span class="muted">Trang {{ reviewPage()+1 }} / {{ reviewPages() }}</span><button class="page-button" [disabled]="reviewPage()+1 >= reviewPages()" (click)="loadReviews(reviewPage()+1)">›</button></nav> }
            </section>
          </main>
          <aside class="detail-aside"><div class="stats-card"><span class="eyebrow">THỐNG KÊ</span><div><span><svg lucideEye></svg>Lượt xem</span><strong>{{ doc.viewCount ?? '—' }}</strong></div><div><span><svg lucideExternalLink></svg>Lượt mở liên kết</span><strong>{{ doc.accessCount ?? '—' }}</strong></div><div><span>Hữu ích</span><strong>{{ helpfulPercent(doc) }}</strong></div></div><div class="tip-card"><span>✦</span><strong>Chia sẻ tri thức</strong><p>Đánh giá mức độ hữu ích để giúp bạn bè lựa chọn tài liệu.</p></div></aside>
        </div>
      }
      @if (reportOpen()) { <div class="modal-backdrop" (click)="reportOpen.set(false)"><section class="modal-card" (click)="$event.stopPropagation()"><div class="modal-heading"><div><span class="eyebrow">BÁO CÁO NỘI DUNG</span><h2>Báo cáo tài liệu</h2></div><button class="icon-button" aria-label="Đóng" (click)="reportOpen.set(false)"><span>×</span></button></div><form [formGroup]="reportForm" (ngSubmit)="submitReport()"><label class="field-label">Lý do báo cáo<select class="form-input" formControlName="reason"><option value="">Chọn lý do</option><option value="WRONG_COURSE">Sai môn học</option><option value="WRONG_MAJOR">Sai chuyên ngành</option><option value="INAPPROPRIATE">Nội dung không phù hợp</option><option value="BROKEN_LINK">Liên kết bị lỗi</option><option value="NO_ACCESS">Không có quyền truy cập</option><option value="COPYRIGHT">Vi phạm bản quyền</option><option value="OTHER">Lý do khác</option></select></label><label class="field-label spaced-label">Mô tả thêm<textarea class="form-input textarea" formControlName="description" rows="4" maxlength="2000" placeholder="Cung cấp thêm thông tin để quản trị viên xem xét (không bắt buộc)."></textarea></label>@if (reportForm.controls.reason.touched && reportForm.controls.reason.invalid) { <div class="field-error">Vui lòng chọn lý do báo cáo.</div> }@if (reportMessage() && !reportSubmitted()) { <div class="alert alert-error">{{ reportMessage() }}</div> }<div class="modal-actions"><button class="btn btn-outline" type="button" (click)="reportOpen.set(false)">Hủy</button><button class="btn btn-primary" type="submit" [disabled]="reportLoading()">{{ reportLoading() ? 'Đang gửi…' : 'Gửi báo cáo' }}</button></div></form></section></div> }
    </div>
  `,
})
export class DetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(DocumentService);
  readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly document = signal<Document | null>(null);
  readonly reviews = signal<Review[]>([]);
  readonly loading = signal(true);
  readonly reviewsLoading = signal(true);
  readonly reviewLoading = signal(false);
  readonly reviewMessage = signal('');
  readonly reviewSaved = signal(false);
  readonly editingReview = signal<number | null>(null);
  readonly error = signal('');
  readonly linkMessage = signal('');
  readonly reportOpen = signal(false);
  readonly reportLoading = signal(false);
  readonly reportMessage = signal('');
  readonly reportSubmitted = signal(false);
  readonly reviewPage = signal(0);
  readonly reviewPages = signal(1);
  readonly reviewForm = new FormGroup({
    rating: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(0), Validators.max(1)] }),
    content: new FormControl('', { nonNullable: true, validators: Validators.maxLength(2000) }),
  });
  readonly reportForm = new FormGroup({
    reason: new FormControl<ReportReason | ''>('', { nonNullable: true, validators: Validators.required }),
    description: new FormControl('', { nonNullable: true, validators: Validators.maxLength(2000) }),
  });
  private docId = 0;

  ngOnInit(): void {
    this.docId = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(this.docId) || this.docId < 1) {
      this.loading.set(false); this.error.set('Mã tài liệu không hợp lệ.'); return;
    }
    this.service.get(this.docId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (document) => {
        if (document.status && document.status !== 'APPROVED') {
          this.error.set('Tài liệu này hiện không khả dụng.');
        } else {
          this.document.set(document);
          this.reviewForm.controls.rating.setValue(document.myRating ?? null);
          this.service.registerView(this.docId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => undefined });
        }
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.error.set('Không tìm thấy tài liệu.'); },
    });
    this.loadReviews(0);
  }

  uploaderInitials(doc: Document): string {
    return doc.uploader?.fullName.split(' ').map((part) => part[0]).slice(-2).join('').toUpperCase() || 'SV';
  }
  submitReport(): void {
    const doc = this.document();
    this.reportForm.markAllAsTouched();
    if (!doc || this.reportForm.invalid || this.reportLoading()) return;
    this.reportLoading.set(true);
    this.reportMessage.set('');
    this.reportSubmitted.set(false);
    const { reason, description } = this.reportForm.getRawValue();
    if (!reason) {
      this.reportLoading.set(false);
      return;
    }
    this.service.report(doc.id, reason, description).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.reportLoading.set(false);
        this.reportSubmitted.set(true);
        this.reportMessage.set('Báo cáo đã được gửi để quản trị viên xem xét.');
        this.reportOpen.set(false);
        this.reportForm.reset({ reason: '', description: '' });
      },
      error: (error: { error?: { message?: string } }) => {
        this.reportLoading.set(false);
        this.reportSubmitted.set(false);
        this.reportMessage.set(error.error?.message || 'Không thể gửi báo cáo. Vui lòng thử lại.');
      },
    });
  }
  trustClass(doc: Document): string { return trustClass(doc); }
  trustLabel(doc: Document): string { return trustLabel(doc); }
  helpfulPercent(doc: Document): string { return helpfulPercent(doc); }
  openLink(): void {
    const doc = this.document();
    if (!doc) return;
    this.linkMessage.set('');
    this.service.access(doc.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (link) => {
        const url = new URL(link.externalUrl);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          this.linkMessage.set('Liên kết tài liệu không hợp lệ.');
          return;
        }
        window.location.assign(url.href);
      },
      error: (error: { error?: { message?: string } }) => {
        this.linkMessage.set(error.error?.message || 'Không thể mở liên kết tài liệu.');
      },
    });
  }
  toggleFavorite(): void {
    const doc = this.document();
    if (!doc) return;
    const request = doc.isFavorite ? this.service.unfavorite(doc.id) : this.service.favorite(doc.id);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.document.update((current) => current ? { ...current, isFavorite: !current.isFavorite } : current),
      error: () => { this.reviewMessage.set('Không thể cập nhật yêu thích.'); this.reviewSaved.set(false); },
    });
  }
  loadReviews(page: number): void {
    if (page < 0) return;
    this.reviewsLoading.set(true);
    this.service.reviews(this.docId, page, 10).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.reviews.set(pageItems(response));
        if (!Array.isArray(response)) this.reviewPages.set(response.totalPages || 1);
        this.reviewPage.set(page);
        this.reviewsLoading.set(false);
      },
      error: () => { this.reviews.set([]); this.reviewsLoading.set(false); },
    });
  }
  editReview(review: Review): void {
    this.editingReview.set(review.id);
    this.reviewForm.setValue({ rating: review.rating, content: review.content ?? '' });
    this.reviewMessage.set('');
  }
  deleteReview(review: Review): void {
    if (!window.confirm('Bạn có chắc muốn xóa nhận xét này?')) return;
    this.service.deleteReview(review.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.reviewMessage.set('Đã xóa nhận xét.'); this.reviewSaved.set(true);
        this.loadReviews(this.reviewPage());
        this.service.get(this.docId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (doc) => this.document.set(doc) });
      },
      error: (error: { error?: { message?: string } }) => {
        this.reviewMessage.set(error.error?.message || 'Không thể xóa nhận xét.'); this.reviewSaved.set(false);
      },
    });
  }
  submitReview(): void {
    this.reviewForm.markAllAsTouched();
    if (this.reviewForm.invalid || this.reviewLoading()) return;
    this.reviewLoading.set(true);
    const { rating, content } = this.reviewForm.getRawValue();
    if (rating === null) return;
    const request = this.editingReview()
      ? this.service.updateReview(this.editingReview()!, rating, content)
      : this.service.submitReview(this.docId, rating, content);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        const wasEditing = this.editingReview() !== null;
        this.reviewLoading.set(false); this.reviewMessage.set(wasEditing ? 'Đã cập nhật nhận xét.' : 'Cảm ơn bạn đã gửi đánh giá.'); this.reviewSaved.set(true);
        this.editingReview.set(null);
        this.document.update((current) => current ? { ...current, myRating: rating } : current);
        this.reviewForm.reset({ rating, content: '' });
        this.loadReviews(wasEditing ? this.reviewPage() : 0);
        this.service.get(this.docId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (doc) => this.document.set(doc) });
      },
      error: (error: { error?: { message?: string } }) => {
        this.reviewLoading.set(false); this.reviewMessage.set(error.error?.message || 'Không thể gửi đánh giá.'); this.reviewSaved.set(false);
      },
    });
  }
}
