import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight, LucideBookOpen, LucideDownload, LucideFileText, LucideSearch, LucideStar, LucideUpload } from '@lucide/angular';
import { Document, Faculty, PopularCourse } from '../../core/models/api.models';
import { pageItems } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { CatalogService } from '../../core/services/catalog.service';
import { DocumentService } from '../../core/services/document.service';
import { helpfulPercent as formatHelpfulPercent } from '../../core/utils/document-ui.utils';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-home',
  imports: [DatePipe, RouterLink, FormsModule, LucideArrowRight, LucideBookOpen, LucideDownload, LucideFileText, LucideSearch, LucideStar, LucideUpload],
  template: `
    <div class="home-page">
      <section class="welcome-row"><div><span class="eyebrow">THỨC DẬY CÙNG TRI THỨC</span><h1>Xin chào, {{ firstName }} <span class="wave">✦</span></h1><p class="muted">Không gian học tập của bạn hôm nay thế nào?</p></div><div class="welcome-date">{{ today }}</div></section>
      <section class="hero-search">
        <div class="hero-copy"><span class="hero-kicker">DUT KNOWLEDGE HUB</span><h2>Tìm đúng tài liệu.<br><em>Học đúng trọng tâm.</em></h2><p>Khám phá tài liệu học tập được chia sẻ bởi cộng đồng sinh viên DUT.</p>
          <form class="hero-search-form" (ngSubmit)="search()"><svg lucideSearch></svg><input [(ngModel)]="query" name="query" placeholder="Tìm tên môn học, mã môn, giảng viên hoặc tài liệu..." /><button class="btn btn-primary" type="submit">Tìm kiếm <span>→</span></button></form>
          <div class="hero-meta"><span><svg lucideBookOpen></svg> Kho tài liệu học tập DUT</span><span><i></i> Cập nhật liên tục</span></div>
        </div><div class="hero-art"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="hero-book"><span class="book-emblem"><svg lucideBookOpen></svg></span><span class="book-lines"></span><span class="book-lines short"></span><span class="book-caption">LEARN<br>TOGETHER</span></div><div class="hero-float float-doc"><svg lucideFileText></svg></div><div class="hero-float float-star"><svg lucideStar></svg></div><div class="hero-float float-download"><svg lucideDownload></svg></div></div>
      </section>
      <section class="quick-actions"><a class="quick-card" routerLink="/documents"><span class="quick-icon quick-search"><svg lucideSearch></svg></span><span><strong>Tìm tài liệu</strong><small>Khám phá kho học liệu</small></span><svg class="quick-arrow" lucideArrowRight></svg></a><a class="quick-card" routerLink="/documents/upload"><span class="quick-icon quick-upload"><svg lucideUpload></svg></span><span><strong>Đăng tài liệu</strong><small>Chia sẻ cùng cộng đồng</small></span><svg class="quick-arrow" lucideArrowRight></svg></a><a class="quick-card" routerLink="/my-documents"><span class="quick-icon quick-files"><svg lucideFileText></svg></span><span><strong>Tài liệu của tôi</strong><small>Quản lý nội dung đã đăng</small></span><svg class="quick-arrow" lucideArrowRight></svg></a></section>
      <section class="content-section">
        <div class="section-heading"><div><span class="eyebrow">MỚI NHẤT TRONG KHO</span><h2>Tài liệu mới nhất</h2><p class="muted">Những chia sẻ vừa được cộng đồng đóng góp.</p></div><a class="link-action" routerLink="/documents" [queryParams]="{ sort: 'recent' }">Xem tất cả <svg lucideArrowRight></svg></a></div>
        @if (loading()) { <div class="document-grid">@for (_ of [1,2,3]; track $index) { <div class="skeleton-card"><span class="skeleton-line"></span><span class="skeleton-line wide"></span><span class="skeleton-line"></span></div> }</div> }
        @else if (error()) { <div class="empty-state"><strong>Chưa thể tải tài liệu</strong><p>{{ error() }}</p><button class="btn btn-outline" (click)="load()">Thử lại</button></div> }
        @else if (latest().length) { <div class="document-grid">@for (doc of latest(); track doc.id) { <a class="document-card" [routerLink]="['/documents', doc.id]"><div class="doc-card-top"><span class="doc-type">{{ doc.category?.name || doc.categoryCode || 'Tài liệu' }}</span><span class="doc-date">{{ doc.createdAt | date:'dd/MM/yyyy' }}</span></div><h3>{{ doc.title }}</h3><div class="doc-course">{{ doc.course?.code }}{{ doc.course?.code && doc.course?.name ? ' · ' : '' }}{{ doc.course?.name || 'Chưa gắn môn học' }}</div><div class="doc-card-footer"><span>{{ doc.uploader?.fullName || 'Sinh viên DUT' }}</span><span class="doc-stats"><span><svg lucideDownload></svg>{{ doc.accessCount ?? '—' }}</span><span><svg lucideStar></svg>{{ helpfulPercent(doc) }}</span></span></div></a> }</div> }
        @else { <div class="empty-state"><strong>Chưa có tài liệu mới</strong><p>Tài liệu đã được duyệt sẽ xuất hiện tại đây.</p></div> }
      </section>
      <section class="content-section">
        <div class="section-heading"><div><span class="eyebrow">ĐƯỢC CỘNG ĐỒNG QUAN TÂM</span><h2>Tài liệu phổ biến</h2><p class="muted">Những tài liệu được sinh viên tìm đọc nhiều.</p></div><a class="link-action" routerLink="/documents" [queryParams]="{ sort: 'popular' }">Xem tất cả <svg lucideArrowRight></svg></a></div>
        @if (popular().length) { <div class="document-grid">@for (doc of popular(); track doc.id) { <a class="document-card" [routerLink]="['/documents', doc.id]"><div class="doc-card-top"><span class="doc-type">{{ doc.category?.name || doc.categoryCode || 'Tài liệu' }}</span><span class="doc-date">{{ doc.createdAt | date:'dd/MM/yyyy' }}</span></div><h3>{{ doc.title }}</h3><div class="doc-course">{{ doc.course?.code }}{{ doc.course?.code && doc.course?.name ? ' · ' : '' }}{{ doc.course?.name || 'Chưa gắn môn học' }}</div><div class="doc-card-footer"><span>{{ doc.uploader?.fullName || 'Sinh viên DUT' }}</span><span class="doc-stats"><span><svg lucideDownload></svg>{{ doc.accessCount ?? '—' }}</span><span><svg lucideStar></svg>{{ helpfulPercent(doc) }}</span></span></div></a> }</div> }
        @else if (popularError()) { <div class="empty-state"><strong>Chưa thể tải tài liệu phổ biến</strong><p>{{ popularError() }}</p></div> }
        @else if (!loading()) { <div class="empty-state"><strong>Chưa có tài liệu phổ biến</strong><p>Dữ liệu sẽ được cập nhật theo hoạt động của sinh viên.</p></div> }
      </section>
      <section class="content-section">
        <div class="section-heading"><div><span class="eyebrow">ĐÁNH GIÁ TÍCH CỰC</span><h2>Tài liệu hữu ích</h2><p class="muted">Những tài liệu được cộng đồng đánh giá hữu ích.</p></div><a class="link-action" routerLink="/documents" [queryParams]="{ sort: 'helpful' }">Xem tất cả <svg lucideArrowRight></svg></a></div>
        @if (topRated().length) { <div class="document-grid">@for (doc of topRated(); track doc.id) { <a class="document-card" [routerLink]="['/documents', doc.id]"><div class="doc-card-top"><span class="doc-type">{{ doc.category?.name || doc.categoryCode || 'Tài liệu' }}</span><span class="doc-date">{{ doc.createdAt | date:'dd/MM/yyyy' }}</span></div><h3>{{ doc.title }}</h3><div class="doc-course">{{ doc.course?.code }}{{ doc.course?.code && doc.course?.name ? ' · ' : '' }}{{ doc.course?.name || 'Chưa gắn môn học' }}</div><div class="doc-card-footer"><span>{{ doc.uploader?.fullName || 'Sinh viên DUT' }}</span><span class="doc-stats"><span><svg lucideDownload></svg>{{ doc.accessCount ?? '—' }}</span><span><svg lucideStar></svg>{{ helpfulPercent(doc) }}</span></span></div></a> }</div> }
        @else if (topRatedError()) { <div class="empty-state"><strong>Chưa thể tải tài liệu đánh giá cao</strong><p>{{ topRatedError() }}</p></div> }
        @else if (!loading()) { <div class="empty-state"><strong>Chưa có tài liệu được đánh giá</strong><p>Đánh giá của cộng đồng sẽ hiển thị tại đây.</p></div> }
      </section>
      <section class="content-section">
        <div class="section-heading"><div><span class="eyebrow">MÔN HỌC ĐƯỢC QUAN TÂM</span><h2>Môn học phổ biến</h2><p class="muted">Xếp hạng theo số tài liệu đã được duyệt.</p></div></div>
        @if (popularCoursesLoading()) { <div class="table-skeleton"><span></span><span></span><span></span></div> }
        @else if (popularCourses().length) { <div class="subject-panel">@for (course of popularCourses(); track course.id) { <a class="faculty-row" routerLink="/documents" [queryParams]="{ courseId: course.id }"><span><strong>{{ course.code }} · {{ course.name }}</strong></span><span>{{ course.documentCount }} tài liệu</span></a> }</div> }
        @else if (popularCoursesError()) { <div class="empty-state"><strong>Chưa thể tải môn học phổ biến</strong><p>{{ popularCoursesError() }}</p></div> }
        @else { <div class="empty-state"><strong>Chưa có môn học nổi bật</strong><p>Dữ liệu sẽ xuất hiện khi có tài liệu được duyệt.</p></div> }
      </section>
      <section class="home-bottom-grid"><div class="subject-panel"><div class="section-heading compact-heading"><div><span class="eyebrow">KHÁM PHÁ THEO KHOA</span><h2>Khoa đào tạo</h2></div><svg lucideBookOpen></svg></div>@if (faculties().length) { @for (faculty of faculties(); track faculty.id) { <a class="faculty-row" routerLink="/documents" [queryParams]="{ facultyId: faculty.id }"><span>{{ faculty.name }}</span><svg lucideArrowRight></svg></a> } } @else { <p class="muted small-note">Danh mục khoa hiện chưa có dữ liệu.</p> }</div><div class="share-panel"><span class="share-mark">✦</span><span class="eyebrow eyebrow-light">CHUNG TAY XÂY DỰNG</span><h2>Tài liệu của bạn<br>có thể giúp ai đó.</h2><p>Một chia sẻ nhỏ hôm nay có thể tạo nên khác biệt lớn cho hành trình học tập của bạn bè.</p><a class="btn btn-light" routerLink="/documents/upload">Chia sẻ tài liệu <span>→</span></a></div></section>
    </div>
  `,
})
export class HomeComponent implements OnInit {
  private readonly documents = inject(DocumentService);
  private readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly latest = signal<Document[]>([]);
  readonly popular = signal<Document[]>([]);
  readonly topRated = signal<Document[]>([]);
  readonly popularError = signal('');
  readonly topRatedError = signal('');
  readonly faculties = signal<Faculty[]>([]);
  readonly popularCourses = signal<PopularCourse[]>([]);
  readonly popularCoursesLoading = signal(true);
  readonly popularCoursesError = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
  query = '';
  get firstName(): string { return this.auth.user()?.fullName.split(' ')[0] || 'bạn'; }
  get today(): string {
    return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  }
  helpfulPercent(doc: Document): string { return formatHelpfulPercent(doc); }

  ngOnInit(): void {
    this.load();
    this.documents.search({ sort: 'popular', page: 0, size: 3 }).subscribe({
      next: (data) => this.popular.set(pageItems(data)),
      error: () => this.popularError.set('Vui lòng thử tải lại trang sau.'),
    });
    this.documents.search({ sort: 'helpful', page: 0, size: 3 }).subscribe({
      next: (data) => this.topRated.set(pageItems(data)),
      error: () => this.topRatedError.set('Vui lòng thử tải lại trang sau.'),
    });
    this.catalog.faculties().subscribe({ next: (data) => this.faculties.set(data), error: () => this.faculties.set([]) });
    this.catalog.popularCourses().subscribe({
      next: (data) => { this.popularCourses.set(data); this.popularCoursesLoading.set(false); },
      error: () => { this.popularCoursesLoading.set(false); this.popularCoursesError.set('Không thể tải dữ liệu từ máy chủ.'); },
    });
  }

  load(): void {
    this.loading.set(true);
    this.documents.search({ sort: 'recent', page: 0, size: 3 }).subscribe({
      next: (data) => { this.latest.set(pageItems(data)); this.loading.set(false); this.error.set(''); },
      error: () => { this.loading.set(false); this.error.set('Vui lòng kiểm tra kết nối máy chủ rồi thử lại.'); },
    });
  }

  search(): void {
    void this.router.navigate(['/documents'], { queryParams: this.query.trim() ? { q: this.query.trim() } : {} });
  }
}
