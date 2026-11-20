import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideBookOpen, LucideBuilding2, LucideGraduationCap, LucideLayoutDashboard, LucideLogOut, LucideShieldCheck, LucideUsers } from '@lucide/angular';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideBookOpen, LucideBuilding2, LucideGraduationCap, LucideLayoutDashboard, LucideLogOut, LucideShieldCheck, LucideUsers],
  template: `
    <div class="app-shell admin-shell">
      <aside class="sidebar">
        <a class="brand" routerLink="/admin"><span class="brand-mark"><svg lucideBookOpen></svg></span><span><strong>DUT<span class="brand-dot">.</span></strong><small>Quản trị hệ thống</small></span></a>
        <div class="nav-caption">QUẢN TRỊ</div>
        <nav class="main-nav">
          <a routerLink="/admin/dashboard" routerLinkActive="nav-active"><svg lucideLayoutDashboard></svg><span>Tổng quan</span></a>
          <a routerLink="/admin/users" routerLinkActive="nav-active"><svg lucideUsers></svg><span>Sinh viên</span></a>
          <a routerLink="/admin/documents" routerLinkActive="nav-active"><svg lucideShieldCheck></svg><span>Kiểm duyệt tài liệu</span></a>
          <a routerLink="/admin/reports" routerLinkActive="nav-active"><svg lucideShieldCheck></svg><span>Báo cáo tài liệu</span></a>
        </nav>
        <div class="nav-caption catalog-caption">DỮ LIỆU ĐÀO TẠO</div>
        <nav class="main-nav">
          <a routerLink="/admin/catalog/faculties" routerLinkActive="nav-active"><svg lucideBuilding2></svg><span>Khoa</span></a>
          <a routerLink="/admin/catalog/majors" routerLinkActive="nav-active"><svg lucideGraduationCap></svg><span>Chuyên ngành</span></a>
          <a routerLink="/admin/catalog/courses" routerLinkActive="nav-active"><svg lucideBookOpen></svg><span>Môn học</span></a>
          <a routerLink="/admin/catalog/lecturers" routerLinkActive="nav-active"><svg lucideUsers></svg><span>Giảng viên</span></a>
          <a routerLink="/admin/catalog/academic-terms" routerLinkActive="nav-active"><svg lucideGraduationCap></svg><span>Học kỳ</span></a>
          <a routerLink="/admin/catalog/course-offerings" routerLinkActive="nav-active"><svg lucideBookOpen></svg><span>Lớp học phần</span></a>
        </nav>
        <div class="sidebar-bottom"><button class="logout-link" (click)="auth.logout()"><svg lucideLogOut></svg>Đăng xuất</button></div>
      </aside>
      <main class="main-area">
        <header class="topbar"><div class="breadcrumb"><span>Bảng điều khiển</span><span class="breadcrumb-sep">/</span><strong>Quản trị viên</strong></div><div class="topbar-actions"><span class="admin-label">QUẢN TRỊ VIÊN</span><span class="top-avatar">{{ initials }}</span></div></header>
        <section class="page-content"><router-outlet /></section>
        <footer class="footer">DUT · Bảng điều khiển quản trị</footer>
      </main>
    </div>
  `,
})
export class AdminLayoutComponent {
  constructor(readonly auth: AuthService) {}
  get initials(): string { return this.auth.user()?.fullName.split(' ').map((part) => part[0]).slice(-2).join('').toUpperCase() || 'AD'; }
}
