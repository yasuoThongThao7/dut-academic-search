import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideBookOpen, LucideBuilding2, LucideKeyRound, LucideLogOut, LucideMail, LucideUserRound } from '@lucide/angular';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  imports: [RouterLink, LucideBookOpen, LucideBuilding2, LucideKeyRound, LucideLogOut, LucideMail, LucideUserRound],
  template: `
    <div class="profile-page"><div class="page-title-row"><div><span class="eyebrow">TÀI KHOẢN DUT</span><h1>Hồ sơ cá nhân</h1><p class="muted">Thông tin tài khoản sinh viên của bạn.</p></div></div>
      @if (error()) { <div class="alert alert-error">{{ error() }} <button class="text-button" (click)="load()">Thử lại</button></div> }
      @if (loading()) { <div class="profile-skeleton"><span></span><span></span><span></span></div> }
      @else if (auth.user(); as user) { <div class="profile-grid"><section class="profile-card profile-overview"><div class="profile-avatar">{{ initials }}</div><h2>{{ user.fullName }}</h2><span class="profile-id">{{ user.studentId }}</span><span class="status-badge status-approved">Sinh viên DUT</span></section><section class="profile-card profile-info"><div class="profile-card-heading"><span class="eyebrow">THÔNG TIN CÁ NHÂN</span><svg lucideUserRound></svg></div><div class="profile-info-row"><span><svg lucideUserRound></svg>Họ và tên</span><strong>{{ user.fullName }}</strong></div><div class="profile-info-row"><span><svg lucideBookOpen></svg>Mã số sinh viên</span><strong>{{ user.studentId }}</strong></div><div class="profile-info-row"><span><svg lucideMail></svg>Email</span><strong>{{ user.email || 'Chưa cập nhật' }}</strong></div><div class="profile-info-row"><span><svg lucideBuilding2></svg>Khoa</span><strong>{{ user.faculty?.name || 'Chưa cập nhật' }}</strong></div><div class="profile-info-row"><span><svg lucideBookOpen></svg>Chuyên ngành</span><strong>{{ user.major?.name || 'Chưa cập nhật' }}</strong></div><div class="profile-security"><span><svg lucideKeyRound></svg> Bảo mật tài khoản</span><a class="btn btn-outline btn-small" routerLink="/change-password">Đổi mật khẩu</a></div><button class="logout-profile" (click)="auth.logout()"><svg lucideLogOut></svg> Đăng xuất khỏi tài khoản</button></section></div> }
    </div>
  `,
})
export class ProfileComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly loading = signal(true);
  readonly error = signal('');
  get initials(): string { return this.auth.user()?.fullName.split(' ').map((part) => part[0]).slice(-2).join('').toUpperCase() || 'SV'; }
  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true); this.error.set('');
    this.auth.loadCurrentUser().subscribe({
      next: () => this.loading.set(false),
      error: () => { this.loading.set(false); this.error.set('Không thể tải thông tin hồ sơ.'); },
    });
  }
}
