import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { NotificationService } from '../../services/notification.service';
import { Program, CaseReport, Attendance, Checkpoint, Ambulance } from '../../models';
import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';

interface ReportData {
  program: Program;
  cases: CaseReport[];
  attendance: Attendance[];
  checkpoints: Checkpoint[];
  ambulances: Ambulance[];
  generatedAt: string;
}

@Component({
  selector: 'app-report-generator',
  imports: [CommonModule, LoadingIndicatorComponent],
  templateUrl: './report-generator.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportGeneratorComponent implements OnInit {
  private apiSvc = inject(ApiService);
  private notificationSvc = inject(NotificationService);
  stateSvc = inject(StateService);

  programs = signal<Program[]>([]);
  selectedProgramId = signal<string>('');
  
  isLoadingPrograms = signal(true);
  isLoadingReport = signal(false);
  isGeneratingPdf = signal(false);

  reportData = signal<ReportData | null>(null);

  selectedProgram = computed(() => {
    const id = this.selectedProgramId();
    if (!id) return null;
    return this.programs().find(p => p.id === id) || null;
  });

  ngOnInit(): void {
    this.fetchPrograms();
  }

  async fetchPrograms(): Promise<void> {
    this.isLoadingPrograms.set(true);
    try {
      const data = await this.apiSvc.getPrograms();
      data.sort((a, b) => {
          const dateA = a.tarikh ? new Date(a.tarikh).getTime() : 0;
          const dateB = b.tarikh ? new Date(b.tarikh).getTime() : 0;
          return dateB - dateA;
      });
      this.programs.set(data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal memuat turun senarai program.';
      this.notificationSvc.show('error', 'Ralat Muat Turun', msg);
    } finally {
      this.isLoadingPrograms.set(false);
    }
  }
  
  async onProgramSelect(event: Event): Promise<void> {
    const programId = (event.target as HTMLSelectElement).value;
    this.selectedProgramId.set(programId);
    if (programId) {
        await this.generateReportData(programId);
    } else {
        this.reportData.set(null);
    }
  }

  async generateReportData(programId: string): Promise<void> {
    this.isLoadingReport.set(true);
    this.reportData.set(null);
    
    try {
        const program = this.programs().find(p => p.id === programId);
        if (!program) throw new Error('Program tidak ditemui.');

        const [cases, details, attendance] = await Promise.all([
            this.apiSvc.getCaseReports(programId),
            this.apiSvc.getProgramDetails(programId),
            this.apiSvc.getAttendance() // Note: Attendance data is currently global
        ]);

        const checkpoints = details.filter(d => d.jenis === 'Cekpoint');
        const ambulances = details.filter(d => d.jenis === 'Ambulan');
        
        this.reportData.set({
            program,
            cases: cases.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
            attendance,
            checkpoints,
            ambulances,
            generatedAt: new Date().toISOString()
        });

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal memuat turun data laporan.';
        this.notificationSvc.show('error', 'Ralat Data', msg);
    } finally {
        this.isLoadingReport.set(false);
    }
  }
  
  async downloadPdf(): Promise<void> {
    const reportContent = document.getElementById('report-content');
    if (!reportContent) {
      this.notificationSvc.show('error', 'Gagal Jana PDF', 'Elemen laporan tidak ditemui.');
      return;
    }

    this.isGeneratingPdf.set(true);
    
    try {
        const canvas = await html2canvas(reportContent, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasWidth / canvasHeight;
        const imgWidth = pdfWidth - 40; // with margin
        const imgHeight = imgWidth / ratio;
        
        const pdfHeight = pdf.internal.pageSize.getHeight();
        let heightLeft = imgHeight;
        let position = 20; // top margin

        pdf.addImage(imgData, 'PNG', 20, position, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - 40);

        while (heightLeft > 0) {
            position = heightLeft - imgHeight + 20; // new page top margin
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 20, position, imgWidth, imgHeight);
            heightLeft -= (pdfHeight - 40);
        }
        
        const programName = this.selectedProgram()?.namaprogram || 'laporan';
        const fileName = `Laporan-${programName.replace(/\s+/g, '-')}.pdf`;
        pdf.save(fileName);
        this.notificationSvc.show('case', 'PDF Dijana', `Fail ${fileName} sedang dimuat turun.`);

    } catch (error) {
        console.error("Error generating PDF:", error);
        this.notificationSvc.show('error', 'Ralat PDF', 'Gagal menjana fail PDF.');
    } finally {
        this.isGeneratingPdf.set(false);
    }
  }

  getFormattedDateTime(dateString: string | null): string {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString('ms-MY', { 
        day: '2-digit', month: 'short', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', hour12: true 
    });
  }

  getFormattedDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('ms-MY', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  getFormattedTime(timeString?: string): string {
    if (!timeString) return 'N/A';
    if (timeString.includes('T')) {
        try {
            const date = new Date(timeString);
            return date.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch (e) { return timeString; }
    }
    return timeString;
  }
}