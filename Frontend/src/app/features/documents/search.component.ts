import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { LucideArrowDownWideNarrow, LucideDownload, LucideFileText, LucideGrid2X2, LucideHeart, LucideList, LucideSearch, LucideSlidersHorizontal, LucideStar, LucideX } from '@lucide/angular';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { Document, DocumentQuery, DocumentSort, Faculty, Major, Course, AcademicTerm, DocumentCategory, Lecturer } from '../../core/models/api.models';
import { pageItems } from '../../core/services/api.service';
import { CatalogService } from '../../core/services/catalog.service';
import { DocumentService } from '../../core/services/document.service';
import { helpfulPercent as formatHelpfulPercent } from '../../core/utils/document-ui.utils';

type SearchForm = {
  q: FormControl<string>;
  facultyId: FormControl<string>;
  majorId: FormControl<string>;
  courseId: FormControl<string>;
  lecturerId: FormControl<string>;
  termId: FormControl<string>;
  categoryCode: FormControl<string>;
};

@Component({
  selector: 'app-search',
  imports: [DatePipe, RouterLink, FormsModule, ReactiveFormsModule, LucideArrowDownWideNarrow, LucideDownload, LucideFileText, LucideGrid2X2, LucideHeart, LucideList, LucideSearch, LucideSlidersHorizontal, LucideStar, LucideX],
  template: `
    <div class="search-page">
      <div class="page-title-row"><div><span class="eyebrow">KHO HỌC LIỆU DUT</span><h1>Tìm tài liệu</h1><p class="muted">Tìm kiếm học liệu phù hợp cho hành trình học tập của bạn.</p></div><a class="btn btn-primary" routerLink="/documents/upload"><span>＋</span> Chia sẻ tài liệu</a></div>
      <form class="search-bar search-main-bar" [formGroup]="form" (ngSubmit)="submitSearch()"><svg lucideSearch></svg><input formControlName="q" placeholder="Tên tài liệu, môn học, mã môn hoặc giảng viên..." /><button class="btn btn-primary" type="submit">Tìm kiếm</button></form>
      <div class="search-layout">
        <aside class="filter-panel">
          <div class="filter-heading"><span><svg lucideSlidersHorizontal></svg>Bộ lọc</span><button class="text-button" type="button" (click)="clearFilters()">Xóa tất cả</button></div>
          <form [formGroup]="form" class="filter-fields">
            <label class="filter-label">Khoa<select formControlName="facultyId"><option value="">Tất cả khoa</option>@for (item of faculties(); track item.id) { <option [value]="item.id">{{ item.name }}</option> }</select></label>
            <label class="filter-label">Chuyên ngành<select formControlName="majorId" [disabled]="!form.controls.facultyId.value"><option value="">Tất cả chuyên ngành</option>@for (item of majors(); track item.id) { <option [value]="item.id">{{ item.name }}</option> }</select></label>
            <label class="filter-label">Môn học<select formControlName="courseId" [disabled]="!form.controls.majorId.value"><option value="">Tất cả môn học</option>@for (item of courses(); track item.id) { <option [value]="item.id">{{ item.code }} · {{ item.name }}</option> }</select></label>
            <label class="filter-label">Học kỳ<select formControlName="termId"><option value="">Tất cả học kỳ</option>@for (item of terms(); track item.id) { <option [value]="item.id">{{ item.name }}</option> }</select></label>
            <label class="filter-label">Giảng viên<select formControlName="lecturerId"><option value="">Tất cả giảng viên</option>@for (item of lecturers(); track item.id) { <option [value]="item.id">{{ item.fullName }}</option> }</select></label>
            <label class="filter-label">Loại tài liệu<select formControlName="categoryCode"><option value="">Tất cả loại tài liệu</option>@for (item of categories(); track item.code) { <option [value]="item.code">{{ item.name }}</option> }</select></label>
          </form>
          <div class="filter-help"><span>ⓘ</span> Bộ lọc chuyên ngành và môn học được liên kết theo dữ liệu đào tạo.</div>
        </aside>
        <section class="results-area">
          @if (activeChips().length) { <div class="filter-chips">@for (chip of activeChips(); track chip.key) { <button class="filter-chip" (click)="removeFilter(chip.key)">{{ chip.label }} <svg lucideX></svg></button> }</div> }
          <div class="results-toolbar"><div><strong>{{ totalLabel }}</strong><span class="muted"> · {{ currentPage() + 1 }} / {{ pageCount() }} trang</span></div><div class="toolbar-actions"><label class="sort-select"><svg lucideArrowDownWideNarrow></svg><select [value]="sort()" (change)="changeSort($any($event.target).value)"><option value="recent">Mới nhất</option><option value="popular">Phổ biến</option><option value="helpful">Hữu ích</option><option value="accessed">Nhiều lượt mở</option></select></label><div class="view-toggle"><button [class.view-active]="viewMode() === 'grid'" aria-label="Dạng lưới" (click)="viewMode.set('grid')"><svg lucideGrid2X2></svg></button><button [class.view-active]="viewMode() === 'list'" aria-label="Dạng danh sách" (click)="viewMode.set('list')"><svg lucideList></svg></button></div></div></div>
          @if (loading()) { <div class="results-grid" [class.results-list]="viewMode() === 'list'">@for (_ of [1,2,3,4,5,6]; track $index) { <div class="skeleton-card"><span class="skeleton-line"></span><span class="skeleton-line wide"></span><span class="skeleton-line"></span><span class="skeleton-line short"></span></div> }</div> }
          @else if (error()) { <div class="empty-state error-state"><span class="empty-icon">!</span><strong>Không thể tải kết quả</strong><p>{{ error() }}</p><button class="btn btn-outline" (click)="refresh()">Thử lại</button></div> }
          @else if (documents().length) { <div class="results-grid" [class.results-list]="viewMode() === 'list'">
            @for (doc of documents(); track doc.id) {
              <article class="result-card">
                <div class="result-card-head"><span class="doc-type">{{ doc.category?.name || doc.categoryCode || 'Tài liệu' }}</span><button class="icon-button favorite-button" aria-label="Lưu yêu thích" (click)="toggleFavorite(doc, $event)"><svg lucideHeart></svg></button></div>
                <a class="result-title" [routerLink]="['/documents', doc.id]">{{ doc.title }}</a>
                @if (doc.description) { <p class="result-description">{{ doc.description }}</p> }
                <div class="result-course"><span class="course-code">{{ doc.course?.code || 'HỌC LIỆU' }}</span><span>{{ doc.course?.name || 'Chưa gắn môn học' }}</span></div>
                <div class="result-meta">
                  @if (doc.major?.faculty?.name || doc.major?.name) { <span>{{ doc.major?.faculty?.name }}{{ doc.major?.faculty?.name && doc.major?.name ? ' · ' : '' }}{{ doc.major?.name }}</span> }
                  @if (doc.courseOffering?.lecturer?.fullName) { <span>GV. {{ doc.courseOffering?.lecturer?.fullName }}</span> }
                  @if (doc.courseOffering?.academicTerm?.name) { <span>{{ doc.courseOffering?.academicTerm?.name }}</span> }
                </div>
                <div class="result-footer"><span>{{ doc.uploader?.fullName || 'Sinh viên DUT' }} <i>·</i> {{ doc.createdAt | date:'dd/MM/yyyy' }}</span><div class="doc-stats"><span><svg lucideDownload></svg>{{ doc.accessCount ?? '—' }}</span><span><svg lucideStar></svg>{{ formatHelpfulPercent(doc) }}</span><span><svg lucideFileText></svg>{{ doc.reviewCount ?? '—' }}</span></div></div>
              </article>
            }
          </div> }
          @else { <div class="empty-state"><span class="empty-icon"><svg lucideSearch></svg></span><strong>Chưa tìm thấy tài liệu phù hợp</strong><p>Thử thay đổi từ khóa hoặc xóa bớt bộ lọc để xem thêm kết quả.</p><button class="btn btn-outline" (click)="clearFilters()">Xóa bộ lọc</button></div> }
          @if (!loading() && documents().length && pageCount() > 1) { <nav class="pagination"><button class="page-button" [disabled]="currentPage() === 0" (click)="goToPage(currentPage() - 1)">‹</button>@for (page of visiblePages; track page) { <button class="page-button" [class.page-current]="page === currentPage()" (click)="goToPage(page)">{{ page + 1 }}</button> }<button class="page-button" [disabled]="currentPage() + 1 >= pageCount()" (click)="goToPage(currentPage() + 1)">›</button></nav> }
        </section>
      </div>
    </div>
  `,
})
export class SearchComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly catalog = inject(CatalogService);
  private readonly documentService = inject(DocumentService);
  private readonly searches = new Subject<DocumentQuery>();
  readonly form = new FormGroup<SearchForm>({
    q: new FormControl('', { nonNullable: true }),
    facultyId: new FormControl('', { nonNullable: true }),
    majorId: new FormControl('', { nonNullable: true }),
    courseId: new FormControl('', { nonNullable: true }),
    lecturerId: new FormControl('', { nonNullable: true }),
    termId: new FormControl('', { nonNullable: true }),
    categoryCode: new FormControl('', { nonNullable: true }),
  });
  readonly faculties = signal<Faculty[]>([]);
  readonly majors = signal<Major[]>([]);
  readonly courses = signal<Course[]>([]);
  readonly terms = signal<AcademicTerm[]>([]);
  readonly lecturers = signal<Lecturer[]>([]);
  readonly categories = signal<DocumentCategory[]>([]);
  readonly documents = signal<Document[]>([]);
  readonly totalElements = signal(0);
  readonly currentPage = signal(0);
  readonly pageCount = signal(1);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly sort = signal<DocumentSort>('recent');
  readonly viewMode = signal<'grid' | 'list'>('grid');
  readonly formatHelpfulPercent = formatHelpfulPercent;
  readonly activeChips = computed(() => {
    const values = this.form.getRawValue();
    const result: { key: keyof SearchForm; label: string }[] = [];
    if (values.q) result.push({ key: 'q', label: `Từ khóa: ${values.q}` });
    const faculty = this.faculties().find((item) => item.id === Number(values.facultyId));
    if (faculty) result.push({ key: 'facultyId', label: faculty.name });
    const major = this.majors().find((item) => item.id === Number(values.majorId));
    if (major) result.push({ key: 'majorId', label: major.name });
    const course = this.courses().find((item) => item.id === Number(values.courseId));
    if (course) result.push({ key: 'courseId', label: course.name });
    const term = this.terms().find((item) => item.id === Number(values.termId));
    if (term) result.push({ key: 'termId', label: term.name });
    const lecturer = this.lecturers().find((item) => item.id === Number(values.lecturerId));
    if (lecturer) result.push({ key: 'lecturerId', label: lecturer.fullName });
    const category = this.categories().find((item) => item.code === values.categoryCode);
    if (category) result.push({ key: 'categoryCode', label: category.name });
    return result;
  });

  ngOnInit(): void {
    this.catalog.faculties().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (data) => this.faculties.set(data), error: () => this.error.set('Không thể tải danh sách khoa.') });
    this.catalog.terms().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (data) => this.terms.set(data), error: () => this.error.set('Không thể tải danh sách học kỳ.') });
    this.catalog.categories().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (data) => this.categories.set(data), error: () => this.error.set('Không thể tải loại tài liệu.') });
    this.searches.pipe(
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      switchMap((query) => {
        this.loading.set(true);
        this.error.set('');
        return this.documentService.search(query).pipe(map((response) => ({ response, query })), catchError(() => of({ response: null, query })));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ response }) => {
      if (response === null) {
        this.error.set('Đã xảy ra lỗi khi kết nối máy chủ. Vui lòng thử lại.');
        this.documents.set([]);
        this.totalElements.set(0);
      } else {
        const list = pageItems(response);
        this.documents.set(list);
        if (Array.isArray(response)) {
          this.totalElements.set(list.length);
          this.pageCount.set(1);
        } else {
          this.totalElements.set(response.totalElements ?? list.length);
          this.pageCount.set(response.totalPages || 1);
        }
      }
      this.loading.set(false);
    });
    this.route.queryParamMap.pipe(
      map((params) => ({
        q: params.get('q') ?? '',
        facultyId: params.get('facultyId') ?? '',
        majorId: params.get('majorId') ?? '',
        courseId: params.get('courseId') ?? '',
        lecturerId: params.get('lecturerId') ?? '',
        termId: params.get('termId') ?? '',
        categoryCode: params.get('categoryCode') ?? '',
        sort: (params.get('sort') as DocumentSort | null) ?? 'recent',
        page: Number(params.get('page') ?? 0),
      })),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((state) => {
      this.form.patchValue({
        q: state.q, facultyId: state.facultyId, majorId: state.majorId, courseId: state.courseId,
        lecturerId: state.lecturerId, termId: state.termId, categoryCode: state.categoryCode,
      }, { emitEvent: false });
      this.sort.set(state.sort);
      this.currentPage.set(Number.isFinite(state.page) && state.page >= 0 ? state.page : 0);
      this.loadRelations(state.facultyId, state.majorId, state.courseId, state.termId);
      this.searches.next(this.buildQuery(state.page));
    });
    this.form.controls.facultyId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((id) => {
      this.form.patchValue({ majorId: '', courseId: '', lecturerId: '' }, { emitEvent: false });
      this.majors.set([]); this.courses.set([]);
      if (id) this.catalog.majors(Number(id)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (data) => this.majors.set(data), error: () => this.error.set('Không thể tải chuyên ngành của khoa.') });
      this.applyUrlState(0);
    });
    this.form.controls.majorId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((id) => {
      this.form.patchValue({ courseId: '', lecturerId: '' }, { emitEvent: false });
      this.courses.set([]);
      if (id) this.catalog.courses(Number(id)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (data) => this.courses.set(data), error: () => this.error.set('Không thể tải môn học của chuyên ngành.') });
      this.applyUrlState(0);
    });
    this.form.controls.courseId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.form.controls.lecturerId.setValue('', { emitEvent: false });
      this.loadLecturers();
      this.applyUrlState(0);
    });
    this.form.controls.termId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.form.controls.lecturerId.setValue('', { emitEvent: false });
      this.loadLecturers();
      this.applyUrlState(0);
    });
    for (const control of [this.form.controls.lecturerId, this.form.controls.categoryCode]) {
      control.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyUrlState(0));
    }
    this.form.controls.q.valueChanges.pipe(debounceTime(350), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyUrlState(0));
  }

  get totalLabel(): string {
    return `${this.totalElements().toLocaleString('vi-VN')} kết quả`;
  }
  get visiblePages(): number[] {
    const pages = this.pageCount();
    const start = Math.max(0, Math.min(this.currentPage() - 2, pages - 5));
    return Array.from({ length: Math.min(5, pages) }, (_, index) => start + index);
  }

  submitSearch(): void { this.applyUrlState(0); }
  changeSort(value: string): void {
    if (['recent', 'popular', 'helpful', 'accessed'].includes(value)) {
      this.sort.set(value as DocumentSort);
      this.applyUrlState(0);
    }
  }
  goToPage(page: number): void { this.applyUrlState(page); }
  refresh(): void { this.searches.next(this.buildQuery(this.currentPage())); }

  clearFilters(): void {
    this.form.reset({ q: '', facultyId: '', majorId: '', courseId: '', lecturerId: '', termId: '', categoryCode: '' }, { emitEvent: false });
    this.majors.set([]); this.courses.set([]); this.lecturers.set([]);
    this.sort.set('recent');
    void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: false });
  }

  removeFilter(key: keyof SearchForm): void {
    this.form.controls[key].setValue('');
  }

  toggleFavorite(document: Document, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const request = document.isFavorite ? this.documentService.unfavorite(document.id) : this.documentService.favorite(document.id);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.documents.update((list) => list.map((item) => item.id === document.id ? { ...item, isFavorite: !document.isFavorite } : item)),
      error: () => this.error.set('Không thể cập nhật danh sách yêu thích. Vui lòng thử lại.'),
    });
  }

  private loadRelations(facultyId: string, majorId: string, courseId: string, termId: string): void {
    if (facultyId) this.catalog.majors(Number(facultyId)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (data) => this.majors.set(data), error: () => this.error.set('Không thể tải chuyên ngành.') });
    else this.majors.set([]);
    if (majorId) this.catalog.courses(Number(majorId)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (data) => this.courses.set(data), error: () => this.error.set('Không thể tải môn học.') });
    else this.courses.set([]);
    if (courseId || termId) this.loadLecturers(courseId, termId);
    else this.catalog.lecturers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (data) => this.lecturers.set(data), error: () => this.error.set('Không thể tải giảng viên.') });
  }

  private loadLecturers(courseId = this.form.controls.courseId.value, termId = this.form.controls.termId.value): void {
    this.catalog.lecturers(undefined, courseId ? Number(courseId) : undefined, termId ? Number(termId) : undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (data) => this.lecturers.set(data), error: () => this.error.set('Không thể tải giảng viên.') });
  }

  private buildQuery(page: number): DocumentQuery {
    const values = this.form.getRawValue();
    return {
      q: values.q.trim() || undefined,
      facultyId: values.facultyId ? Number(values.facultyId) : undefined,
      majorId: values.majorId ? Number(values.majorId) : undefined,
      courseId: values.courseId ? Number(values.courseId) : undefined,
      lecturerId: values.lecturerId ? Number(values.lecturerId) : undefined,
      termId: values.termId ? Number(values.termId) : undefined,
      categoryCode: values.categoryCode || undefined,
      sort: this.sort(),
      page,
      size: 12,
    };
  }

  private applyUrlState(page: number): void {
    const query = this.buildQuery(page);
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '' && !(key === 'page' && value === 0) && !(key === 'size' && value === 12)) params[key] = value;
    }
    void this.router.navigate([], { relativeTo: this.route, queryParams: params });
  }
}
