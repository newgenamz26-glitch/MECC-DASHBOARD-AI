import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../services/state.service';

interface GuideStep {
  title: string;
  content: string;
  icon: string;
}

@Component({
  selector: 'app-user-guide',
  imports: [CommonModule],
  templateUrl: './user-guide.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserGuideComponent {
  stateSvc = inject(StateService);

  readonly guideSteps: GuideStep[] = [
    {
      title: 'Selamat Datang!',
      icon: '👋',
      content: `
        <p class="text-slate-600">Panduan interaktif ini akan membawa anda melalui fungsi-fungsi utama sistem <strong>MECC AMAL Smart Response</strong>.</p>
        <p class="mt-2 text-slate-600">Klik 'Seterusnya' untuk bermula!</p>
      `
    },
    {
      title: '1. Pemilihan Mod Operasi',
      icon: '🚀',
      content: `
        <p class="text-slate-600">Bermula di skrin utama, anda mempunyai pilihan penting:</p>
        <ul class="list-disc list-inside mt-3 space-y-2 text-slate-600 text-sm">
          <li><strong>Mod Langsung:</strong> Sambung ke pangkalan data Google Sheets sebenar untuk menguruskan acara secara langsung.</li>
          <li><strong>Mod Simulasi:</strong> Gunakan data sampel untuk latihan atau demonstrasi tanpa menjejaskan data sebenar.</li>
        </ul>
        <div class="mt-4 p-3 bg-sky-100/50 border border-sky-200 rounded-lg text-xs text-sky-800">
          <strong>Tip:</strong> Mod Simulasi sangat sesuai untuk membiasakan diri dengan sistem.
        </div>
      `
    },
    {
      title: '2. Papan Pemuka (Dashboard)',
      icon: '📊',
      content: `
        <p class="text-slate-600">Setelah log masuk, Dashboard adalah pusat kawalan anda. Di sini anda boleh memantau:</p>
        <ul class="list-disc list-inside mt-3 space-y-2 text-slate-600 text-sm">
          <li><strong>Program Aktif:</strong> Maklumat program yang sedang berjalan.</li>
          <li><strong>Statistik Utama:</strong> Jumlah kes dan bilangan petugas yang aktif.</li>
          <li><strong>Log Masa Nyata:</strong> Laporan kes dan rekod kehadiran terkini dipaparkan secara automatik.</li>
        </ul>
      `
    },
    {
      title: '3. Pengurusan Program',
      icon: '📂',
      content: `
        <p class="text-slate-600">Tab 'Program' membolehkan anda menguruskan semua acara anda.</p>
        <ul class="list-disc list-inside mt-3 space-y-2 text-slate-600 text-sm">
          <li><strong>Aktifkan Program:</strong> Pilih satu program untuk dipantau di Dashboard. Hanya satu program boleh aktif pada satu masa.</li>
          <li><strong>Tambah Maklumat:</strong> Klik 'Maklumat' untuk menambah butiran operasi seperti Cekpoint dan Ambulans.</li>
          <li><strong>Kemas Kini Status:</strong> Tandakan program sebagai 'Selesai' apabila tamat.</li>
        </ul>
      `
    },
    {
      title: '4. Konfigurasi & Tetapan',
      icon: '⚙️',
      content: `
        <p class="text-slate-600">Tab 'Tetapan' adalah pusat teknikal aplikasi.</p>
        <ul class="list-disc list-inside mt-3 space-y-2 text-slate-600 text-sm">
          <li><strong>Sambungan Cloud:</strong> Sambungkan aplikasi ke Google Apps Script anda.</li>
          <li><strong>Cipta Program Baru:</strong> Rekodkan program baru sebelum ia boleh diuruskan.</li>
          <li><strong>Diagnostik:</strong> Jalankan alatan untuk menyemak kesihatan sistem, seperti menguji GPS dan struktur Helaian Google.</li>
        </ul>
      `
    },
    {
      title: '5. Bantuan AI Pintar',
      icon: '✨',
      content: `
        <p class="text-slate-600">Sistem ini dilengkapi dengan pembantu AI untuk membantu anda membuat keputusan pantas.</p>
        <p class="mt-3 text-slate-600 text-sm">Contohnya, fungsi <strong>'Carian Fasiliti Perubatan'</strong> menggunakan GPS semasa anda untuk mencari hospital dan klinik terdekat, lengkap dengan anggaran jarak perjalanan sebenar.</p>
        <div class="mt-4 p-3 bg-teal-100/50 border border-teal-200 rounded-lg text-xs text-teal-800">
          <strong>Penting:</strong> Fungsi AI memerlukan sambungan internet dan API Key yang sah.
        </div>
      `
    },
    {
      title: 'Panduan Selesai!',
      icon: '🎉',
      content: `
        <p class="text-slate-600">Anda kini telah mempelajari asas-asas penggunaan sistem MECC AMAL.</p>
        <p class="mt-2 text-slate-600">Terokai setiap tab untuk melihat fungsi-fungsi ini secara langsung. Jika anda mempunyai sebarang maklum balas, gunakan butang <strong>'Maklum Balas'</strong> di navigasi bawah.</p>
      `
    }
  ];

  currentStepIndex = signal(0);
  currentStep = computed(() => this.guideSteps[this.currentStepIndex()]);
  progressPercentage = computed(() => ((this.currentStepIndex() + 1) / this.guideSteps.length) * 100);

  nextStep(): void {
    if (this.currentStepIndex() < this.guideSteps.length - 1) {
      this.currentStepIndex.update(i => i + 1);
    } else {
      this.closeGuide();
    }
  }

  previousStep(): void {
    if (this.currentStepIndex() > 0) {
      this.currentStepIndex.update(i => i - 1);
    }
  }

  closeGuide(): void {
    this.stateSvc.isUserGuideVisible.set(false);
    // Reset to first step for next time
    setTimeout(() => this.currentStepIndex.set(0), 300);
  }
}
