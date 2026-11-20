import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideBookOpen, LucideBookmark, LucideFileText, LucideHouse, LucideLogOut, LucideMenu, LucideSearch, LucideUpload, LucideX } from '@lucide/angular';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-student-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideBookOpen, LucideBookmark, LucideFileText, LucideHouse, LucideLogOut, LucideMenu, LucideSearch, LucideUpload, LucideX],
  template: `
    <div class="app-shell">
      @if (menuOpen()) { <button class="mobile-scrim" aria-label="Đóng menu" (click)="menuOpen.set(false)"></button> }
      <aside class="sidebar" [class.sidebar-open]="menuOpen()">
        <a class="brand" routerLink="/" (click)="menuOpen.set(false)">
          <span class="brand-mark"><svg lucideBookOpen></svg></span>
          <span><strong>DUT<span class="brand-dot">.</span></strong><small>Kho tri thức sinh viên</small></span>
          <button class="icon-button mobile-close" aria-label="Đóng menu" (click)="menuOpen.set(false); $event.preventDefault()"><svg lucideX></svg></button>
        </a>
        <div class="nav-caption">KHÔNG GIAN HỌC TẬP</div>
        <nav class="main-nav">
          <a routerLink="/" routerLinkActive="nav-active" [routerLinkActiveOptions]="{ exact: true }" (click)="menuOpen.set(false)"><svg lucideHouse></svg><span>Trang chủ</span></a>
          <a routerLink="/documents" routerLinkActive="nav-active" (click)="menuOpen.set(false)"><svg lucideSearch></svg><span>Tìm tài liệu</span></a>
          <a routerLink="/documents/upload" routerLinkActive="nav-active" (click)="menuOpen.set(false)"><svg lucideUpload></svg><span>Đăng tài liệu</span></a>
          <a routerLink="/my-documents" routerLinkActive="nav-active" (click)="menuOpen.set(false)"><svg lucideFileText></svg><span>Tài liệu của tôi</span></a>
          <a routerLink="/favorites" routerLinkActive="nav-active" (click)="menuOpen.set(false)"><svg lucideBookmark></svg><span>Yêu thích</span></a>
        </nav>
        <div class="sidebar-bottom">
          <div class="sidebar-note"><span class="note-icon">✦</span><strong>Tri thức sẻ chia</strong><p>Cùng nhau xây dựng kho tài liệu học tập hữu ích cho DUT.</p></div>
          <a routerLink="/profile" class="user-menu" routerLinkActive="user-active">
            <span class="avatar">{{ initials }}</span>
            <span class="user-meta"><strong>{{ auth.user()?.fullName || 'Sinh viên DUT' }}</strong><small>{{ auth.user()?.studentId || 'Tài khoản sinh viên' }}</small></span>
            <button class="logout-button" aria-label="Đăng xuất" (click)="logout($event)"><svg lucideLogOut></svg></button>
          </a>
        </div>
      </aside>
      <main class="main-area">
        <header class="topbar">
          <button class="icon-button mobile-menu" aria-label="Mở menu" (click)="menuOpen.set(true)"><svg lucideMenu></svg></button>
          <div class="breadcrumb"><span>Không gian học tập</span><span class="breadcrumb-sep">/</span><strong>{{ pageLabel }}</strong></div>
          <div class="topbar-actions">
            <a class="top-search" routerLink="/documents"><svg lucideSearch></svg><span>Tìm kiếm tài liệu</span><kbd>⌘ K</kbd></a>
            <a class="top-avatar" routerLink="/profile" aria-label="Hồ sơ cá nhân">{{ initials }}</a>
          </div>
        </header>
        <section class="page-content"><router-outlet /></section>
        <footer class="footer">© DUT · Nền tảng chia sẻ tri thức học tập</footer>
      </main>
    </div>
  `,
})
export class StudentLayoutComponent {
  readonly menuOpen = signal(false);
  readonly auth = injectAuth();

  get initials(): string {
    return this.auth.user()?.fullName.split(' ').map((part) => part[0]).slice(-2).join('').toUpperCase() || 'SV';
  }

  get pageLabel(): string {
    const path = globalThis.location.pathname;
    if (path.includes('/upload')) return 'Đăng tài liệu';
    if (path.includes('/my-documents')) return 'Tài liệu của tôi';
    if (path.includes('/favorites')) return 'Yêu thích';
    if (path.includes('/profile')) return 'Hồ sơ';
    if (/\/documents\/\d+/.test(path)) return 'Chi tiết tài liệu';
    if (path.includes('/documents')) return 'Tìm tài liệu';
    return 'Trang chủ';
  }

  logout(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.auth.logout();
  }
}

function injectAuth(): AuthService {
  return inject(AuthService);
}
