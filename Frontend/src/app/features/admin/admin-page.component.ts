import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LucideArrowRight, LucideBookOpen, LucideCheck, LucideCircleAlert, LucideDownload, LucideFileText, LucidePlus, LucideRefreshCw, LucideSearch, LucideShieldCheck, LucideTrash2, LucideUsers, LucideX } from '@lucide/angular';
import { combineLatest, forkJoin } from 'rxjs';
import { ApiService, pageItems } from '../../core/services/api.service';
import { Course, DashboardStats, Document, DocumentReport, DocumentStatus, Faculty, Major, Page, User } from '../../core/models/api.models';

type AdminView = 'dashboard' | 'users' | 'moderation' | 'reports' | 'catalog';
type CatalogResource = 'faculties' | 'majors' | 'courses' | 'lecturers' | 'academic-terms' | 'course-offerings';

@Component({
  selector: 'app-admin-page',
  imports: [DatePipe, DecimalPipe, RouterLink, FormsModule, LucideArrowRight, LucideBookOpen, LucideCheck, LucideCircleAlert, LucideDownload, LucideFileText, LucidePlus, LucideRefreshCw, LucideSearch, LucideShieldCheck, LucideUsers, LucideX],
  template: `
    <div class="admin-page">
      @if (view() === 'dashboard') {
        <div class="page-title-row"><div><span class="eyebrow">TỔNG QUAN HỆ THỐNG</span><h1>Bảng điều khiển</h1><p class="muted">Theo dõi hoạt động nền tảng chia sẻ tài liệu DUT.</p></div><button class="icon-button refresh-button" (click)="loadDashboard()" aria-label="Làm mới"><svg lucideRefreshCw></svg></button></div>
        @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
        @if (loading()) { <div class="stats-grid">@for (_ of [1,2,3,4,5]; track $index) { <div class="stat-skeleton"></div> }</div> }
        @else if (stats(); as summary) { <div class="stats-grid"><article class="stat-card"><span class="stat-icon stat-blue"><svg lucideUsers></svg></span><small>TỔNG SINH VIÊN</small><strong>{{ summary.totalStudents | number }}</strong><span>Tài khoản đã cấp phát</span></article><article class="stat-card"><span class="stat-icon stat-violet"><svg lucideFileText></svg></span><small>TỔNG TÀI LIỆU</small><strong>{{ summary.totalDocuments | number }}</strong><span>Trong kho học liệu</span></article><article class="stat-card"><span class="stat-icon stat-amber"><svg lucideCircleAlert></svg></span><small>CHỜ DUYỆT</small><strong>{{ summary.pendingDocuments | number }}</strong><span>Cần được kiểm duyệt</span></article><article class="stat-card"><span class="stat-icon stat-green"><svg lucideShieldCheck></svg></span><small>ĐÃ DUYỆT</small><strong>{{ summary.approvedDocuments | number }}</strong><span>Tài liệu khả dụng</span></article><article class="stat-card"><span class="stat-icon stat-cyan"><svg lucideDownload></svg></span><small>TỔNG LƯỢT TẢI</small><strong>{{ summary.totalDownloads | number }}</strong><span>Lượt tải trong hệ thống</span></article><article class="stat-card"><span class="stat-icon stat-amber"><svg lucideCircleAlert></svg></span><small>BỊ TỪ CHỐI</small><strong>{{ summary.rejectedDocuments || 0 | number }}</strong><span>Tài liệu bị từ chối</span></article></div> }
        @if (stats()?.recentActivities?.length) { <section class="admin-panel"><div class="admin-panel-heading"><div><span class="eyebrow">HOẠT ĐỘNG HỆ THỐNG</span><h2>Hoạt động gần đây</h2></div></div>@for (activity of stats()?.recentActivities; track $index) { <div class="faculty-row"><span>{{ activity.description }}</span><small>{{ activity.createdAt | date:'dd/MM/yyyy HH:mm' }}</small></div> }</section> }
        <section class="admin-panel"><div class="admin-panel-heading"><div><span class="eyebrow">CẦN XỬ LÝ</span><h2>Tài liệu chờ kiểm duyệt</h2></div><a class="link-action" routerLink="/admin/documents">Xem tất cả <svg lucideArrowRight></svg></a></div>
          @if (pending().length) { <div class="table-wrap"><table class="data-table"><thead><tr><th>TÀI LIỆU</th><th>NGƯỜI ĐĂNG</th><th>MÔN HỌC</th><th>NGÀY GỬI</th><th></th></tr></thead><tbody>@for (doc of pending(); track doc.id) { <tr><td><strong>{{ doc.title }}</strong></td><td>{{ doc.uploader?.fullName || '—' }}</td><td>{{ doc.course?.name || '—' }}</td><td>{{ doc.createdAt | date:'dd/MM/yyyy' }}</td><td><button class="btn btn-outline btn-small" (click)="openModeration(doc)">Xem xét</button></td></tr> }</tbody></table></div> }
          @else if (!loading()) { <div class="table-empty">Hiện không có tài liệu chờ duyệt.</div> }
        </section>
      }

      @if (view() === 'users') {
        <div class="page-title-row"><div><span class="eyebrow">QUẢN LÝ TÀI KHOẢN</span><h1>Sinh viên</h1><p class="muted">Cấp phát và quản lý tài khoản sinh viên DUT.</p></div><button class="btn btn-primary" (click)="showUserForm.set(true)"><svg lucidePlus></svg> Cấp tài khoản</button></div>
        @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
        @if (createdCredential()) { <div class="credential-alert"><div><strong>Mật khẩu khởi tạo — chỉ hiển thị lần này</strong><p><code>{{ createdCredential() }}</code></p></div><button class="icon-button" (click)="createdCredential.set('')" aria-label="Đóng"><svg lucideX></svg></button></div> }
        <div class="list-toolbar"><label class="search-bar admin-search"><svg lucideSearch></svg><input [(ngModel)]="userQuery" (ngModelChange)="filterUsers()" placeholder="Tìm theo MSSV hoặc họ tên..." /></label><div class="list-filters"><select class="form-input" [ngModel]="facultyFilter()" (ngModelChange)="setFacultyFilter($event)" aria-label="Lọc theo khoa"><option [ngValue]="null">Tất cả khoa</option>@for (faculty of faculties(); track faculty.id) { <option [ngValue]="faculty.id">{{ faculty.name }}</option> }</select><select class="form-input" [ngModel]="majorFilter()" (ngModelChange)="setMajorFilter($event)" aria-label="Lọc theo chuyên ngành" [disabled]="!facultyFilter()"><option [ngValue]="null">Tất cả chuyên ngành</option>@for (major of filterMajors(); track major.id) { <option [ngValue]="major.id">{{ major.name }}</option> }</select><span class="muted">{{ filteredUsers().length }} tài khoản</span></div></div>
        @if (loading()) { <div class="table-skeleton"><span></span><span></span><span></span><span></span></div> }
        @else if (filteredUsers().length) { <div class="table-wrap"><table class="data-table"><thead><tr><th>SINH VIÊN</th><th>MSSV</th><th>KHOA / CHUYÊN NGÀNH</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr></thead><tbody>@for (user of filteredUsers(); track user.id) { <tr><td><div class="table-user"><span class="avatar">{{ user.fullName.slice(0,1) }}</span><strong>{{ user.fullName }}</strong></div></td><td>{{ user.studentId }}</td><td>{{ user.faculty?.name || '—' }}<small>{{ user.major?.name || '' }}</small></td><td><span class="status-badge" [class.status-approved]="user.active !== false" [class.status-rejected]="user.active === false">{{ user.active === false ? 'Đã khóa' : 'Đang hoạt động' }}</span></td><td><div class="table-actions"><button class="text-button" (click)="toggleUser(user)">{{ user.active === false ? 'Mở khóa' : 'Khóa' }}</button><button class="text-button" (click)="resetPassword(user)">Đặt lại mật khẩu</button></div></td></tr> }</tbody></table></div><nav class="pagination"><button class="page-button" [disabled]="usersPage() === 0" (click)="loadUsers(usersPage()-1)">‹</button><span class="muted">Trang {{ usersPage()+1 }} / {{ usersPages() }}</span><button class="page-button" [disabled]="usersPage()+1 >= usersPages()" (click)="loadUsers(usersPage()+1)">›</button></nav> }
        @else { <div class="empty-state"><span class="empty-icon"><svg lucideUsers></svg></span><strong>Không tìm thấy tài khoản</strong><p>Thử tìm theo MSSV hoặc họ tên khác.</p></div> }
      }

      @if (view() === 'moderation') {
        <div class="page-title-row"><div><span class="eyebrow">KIỂM SOÁT NỘI DUNG</span><h1>Kiểm duyệt tài liệu</h1><p class="muted">Xem xét chất lượng và trạng thái tài liệu được chia sẻ.</p></div><button class="icon-button refresh-button" (click)="loadModeration()" aria-label="Làm mới"><svg lucideRefreshCw></svg></button></div>
        <div class="tabs">@for (status of moderationStatuses; track status.value) { <button [class.tab-active]="moderationStatus() === status.value" (click)="setModerationStatus(status.value)">{{ status.label }}</button> }</div>
        @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
        @if (loading()) { <div class="table-skeleton"><span></span><span></span><span></span><span></span></div> }
        @else if (moderatedDocuments().length) { <div class="table-wrap"><table class="data-table"><thead><tr><th>TÀI LIỆU</th><th>NGƯỜI ĐĂNG</th><th>MÔN HỌC</th><th>NGÀY ĐĂNG</th><th>THAO TÁC</th></tr></thead><tbody>@for (doc of moderatedDocuments(); track doc.id) { <tr><td><strong>{{ doc.title }}</strong><small>{{ doc.category?.name || doc.categoryCode || '' }}</small></td><td>{{ doc.uploader?.fullName || '—' }}</td><td>{{ doc.course?.name || '—' }}</td><td>{{ doc.createdAt | date:'dd/MM/yyyy' }}</td><td><button class="btn btn-outline btn-small" (click)="openModeration(doc)">Chi tiết</button></td></tr> }</tbody></table></div><nav class="pagination"><button class="page-button" [disabled]="moderationPage() === 0" (click)="loadModeration(moderationPage()-1)">‹</button><span class="muted">Trang {{ moderationPage()+1 }} / {{ moderationPages() }}</span><button class="page-button" [disabled]="moderationPage()+1 >= moderationPages()" (click)="loadModeration(moderationPage()+1)">›</button></nav> }
        @else { <div class="empty-state"><span class="empty-icon"><svg lucideShieldCheck></svg></span><strong>Không có tài liệu trong danh sách này</strong><p>Danh sách sẽ được cập nhật khi có tài liệu tương ứng.</p></div> }
      }

      @if (view() === 'reports') {
        <div class="page-title-row"><div><span class="eyebrow">KIỂM SOÁT NỘI DUNG</span><h1>Báo cáo tài liệu</h1><p class="muted">Xem xét phản hồi của sinh viên về tài liệu được chia sẻ.</p></div><button class="icon-button refresh-button" (click)="loadReports()" aria-label="Làm mới"><svg lucideRefreshCw></svg></button></div>
        <div class="tabs">@for (status of reportStatuses; track status.value) { <button [class.tab-active]="reportStatus() === status.value" (click)="setReportStatus(status.value)">{{ status.label }}</button> }</div>
        @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
        @if (loading()) { <div class="table-skeleton"><span></span><span></span><span></span><span></span></div> }
        @else if (reports().length) { <div class="table-wrap"><table class="data-table"><thead><tr><th>TÀI LIỆU</th><th>NGƯỜI BÁO CÁO</th><th>LÝ DO</th><th>NGÀY GỬI</th><th>TRẠNG THÁI</th><th></th></tr></thead><tbody>@for (report of reports(); track report.id) { <tr><td><strong>{{ report.documentTitle }}</strong></td><td>{{ report.reporter.fullName }}<small>{{ report.reporter.studentId }}</small></td><td>{{ reportReasonLabel(report.reason) }}</td><td>{{ report.createdAt | date:'dd/MM/yyyy' }}</td><td>{{ report.status }}</td><td><button class="btn btn-outline btn-small" (click)="openReport(report)">Chi tiết</button></td></tr> }</tbody></table></div><nav class="pagination"><button class="page-button" [disabled]="reportsPage() === 0" (click)="loadReports(reportsPage()-1)">‹</button><span class="muted">Trang {{ reportsPage()+1 }} / {{ reportsPages() }}</span><button class="page-button" [disabled]="reportsPage()+1 >= reportsPages()" (click)="loadReports(reportsPage()+1)">›</button></nav> }
        @else { <div class="empty-state"><span class="empty-icon"><svg lucideShieldCheck></svg></span><strong>Không có báo cáo cần xử lý</strong><p>Các báo cáo mới sẽ xuất hiện tại đây.</p></div> }
      }

      @if (view() === 'catalog') {
        <div class="page-title-row"><div><span class="eyebrow">DỮ LIỆU ĐÀO TẠO</span><h1>{{ catalogTitle }}</h1><p class="muted">Quản lý danh mục và dữ liệu được sử dụng trong học liệu.</p></div><button class="btn btn-primary" (click)="startCatalogCreate()"><svg lucidePlus></svg> Thêm mới</button></div>
        @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
        @if (loading()) { <div class="table-skeleton"><span></span><span></span><span></span></div> }
        @else if (catalogRows().length) { <div class="table-wrap"><table class="data-table"><thead><tr><th>MÃ</th><th>TÊN</th><th>TRẠNG THÁI / LIÊN KẾT</th><th>THAO TÁC</th></tr></thead><tbody>@for (row of catalogRows(); track row['id']) { <tr><td>{{ row['code'] || row['lecturerCode'] || '—' }}</td><td><strong>{{ row['name'] || row['fullName'] || '—' }}</strong></td><td>{{ row['status'] || relatedCatalogName(row) }}</td><td><div class="table-actions">@if (resource === 'majors') { <button class="text-button" (click)="openCourseMapping(row)">Quản lý môn học</button> }<button class="text-button" (click)="editCatalog(row)">Chỉnh sửa</button><button class="text-button danger-text" (click)="deleteCatalog(row)">Xóa</button></div></td></tr> }</tbody></table></div> }
        @else { <div class="empty-state"><span class="empty-icon"><svg lucideBookOpen></svg></span><strong>Chưa có dữ liệu danh mục</strong><p>Thêm dữ liệu đào tạo để sử dụng trong hệ thống.</p></div> }
      }

      @if (showUserForm()) { <div class="modal-backdrop" (click)="closeModals()"><section class="modal-card" (click)="$event.stopPropagation()"><div class="modal-heading"><div><span class="eyebrow">CẤP TÀI KHOẢN</span><h2>Tạo tài khoản sinh viên</h2></div><button class="icon-button" (click)="closeModals()" aria-label="Đóng"><svg lucideX></svg></button></div><form (ngSubmit)="createUser()"><div class="form-fields"><label class="field-label">MSSV <span class="required">*</span><input class="form-input" name="studentId" [(ngModel)]="userDraft.studentId" required /></label><label class="field-label">Họ tên <span class="required">*</span><input class="form-input" name="fullName" [(ngModel)]="userDraft.fullName" required /></label><label class="field-label">Email<input class="form-input" type="email" name="email" [(ngModel)]="userDraft.email" /></label><label class="field-label">Khoa<select class="form-input" name="facultyId" [(ngModel)]="userDraft.facultyId" (ngModelChange)="loadUserMajors($event)"><option [ngValue]="null">Chọn khoa</option>@for (faculty of faculties(); track faculty.id) { <option [ngValue]="faculty.id">{{ faculty.name }}</option> }</select></label><label class="field-label">Chuyên ngành<select class="form-input" name="majorId" [(ngModel)]="userDraft.majorId" [disabled]="!userDraft.facultyId"><option [ngValue]="null">Chọn chuyên ngành</option>@for (major of userMajors(); track major.id) { <option [ngValue]="major.id">{{ major.name }}</option> }</select></label></div>@if (modalError()) { <div class="field-error">{{ modalError() }}</div> }<div class="modal-actions"><button class="btn btn-outline" type="button" (click)="closeModals()">Hủy</button><button class="btn btn-primary" type="submit" [disabled]="saving()">{{ saving() ? 'Đang cấp tài khoản…' : 'Tạo tài khoản' }}</button></div></form></section></div> }

      @if (selectedDocument()) { <div class="modal-backdrop" (click)="closeModeration()"><section class="modal-card moderation-modal" (click)="$event.stopPropagation()"><div class="modal-heading"><div><span class="eyebrow">CHI TIẾT KIỂM DUYỆT</span><h2>{{ selectedDocument()?.title }}</h2></div><button class="icon-button" (click)="closeModeration()" aria-label="Đóng"><svg lucideX></svg></button></div><div class="moderation-details"><p>{{ selectedDocument()?.description || 'Không có mô tả.' }}</p><div><small>NGƯỜI ĐĂNG</small><strong>{{ selectedDocument()?.uploader?.fullName || '—' }}</strong></div><div><small>MÔN HỌC</small><strong>{{ selectedDocument()?.course?.name || '—' }}</strong></div><div><small>KHOA / CHUYÊN NGÀNH</small><strong>{{ selectedDocument()?.major?.faculty?.name || '—' }} · {{ selectedDocument()?.major?.name || '—' }}</strong></div><button class="btn btn-outline" (click)="previewModerationDocument()">Xem trước tệp</button>@if (adminPreviewError()) { <p class="field-error">{{ adminPreviewError() }}</p> }@if (adminPreviewImage()) { <img class="document-image-preview" [src]="adminPreviewImage()" [alt]="selectedDocument()?.fileName || selectedDocument()?.title" /> }@if (adminPreviewPdf()) { <iframe class="document-pdf-preview" [src]="adminPreviewPdf()" title="Xem trước tài liệu kiểm duyệt"></iframe> }</div>@if (selectedDocument()?.status === 'PENDING') { <div class="modal-actions"><button class="btn btn-outline danger-button" (click)="moderate('REJECTED')">Từ chối</button><button class="btn btn-primary" (click)="moderate('APPROVED')"><svg lucideCheck></svg> Duyệt tài liệu</button></div> }@else { <div class="modal-actions"><button class="btn btn-outline" (click)="moderate(selectedDocument()?.status === 'HIDDEN' ? 'APPROVED' : 'HIDDEN')">{{ selectedDocument()?.status === 'HIDDEN' ? 'Hiện lại' : 'Ẩn tài liệu' }}</button></div> }</section></div> }

      @if (showCatalogForm()) { <div class="modal-backdrop" (click)="showCatalogForm.set(false)"><section class="modal-card" (click)="$event.stopPropagation()"><div class="modal-heading"><div><span class="eyebrow">{{ catalogEditing() ? 'CẬP NHẬT' : 'THÊM MỚI' }}</span><h2>{{ catalogEditing() ? 'Chỉnh sửa' : 'Thêm' }} {{ catalogTitle.toLowerCase() }}</h2></div><button class="icon-button" (click)="showCatalogForm.set(false)" aria-label="Đóng"><svg lucideX></svg></button></div><form (ngSubmit)="saveCatalog()"><div class="form-fields">@for (field of catalogFields; track field.key) { <label class="field-label">{{ field.label }}<input class="form-input" [type]="field.type || 'text'" [name]="field.key" [(ngModel)]="catalogDraft[field.key]" [required]="field.required" /></label> }</div>@if (modalError()) { <div class="field-error">{{ modalError() }}</div> }<div class="modal-actions"><button class="btn btn-outline" type="button" (click)="showCatalogForm.set(false)">Hủy</button><button class="btn btn-primary" type="submit" [disabled]="saving()">{{ saving() ? 'Đang lưu…' : 'Lưu thay đổi' }}</button></div></form></section></div> }
      @if (selectedReport()) { <div class="modal-backdrop" (click)="selectedReport.set(null)"><section class="modal-card" (click)="$event.stopPropagation()"><div class="modal-heading"><div><span class="eyebrow">CHI TIẾT BÁO CÁO #{{ selectedReport()?.id }}</span><h2>{{ selectedReport()?.documentTitle }}</h2></div><button class="icon-button" aria-label="Đóng" (click)="selectedReport.set(null)"><svg lucideX></svg></button></div><div class="moderation-details"><div><small>NGƯỜI BÁO CÁO</small><strong>{{ selectedReport()?.reporter?.fullName }} · {{ selectedReport()?.reporter?.studentId }}</strong></div><div><small>LÝ DO</small><strong>{{ reportReasonLabel(selectedReport()?.reason) }}</strong></div><p>{{ selectedReport()?.description || 'Không có mô tả bổ sung.' }}</p>@if (selectedReport()?.document; as reportedDocument) { <div><small>TRẠNG THÁI TÀI LIỆU</small><strong>{{ reportedDocument.status }}</strong></div><p>{{ reportedDocument.description || 'Không có mô tả tài liệu.' }}</p> }</div>@if (selectedReport()?.status === 'PENDING') { <label class="field-label"><input type="checkbox" [checked]="hideReportedDocument()" (change)="hideReportedDocument.set($any($event.target).checked)" /> Ẩn tài liệu khi xử lý báo cáo</label><div class="modal-actions"><button class="btn btn-outline" (click)="processReport('REJECTED')">Từ chối báo cáo</button><button class="btn btn-primary" (click)="processReport('RESOLVED')">Đánh dấu đã xử lý</button></div> }</section></div> }
      @if (mappingMajor()) { <div class="modal-backdrop" (click)="mappingMajor.set(null)"><section class="modal-card" (click)="$event.stopPropagation()"><div class="modal-heading"><div><span class="eyebrow">CHƯƠNG TRÌNH ĐÀO TẠO</span><h2>Môn học · {{ mappingMajor()?.name }}</h2></div><button class="icon-button" aria-label="Đóng" (click)="mappingMajor.set(null)"><svg lucideX></svg></button></div><label class="field-label">Tìm môn học<input class="form-input" name="mappingSearch" [(ngModel)]="mappingSearch" placeholder="Tên hoặc mã môn học" /></label>@if (mappingLoading()) { <div class="table-skeleton"><span></span><span></span></div> } @else { <div class="form-fields"><section><h3>Đã liên kết</h3>@for (course of visibleMappingCourses(true); track course.id) { <label class="field-label"><input type="checkbox" [checked]="mappingSelectedIds().includes(course.id)" (change)="toggleMappingCourse(course.id, $any($event.target).checked)" /> {{ course.code }} · {{ course.name }}</label> }@if (!visibleMappingCourses(true).length) { <p class="muted">Không có môn học phù hợp.</p> }</section><section><h3>Chưa liên kết</h3>@for (course of visibleMappingCourses(false); track course.id) { <label class="field-label"><input type="checkbox" [checked]="mappingSelectedIds().includes(course.id)" (change)="toggleMappingCourse(course.id, $any($event.target).checked)" /> {{ course.code }} · {{ course.name }}</label> }@if (!visibleMappingCourses(false).length) { <p class="muted">Không có môn học phù hợp.</p> }</section></div>}@if (mappingError()) { <div class="field-error">{{ mappingError() }}</div> }<div class="modal-actions"><button class="btn btn-outline" type="button" (click)="mappingMajor.set(null)">Hủy</button><button class="btn btn-primary" type="button" [disabled]="mappingLoading() || mappingSaving()" (click)="saveCourseMapping()">{{ mappingSaving() ? 'Đang lưu…' : 'Lưu liên kết' }}</button></div></section></div> }
    </div>
  `,
})
export class AdminPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);
  readonly view = signal<AdminView>('dashboard');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly modalError = signal('');
  readonly stats = signal<DashboardStats | null>(null);
  readonly pending = signal<Document[]>([]);
  readonly users = signal<User[]>([]);
  readonly filteredUsers = signal<User[]>([]);
  readonly usersPage = signal(0);
  readonly usersPages = signal(1);
  readonly faculties = signal<Faculty[]>([]);
  readonly userMajors = signal<Major[]>([]);
  readonly filterMajors = signal<Major[]>([]);
  readonly facultyFilter = signal<number | null>(null);
  readonly majorFilter = signal<number | null>(null);
  readonly moderatedDocuments = signal<Document[]>([]);
  readonly moderationPage = signal(0);
  readonly moderationPages = signal(1);
  readonly selectedDocument = signal<Document | null>(null);
  readonly adminPreviewPdf = signal<SafeResourceUrl | null>(null);
  readonly adminPreviewImage = signal<string | null>(null);
  readonly adminPreviewError = signal('');
  readonly showUserForm = signal(false);
  readonly showCatalogForm = signal(false);
  readonly createdCredential = signal('');
  readonly catalogRows = signal<Record<string, unknown>[]>([]);
  readonly catalogEditing = signal<Record<string, unknown> | null>(null);
  readonly catalogDraft: Record<string, string | number> = {};
  readonly reports = signal<DocumentReport[]>([]);
  readonly reportStatus = signal<DocumentReport['status']>('PENDING');
  readonly reportsPage = signal(0);
  readonly reportsPages = signal(1);
  readonly selectedReport = signal<DocumentReport | null>(null);
  readonly hideReportedDocument = signal(false);
  readonly mappingMajor = signal<Major | null>(null);
  readonly mappingCourses = signal<Course[]>([]);
  readonly mappingSelectedIds = signal<number[]>([]);
  readonly mappingLoading = signal(false);
  readonly mappingSaving = signal(false);
  readonly mappingError = signal('');
  mappingSearch = '';
  readonly userDraft: { studentId: string; fullName: string; email: string; facultyId: number | null; majorId: number | null } = { studentId: '', fullName: '', email: '', facultyId: null, majorId: null };
  readonly moderationStatus = signal<DocumentStatus>('PENDING');
  readonly reportStatuses = [
    { label: 'Chờ xử lý', value: 'PENDING' as const },
    { label: 'Đã xử lý', value: 'RESOLVED' as const },
    { label: 'Từ chối', value: 'REJECTED' as const },
  ];
  userQuery = '';
  resource: CatalogResource = 'faculties';
  private localQuery = '';
  private moderationPreviewObjectUrl: string | null = null;
  readonly moderationStatuses = [
    { label: 'Chờ duyệt', value: 'PENDING' as DocumentStatus },
    { label: 'Đã duyệt', value: 'APPROVED' as DocumentStatus },
    { label: 'Từ chối', value: 'REJECTED' as DocumentStatus },
    { label: 'Đã ẩn', value: 'HIDDEN' as DocumentStatus },
  ];

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.clearModerationPreview());
    combineLatest([this.route.data, this.route.paramMap]).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(([data, params]) => {
      this.view.set(data['view'] as AdminView);
      this.error.set('');
      if (this.view() === 'dashboard') this.loadDashboard();
      if (this.view() === 'users') this.loadUsers();
      if (this.view() === 'moderation') this.loadModeration();
      if (this.view() === 'reports') this.loadReports();
      if (this.view() === 'catalog') {
        const resource = params.get('resource') || 'faculties';
        this.resource = this.isCatalogResource(resource) ? resource : 'faculties';
        this.loadCatalog();
      }
    });
  }

  get catalogTitle(): string {
    return ({ faculties: 'Khoa', majors: 'Chuyên ngành', courses: 'Môn học', lecturers: 'Giảng viên', 'academic-terms': 'Học kỳ', 'course-offerings': 'Lớp học phần' } as const)[this.resource];
  }
  get catalogFields(): { key: string; label: string; type?: string; required: boolean }[] {
    const common = [{ key: 'code', label: 'Mã', required: true }, { key: 'name', label: 'Tên', required: true }];
    if (this.resource === 'faculties') return common;
    if (this.resource === 'majors') return [...common, { key: 'facultyId', label: 'Mã khoa', type: 'number', required: true }];
    if (this.resource === 'courses') return [...common, { key: 'credits', label: 'Số tín chỉ', type: 'number', required: true }];
    if (this.resource === 'lecturers') return [{ key: 'lecturerCode', label: 'Mã giảng viên', required: true }, { key: 'fullName', label: 'Họ tên', required: true }, { key: 'email', label: 'Email', required: false }, { key: 'facultyId', label: 'Mã khoa', type: 'number', required: true }];
    if (this.resource === 'academic-terms') return [{ key: 'code', label: 'Mã học kỳ', required: true }, { key: 'name', label: 'Tên học kỳ', required: true }, { key: 'startDate', label: 'Ngày bắt đầu', type: 'date', required: true }, { key: 'endDate', label: 'Ngày kết thúc', type: 'date', required: true }];
    return [{ key: 'courseId', label: 'Mã môn học', type: 'number', required: true }, { key: 'lecturerId', label: 'Mã giảng viên', type: 'number', required: true }, { key: 'termId', label: 'Mã học kỳ', type: 'number', required: true }, { key: 'classCode', label: 'Mã lớp học phần', required: true }];
  }
  filterUsers(): void {
    this.localQuery = this.userQuery.toLowerCase().trim();
    this.filteredUsers.set(this.users().filter((user) => {
      const matchesQuery = `${user.studentId} ${user.fullName}`.toLowerCase().includes(this.localQuery);
      const matchesFaculty = this.facultyFilter() === null || user.faculty?.id === this.facultyFilter();
      const matchesMajor = this.majorFilter() === null || user.major?.id === this.majorFilter();
      return matchesQuery && matchesFaculty && matchesMajor;
    }));
  }
  setFacultyFilter(id: number | null): void {
    this.facultyFilter.set(id); this.majorFilter.set(null); this.filterMajors.set([]);
    if (id !== null) this.api.get<Major[]>(`/faculties/${id}/majors`).subscribe({
      next: (majors) => this.filterMajors.set(majors),
      error: () => this.error.set('Không thể tải chuyên ngành để lọc.'),
    });
    this.filterUsers();
  }
  setMajorFilter(id: number | null): void { this.majorFilter.set(id); this.filterUsers(); }
  loadUserMajors(id: number | null): void {
    this.userDraft.majorId = null;
    this.userMajors.set([]);
    if (id !== null) this.api.get<Major[]>(`/faculties/${id}/majors`).subscribe({
      next: (majors) => this.userMajors.set(majors),
      error: () => this.modalError.set('Không thể tải chuyên ngành của khoa.'),
    });
  }
  loadDashboard(): void {
    this.loading.set(true); this.error.set('');
    this.api.get<DashboardStats>('/admin/dashboard/stats').subscribe({
      next: (data) => { this.stats.set(data); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('Không thể tải thống kê quản trị.'); },
    });
    this.api.get<Document[]>('/admin/documents', { status: 'PENDING' }).subscribe({
      next: (data) => this.pending.set(Array.isArray(data) ? data.slice(0, 5) : pageItems(data)),
      error: () => this.pending.set([]),
    });
  }
  loadUsers(page = this.usersPage()): void {
    if (page < 0) return;
    this.loading.set(true); this.error.set('');
    if (!this.faculties().length) this.api.get<Faculty[]>('/faculties').subscribe({
      next: (faculties) => this.faculties.set(faculties),
      error: () => this.error.set('Không thể tải danh sách khoa.'),
    });
    this.api.get<Page<User> | User[]>('/admin/users', { page, size: 12 }).subscribe({
      next: (data) => {
        this.users.set(pageItems(data));
        if (!Array.isArray(data)) this.usersPages.set(data.totalPages || 1);
        this.usersPage.set(page);
        this.filterUsers();
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.error.set('Không thể tải danh sách sinh viên.'); },
    });
  }
  createUser(): void {
    this.modalError.set('');
    if (!this.userDraft.studentId.trim() || !this.userDraft.fullName.trim()) { this.modalError.set('MSSV và họ tên là thông tin bắt buộc.'); return; }
    this.saving.set(true);
    this.api.post<Record<string, unknown>>('/admin/users', {
      studentId: this.userDraft.studentId.trim(),
      fullName: this.userDraft.fullName.trim(),
      email: this.userDraft.email.trim() || undefined,
      facultyId: this.userDraft.facultyId || undefined,
      majorId: this.userDraft.majorId || undefined,
    }).subscribe({
      next: (result) => {
        this.saving.set(false); this.showUserForm.set(false);
        const credential = typeof result['temporaryPassword'] === 'string' ? result['temporaryPassword'] : '';
        this.createdCredential.set(credential);
        this.userDraft.studentId = ''; this.userDraft.fullName = ''; this.userDraft.email = ''; this.userDraft.facultyId = null; this.userDraft.majorId = null;
        this.loadUsers(0);
      },
      error: (error: { error?: { message?: string } }) => { this.saving.set(false); this.modalError.set(error.error?.message || 'Không thể cấp tài khoản.'); },
    });
  }
  toggleUser(user: User): void {
    const nextStatus = user.active === false ? 'ACTIVE' : 'LOCKED';
    const action = nextStatus === 'ACTIVE' ? 'mở khóa' : 'khóa';
    if (!window.confirm(`Xác nhận ${action} tài khoản ${user.studentId}?`)) return;
    this.api.patch<void>(`/admin/users/${user.id}/status`, { status: nextStatus }).subscribe({
      next: () => this.loadUsers(),
      error: () => this.error.set('Không thể cập nhật trạng thái tài khoản.'),
    });
  }
  resetPassword(user: User): void {
    if (!window.confirm(`Đặt lại mật khẩu cho ${user.studentId}?`)) return;
    this.api.post<Record<string, unknown>>(`/admin/users/${user.id}/reset-password`, {}).subscribe({
      next: (result) => {
        const credential = typeof result['temporaryPassword'] === 'string' ? result['temporaryPassword'] : '';
        this.createdCredential.set(credential);
      },
      error: () => this.error.set('Không thể đặt lại mật khẩu.'),
    });
  }
  setModerationStatus(status: DocumentStatus): void { this.moderationStatus.set(status); this.moderationPage.set(0); this.loadModeration(0); }
  setReportStatus(status: DocumentReport['status']): void { this.reportStatus.set(status); this.reportsPage.set(0); this.loadReports(0); }
  loadReports(page = this.reportsPage()): void {
    if (page < 0) return;
    this.loading.set(true); this.error.set('');
    this.api.get<Page<DocumentReport> | DocumentReport[]>('/admin/reports', { status: this.reportStatus(), page, size: 12 }).subscribe({
      next: (result) => {
        this.reports.set(pageItems(result));
        if (!Array.isArray(result)) this.reportsPages.set(result.totalPages || 1);
        this.reportsPage.set(page);
        this.loading.set(false);
      },
      error: () => { this.reports.set([]); this.loading.set(false); this.error.set('Không thể tải danh sách báo cáo.'); },
    });
  }
  openReport(report: DocumentReport): void {
    this.selectedReport.set(report);
    this.hideReportedDocument.set(false);
    this.api.get<DocumentReport>(`/admin/reports/${report.id}`).subscribe({
      next: (details) => this.selectedReport.set(details),
      error: () => this.error.set('Không thể tải chi tiết báo cáo.'),
    });
  }
  processReport(status: 'RESOLVED' | 'REJECTED'): void {
    const report = this.selectedReport();
    if (!report || report.status !== 'PENDING') return;
    this.saving.set(true);
    this.api.patch<DocumentReport>(`/admin/reports/${report.id}`, {
      status,
      hideDocument: this.hideReportedDocument(),
    }).subscribe({
      next: () => { this.saving.set(false); this.selectedReport.set(null); this.loadReports(); },
      error: (error: { error?: { message?: string } }) => {
        this.saving.set(false);
        this.error.set(error.error?.message || 'Không thể cập nhật báo cáo.');
      },
    });
  }
  reportReasonLabel(reason?: DocumentReport['reason']): string {
    const labels: Record<DocumentReport['reason'], string> = {
      WRONG_COURSE: 'Sai môn học',
      WRONG_MAJOR: 'Sai chuyên ngành',
      INAPPROPRIATE: 'Nội dung không phù hợp',
      BROKEN_FILE: 'File lỗi hoặc không mở được',
      COPYRIGHT: 'Vi phạm bản quyền',
      OTHER: 'Lý do khác',
    };
    return reason ? labels[reason] : '—';
  }
  openCourseMapping(row: Record<string, unknown>): void {
    const majorId = typeof row['id'] === 'number' ? row['id'] : null;
    if (majorId === null) return;
    this.mappingMajor.set({ id: majorId, name: String(row['name'] || ''), facultyId: Number(row['facultyId']) });
    this.mappingLoading.set(true);
    this.mappingError.set('');
    this.mappingSearch = '';
    forkJoin({
      linked: this.api.get<Course[]>(`/admin/majors/${majorId}/courses`),
      courses: this.api.get<Course[]>('/admin/courses'),
    }).subscribe({
      next: ({ linked, courses }) => {
        this.mappingCourses.set(courses);
        this.mappingSelectedIds.set(linked.map((course) => course.id));
        this.mappingLoading.set(false);
      },
      error: () => {
        this.mappingLoading.set(false);
        this.mappingError.set('Không thể tải dữ liệu liên kết môn học.');
      },
    });
  }
  visibleMappingCourses(linked: boolean): Course[] {
    const query = this.mappingSearch.trim().toLocaleLowerCase();
    return this.mappingCourses().filter((course) =>
      this.mappingSelectedIds().includes(course.id) === linked
      && (!query || `${course.code} ${course.name}`.toLocaleLowerCase().includes(query)),
    );
  }
  toggleMappingCourse(courseId: number, checked: boolean): void {
    this.mappingSelectedIds.update((ids) => checked
      ? ids.includes(courseId) ? ids : [...ids, courseId]
      : ids.filter((id) => id !== courseId));
  }
  saveCourseMapping(): void {
    const major = this.mappingMajor();
    if (!major || this.mappingSaving()) return;
    this.mappingSaving.set(true);
    this.mappingError.set('');
    this.api.put<Course[]>(`/admin/majors/${major.id}/courses`, { courseIds: this.mappingSelectedIds() }).subscribe({
      next: (courses) => {
        this.mappingSelectedIds.set(courses.map((course) => course.id));
        this.mappingSaving.set(false);
      },
      error: (error: { error?: { message?: string } }) => {
        this.mappingSaving.set(false);
        this.mappingError.set(error.error?.message || 'Không thể lưu liên kết môn học.');
      },
    });
  }
  loadModeration(page = this.moderationPage()): void {
    if (page < 0) return;
    this.loading.set(true); this.error.set('');
    this.api.get<Page<Document> | Document[]>('/admin/documents', { status: this.moderationStatus(), page, size: 12 }).subscribe({
      next: (data) => {
        this.moderatedDocuments.set(pageItems(data));
        if (!Array.isArray(data)) this.moderationPages.set(data.totalPages || 1);
        this.moderationPage.set(page);
        this.loading.set(false);
      },
      error: () => { this.moderatedDocuments.set([]); this.loading.set(false); this.error.set('Không thể tải danh sách kiểm duyệt.'); },
    });
  }
  openModeration(doc: Document): void {
    this.clearModerationPreview();
    this.selectedDocument.set(doc);
    if (this.view() === 'moderation' || this.view() === 'dashboard') {
      this.api.get<Document>(`/admin/documents/${doc.id}`).subscribe({
        next: (details) => this.selectedDocument.set(details),
        error: () => this.error.set('Không thể tải chi tiết tài liệu.'),
      });
    }
  }
  previewModerationDocument(): void {
    const doc = this.selectedDocument();
    if (!doc) return;
    this.adminPreviewError.set('');
    this.api.download(`/admin/documents/${doc.id}/preview`).subscribe({
      next: (blob) => {
        this.clearModerationPreview();
        this.moderationPreviewObjectUrl = URL.createObjectURL(blob);
        if (doc.fileType === 'application/pdf') {
          this.adminPreviewPdf.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.moderationPreviewObjectUrl));
        } else if (doc.fileType?.startsWith('image/')) {
          this.adminPreviewImage.set(this.moderationPreviewObjectUrl);
        } else {
          this.adminPreviewError.set('Định dạng tài liệu không hỗ trợ xem trước.');
        }
      },
      error: (error: { error?: { message?: string } }) => {
        this.adminPreviewError.set(error.error?.message || 'Không thể tải bản xem trước.');
      },
    });
  }
  closeModeration(): void {
    this.selectedDocument.set(null);
    this.clearModerationPreview();
  }
  private clearModerationPreview(): void {
    if (this.moderationPreviewObjectUrl) URL.revokeObjectURL(this.moderationPreviewObjectUrl);
    this.moderationPreviewObjectUrl = null;
    this.adminPreviewPdf.set(null);
    this.adminPreviewImage.set(null);
  }
  moderate(status: DocumentStatus): void {
    const doc = this.selectedDocument();
    if (!doc) return;
    let rejectionReason: string | undefined;
    if (status === 'REJECTED') {
      rejectionReason = window.prompt('Nhập lý do từ chối tài liệu:')?.trim();
      if (!rejectionReason) return;
    } else if (!window.confirm(`${status === 'APPROVED' ? 'Duyệt' : status === 'HIDDEN' ? 'Ẩn' : 'Cập nhật'} tài liệu “${doc.title}”?`)) return;
    this.api.patch<void>(`/admin/documents/${doc.id}/moderation`, { status, reason: rejectionReason }).subscribe({
      next: () => {
        this.closeModeration();
        if (this.view() === 'dashboard') this.loadDashboard();
        else this.loadModeration();
      },
      error: (error: { error?: { message?: string } }) => this.error.set(error.error?.message || 'Không thể cập nhật trạng thái tài liệu.'),
    });
  }
  loadCatalog(): void {
    this.loading.set(true); this.error.set('');
    this.api.get<Page<Record<string, unknown>> | Record<string, unknown>[]>(`/admin/${this.resource}`).subscribe({
      next: (result) => { this.catalogRows.set(pageItems(result)); this.loading.set(false); },
      error: () => { this.catalogRows.set([]); this.loading.set(false); this.error.set(`Không thể tải danh mục ${this.catalogTitle.toLowerCase()}.`); },
    });
  }
  startCatalogCreate(): void {
    this.catalogEditing.set(null);
    for (const key of Object.keys(this.catalogDraft)) delete this.catalogDraft[key];
    this.showCatalogForm.set(true);
  }
  editCatalog(row: Record<string, unknown>): void {
    this.catalogEditing.set(row);
    for (const field of this.catalogFields) {
      const value = row[field.key];
      this.catalogDraft[field.key] = typeof value === 'string' || typeof value === 'number' ? value : '';
    }
    this.showCatalogForm.set(true);
  }
  saveCatalog(): void {
    this.modalError.set('');
    if (this.catalogFields.some((field) => field.required && !this.catalogDraft[field.key])) { this.modalError.set('Vui lòng nhập đầy đủ thông tin bắt buộc.'); return; }
    const body: Record<string, string | number> = {};
    for (const field of this.catalogFields) {
      const value = this.catalogDraft[field.key];
      if (value !== '' && value !== undefined) body[field.key] = field.type === 'number' ? Number(value) : value;
    }
    const id = typeof this.catalogEditing()?.['id'] === 'number' ? this.catalogEditing()?.['id'] as number : null;
    this.saving.set(true);
    const url = id === null ? `/admin/${this.resource}` : `/admin/${this.resource}/${id}`;
    const request = id === null ? this.api.post(url, body) : this.api.patch(url, body);
    request.subscribe({
      next: () => { this.saving.set(false); this.showCatalogForm.set(false); this.loadCatalog(); },
      error: (error: { error?: { message?: string } }) => { this.saving.set(false); this.modalError.set(error.error?.message || 'Không thể lưu dữ liệu.'); },
    });
  }
  deleteCatalog(row: Record<string, unknown>): void {
    const id = typeof row['id'] === 'number' ? row['id'] : null;
    if (id === null || !window.confirm(`Xóa “${String(row['name'] || row['code'] || '')}”? Dữ liệu đang được tài liệu tham chiếu có thể không xóa được.`)) return;
    this.api.delete<void>(`/admin/${this.resource}/${id}`).subscribe({
      next: () => this.loadCatalog(),
      error: (error: { error?: { message?: string } }) => this.error.set(error.error?.message || 'Không thể xóa. Dữ liệu có thể đang được tài liệu tham chiếu.'),
    });
  }
  relatedCatalogName(row: Record<string, unknown>): string {
    if (this.resource === 'majors') return `Khoa ID: ${row['facultyId'] ?? '—'}`;
    if (this.resource === 'courses') return `${row['credits'] ?? '—'} tín chỉ`;
    if (this.resource === 'lecturers') return String(row['email'] ?? '—');
    if (this.resource === 'course-offerings') return `Môn ID ${row['courseId'] ?? '—'} · GV ID ${row['lecturerId'] ?? '—'}`;
    return '—';
  }
  closeModals(): void { this.showUserForm.set(false); this.modalError.set(''); }
  private isCatalogResource(value: string): value is CatalogResource {
    return ['faculties', 'majors', 'courses', 'lecturers', 'academic-terms', 'course-offerings'].includes(value);
  }
}
