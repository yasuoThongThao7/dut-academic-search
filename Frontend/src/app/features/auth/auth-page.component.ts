import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideBookOpen, LucideEye, LucideEyeOff, LucideLockKeyhole, LucideUserRound } from '@lucide/angular';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth-page',
  imports: [ReactiveFormsModule, RouterLink, LucideBookOpen, LucideLockKeyhole, LucideUserRound],
  template: `
    <main class="auth-page">
      <section class="auth-brand-panel">
        <a class="brand auth-brand" routerLink="/login"><span class="brand-mark"><svg lucideBookOpen></svg></span><span><strong>DUT<span class="brand-dot">.</span></strong><small>Kho tri thức sinh viên</small></span></a>
        <div class="auth-message"><span class="eyebrow eyebrow-light">ĐẠI HỌC BÁCH KHOA · ĐHĐN</span><h1>Tri thức được<br>chia sẻ, tương lai<br><em>được mở ra.</em></h1><p>Nền tảng tài liệu học tập dành riêng cho cộng đồng sinh viên DUT.</p></div>
        <div class="auth-footnote"><span class="auth-dot"></span>Không gian học tập nội bộ DUT</div>
      </section>
      <section class="auth-form-side">
        <div class="auth-form-wrap">
          <div class="mobile-auth-logo"><span class="brand-mark"><svg lucideBookOpen></svg></span><strong>DUT<span class="brand-dot">.</span></strong></div>
          <span class="eyebrow">CHÀO MỪNG BẠN TRỞ LẠI</span>
          <h2>Đăng nhập</h2>
          <p class="muted">Sử dụng tài khoản sinh viên do nhà trường cấp.</p>
          @if (error()) { <div class="alert alert-error" role="alert">{{ error() }}</div> }
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <label class="field-label" for="studentId">Mã số sinh viên</label>
            <div class="input-wrap"><svg lucideUserRound></svg><input id="studentId" formControlName="studentId" autocomplete="username" placeholder="Ví dụ: 102230000" /></div>
            @if (form.controls.studentId.touched && form.controls.studentId.invalid) { <span class="field-error">Vui lòng nhập MSSV hợp lệ (chỉ gồm chữ số).</span> }
            <div class="password-label"><label class="field-label" for="password">Mật khẩu</label><a routerLink="/login" (click)="$event.preventDefault(); helpMessage.set('Vui lòng liên hệ quản trị viên để được cấp lại mật khẩu.')">Quên mật khẩu?</a></div>
            <div class="input-wrap"><svg lucideLockKeyhole></svg><input id="password" formControlName="password" [type]="showPassword() ? 'text' : 'password'" autocomplete="current-password" placeholder="Nhập mật khẩu" /><button class="password-toggle" type="button" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'">{{ showPassword() ? 'Ẩn' : 'Hiện' }}</button></div>
            @if (form.controls.password.touched && form.controls.password.invalid) { <span class="field-error">Vui lòng nhập mật khẩu.</span> }
            @if (helpMessage()) { <span class="field-hint">{{ helpMessage() }}</span> }
            <button class="btn btn-primary btn-block login-button" type="submit" [disabled]="loading()">{{ loading() ? 'Đang đăng nhập…' : 'Đăng nhập' }}<span>→</span></button>
          </form>
          <div class="auth-divider"><span></span><small>TÀI KHOẢN NỘI BỘ</small><span></span></div>
          <p class="auth-help">Chưa có tài khoản? Liên hệ <strong>quản trị viên khoa</strong> để được cấp tài khoản.</p>
          <div class="security-note"><span>⌑</span><p>Thông tin đăng nhập được bảo vệ và chỉ dành cho thành viên DUT.</p></div>
        </div>
        <footer class="auth-copyright">© Trường Đại học Bách khoa – Đại học Đà Nẵng</footer>
      </section>
    </main>
  `,
})
export class AuthPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly helpMessage = signal('');
  readonly showPassword = signal(false);
  readonly form = new FormGroup({
    studentId: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{6,12}$/)] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  submit(): void {
    this.error.set('');
    this.helpMessage.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    const { studentId, password } = this.form.getRawValue();
    this.auth.login(studentId, password).subscribe({
      next: ({ user }) => {
        this.loading.set(false);
        const destination = user.forcePasswordChange ? '/change-password' : user.role === 'ADMIN' ? '/admin/dashboard' : '/';
        void this.router.navigateByUrl(destination);
      },
      error: (error: { error?: { message?: string } }) => {
        this.loading.set(false);
        this.error.set(error.error?.message || 'MSSV hoặc mật khẩu không chính xác. Vui lòng thử lại.');
      },
    });
  }
}
