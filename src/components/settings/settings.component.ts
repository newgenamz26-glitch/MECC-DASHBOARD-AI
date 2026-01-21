import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CommonModule, JsonPipe } from '@angular/common';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { NotificationService } from '../../services/notification.service';
import { SimulationService } from '../../services/simulation.service';
import { Program } from '../../models';
import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';

interface Feature {
  title: string;
  description: string;
  mode: 'simulasi' | 'live' | 'semua';
  version: number;
}

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, CommonModule, LoadingIndicatorComponent, JsonPipe],
  templateUrl: './settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  stateSvc = inject(StateService);
  private apiSvc = inject(ApiService);
  private notificationSvc = inject(NotificationService);
  private simulationSvc = inject(SimulationService);
  // FIX: Explicitly type injected FormBuilder to fix type inference issues.
  private fb: FormBuilder = inject(FormBuilder);

  isBackendSetupVisible = signal(false);
  isProgramFormVisible = signal(false);
  isConfigVisible = signal(false);
  isVersionInfoVisible = signal(false);
  isVerifying = signal(false);
  isTesting = signal(false);
  programId = signal('');
  isCheckingLatestProgram = signal(false);
  isCheckingNextId = signal(false);
  nextCloudId = signal<string | null>(null);
  isCheckingStructure = signal(false);
  
  isProgramListModalVisible = signal(false);
  allPrograms = signal<Program[]>([]);
  isLoadingPrograms = signal(false);
  lockingProgramId = signal<string | null>(null);

  isSavingToDocs = signal(false);

  // Signals for Add Sample Data feature
  isAddingSampleData = signal(false);
  isSampleDataConfirmVisible = signal(false);

  // Make simulation data available to the template
  simulationData = this.simulationSvc.exportedData;

  // --- Version Info Features ---
  private readonly allFeatures: Feature[] = ([
    { version: 2.4, mode: 'semua', title: 'Log Keluar Global', description: 'Butang log keluar universal di header utama untuk akses mudah.' },
    { version: 2.3, mode: 'simulasi', title: 'Eksport Data Simulasi', description: 'Muat turun semua data sesi latihan (program, kes, kehadiran) sebagai fail JSON.' },
    { version: 2.2, mode: 'simulasi', title: 'Cipta Program Latihan', description: 'Fungsi untuk menambah program baru terus di dalam Mod Simulasi untuk latihan menyeluruh.' },
    { version: 2.1, mode: 'semua', title: 'Antara Muka Disatukan', description: 'Reka bentuk visual yang dikemaskini untuk pengalaman pengguna yang lebih baik.' },
    { version: 2.0, mode: 'simulasi', title: 'Mod Latihan Interaktif', description: 'Pengenalan Mod Simulasi dengan data sampel untuk tujuan latihan dan demo.' },
    { version: 1.0, mode: 'live', title: 'Penyambungan Cloud', description: 'Integrasi dengan Google Sheets untuk pengurusan data secara langsung.' },
  ] as Feature[]).sort((a, b) => b.version - a.version);

  liveAndCommonFeatures = this.allFeatures.filter(f => f.mode === 'live' || f.mode === 'semua');
  simulationFeatures = this.allFeatures.filter(f => f.mode === 'simulasi');

  backendForm = this.fb.group({
    url: [this.stateSvc.gasUrl(), [Validators.required, Validators.pattern('^https://script\\.google\\.com.*')]],
  });

  programForm = this.fb.group({
    name: ['', Validators.required],
    date: ['', Validators.required],
    time: ['', Validators.required],
    location: ['', Validators.required],
  });

  toggleConfigVisibility(): void {
    this.isConfigVisible.update(v => !v);
  }
  
  toggleVersionInfoVisibility(): void {
    this.isVersionInfoVisible.update(v => !v);
  }

  toggleBackendSetup(): void {
    this.isBackendSetupVisible.update(v => !v);
  }

  async toggleProgramForm(): Promise<void> {
    this.isProgramFormVisible.update(v => !v);
    if (this.isProgramFormVisible()) {
      this.programForm.reset();
      const idText = this.stateSvc.isSimulationMode()
        ? 'Akan dijana secara automatik oleh Simulasi'
        : 'Akan dijana secara automatik oleh Cloud';
      this.programId.set(idText);
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
      // Do not set the new program as active automatically.
      this.notificationSvc.show(
        'case', 
        'Program Berjaya Disimpan', 
        `Program "${result.newProgram.namaprogram}" telah direkodkan. Sila aktifkannya di tab 'Program' untuk mula menggunakannya.`
      );
      this.programForm.reset();
      this.isProgramFormVisible.set(false);
      this.stateSvc.programListVersion.update(v => v + 1); // Trigger refresh in other components
    } else {
      const errorMessage = result.message || 'Gagal menyimpan data program ke Cloud.';
      this.notificationSvc.show('error', 'Ralat Menyimpan', errorMessage);
    }
  }

  async validateSheetStructure(): Promise<void> {
    if (!this.stateSvc.backendCapabilities().includes('validateSheets')) {
        this.notificationSvc.show('error', 'Fungsi Tidak Disokong', 'Versi Google Apps Script anda adalah lama. Sila deploy versi terkini.');
        return;
    }

    this.isCheckingStructure.set(true);
    try {
      const result = await this.apiSvc.validateSheets();
      const checks = [
        { name: 'Programs', result: result.programs },
        { name: 'Attendance', result: result.attendance },
        { name: 'CaseReports', result: result.caseReports },
        { name: 'Program Details', result: result.programDetails },
      ];

      const invalidChecks = checks.filter(c => c.result && !c.result.isValid);

      if (invalidChecks.length === 0) {
        this.notificationSvc.show('case', 'Struktur Sah', 'Semua helaian yang diperlukan mempunyai struktur yang betul.');
      } else {
        const errorMessages = invalidChecks.map(c => `${c.name}: ${c.result.message}`);
        this.notificationSvc.show('error', 'Struktur Tidak Sah Dikesan', errorMessages.join('\n'));
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
    
    this.notificationSvc.show('info', 'Maklumat Konfigurasi', message);
  }

  openDatabaseSheet(): void {
    const sheetId = this.stateSvc.spreadsheetId();
    if (sheetId && sheetId !== 'YOUR_SPREADSHEET_ID') {
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
      window.open(url, '_blank');
    } else if (sheetId === 'YOUR_SPREADSHEET_ID') {
      this.notificationSvc.show('error', 'Konfigurasi Tidak Lengkap', 'ID Pangkalan Data perlu ditetapkan di dalam fail skrip Google (Code.gs).');
    } else {
      this.notificationSvc.show('error', 'ID Tidak Ditemui', 'Tidak dapat mendapatkan ID Pangkalan Data dari Cloud. Sila pastikan sambungan aktif.');
    }
  }

  async activateProgram(program: Program): Promise<void> {
    this.lockingProgramId.set(program.id);
    try {
      const result = await this.apiSvc.setProgramStatus(program.id, 'Aktif');
      if (result.success) {
        this.notificationSvc.show('case', 'Program Diaktifkan', `Program "${program.namaprogram}" kini aktif.`);

        // Update local state to reflect the change without a full re-fetch.
        this.allPrograms.update(programs =>
          programs.map(p => {
            if (p.id === program.id) return { ...p, status: 'Aktif' };
            // Deactivate any other program that was active.
            if (p.status === 'Aktif') return { ...p, status: 'Belum Mula' };
            return p;
          })
        );
        
        const activatedProgram: Program = { ...program, status: 'Aktif' };
        this.stateSvc.activeProgram.set(activatedProgram);
        
        // Trigger a refresh for other components like the main program list.
        this.stateSvc.programListVersion.update(v => v + 1);

        this.closeProgramListModal();

      } else {
        throw new Error(result.message || 'Gagal mengaktifkan program.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ralat tidak diketahui.';
      this.notificationSvc.show('error', 'Gagal Mengaktifkan', msg);
    } finally {
      this.lockingProgramId.set(null);
    }
  }

  async toggleLockProgram(program: Program, event: Event): Promise<void> {
    event.stopPropagation();

    if (this.lockingProgramId()) return;

    this.lockingProgramId.set(program.id);
    const newLockedState = !program.locked;
    
    try {
      const result = await this.apiSvc.updateProgram(program.id, { locked: newLockedState });
      if (result.success) {
        this.allPrograms.update(programs => 
          programs.map(p => p.id === program.id ? { ...p, locked: newLockedState } : p)
        );
        this.notificationSvc.show('info', 'Status Dikemaskini', `Program "${program.namaprogram}" telah ${newLockedState ? 'dikunci' : 'dibuka kunci'}.`);
        
        if (this.stateSvc.activeProgram()?.id === program.id) {
          this.stateSvc.activeProgram.update(p => p ? { ...p, locked: newLockedState } : null);
        }
        
        this.stateSvc.programListVersion.update(v => v + 1);
      } else {
        this.notificationSvc.show('error', 'Gagal Mengunci', result.message || 'Ralat tidak diketahui.');
      }
    } catch (error) {
       const errorMessage = error instanceof Error ? error.message : 'Ralat berhubung dengan server.';
       this.notificationSvc.show('error', 'Gagal Mengunci', errorMessage);
    } finally {
      this.lockingProgramId.set(null);
    }
  }

  downloadSimulationData(): void {
    const data = this.simulationSvc.exportedData();
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `mecc-simulation-data-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.notificationSvc.show('info', 'Muat Turun Bermula', 'Fail data simulasi sedang dimuat turun.');
  }

  private _generateFeatureListContent(): string {
    let content = `Dokumen: Ringkasan Ciri-ciri & Fungsi Sistem MECC AMAL v2.4\n\n`;
    content += `Dokumen ini memberikan gambaran keseluruhan tentang keupayaan aplikasi MECC AMAL Smart Response, merangkumi fungsi utama, ciri terkini, dan aliran kerja yang disyorkan.\n\n`;

    content += `## Mod Langsung & Umum\n`;
    this.liveAndCommonFeatures.forEach(feature => {
      content += `* v${feature.version} - ${feature.title}: ${feature.description}\n`;
    });
    content += `\n`;

    content += `## Mod Simulasi\n`;
    this.simulationFeatures.forEach(feature => {
      content += `* v${feature.version} - ${feature.title}: ${feature.description}\n`;
    });

    return content;
  }

  async saveFeaturesToDocs(): Promise<void> {
    this.isSavingToDocs.set(true);
    const title = 'MECC AMAL v2.4 Feature List';
    const content = this._generateFeatureListContent();

    try {
      const result = await this.apiSvc.saveFeatureListToDocs(title, content);
      if (result.success && result.url) {
        window.open(result.url, '_blank');
        this.notificationSvc.show('case', 'Dokumen Dicipta', 'Senarai ciri telah berjaya disimpan ke Google Drive anda dan dibuka dalam tab baru.');
      } else {
        throw new Error(result.message || 'Gagal mencipta dokumen di Google Drive.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ralat tidak diketahui.';
      this.notificationSvc.show('error', 'Gagal Menyimpan', msg);
    } finally {
      this.isSavingToDocs.set(false);
    }
  }

  showSampleDataConfirm(): void {
    this.isSampleDataConfirmVisible.set(true);
  }

  hideSampleDataConfirm(): void {
    this.isSampleDataConfirmVisible.set(false);
  }

  async confirmAddSampleData(): Promise<void> {
    this.hideSampleDataConfirm();
    this.isAddingSampleData.set(true);
    try {
        const result = await this.apiSvc.addSampleDataToCloud();
        if (result.success) {
            this.notificationSvc.show('case', 'Data Sampel Ditambah', result.message || 'Data sampel berjaya ditambah.');
        } else {
            throw new Error(result.message || 'Gagal menambah data sampel.');
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Ralat tidak diketahui.';
        this.notificationSvc.show('error', 'Operasi Gagal', msg);
    } finally {
        this.isAddingSampleData.set(false);
    }
  }

  formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    return dateString.substring(0, 10);
  }

  formatTime(timeString?: string): string {
    if (!timeString) return 'N/A';
    if (timeString.includes('T')) {
        try {
            const date = new Date(timeString);
            if (isNaN(date.getTime())) return timeString;
            const hours = ('0' + date.getHours()).slice(-2);
            const minutes = ('0' + date.getMinutes()).slice(-2);
            return `${hours}:${minutes}`;
        } catch (e) {
            return timeString;
        }
    }
    return timeString;
  }
}