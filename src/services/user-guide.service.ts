import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class UserGuideService {

  public generateGuideHtml(isInteractive: boolean): string {
    const today = new Date().toLocaleDateString('ms-MY', { day: '2-digit', month: 'long', year: 'numeric' });
    const guideStyles = this.getStyles();
    
    const content = `
      <div class="p-8 space-y-12">
        ${this.getCoverPageHtml(today)}
        ${this.getWorkflowSectionHtml()}
        ${this.getSectionHtml('2.0 Skrin Log Masuk & Pemilihan Mod', 'Muka surat ini adalah pintu masuk utama ke dalam sistem. Pengguna boleh memilih antara dua mod operasi: Mod Langsung untuk acara sebenar atau Mod Simulasi untuk latihan.', this.getLoginSnapshotHtml(), 'guide-login')}
        ${this.getSectionHtml('3.0 Papan Pemuka (Dashboard)', 'Papan pemuka adalah pusat kawalan utama anda, memaparkan data masa nyata mengenai program yang sedang aktif. Ia membolehkan pemantauan berterusan terhadap petugas dan laporan kes.', this.getDashboardSnapshotHtml(), 'guide-dashboard')}
        ${this.getSectionHtml('4.0 Pengurusan Program', 'Tab ini membolehkan anda melihat semua program yang telah direkodkan, mengaktifkan program untuk pemantauan, dan menguruskan butiran operasi terperinci bagi setiap program.', this.getProgramSelectorSnapshotHtml(), 'guide-program')}
        ${this.getSectionHtml('5.0 Tetapan & Konfigurasi', 'Pusat untuk mengkonfigurasi sambungan Cloud, mencipta program baru, menjalankan alatan diagnostik sistem, dan mengakses fungsi bantuan seperti penjanaan panduan ini.', this.getSettingsSnapshotHtml(), 'guide-settings')}
        ${this.getSectionHtml('6.0 Bantuan AI & Alat Pintar', 'Sistem ini dilengkapi dengan alat bantuan AI untuk membantu petugas di lapangan, seperti mencari fasiliti perubatan terdekat berdasarkan lokasi GPS masa nyata.', this.getAiAssistantSnapshotHtml(), 'guide-ai')}
      </div>
    `;

    if (isInteractive) {
      return content; // Return raw content for modal
    }

    // Return full HTML document for PDF generation
    return `
      <html>
        <head>
          <style>${guideStyles}</style>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
        </head>
        <body class="font-sans bg-white">
          ${content}
        </body>
      </html>
    `;
  }

  private getStyles(): string {
    return `
      body { font-family: 'Inter', sans-serif; }
      .guide-page { page-break-after: always; break-after: page; }
      .snapshot-container {
        background-color: #f0f9ff;
        border: 8px solid #334155;
        border-radius: 1.5rem;
        padding: 1.5rem;
        margin-top: 1.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        overflow: hidden;
      }
    `;
  }

  private getCoverPageHtml(date: string): string {
    return `
      <div id="guide-cover" class="guide-page flex flex-col items-center justify-center text-center h-screen border-b-2 border-slate-200 pb-12">
        <h1 class="text-4xl font-black text-sky-800">Panduan Pengguna</h1>
        <h2 class="text-2xl font-bold text-slate-700 mt-2">Sistem MECC AMAL Smart Response v2.6</h2>
        <p class="mt-8 text-slate-500">Dokumen ini memberikan panduan visual dan penerangan untuk setiap komponen utama dalam aplikasi.</p>
        <p class="text-sm text-slate-400 mt-2">Dijana pada: ${date}</p>
      </div>
    `;
  }

  private getWorkflowSectionHtml(): string {
    return `
       <div id="guide-workflow" class="guide-page">
        <h3 class="text-2xl font-bold text-sky-700 border-b-2 border-sky-200 pb-2">1.0 Aliran Kerja Sistem</h3>
        <p class="mt-4 text-slate-600">Aliran kerja sistem MECC AMAL direka untuk menjadi sistematik, dari fasa persediaan awal sehingga operasi selesai.</p>
        <div class="mt-6 space-y-4 text-sm">
            <div>
              <p class="font-bold text-slate-800">Fasa 1: Pra-Tugasan (Persediaan Awal)</p>
              <ol class="list-decimal list-inside ml-4 mt-2 space-y-2 text-slate-600 text-xs">
                  <li><span class="font-semibold">Log Masuk:</span> PIC MECC atau AJK Unit yang bertanggungjawab log masuk ke dalam sistem.</li>
                  <li><span class="font-semibold">Cipta Program:</span> Masukkan maklumat asas program baru seperti Nama, Tarikh, Masa, dan Lokasi melalui tab <span class="font-bold">Tetapan</span>.</li>
                  <li><span class="font-semibold">Lengkapkan Butiran Operasi:</span> Di tab <span class="font-bold">Program</span>, pilih program dan kemas kini maklumat lanjut seperti:
                      <ul class="list-disc list-inside ml-5 mt-1">
                          <li><span class="font-bold">Cekpoint:</span> Nama/Callsign, Lokasi, PIC, Krew.</li>
                          <li><span class="font-bold">Ambulans:</span> Callsign, No. Pendaftaran Kenderaan, Krew.</li>
                          <li><span class="font-bold">Maklumat Lain:</span> Sebarang nota atau maklumat tambahan berkaitan operasi.</li>
                      </ul>
                  </li>
                  <li><span class="font-semibold">Aktifkan Program:</span> Program diaktifkan sehari atau beberapa jam sebelum tugasan bermula untuk membolehkan persediaan akhir oleh semua petugas.</li>
              </ol>
            </div>
             <div>
              <p class="font-bold text-slate-800">Fasa 2: Semasa Tugasan (Hari Operasi)</p>
              <ol class="list-decimal list-inside ml-4 mt-2 space-y-2 text-slate-600 text-xs">
                  <li><span class="font-semibold">Pemantauan Dashboard:</span> Semua aktiviti program yang aktif dipantau secara langsung di <span class="font-bold">Dashboard</span>.</li>
                  <li><span class="font-semibold">Selia Kehadiran:</span> Kehadiran petugas (log masuk/keluar) diselia secara automatik. Notifikasi akan dipaparkan apabila petugas log masuk atau log keluar.</li>
                  <li><span class="font-semibold">Selia Laporan Kes:</span> Setiap kes yang dilaporkan oleh petugas akan mencetuskan notifikasi dan direkodkan di Dashboard untuk tindakan segera oleh PIC MECC.</li>
              </ol>
            </div>
             <div>
              <p class="font-bold text-slate-800">Fasa 3: Pasca-Tugasan</p>
               <ol class="list-decimal list-inside ml-4 mt-2 space-y-2 text-slate-600 text-xs">
                  <li><span class="font-semibold">Jana Laporan:</span> Fungsi untuk menjana laporan penuh selepas program selesai. <span class="font-semibold text-amber-600">(Dalam Pembangunan)</span></li>
              </ol>
            </div>
          </div>
      </div>
    `;
  }

  private getSectionHtml(title: string, description: string, snapshotHtml: string, id: string): string {
    return `
      <div id="${id}" class="guide-page">
        <h3 class="text-2xl font-bold text-sky-700 border-b-2 border-sky-200 pb-2">${title}</h3>
        <p class="mt-4 text-slate-600">${description}</p>
        <div class="snapshot-container">
          ${snapshotHtml}
        </div>
      </div>
    `;
  }

  private getLoginSnapshotHtml(): string {
    return `
      <div class="flex flex-col items-center justify-center bg-sky-900 p-4">
        <div class="text-center mb-10">
          <h1 class="font-bold text-3xl text-white leading-tight">MECC AMAL <span class="text-xs bg-sky-700 px-2 py-0.5 rounded-full ml-1 align-middle">v2.6</span></h1>
          <p class="text-sm text-sky-300 uppercase tracking-widest font-bold mt-1">Respon Pintar Cloud</p>
        </div>
        <div class="w-full max-w-sm space-y-5">
          <div class="w-full bg-white p-6 rounded-3xl shadow-lg text-left"><div class="flex items-center gap-5"><div class="bg-sky-100 text-sky-600 p-4 rounded-2xl"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg></div><div><h2 class="font-bold text-lg text-slate-800">Mod Langsung</h2><p class="text-sm text-slate-500 mt-1">Sambung ke Cloud sebenar.</p></div></div></div>
          <div class="w-full bg-white p-6 rounded-3xl shadow-lg text-left"><div class="flex items-center gap-5"><div class="bg-amber-100 text-amber-600 p-4 rounded-2xl"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path></svg></div><div><h2 class="font-bold text-lg text-slate-800">Mod Simulasi</h2><p class="text-sm text-slate-500 mt-1">Guna data sampel untuk latihan.</p></div></div></div>
        </div>
      </div>
    `;
  }

  private getDashboardSnapshotHtml(): string {
    return `
      <div class="space-y-5">
        <div class="bg-white p-7 rounded-[32px] shadow-sm border border-sky-50"><h2 class="text-[11px] font-black text-sky-400 uppercase tracking-[0.2em] mb-2">Program Aktif</h2><p class="text-2xl font-black text-slate-800 leading-tight">Larian Amal 2024</p></div>
        <div class="grid grid-cols-2 gap-4"><div class="bg-white p-6 rounded-[32px] shadow-sm border text-center"><p class="text-3xl font-black text-sky-600">3</p><p class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Jumlah Kes</p></div><div class="bg-white p-6 rounded-[32px] shadow-sm border text-center"><p class="text-3xl font-black text-sky-600">5</p><p class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Responder Aktif</p></div></div>
        <div class="space-y-3 pt-6 border-t-2 border-dashed border-sky-200"><h3 class="text-[11px] font-black text-slate-500 uppercase tracking-widest px-2">Laporan Kes</h3><div class="bg-white rounded-2xl p-4 border-2 border-sky-200 shadow-lg"><div class="flex justify-between items-start"><p class="font-bold text-slate-800 pr-4 text-sm">Peserta pengsan, dehidrasi.</p><span class="text-[9px] font-black px-2.5 py-1 rounded-full whitespace-nowrap text-sky-700 bg-sky-100">Baru</span></div></div></div>
      </div>
    `;
  }

  private getProgramSelectorSnapshotHtml(): string {
    return `
      <div class="space-y-3">
        <h3 class="text-[11px] font-black text-slate-500 uppercase tracking-widest px-2">Senarai Program</h3>
        <div class="bg-white rounded-2xl p-4 border-sky-400 ring-4 ring-sky-100 border"><p class="font-bold text-slate-800 pr-2">Larian Amal 2024</p><span class="text-[9px] font-black px-2.5 py-1 rounded-full whitespace-nowrap bg-sky-100 text-sky-700">Aktif</span><div class="mt-4 pt-3 border-t border-slate-100"><button class="w-full text-sm font-bold bg-slate-500 text-white px-5 py-2.5 rounded-lg">Nyahaktifkan</button></div></div>
        <div class="bg-white rounded-2xl p-4 border-slate-100 border"><p class="font-bold text-slate-800 pr-2">Konsert Gegar Suara</p><span class="text-[9px] font-black px-2.5 py-1 rounded-full whitespace-nowrap bg-slate-100 text-slate-700">Belum Mula</span><div class="mt-4 pt-3 border-t border-slate-100"><button class="w-full text-sm font-bold bg-sky-500 text-white px-5 py-2.5 rounded-lg flex items-center justify-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Aktifkan</span></button></div></div>
      </div>
    `;
  }
  
  private getSettingsSnapshotHtml(): string {
    return `
      <div class="space-y-4">
        <div class="bg-white p-6 rounded-[32px] shadow-sm border border-sky-50">
          <h4 class="font-bold text-sky-800 text-base">Pengurusan Program</h4>
          <p class="text-xs text-slate-400 mt-1">Tambah atau semak maklumat program.</p>
        </div>
        <div class="bg-white p-6 rounded-[32px] shadow-sm border border-sky-50">
            <h4 class="font-bold text-sky-800 text-base">Tetapan Cloud</h4>
            <p class="text-xs text-slate-400 mt-1">Sambungkan aplikasi ke pangkalan data anda.</p>
        </div>
        <div class="bg-white p-6 rounded-[32px] shadow-sm border border-sky-50">
            <h4 class="font-bold text-sky-800 text-base">Panduan Pengguna & Bantuan</h4>
            <p class="text-xs text-slate-400 mt-1">Jana panduan pengguna lengkap dalam format PDF.</p>
        </div>
      </div>
    `;
  }

  private getAiAssistantSnapshotHtml(): string {
    return `
      <div class="bg-white rounded-[32px] shadow-sm border border-sky-50 overflow-hidden">
        <div class="p-6">
          <h4 class="font-bold text-slate-800">Carian Fasiliti Perubatan</h4>
          <p class="text-xs text-slate-500 mt-1">Cari hospital & klinik terdekat menggunakan AI.</p>
        </div>
        <div class="p-6 border-t-2 border-dashed border-sky-100">
          <div class="space-y-3">
            <h4 class="text-xs font-black text-red-600 uppercase tracking-widest">Hospital</h4>
            <div class="bg-sky-50/50 p-4 rounded-xl border border-slate-200">
                <p class="font-bold text-slate-800">Hospital Kuala Lumpur</p>
                <p class="text-sm font-semibold text-slate-500 mt-1">3.2 km</p>
            </div>
            <h4 class="text-xs font-black text-blue-600 uppercase tracking-widest pt-2">Klinik</h4>
            <div class="bg-sky-50/50 p-4 rounded-xl border border-slate-200">
                <p class="font-bold text-slate-800">Klinik Kesihatan Meru</p>
                <p class="text-sm font-semibold text-slate-500 mt-1">1.8 km</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}