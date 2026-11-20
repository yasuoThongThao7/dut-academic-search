import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideArrowLeft, LucideCheck, LucideCloudUpload, LucideFile, LucideUpload, LucideX } from '@lucide/angular';
import { AcademicTerm, Course, CourseOffering, DocumentCategory, Faculty, Major } from '../../core/models/api.models';
import { CatalogService } from '../../core/services/catalog.service';
import { DocumentService } from '../../core/services/document.service';

@Component({
  selector: 'app-upload',
  imports: [DecimalPipe, ReactiveFormsModule, RouterLink, LucideArrowLeft, LucideCheck, LucideCloudUpload, LucideFile, LucideUpload, LucideX],
  template: `
    <div class="form-page">
      <a class="back-link" routerLink="/documents"><svg lucideArrowLeft></svg> Quay lại kho tài liệu</a>
      <div class="page-title-row upload-title"><div><span class="eyebrow">ĐÓNG GÓP TRI THỨC</span><h1>Đăng tài liệu</h1><p class="muted">Chia sẻ tài liệu hữu ích với cộng đồng sinh viên DUT.</p></div><span class="step-indicator"><i></i> Tài liệu sẽ được kiểm duyệt</span></div>
      @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
      @if (success()) { <div class="alert alert-success"><svg lucideCheck></svg>{{ success() }}</div> }
      <form class="upload-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <section class="form-section">
          <div class="form-section-heading"><span class="section-number">01</span><div><h2>Thông tin cơ bản</h2><p>Giúp mọi người hiểu nhanh nội dung tài liệu.</p></div></div>
          <div class="form-fields">
            <label class="field-label full-field">Tên tài liệu <span class="required">*</span><input class="form-input" formControlName="title" placeholder="Ví dụ: Đề cương ôn tập Cấu trúc dữ liệu" maxlength="180" /></label>
            @if (form.controls.title.touched && form.controls.title.invalid) { <span class="field-error full-field">Tên tài liệu là bắt buộc (tối đa 180 ký tự).</span> }
            <label class="field-label full-field">Mô tả<textarea class="form-input textarea" formControlName="description" rows="4" placeholder="Mô tả ngắn về nội dung, phạm vi kiến thức hoặc lưu ý khi sử dụng..."></textarea></label>
            <label class="field-label">Loại tài liệu <span class="required">*</span><select class="form-input" formControlName="categoryCode"><option value="">Chọn loại tài liệu</option>@for (item of categories(); track item.code) { <option [value]="item.code">{{ item.name }}</option> }</select></label>
            @if (form.controls.categoryCode.touched && form.controls.categoryCode.invalid) { <span class="field-error">Vui lòng chọn loại tài liệu.</span> }
          </div>
        </section>
        <section class="form-section">
          <div class="form-section-heading"><span class="section-number">02</span><div><h2>Thông tin học thuật</h2><p>Chọn đúng dữ liệu đào tạo để tài liệu dễ được tìm thấy.</p></div></div>
          <div class="form-fields">
            <label class="field-label">Khoa <span class="required">*</span><select class="form-input" [value]="selectedFaculty()" (change)="selectFaculty($any($event.target).value)"><option value="">Chọn khoa</option>@for (item of faculties(); track item.id) { <option [value]="item.id">{{ item.name }}</option> }</select></label>
            <label class="field-label">Chuyên ngành <span class="required">*</span><select class="form-input" formControlName="majorId" [disabled]="!selectedFaculty()"><option value="">Chọn chuyên ngành</option>@for (item of majors(); track item.id) { <option [value]="item.id">{{ item.name }}</option> }</select></label>
            <label class="field-label">Môn học <span class="required">*</span><select class="form-input" formControlName="courseId" [disabled]="!form.controls.majorId.value"><option value="">Chọn môn học</option>@for (item of courses(); track item.id) { <option [value]="item.id">{{ item.code }} · {{ item.name }}</option> }</select></label>
            <label class="field-label">Học kỳ<select class="form-input" formControlName="termId"><option value="">Chọn học kỳ (không bắt buộc)</option>@for (item of terms(); track item.id) { <option [value]="item.id">{{ item.name }}</option> }</select></label>
            <label class="field-label full-field">Lớp học phần / Giảng viên <select class="form-input" formControlName="courseOfferingId" [disabled]="!form.controls.courseId.value"><option value="">Chưa xác định lớp học phần</option>@for (item of offerings(); track item.id) { <option [value]="item.id">{{ item.classCode }} · {{ item.lecturer.fullName }} · {{ item.academicTerm.name }}</option> }</select><small class="field-hint">Lớp học phần xác định giảng viên. Có thể để trống nếu chưa xác định.</small></label>
          </div>
        </section>
        <section class="form-section">
          <div class="form-section-heading"><span class="section-number">03</span><div><h2>Tệp tài liệu</h2><p>Tải lên tài liệu bạn muốn chia sẻ.</p></div></div>
          <div class="dropzone" [class.dropzone-active]="dragging()" (dragover)="onDragOver($event)" (dragleave)="dragging.set(false)" (drop)="onDrop($event)" (click)="fileInput.click()" role="button" tabindex="0" (keydown.enter)="fileInput.click()">
            <input #fileInput type="file" hidden (change)="onFileInput($event)" />
            @if (!file()) { <span class="drop-icon"><svg lucideCloudUpload></svg></span><strong>Kéo thả tệp vào đây</strong><span>hoặc <b>chọn tệp từ thiết bị</b></span><small>Chọn tệp bạn có quyền chia sẻ. Định dạng và dung lượng tùy theo máy chủ hỗ trợ.</small> }
            @else { <span class="file-icon"><svg lucideFile></svg></span><div class="file-info"><strong>{{ file()?.name }}</strong><small>{{ file()?.size | number:'1.0-2' }} bytes</small></div><button class="icon-button" type="button" aria-label="Xóa tệp" (click)="removeFile($event)"><svg lucideX></svg></button> }
          </div>
          @if (fileError()) { <span class="field-error">{{ fileError() }}</span> }
        </section>
        <div class="form-submit-row"><p><span class="required">*</span> Thông tin bắt buộc</p><div><button class="btn btn-outline" type="button" routerLink="/documents">Hủy</button><button class="btn btn-primary" type="submit" [disabled]="loading()">{{ loading() ? 'Đang tải lên…' : 'Gửi tài liệu duyệt' }} <svg lucideUpload></svg></button></div></div>
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
  readonly file = signal<File | null>(null);
  readonly fileError = signal('');
  readonly error = signal('');
  readonly success = signal('');
  readonly loading = signal(false);
  readonly dragging = signal(false);
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(180)] }),
    description: new FormControl('', { nonNullable: true }),
    categoryCode: new FormControl('', { nonNullable: true, validators: Validators.required }),
    majorId: new FormControl('', { nonNullable: true, validators: Validators.required }),
    courseId: new FormControl('', { nonNullable: true, validators: Validators.required }),
    termId: new FormControl('', { nonNullable: true }),
    courseOfferingId: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.catalog.faculties().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (data) => this.faculties.set(data), error: () => this.error.set('Không thể tải danh sách khoa.') });
    this.catalog.terms().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (data) => this.terms.set(data), error: () => this.error.set('Không thể tải học kỳ.') });
    this.catalog.categories().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (data) => this.categories.set(data), error: () => this.error.set('Không thể tải loại tài liệu.') });
    this.form.controls.majorId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((id) => {
      this.form.patchValue({ courseId: '', courseOfferingId: '' }, { emitEvent: false });
      this.courses.set([]); this.offerings.set([]);
      if (id) this.catalog.courses(Number(id)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (data) => this.courses.set(data), error: () => this.error.set('Không thể tải môn học của chuyên ngành.') });
    });
    this.form.controls.courseId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((id) => {
      this.form.controls.courseOfferingId.setValue('', { emitEvent: false });
      this.offerings.set([]);
      if (id) this.loadOfferings(Number(id), this.form.controls.termId.value);
    });
    this.form.controls.termId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((termId) => {
      this.form.controls.courseOfferingId.setValue('', { emitEvent: false });
      const courseId = this.form.controls.courseId.value;
      if (courseId) this.loadOfferings(Number(courseId), termId);
    });
  }

  selectFaculty(id: string): void {
    this.selectedFaculty.set(id);
    this.majors.set([]); this.courses.set([]); this.offerings.set([]);
    this.form.patchValue({ majorId: '', courseId: '', courseOfferingId: '' });
    if (id) this.catalog.majors(Number(id)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (data) => this.majors.set(data), error: () => this.error.set('Không thể tải chuyên ngành của khoa.') });
  }

  onDragOver(event: DragEvent): void { event.preventDefault(); this.dragging.set(true); }
  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const dropped = event.dataTransfer?.files.item(0);
    if (dropped) this.setFile(dropped);
  }
  onFileInput(event: Event): void {
    const selected = (event.target as HTMLInputElement).files?.item(0);
    if (selected) this.setFile(selected);
  }
  removeFile(event: Event): void { event.stopPropagation(); this.file.set(null); this.fileError.set(''); }
  submit(): void {
    this.error.set(''); this.success.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.file() || this.loading()) {
      if (!this.file()) this.fileError.set('Vui lòng chọn tệp tài liệu.');
      return;
    }
    const formValue = this.form.getRawValue();
    const majorId = Number(formValue.majorId);
    const courseId = Number(formValue.courseId);
    if (!this.majors().some((item) => item.id === majorId) || !this.courses().some((item) => item.id === courseId)) {
      this.error.set('Chuyên ngành hoặc môn học không thuộc quan hệ đã chọn. Vui lòng chọn lại.');
      return;
    }
    const offeringId = formValue.courseOfferingId ? Number(formValue.courseOfferingId) : null;
    if (offeringId && !this.offerings().some((item) => item.id === offeringId)) {
      this.error.set('Lớp học phần không hợp lệ với môn học và học kỳ đã chọn.');
      return;
    }
    this.loading.set(true);
    this.service.upload({
      title: formValue.title.trim(),
      description: formValue.description.trim(),
      majorId,
      courseId,
      courseOfferingId: offeringId,
      categoryCode: formValue.categoryCode,
    }, this.file()!).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (document) => {
        this.loading.set(false);
        this.success.set('Tài liệu đã được tải lên và đang chờ quản trị viên duyệt.');
        void this.router.navigate(['/my-documents']);
      },
      error: (error: { error?: { message?: string } }) => {
        this.loading.set(false);
        this.error.set(error.error?.message || 'Tải tài liệu không thành công. Vui lòng kiểm tra thông tin và thử lại.');
      },
    });
  }

  private loadOfferings(courseId: number, termId: string): void {
    this.catalog.offerings(courseId, termId ? Number(termId) : undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (data) => this.offerings.set(data), error: () => this.error.set('Không thể tải lớp học phần.') });
  }
  private setFile(file: File): void {
    this.fileError.set('');
    this.file.set(file);
  }
}
