import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideArrowLeft, LucideCheck, LucideExternalLink, LucideUpload } from '@lucide/angular';
import {
  AcademicTerm,
  Course,
  CourseOffering,
  DocumentCategory,
  Faculty,
  Major,
} from '../../core/models/api.models';
import { CatalogService } from '../../core/services/catalog.service';
import { DocumentService } from '../../core/services/document.service';

@Component({
  selector: 'app-upload',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideArrowLeft,
    LucideCheck,
    LucideExternalLink,
    LucideUpload,
  ],
  template: `
    <div class="form-page">
      <a class="back-link" routerLink="/documents"
        ><svg lucideArrowLeft></svg> Quay lại kho tài liệu</a
      >
      <div class="page-title-row upload-title">
        <div>
          <span class="eyebrow">ĐÓNG GÓP TRI THỨC</span>
          <h1>Chia sẻ tài liệu</h1>
          <p class="muted">Chia sẻ liên kết tài liệu hữu ích với cộng đồng sinh viên DUT.</p>
        </div>
        <span class="step-indicator"><i></i> Tài liệu sẽ được kiểm duyệt</span>
      </div>
      @if (error()) {
        <div class="alert alert-error">{{ error() }}</div>
      }
      @if (success()) {
        <div class="alert alert-success"><svg lucideCheck></svg>{{ success() }}</div>
      }
      <form class="upload-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <section class="form-section">
          <div class="form-section-heading">
            <span class="section-number">01</span>
            <div>
              <h2>Thông tin cơ bản</h2>
              <p>Giúp mọi người hiểu nhanh nội dung tài liệu.</p>
            </div>
          </div>
          <div class="form-fields">
            <label class="field-label full-field"
              >Tên tài liệu <span class="required">*</span
              ><input
                class="form-input"
                formControlName="title"
                placeholder="Ví dụ: Đề cương ôn tập Cấu trúc dữ liệu"
                maxlength="180"
            /></label>
            @if (form.controls.title.touched && form.controls.title.invalid) {
              <span class="field-error full-field"
                >Tên tài liệu là bắt buộc (tối đa 180 ký tự).</span
              >
            }
            <label class="field-label full-field"
              >Mô tả<textarea
                class="form-input textarea"
                formControlName="description"
                rows="4"
                maxlength="500"
                placeholder="Mô tả ngắn về nội dung, phạm vi kiến thức hoặc lưu ý khi sử dụng..."
              ></textarea>
            </label>
            <span class="char-counter full-field"
              >{{ form.controls.description.value.length }}/500 ký tự</span
            >
            <label class="field-label"
              >Loại tài liệu <span class="required">*</span
              ><select class="form-input" formControlName="categoryCode">
                <option value="">Chọn loại tài liệu</option>
                @for (item of categories(); track item.code) {
                  <option [value]="item.code">{{ item.name }}</option>
                }
              </select></label
            >
            @if (form.controls.categoryCode.touched && form.controls.categoryCode.invalid) {
              <span class="field-error">Vui lòng chọn loại tài liệu.</span>
            }
          </div>
        </section>
        <section class="form-section">
          <div class="form-section-heading">
            <span class="section-number">02</span>
            <div>
              <h2>Thông tin học thuật</h2>
              <p>Chọn đúng dữ liệu đào tạo để tài liệu dễ được tìm thấy.</p>
            </div>
          </div>
          <div class="form-fields">
            <label class="field-label"
              >Khoa <span class="required">*</span
              ><select
                class="form-input"
                [value]="selectedFaculty()"
                (change)="selectFaculty($any($event.target).value)"
              >
                <option value="">Chọn khoa</option>
                @for (item of faculties(); track item.id) {
                  <option [value]="item.id">{{ item.name }}</option>
                }
              </select></label
            >
            <label class="field-label"
              >Chuyên ngành <span class="required">*</span
              ><select class="form-input" formControlName="majorId" [disabled]="!selectedFaculty()">
                <option value="">Chọn chuyên ngành</option>
                @for (item of majors(); track item.id) {
                  <option [value]="item.id">{{ item.name }}</option>
                }
              </select></label
            >
            <label class="field-label"
              >Môn học <span class="required">*</span
              ><select
                class="form-input"
                formControlName="courseId"
                [disabled]="!form.controls.majorId.value"
              >
                <option value="">Chọn môn học</option>
                @for (item of courses(); track item.id) {
                  <option [value]="item.id">{{ item.code }} · {{ item.name }}</option>
                }
              </select></label
            >
            <label class="field-label"
              >Học kỳ<select class="form-input" formControlName="termId">
                <option value="">Chọn học kỳ (không bắt buộc)</option>
                @for (item of terms(); track item.id) {
                  <option [value]="item.id">{{ item.name }}</option>
                }
              </select></label
            >
            <label class="field-label full-field"
              >Lớp học phần / Giảng viên
              <select
                class="form-input"
                formControlName="courseOfferingId"
                [disabled]="!form.controls.courseId.value"
              >
                <option value="">Chưa xác định lớp học phần</option>
                @for (item of offerings(); track item.id) {
                  <option [value]="item.id">
                    {{ item.classCode }} · {{ item.lecturer.fullName }} ·
                    {{ item.academicTerm.name }}
                  </option>
                }</select
              ><small class="field-hint"
                >Lớp học phần xác định giảng viên. Có thể để trống nếu chưa xác định.</small
              ></label
            >
          </div>
        </section>
        <section class="form-section">
          <div class="form-section-heading">
            <span class="section-number">03</span>
            <div>
              <h2>Liên kết tài liệu</h2>
              <p>
                Dán liên kết Google Drive, OneDrive hoặc nơi lưu trữ khác mà bạn đã bật quyền chia
                sẻ.
              </p>
            </div>
          </div>
          <div class="form-fields">
            <label class="field-label full-field"
              >Liên kết tài liệu <span class="required">*</span
              ><input
                class="form-input"
                type="url"
                formControlName="externalUrl"
                maxlength="1000"
                placeholder="https://drive.google.com/file/d/..."
            /></label>
            @if (form.controls.externalUrl.touched && form.controls.externalUrl.invalid) {
              <span class="field-error full-field"
                >Nhập liên kết hợp lệ bắt đầu bằng http:// hoặc https://, không có khoảng trắng (tối
                đa 1000 ký tự).</span
              >
            } @else if (sourceLabel(); as source) {
              <span class="field-hint full-field"
                ><svg lucideExternalLink></svg> Nguồn lưu trữ nhận diện được:
                <b>{{ source }}</b></span
              >
            }
            <label class="field-label full-field"
              >Lưu ý quyền truy cập<input
                class="form-input"
                formControlName="accessNote"
                maxlength="255"
                placeholder="Ví dụ: Cần đăng nhập bằng email sinh viên DUT để xem"
            /></label>
            <label class="checkbox-label full-field"
              ><input type="checkbox" formControlName="isShareConfirmed" /><span
                >Tôi xác nhận đã bật quyền chia sẻ cho liên kết này và có quyền chia sẻ nội dung tài
                liệu. <span class="required">*</span></span
              ></label
            >
            @if (form.controls.isShareConfirmed.touched && form.controls.isShareConfirmed.invalid) {
              <span class="field-error full-field"
                >Bạn cần xác nhận quyền chia sẻ trước khi gửi.</span
              >
            }
          </div>
        </section>
        <div class="form-submit-row">
          <p><span class="required">*</span> Thông tin bắt buộc</p>
          <div>
            <button class="btn btn-outline" type="button" routerLink="/documents">Hủy</button
            ><button class="btn btn-primary" type="submit" [disabled]="loading()">
              {{ loading() ? 'Đang gửi…' : 'Gửi tài liệu duyệt' }} <svg lucideUpload></svg>
            </button>
          </div>
        </div>
      </form>
    </div>
  `,
})
export class UploadComponent implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly service = inject(DocumentService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly faculties = signal<Faculty[]>([]);
  readonly majors = signal<Major[]>([]);
  readonly courses = signal<Course[]>([]);
  readonly terms = signal<AcademicTerm[]>([]);
  readonly offerings = signal<CourseOffering[]>([]);
  readonly categories = signal<DocumentCategory[]>([]);
  readonly selectedFaculty = signal('');
  readonly error = signal('');
  readonly success = signal('');
  readonly loading = signal(false);
  readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(180)],
    }),
    description: new FormControl('', { nonNullable: true, validators: Validators.maxLength(500) }),
    categoryCode: new FormControl('', { nonNullable: true, validators: Validators.required }),
    majorId: new FormControl('', { nonNullable: true, validators: Validators.required }),
    courseId: new FormControl('', { nonNullable: true, validators: Validators.required }),
    termId: new FormControl('', { nonNullable: true }),
    courseOfferingId: new FormControl('', { nonNullable: true }),
    externalUrl: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(1000),
        Validators.pattern(/^https?:\/\/\S+$/i),
      ],
    }),
    accessNote: new FormControl('', { nonNullable: true, validators: Validators.maxLength(255) }),
    isShareConfirmed: new FormControl(false, {
      nonNullable: true,
      validators: Validators.requiredTrue,
    }),
  });

  ngOnInit(): void {
    this.catalog
      .faculties()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.faculties.set(data),
        error: () => this.error.set('Không thể tải danh sách khoa.'),
      });
    this.catalog
      .terms()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.terms.set(data),
        error: () => this.error.set('Không thể tải học kỳ.'),
      });
    this.catalog
      .categories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.categories.set(data),
        error: () => this.error.set('Không thể tải loại tài liệu.'),
      });
    this.form.controls.majorId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        this.form.patchValue({ courseId: '', courseOfferingId: '' }, { emitEvent: false });
        this.courses.set([]);
        this.offerings.set([]);
        if (id)
          this.catalog
            .courses(Number(id))
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (data) => this.courses.set(data),
              error: () => this.error.set('Không thể tải môn học của chuyên ngành.'),
            });
      });
    this.form.controls.courseId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        this.form.controls.courseOfferingId.setValue('', { emitEvent: false });
        this.offerings.set([]);
        if (id) this.loadOfferings(Number(id), this.form.controls.termId.value);
      });
    this.form.controls.termId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((termId) => {
        this.form.controls.courseOfferingId.setValue('', { emitEvent: false });
        const courseId = this.form.controls.courseId.value;
        if (courseId) this.loadOfferings(Number(courseId), termId);
      });
  }

  selectFaculty(id: string): void {
    this.selectedFaculty.set(id);
    this.majors.set([]);
    this.courses.set([]);
    this.offerings.set([]);
    this.form.patchValue({ majorId: '', courseId: '', courseOfferingId: '' });
    if (id)
      this.catalog
        .majors(Number(id))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (data) => this.majors.set(data),
          error: () => this.error.set('Không thể tải chuyên ngành của khoa.'),
        });
  }

  /** Gợi ý nguồn lưu trữ cho người dùng (máy chủ vẫn tự nhận diện lại khi lưu). */
  sourceLabel(): string {
    const control = this.form.controls.externalUrl;
    if (!control.value || control.invalid) return '';
    try {
      const host = new URL(control.value).hostname.toLowerCase();
      if (host.endsWith('google.com')) return 'Google Drive';
      if (
        host === '1drv.ms' ||
        host === 'onedrive.live.com' ||
        host.endsWith('.sharepoint.com') ||
        host.endsWith('.onedrive.com')
      )
        return 'OneDrive';
      return 'Liên kết khác';
    } catch {
      return '';
    }
  }

  submit(): void {
    this.error.set('');
    this.success.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;
    const formValue = this.form.getRawValue();
    const majorId = Number(formValue.majorId);
    const courseId = Number(formValue.courseId);
    if (
      !this.majors().some((item) => item.id === majorId) ||
      !this.courses().some((item) => item.id === courseId)
    ) {
      this.error.set('Chuyên ngành hoặc môn học không thuộc quan hệ đã chọn. Vui lòng chọn lại.');
      return;
    }
    const offeringId = formValue.courseOfferingId ? Number(formValue.courseOfferingId) : null;
    if (offeringId && !this.offerings().some((item) => item.id === offeringId)) {
      this.error.set('Lớp học phần không hợp lệ với môn học và học kỳ đã chọn.');
      return;
    }
    this.loading.set(true);
    this.service
      .create({
        title: formValue.title.trim(),
        description: formValue.description.trim(),
        majorId,
        courseId,
        courseOfferingId: offeringId,
        categoryCode: formValue.categoryCode,
        externalUrl: formValue.externalUrl.trim(),
        accessNote: formValue.accessNote.trim(),
        isShareConfirmed: formValue.isShareConfirmed,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.success.set('Tài liệu đã được gửi và đang chờ quản trị viên duyệt.');
          void this.router.navigate(['/my-documents']);
        },
        error: (error: { error?: { message?: string } }) => {
          this.loading.set(false);
          this.error.set(
            error.error?.message ||
              'Gửi tài liệu không thành công. Vui lòng kiểm tra thông tin và thử lại.',
          );
        },
      });
  }

  private loadOfferings(courseId: number, termId: string): void {
    this.catalog
      .offerings(courseId, termId ? Number(termId) : undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.offerings.set(data),
        error: () => this.error.set('Không thể tải lớp học phần.'),
      });
  }
}
