import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CommonModule, JsonPipe } from '@angular/common';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { NotificationService } from '../../services/notification.service';
import { SimulationService } from '../../services/simulation.service';
import { Program } from '../../models';
import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';
import { GpsService } from '../../services/gps.service';

interface Feature {
  title: string;
  description: string;
  mode: 'simulasi' | 'live' | 'semua';
  category: string;
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
  private gpsSvc = inject(GpsService);
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
  isTestingGps = signal(false);
  
  isProgramListModalVisible = signal(false);
  allPrograms = signal<Program[]>([]);
  isLoadingPrograms = signal(false);
  lockingProgramId = signal<string | null>(null);

  isSavingToDocs = signal(false);
  isArchiving = signal(false);
  archivedVersionUrl = signal<string | null>(null);

  isAddingSampleData = signal(false);
  isSampleDataConfirmVisible = signal(false);

  simulationData = this.simulationSvc.exportedData;

  private readonly allFeatures: Feature[] = [
    { category: 'Bantuan AI & Pintar', mode: 'semua', title: 'Carian Fasiliti Pintar', description: 'Menggunakan AI dan data GPS untuk mencari hospital dan klinik berdekatan.' },
    { category: 'Bantuan AI & Pintar', mode: 'semua', title: 'Pengiraan Jarak Tepat', description: 'AI diarah untuk mengira jarak perjalanan darat sebenar untuk ketepatan maksimum.' },
    { category: 'Bantuan AI & Pintar', mode: 'semua', title: 'Integrasi Peta Google', description: 'Setiap fasiliti dalam hasil carian boleh dibuka terus dalam Peta Google.' },
    { category: 'Modul Petugas (Responder)', mode: 'simulasi', title: 'Dashboard Petugas', description: 'Antara muka khas untuk petugas di lapangan, memaparkan info program aktif dan akses kepada alatan AI.' },
    { category: 'Modul Petugas (Responder)', mode: 'simulasi', title: 'Log Masuk Petugas', description: 'Aliran log masuk berasingan untuk petugas bagi tujuan latihan dalam Mod Simulasi.' },
    { category: 'Sistem Teras & Antara Muka', mode: 'semua', title: 'Antara Muka Bersepadu', description: 'Reka bentuk yang kemas dan moden untuk pengalaman pengguna yang lebih baik.' },
    { category: 'Sistem Teras & Antara Muka', mode: 'semua', title: 'Log Keluar Global', description: 'Butang log keluar universal di header utama untuk akses mudah.' },
    { category: 'Sistem Teras & Antara Muka', mode: 'semua', title: 'Status GPS & Cloud Langsung', description: 'Penunjuk status masa nyata untuk sambungan GPS dan Cloud di header.' },
    { category: 'Sistem Teras & Antara Muka', mode: 'semua', title: 'Sistem Maklum Balas', description: 'Borang bersepadu untuk menghantar maklum balas, cadangan, atau laporan ralat kepada pembangun.' },
    { category: 'Pengurusan Program', mode: 'semua', title: 'Pengurusan Program Berpusat', description: 'Papar, aktifkan, nyahaktifkan, dan tandakan program sebagai selesai.' },
    { category: 'Pengurusan Program', mode: 'semua', title: 'Perancangan Operasi Terperinci', description: 'Tambah dan urus butiran seperti Cekpoint, Ambulans, dan maklumat lain untuk setiap program.' },
    { category: 'Pengurusan Program', mode: 'live', title: 'Kunci Program (Locked)', description: 'Kunci program untuk mengelakkan sebarang suntingan yang tidak disengajakan.' },
    { category: 'Pengurusan Program', mode: 'semua', title: 'Cadangan Autolengkap', description: 'Cadangan untuk lokasi dan nombor kenderaan yang pernah digunakan untuk mempercepatkan kemasukan data.' },
    { category: 'Dashboard & Pemantauan', mode: 'semua', title: 'Dashboard Masa Nyata', description: 'Pemantauan langsung petugas aktif, laporan kes, dan butiran operasi.' },
    { category: 'Dashboard & Pemantauan', mode: 'semua', title: 'Log Interaktif', description: 'Sejarah kehadiran dan laporan kes yang boleh disembunyi/dipapar.' },
    { category: 'Dashboard & Pemantauan', mode: 'semua', title: 'Penyegaran Auto & Manual', description: 'Data disegarkan secara automatik, dengan pilihan untuk penyegaran manual.' },
    { category: 'Simulasi & Latihan', mode: 'simulasi', title: 'Mod Simulasi Interaktif', description: 'Persekitaran selamat untuk latihan dengan penjanaan data kehadiran dan kes secara automatik.' },
    { category: 'Simulasi & Latihan', mode: 'simulasi', title: 'Eksport Data Simulasi', description: 'Muat turun semua data dari sesi latihan sebagai fail JSON.' },
    { category: 'Simulasi & Latihan', mode: 'simulasi', title: 'Cipta Program Latihan', description: 'Buat program baru terus di dalam mod simulasi.' },
    { category: 'Sistem & Diagnostik', mode: 'live', title: 'Konfigurasi Cloud', description: 'Sambungkan aplikasi kepada pangkalan data Google Sheets anda.' },
    { category: 'Sistem & Diagnostik', mode: 'semua', title: 'Alatan Diagnostik', description: 'Uji GPS, sahkan struktur sheet, dan paparkan maklumat konfigurasi semasa.' },
    { category: 'Sistem & Diagnostik', mode: 'live', title: 'Tambah Data Sampel', description: 'Masukkan data operasi sampel (Cekpoint, Ambulans) ke program terkini untuk persediaan pantas.' },
    { category: 'Sistem & Diagnostik', mode: 'live', title: 'Arkib Versi', description: 'Cipta salinan senarai ciri aplikasi semasa ke dalam Google Doc.' },
    { category: 'Sistem & Diagnostik', mode: 'semua', title: 'Panduan Pengguna PDF', description: 'Jana, muat turun, dan kongsi panduan pengguna lengkap dalam format PDF.' },
  ];
  
  featureCategories = [...new Set(this.allFeatures.map(f => f.category))];

  getFeaturesByCategory(category: string, mode: 'semua' | 'simulasi') {
      const targetModes = mode === 'semua' ? ['semua', 'live'] : ['semua', 'simulasi'];
      return this.allFeatures.filter(f => f.category === category && targetModes.includes(f.mode));
  }

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
    this.nextCloudId.set(null);
    await new Promise(resolve => setTimeout(resolve, 300));
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
    this.allPrograms.set([]);
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
    
    const payload = {
        name: this.programForm.value.name,
        date: this.programForm.value.date,
        time: this.programForm.value.time,
        location: this.programForm.value.location
    };

    const result = await this.apiSvc.saveProgram(payload);

    if (result.success && result.newProgram) {
      this.notificationSvc.show(
        'case', 
        'Program Berjaya Disimpan', 
        `Program "${result.newProgram.namaprogram}" telah direkodkan. Sila aktifkannya di tab 'Program' untuk mula menggunakannya.`
      );
      this.programForm.reset();
      this.isProgramFormVisible.set(false);
      this.stateSvc.programListVersion.update(v => v + 1);
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

  async testGps(): Promise<void> {
    this.isTestingGps.set(true);
    const result = await this.gpsSvc.testCurrentLocation();
    
    if (result.status === 'CONNECTED' && result.position) {
      const { latitude, longitude, accuracy } = result.position;
      this.notificationSvc.show(
        'case', 
        'GPS Berjaya', 
        `Lokasi semasa:\nLat: ${latitude.toFixed(6)}\nLon: ${longitude.toFixed(6)}\n(Ketepatan: ${accuracy.toFixed(1)} meter)`
      );
    } else {
      let message = 'Tidak dapat mendapatkan lokasi GPS.';
      if (result.status === 'UNSUPPORTED') {
        message = 'Peranti ini tidak menyokong GPS.';
      } else if (result.status === 'ERROR') {
        message = 'Ralat berlaku semasa mendapatkan lokasi. Pastikan anda telah memberi kebenaran.';
      }
      this.notificationSvc.show('error', 'Ujian GPS Gagal', message);
    }
    
    this.isTestingGps.set(false);
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

        this.allPrograms.update(programs =>
          programs.map(p => {
            if (p.id === program.id) return { ...p, status: 'Aktif' };
            if (p.status === 'Aktif') return { ...p, status: 'Belum Mula' };
            return p;
          })
        );
        
        const activatedProgram: Program = { ...program, status: 'Aktif' };
        this.stateSvc.activeProgram.set(activatedProgram);
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
    let content = `Dokumen: Ringkasan Ciri-ciri & Fungsi Sistem MECC AMAL v2.6\n\n`;
    content += `Dokumen ini memberikan gambaran keseluruhan tentang keupayaan aplikasi MECC AMAL Smart Response.\n\n`;

    this.featureCategories.forEach(category => {
      content += `## ${category}\n`;
      const features = this.getFeaturesByCategory(category, 'semua');
      features.forEach(feature => {
        content += `* ${feature.title}: ${feature.description}\n`;
      });
      content += `\n`;
    });

    return content;
  }

  async archiveCurrentVersion(): Promise<void> {
    this.isArchiving.set(true);
    const title = `Arkib Versi MECC AMAL (${new Date().toLocaleString('ms-MY')})`;
    const content = this._generateFeatureListContent();

    try {
      const result = await this.apiSvc.saveFeatureListToDocs(title, content);
      if (result.success && result.url) {
        this.archivedVersionUrl.set(result.url);
        this.notificationSvc.show('case', 'Versi Diarkibkan', 'Snapshot ciri-ciri versi ini telah disimpan ke Google Drive.');
      } else {
        throw new Error(result.message || 'Gagal mencipta dokumen arkib di Google Drive.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ralat tidak diketahui.';
      this.notificationSvc.show('error', 'Gagal Mengarkib', msg);
    } finally {
      this.isArchiving.set(false);
    }
  }

  async saveFeaturesToDocs(): Promise<void> {
    this.isSavingToDocs.set(true);
    const title = 'MECC AMAL v2.6 Feature List';
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

  openUserGuide(): void {
    this.stateSvc.isUserGuideVisible.set(true);
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
