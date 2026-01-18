import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { NotificationService } from '../../services/notification.service';
import { Program } from '../../models';
import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, LoadingIndicatorComponent],
  templateUrl: './settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  stateSvc = inject(StateService);
  private apiSvc = inject(ApiService);
  private notificationSvc = inject(NotificationService);
  private fb = inject(FormBuilder);

  isBackendSetupVisible = signal(false);
  isProgramFormVisible = signal(false);
  isVerifying = signal(false);
  isTesting = signal(false);
  programId = signal('');
  isCheckingLatestProgram = signal(false);
  isGeneratingManualId = signal(false);
  manualGeneratedId = signal<string | null>(null);
  isCheckingNextId = signal(false);
  nextCloudId = signal<string | null>(null);
  isCheckingStructure = signal(false);
  
  isProgramListModalVisible = signal(false);
  allPrograms = signal<Program[]>([]);
  isLoadingPrograms = signal(false);

  backendForm = this.fb.group({
    url: [this.stateSvc.gasUrl(), [Validators.required, Validators.pattern('^https://script\\.google\\.com.*')]],
  });

  programForm = this.fb.group({
    name: ['', Validators.required],
    date: ['', Validators.required],
    time: ['', Validators.required],
    location: ['', Validators.required],
  });

  toggleBackendSetup(): void {
    this.isBackendSetupVisible.update(v => !v);
  }

  async toggleProgramForm(): Promise<void> {
    this.isProgramFormVisible.update(v => !v);
    if (this.isProgramFormVisible()) {
      this.programForm.reset();
      this.programId.set('Akan dijana secara automatik oleh Cloud');
    }
  }

  async verifyCloud(): Promise<void> {
    if (this.backendForm.invalid) {
      this.notificationSvc.show('error', 'URL Tidak Sah', 'URL mestilah bermula dengan https://script.google.com...');
      return;
    }
    this.isVerifying.set(true);
    const url = this.backendForm.value.url || '';
    this.stateSvc.gasUrl.set(url);
    const isSuccess = await this.apiSvc.ping();
    this.stateSvc.isCloudConnected.set(isSuccess);
    if (isSuccess) {
        this.notificationSvc.show('login', 'Cloud Aktif!', 'Sistem berjaya disambungkan ke pangkalan data Cloud anda.');
        this.isBackendSetupVisible.set(false);
    } else {
        this.notificationSvc.show('error', 'Gagal Sambung', 'Sila pastikan URL betul dan Web App di-deploy sebagai "Anyone".');
    }
    this.isVerifying.set(false);
  }

  async testConnection(): Promise<void> {
    if (!this.stateSvc.gasUrl()) {
        this.notificationSvc.show('error', 'Tiada URL', 'Sila masukkan URL Cloud terlebih dahulu.');
        return;
    }
    this.isTesting.set(true);
    const isSuccess = await this.apiSvc.ping();
    this.stateSvc.isCloudConnected.set(isSuccess);
    if (isSuccess) {
        this.notificationSvc.show('login', 'Sambungan Berjaya!', 'Berjaya berhubung dengan pangkalan data Cloud.');
    } else {
        this.notificationSvc.show('error', 'Sambungan Gagal', 'Tidak dapat berhubung dengan Cloud. Semak URL dan status deploy.');
    }
    this.isTesting.set(false);
  }

  resetCloud(): void {
    this.stateSvc.gasUrl.set('');
    this.stateSvc.isCloudConnected.set(false);
    this.backendForm.patchValue({ url: '' });
    this.notificationSvc.show('logout', 'Sambungan Direset', 'Sila masukkan URL Cloud yang baru.');
  }

  async checkLatestProgram(): Promise<void> {
    this.isCheckingLatestProgram.set(true);
    try {
      const latestProgram = await this.apiSvc.getLatestProgram();
      if (latestProgram) {
        this.notificationSvc.show(
          'case',
          'Program Terkini Ditemui',
          `ID: ${latestProgram.id} - ${latestProgram.namaprogram}`
        );
      } else {
        this.notificationSvc.show(
          'logout',
          'Tiada Program',
          'Tiada program ditemui di dalam pangkalan data Cloud.'
        );
      }
    } catch (error) {
      const errorMessage = (error instanceof Error) ? error.message : 'Ralat tidak diketahui berlaku.';
      this.notificationSvc.show(
        'error',
        'Gagal Menyemak',
        errorMessage
      );
    } finally {
      this.isCheckingLatestProgram.set(false);
    }
  }

  async generateManualProgramId(): Promise<void> {
    this.isGeneratingManualId.set(true);
    this.manualGeneratedId.set(null); // Clear previous result
    await new Promise(resolve => setTimeout(resolve, 300)); // UX delay
    try {
      // Re-add local generator for this specific diagnostic tool
      const today = new Date();
      const year = today.getFullYear().toString();
      const month = ('0' + (today.getMonth() + 1)).slice(-2);
      const day = ('0' + today.getDate()).slice(-2);
      const datePart = year + month + day;
      const suffix = Date.now().toString().slice(-4).padStart(4, '0');
      const newId = `${datePart}-${suffix}`;
      this.manualGeneratedId.set(newId);
    } catch (error) {
      const errorMessage = (error instanceof Error) ? error.message : 'Ralat tidak diketahui berlaku.';
      this.manualGeneratedId.set('RALAT');
      this.notificationSvc.show(
        'error',
        'Gagal Jana ID Manual',
        errorMessage
      );
    } finally {
      this.isGeneratingManualId.set(false);
    }
  }

  async checkNextCloudId(): Promise<void> {
    this.isCheckingNextId.set(true);
    this.nextCloudId.set(null); // Clear previous result
    await new Promise(resolve => setTimeout(resolve, 300)); // UX delay
    try {
      const newId = await this.apiSvc.getNewProgramId();
      this.nextCloudId.set(newId);
    } catch (error) {
      const errorMessage = (error instanceof Error) ? error.message : 'Ralat tidak diketahui berlaku.';
      this.nextCloudId.set('RALAT');
      this.notificationSvc.show(
        'error',
        'Gagal Semak ID Cloud',
        errorMessage
      );
    } finally {
      this.isCheckingNextId.set(false);
    }
  }
  
  async openProgramListModal(): Promise<void> {
    this.isProgramListModalVisible.set(true);
    this.isLoadingPrograms.set(true);
    this.allPrograms.set([]); // Clear previous data
    try {
        const programs = await this.apiSvc.getPrograms();
        this.allPrograms.set(programs);
    } catch (error) {
        console.error("Failed to fetch all programs:", error);
        this.notificationSvc.show('error', 'Gagal Muat Turun', 'Tidak dapat memuat turun senarai program dari Cloud.');
    } finally {
        this.isLoadingPrograms.set(false);
    }
  }

  closeProgramListModal(): void {
    this.isProgramListModalVisible.set(false);
  }

  async saveProgram(): Promise<void> {
    if (this.programForm.invalid) {
      this.notificationSvc.show('error', 'Maklumat Tidak Lengkap', 'Sila lengkapkan semua butiran program.');
      return;
    }
    
    // The server will generate the ID, so we don't send it.
    const payload = {
        name: this.programForm.value.name,
        date: this.programForm.value.date,
        time: this.programForm.value.time,
        location: this.programForm.value.location
    };

    const result = await this.apiSvc.saveProgram(payload);

    if (result.success && result.newProgram) {
      this.stateSvc.activeProgram.set(result.newProgram);
      this.notificationSvc.show('case', 'Program Disimpan', `Program "${result.newProgram.namaprogram}" (ID: ${result.newProgram.id}) berjaya disimpan.`);
      this.programForm.reset();
      this.isProgramFormVisible.set(false);
      this.stateSvc.programListVersion.update(v => v + 1); // Trigger refresh in other components
    } else {
      const errorMessage = result.message || 'Gagal menyimpan data program ke Cloud.';
      this.notificationSvc.show('error', 'Ralat Menyimpan', errorMessage);
    }
  }

  async validateSheetStructure(): Promise<void> {
    // Check if backend supports this feature
    if (!this.stateSvc.backendCapabilities().includes('validateSheets')) {
        this.notificationSvc.show(
            'error', 
            'Fungsi Tidak Disokong', 
            'Versi Google Apps Script anda adalah lama. Sila deploy versi terkini untuk menggunakan fungsi ini.'
        );
        return;
    }

    this.isCheckingStructure.set(true);
    try {
      const result = await this.apiSvc.validateSheets();
      const { programs, attendance } = result;

      if (programs.isValid && attendance.isValid) {
        this.notificationSvc.show('case', 'Struktur Sah', 'Kedua-dua sheet Programs dan Attendance mempunyai header yang betul.');
      } else {
        let errorParts: string[] = [];
        if (!programs.isValid) {
          errorParts.push(`Programs: ${programs.message}`);
        }
        if (!attendance.isValid) {
          errorParts.push(`Attendance: ${attendance.message}`);
        }
        this.notificationSvc.show('error', 'Struktur Tidak Sah', errorParts.join(' '));
      }
    } catch (error) {
      const errorMessage = (error instanceof Error) ? error.message : 'Gagal menjalankan semakan struktur.';
      this.notificationSvc.show('error', 'Ralat Semakan', errorMessage);
    } finally {
      this.isCheckingStructure.set(false);
    }
  }

  showConfigInfo(): void {
    const url = this.stateSvc.gasUrl();
    const sheetConfig = this.stateSvc.sheetNames();
    
    let sheetInfo = 'Tidak diketahui (deploy skrip terkini).';
    if (sheetConfig) {
        sheetInfo = Object.values(sheetConfig).join(', ');
    }
    
    const message = `URL Cloud:\n${url}\n\nHelaian Digunakan:\n${sheetInfo}`;
    
    this.notificationSvc.show(
        'info',
        'Maklumat Konfigurasi',
        message
    );
  }
}