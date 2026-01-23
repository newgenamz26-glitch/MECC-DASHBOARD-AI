import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../services/state.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { NotificationService } from '../../services/notification.service';

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
  private notificationSvc = inject(NotificationService);
  
  isGeneratingPdf = signal(false);

  readonly guideSteps: GuideStep[] = [
    {
      title: 'Selamat Datang!',
      icon: '👋',
      content: `
        <p class="text-slate-600">Panduan interaktif ini akan membawa anda melalui fungsi-fungsi utama sistem <strong>MECC AMAL Smart Response v2.6</strong>.</p>
        <p class="mt-2 text-slate-600">Panduan ini disusun mengikut aliran kerja sistem, dari persediaan awal hingga ke penjanaan laporan. Klik 'Seterusnya' untuk bermula!</p>
      `
    },
    {
      title: '1. Pemilihan Mod Operasi',
      icon: '🚀',
      content: `
        <p class="text-slate-600">Setiap sesi bermula di skrin utama di mana anda memilih mod operasi.</p>
        <img src="https://placehold.co/400x250/0c4a6e/white?text=MECC+AMAL\n\n[+Mod+Langsung+]\n\n[+Mod+Simulasi+]\n\n[+Log+Masuk+Petugas+]" alt="Skrin Pemilihan Mod" class="my-3 rounded-lg shadow-md border border-slate-200" />
        <ul class="list-disc list-inside mt-3 space-y-2 text-slate-600 text-sm">
          <li><strong>Mod Langsung:</strong> Sambung ke pangkalan data Google Sheets sebenar untuk menguruskan acara secara langsung.</li>
          <li><strong>Mod Simulasi:</strong> Gunakan data sampel untuk latihan atau demonstrasi tanpa menjejaskan data sebenar.</li>
        </ul>
      `
    },
    {
      title: '2. Tab Tetapan (Penyediaan Awal)',
      icon: '⚙️',
      content: `
        <p class="text-slate-600">Sebelum memulakan program, semua konfigurasi dilakukan di sini.</p>
        <img src="https://placehold.co/400x250/f0f9ff/334155?text=Pengurusan+Program\n\nTetapan+Cloud\n\nDiagnostik+&+Alat+Bantuan" alt="Tab Tetapan" class="my-3 rounded-lg shadow-md border border-slate-200" />
        <ul class="list-disc list-inside mt-3 space-y-2 text-slate-600 text-sm">
          <li><strong>Sambungan Cloud:</strong> Sambungkan aplikasi ke URL Google Apps Script anda.</li>
          <li><strong>Cipta Program Baru:</strong> Rekodkan butiran awal program baru seperti nama, tarikh, dan lokasi.</li>
          <li><strong>Diagnostik:</strong> Jalankan alatan untuk menguji GPS dan mengesahkan struktur Helaian Google anda.</li>
        </ul>
      `
    },
    {
      title: '3. Tab Program (Pengurusan)',
      icon: '📂',
      content: `
        <p class="text-slate-600">Setelah program dicipta, uruskannya melalui tab ini.</p>
        <img src="https://placehold.co/400x250/f0f9ff/334155?text=Senarai+Program\n\n[+Program+A+(Aktif)+]\n\n[+Program+B+]" alt="Tab Program" class="my-3 rounded-lg shadow-md border border-slate-200" />
        <ul class="list-disc list-inside mt-3 space-y-2 text-slate-600 text-sm">
          <li><strong>Aktifkan Program:</strong> Pilih satu program untuk dipantau di Dashboard. Hanya satu program boleh aktif pada satu masa.</li>
          <li><strong>Tambah Maklumat Operasi:</strong> Klik butang 'Maklumat' untuk menambah butiran penting seperti Cekpoint dan Ambulans.</li>
          <li><strong>Kemas Kini Status:</strong> Tandakan program sebagai 'Selesai' apabila tamat.</li>
        </ul>
      `
    },
    {
      title: '4. Tab Dashboard (Pemantauan)',
      icon: '📊',
      content: `
        <p class="text-slate-600">Dashboard adalah pusat kawalan anda semasa program berjalan.</p>
        <img src="https://placehold.co/400x250/f0f9ff/334155?text=Program+Aktif:...\n\nStatistik\n\nLaporan+Kes\n\nSenarai+Bertugas" alt="Tab Dashboard" class="my-3 rounded-lg shadow-md border border-slate-200" />
        <ul class="list-disc list-inside mt-3 space-y-2 text-slate-600 text-sm">
          <li><strong>Data Masa Nyata:</strong> Pantau laporan kes dan kehadiran petugas yang dikemaskini secara automatik.</li>
          <li><strong>Maklumat Operasi:</strong> Lihat senarai Cekpoint dan Ambulans yang sedang bertugas.</li>
          <li><strong>Statistik Utama:</strong> Dapatkan gambaran pantas jumlah kes dan petugas aktif.</li>
        </ul>
      `
    },
    {
      title: '5. Bantuan AI Pintar',
      icon: '✨',
      content: `
        <p class="text-slate-600">Gunakan pembantu AI untuk membuat keputusan pantas di lapangan.</p>
        <img src="https://placehold.co/400x250/f0f9ff/115e59?text=Hasil+Carian+AI\n\n-Hospital+A+(1.2km)\n-Hospital+B+(3.5km)\n\n-Klinik+X+(800m)" alt="Bantuan AI" class="my-3 rounded-lg shadow-md border border-slate-200" />
        <p class="mt-3 text-slate-600 text-sm">Fungsi <strong>'Carian Fasiliti Perubatan'</strong> menggunakan GPS semasa anda untuk mencari hospital dan klinik terdekat, lengkap dengan anggaran jarak perjalanan sebenar dan pautan ke Peta Google.</p>
      `
    },
    {
      title: '6. Tab Laporan (Pasca-Program)',
      icon: '📄',
      content: `
        <p class="text-slate-600">Setelah program selesai, jana laporan lengkap di tab Laporan.</p>
        <img src="https://placehold.co/400x250/f0f9ff/334155?text=Pilih+Program:..v\n\n[Pratonton+Laporan]\n\nJana+Laporan+PDF" alt="Tab Laporan" class="my-3 rounded-lg shadow-md border border-slate-200" />
        <ul class="list-disc list-inside mt-3 space-y-2 text-slate-600 text-sm">
          <li>Pilih program yang telah selesai daripada senarai.</li>
          <li>Sistem akan mengumpul semua data berkaitan secara automatik.</li>
          <li>Klik 'Jana Laporan PDF' untuk memuat turun dokumen yang sedia untuk diarkib.</li>
        </ul>
      `
    },
    {
      title: 'Panduan Selesai!',
      icon: '🎉',
      content: `
        <p class="text-slate-600">Anda kini telah mempelajari aliran kerja utama sistem MECC AMAL.</p>
        <p class="mt-2 text-slate-600">Gunakan butang di bawah untuk memuat turun panduan ini sebagai PDF atau kongsikannya. Untuk sebarang maklum balas, sila ke tab <strong>Tetapan</strong>.</p>
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

  async downloadAsPdf(): Promise<void> {
    const guideContent = document.getElementById('user-guide-pdf-content');
    if (!guideContent) {
      this.notificationSvc.show('error', 'Gagal Jana PDF', 'Elemen panduan tidak ditemui.');
      return;
    }

    this.isGeneratingPdf.set(true);
    
    try {
        const canvas = await html2canvas(guideContent, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgWidth = pdfWidth - 80; // with margin
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        const pdfHeight = pdf.internal.pageSize.getHeight();
        let heightLeft = imgHeight;
        let position = 40; // top margin

        pdf.addImage(imgData, 'PNG', 40, position, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - 80);

        while (heightLeft > 0) {
            position = heightLeft - imgHeight + 40;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 40, position, imgWidth, imgHeight);
            heightLeft -= (pdfHeight - 80);
        }
        
        const fileName = `Panduan-Sistem-MECC-AMAL.pdf`;
        pdf.save(fileName);
        this.notificationSvc.show('case', 'PDF Dijana', `Fail ${fileName} sedang dimuat turun.`);

    } catch (error) {
        console.error("Error generating guide PDF:", error);
        this.notificationSvc.show('error', 'Ralat PDF', 'Gagal menjana fail PDF panduan.');
    } finally {
        this.isGeneratingPdf.set(false);
    }
  }

  async shareGuide(): Promise<void> {
    const shareText = 'Lihat Panduan Pengguna untuk Sistem MECC AMAL Smart Response. Sistem ini membantu menguruskan program, memantau petugas dan kes secara langsung di lapangan.';
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Panduan Sistem MECC AMAL',
          text: shareText,
        });
      } catch (error) {
        // User cancelling is not an error we need to report.
        console.log('Share operation was cancelled or failed.', error);
      }
    } else {
      this.notificationSvc.show('error', 'Kongsi Tidak Disokong', 'Pelayar anda tidak menyokong fungsi kongsi ini.');
    }
  }

  getFormattedTimestamp(): string {
    return new Date().toLocaleString('ms-MY', { 
        day: '2-digit', month: 'long', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', hour12: true 
    });
  }
}