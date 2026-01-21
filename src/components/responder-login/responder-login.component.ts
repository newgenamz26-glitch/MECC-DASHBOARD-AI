import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-responder-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './responder-login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResponderLoginComponent {
  stateSvc = inject(StateService);
  private apiSvc = inject(ApiService);
  private fb: FormBuilder = inject(FormBuilder);
  private notificationSvc = inject(NotificationService);

  isSubmitting = signal(false);
  roles = ['PIC Program', 'SU', 'MECC'];

  loginForm = this.fb.group({
    role: [this.roles[0], Validators.required],
    name: ['', Validators.required],
  });

  async login(): Promise<void> {
    if (this.loginForm.invalid) {
      this.notificationSvc.show('error', 'Borang Tidak Lengkap', 'Sila pilih tugas dan masukkan nama anda.');
      return;
    }
    this.isSubmitting.set(true);
    const { name, role } = this.loginForm.value;
    
    const result = await this.apiSvc.loginResponder(name!, role!);

    if (result.success) {
      this.stateSvc.loggedInResponder.set({ name: name!, role: role! });
      this.stateSvc.isLoggedIn.set(true);
      this.stateSvc.isResponderLoginFlow.set(false);
    } else {
      this.notificationSvc.show('error', 'Log Masuk Gagal', result.message || 'Satu ralat telah berlaku.');
      this.isSubmitting.set(false);
    }
  }

  goBack(): void {
    this.stateSvc.isResponderLoginFlow.set(false);
  }
}
