import { Component, ChangeDetectionStrategy, output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-feedback-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './feedback-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedbackFormComponent {
  close = output<void>();

  private apiSvc = inject(ApiService);
  private notificationSvc = inject(NotificationService);
  private fb: FormBuilder = inject(FormBuilder);

  isSubmitting = signal(false);
  currentRating = signal(0);
  
  feedbackTypes = [
    { id: 'Laporan Pepijat', label: 'Laporan Ralat', icon: '🐞' },
    { id: 'Cadangan Fungsi', label: 'Cadangan', icon: '💡' },
    { id: 'Komen Umum', label: 'Komen Umum', icon: '💬' }
  ];

  feedbackForm = this.fb.group({
    feedbackType: ['', Validators.required],
    rating: [0, [Validators.required, Validators.min(1)]],
    message: ['', [Validators.required, Validators.minLength(10)]],
    contactInfo: [''],
  });

  setRating(rating: number): void {
    this.currentRating.set(rating);
    this.feedbackForm.get('rating')?.setValue(rating);
  }
  
  setFeedbackType(type: string): void {
    this.feedbackForm.get('feedbackType')?.setValue(type);
  }

  async sendFeedback(): Promise<void> {
    if (this.feedbackForm.invalid) {
      this.notificationSvc.show('error', 'Borang Tidak Lengkap', 'Sila pilih jenis maklum balas, beri penarafan, dan tulis mesej anda.');
      return;
    }

    this.isSubmitting.set(true);
    try {
      const payload = this.feedbackForm.value;
      const result = await this.apiSvc.sendFeedback({
        feedbackType: payload.feedbackType || 'N/A',
        rating: payload.rating || 0,
        message: payload.message || '',
        contactInfo: payload.contactInfo || ''
      });
      if (result.success) {
        this.notificationSvc.show('case', 'Terima Kasih!', result.message || 'Maklum balas anda telah berjaya dihantar.');
        this.close.emit();
      } else {
        throw new Error(result.message);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ralat tidak diketahui.';
      this.notificationSvc.show('error', 'Gagal Menghantar', msg);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
