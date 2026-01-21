import { Component, ChangeDetectionStrategy, input, output, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { NotificationService } from '../../services/notification.service';
import { Program } from '../../models';

@Component({
  selector: 'app-program-edit',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './program-edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgramEditComponent implements OnInit {
  program = input.required<Program>();
  close = output<void>();
  saved = output<Program>();

  private apiSvc = inject(ApiService);
  private notificationSvc = inject(NotificationService);
  // FIX: Explicitly type injected FormBuilder to fix type inference issues.
  private fb: FormBuilder = inject(FormBuilder);
  
  isSubmitting = signal(false);

  editForm = this.fb.group({
    namaprogram: ['', Validators.required],
    tarikh: ['', Validators.required],
    masa: ['', Validators.required],
    lokasi: ['', Validators.required],
  });

  ngOnInit(): void {
    this.editForm.patchValue({
        namaprogram: this.program().namaprogram,
        tarikh: this.formatDateForInput(this.program().tarikh),
        masa: this.program().masa,
        lokasi: this.program().lokasi
    });
  }
  
  async saveChanges(): Promise<void> {
    if (this.editForm.invalid) {
        this.notificationSvc.show('error', 'Borang Tidak Lengkap', 'Sila isi semua medan yang diperlukan.');
        return;
    }
    
    this.isSubmitting.set(true);
    try {
        const result = await this.apiSvc.updateProgram(this.program().id, this.editForm.value);
        if (result.success) {
            this.notificationSvc.show('case', 'Berjaya Dikemaskini', 'Maklumat program telah berjaya disimpan.');
            const updatedProgram: Program = {
              ...this.program(),
              namaprogram: this.editForm.value.namaprogram || '',
              tarikh: this.editForm.value.tarikh || '',
              masa: this.editForm.value.masa || '',
              lokasi: this.editForm.value.lokasi || ''
            };
            this.saved.emit(updatedProgram);
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Ralat tidak diketahui semasa menyimpan.';
        this.notificationSvc.show('error', 'Gagal Mengemas Kini', msg);
    } finally {
        this.isSubmitting.set(false);
    }
  }

  private formatDateForInput(dateString?: string): string {
    if (!dateString) return '';
    // Ensures the date is in YYYY-MM-DD format for the date input
    return dateString.split('T')[0];
  }
}
