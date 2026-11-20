import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideBookOpen, LucideLockKeyhole } from '@lucide/angular';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-change-password',
  imports: [ReactiveFormsModule, LucideBookOpen, LucideLockKeyhole],
  template: `
    <main class="auth-page password-page">
      <section class="auth-brand-panel"><a class="brand auth-brand" href="/"><span class="brand-mark"><svg lucideBookOpen></svg></span><span><strong>DUT<span class="brand-dot">.</span></strong><small>Kho tri thức sinh viên</small></span></a><div class="auth-message"><span class="eyebrow eyebrow-light">BẢO MẬT TÀI KHOẢN</span><h1>Một bước nhỏ<br>cho trải nghiệm<br><em>an toàn hơn.</em></h1><p>Hãy tạo mật khẩu mới để tiếp tục sử dụng nền tảng.</p></div></section>
      <section class="auth-form-side"><div class="auth-form-wrap">
        <span class="eyebrow">CẬP NHẬT BẢO MẬT</span><h2>Đổi mật khẩu</h2><p class="muted">Tài khoản cần đổi mật khẩu trước khi tiếp tục.</p>
        @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
        @if (success()) { <div class="alert alert-success">{{ success() }}</div> }
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label class="field-label" for="old">Mật khẩu hiện tại</label><div class="input-wrap"><svg lucideLockKeyhole></svg><input id="old" type="password" formControlName="currentPassword" autocomplete="current-password" /></div>
          <label class="field-label spaced-label" for="new">Mật khẩu mới</label><div class="input-wrap"><svg lucideLockKeyhole></svg><input id="new" type="password" formControlName="newPassword" autocomplete="new-password" /></div>
          <div class="strength"><span [class.strength-active]="form.controls.newPassword.value.length >= 8"></span><span [class.strength-active]="hasMixedCase"></span><span [class.strength-active]="hasNumber"></span><small>{{ strengthLabel }}</small></div>
          @if (form.controls.newPassword.touched && form.controls.newPassword.invalid) { <span class="field-error">Mật khẩu mới cần ít nhất 10 ký tự.</span> }
          <label class="field-label spaced-label" for="confirm">Xác nhận mật khẩu mới</label><div class="input-wrap"><svg lucideLockKeyhole></svg><input id="confirm" type="password" formControlName="confirmPassword" autocomplete="new-password" /></div>
          @if (form.controls.confirmPassword.touched && form.controls.confirmPassword.value !== form.controls.newPassword.value) { <span class="field-error">Mật khẩu xác nhận chưa khớp.</span> }
          <button class="btn btn-primary btn-block login-button" type="submit" [disabled]="loading()">{{ loading() ? 'Đang cập nhật…' : 'Cập nhật mật khẩu' }}<span>→</span></button>
        </form>
        <button class="text-button" (click)="auth.logout()">Đăng xuất</button>
      </div></section>
    </main>
  `,
})
export class ChangePasswordComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly form = new FormGroup({
    currentPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
    newPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(10), Validators.maxLength(128)] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });
  get hasMixedCase(): boolean { return /[A-Z]/.test(this.form.controls.newPassword.value) && /[a-z]/.test(this.form.controls.newPassword.value); }
  get hasNumber(): boolean { return /\d/.test(this.form.controls.newPassword.value); }
  get strengthLabel(): string {
    const score = [this.form.controls.newPassword.value.length >= 10, this.hasMixedCase, this.hasNumber].filter(Boolean).length;
    return score < 2 ? 'Mật khẩu yếu' : score === 2 ? 'Mật khẩu trung bình' : 'Mật khẩu tốt';
  }
  submit(): void {
    this.error.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid || this.form.controls.newPassword.value !== this.form.controls.confirmPassword.value) return;
    this.loading.set(true);
    const { currentPassword, newPassword } = this.form.getRawValue();
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set('Đổi mật khẩu thành công.');
        const user = this.auth.user();
        if (user) {
          void this.router.navigateByUrl(user.role === 'ADMIN' ? '/admin/dashboard' : '/');
        }
      },
      error: (error: { error?: { message?: string } }) => {
        this.loading.set(false);
        this.error.set(error.error?.message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại thông tin.');
      },
    });
  }
}
