import { Component, ChangeDetectionStrategy, inject, signal, computed, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { Subject, timer, of, switchMap, takeUntil } from 'rxjs';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { NotificationService } from '../../services/notification.service';
import { Attendance, CaseReport, Checkpoint, Ambulance, OtherInfo } from '../../models';
import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, LoadingIndicatorComponent],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit, OnDestroy {
  stateSvc = inject(StateService);
  private apiSvc = inject(ApiService);
  private notificationSvc = inject(NotificationService);

  // Signals for Attendance
  attendanceList = signal<Attendance[]>([]);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);
  activeResponderCount = computed(() => this.attendanceList().filter(r => !r.tamat).length);
  isAttendanceLogVisible = signal(false);
  latestAttendance = computed(() => this.attendanceList()?.[0] ?? null);
  olderAttendance = computed(() => this.attendanceList()?.slice(1) ?? []);
  newlyAddedAttendanceId = signal<string | null>(null);

  // Signals for Case Reports
  caseReports = signal<CaseReport[]>([]);
  isLoadingCases = signal<boolean>(false);
  isManualRefreshingCases = signal<boolean>(false);
  errorCases = signal<string | null>(null);
  updatingCaseId = signal<string | null>(null);
  isCaseLogVisible = signal(false);
  latestCase = computed(() => this.caseReports()?.[0] ?? null);
  olderCases = computed(() => this.caseReports()?.slice(1) ?? []);
  
  // Signals for Program Details
  checkpoints = signal<Checkpoint[]>([]);
  ambulances = signal<Ambulance[]>([]);
  isLoadingDetails = signal(false);
  errorDetails = signal<string | null>(null);
  
  private destroy$ = new Subject<void>();
  private readonly REFRESH_INTERVAL_MS = 10000; // Auto-refresh every 10 seconds
  private readonly SIM_REFRESH_INTERVAL_MS = 2000; // Faster refresh for simulation mode

  private activeProgram$ = toObservable(this.stateSvc.activeProgram);

  ngOnInit(): void {
    this.activeProgram$
      .pipe(
        switchMap(activeProgram => {
          if (activeProgram) {
            const isSimMode = this.stateSvc.isSimulationMode();
            const refreshInterval = isSimMode ? this.SIM_REFRESH_INTERVAL_MS : this.REFRESH_INTERVAL_MS;
            // Fetch data immediately, then poll at the specified interval
            return timer(0, refreshInterval);
          } else {
            // No active program, so we reset state and stop polling.
            this.resetState();
            return of(); 
          }
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        // This subscription triggers on each emission from the timer
        this.fetchAllData();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private fetchAllData(): void {
    if (!this.stateSvc.activeProgram()) return;
    this.fetchAttendance();
    this.fetchCaseReports();
    this.fetchProgramDetails();
  }
  
  private resetState(): void {
    this.attendanceList.set([]);
    this.caseReports.set([]);
    this.checkpoints.set([]);
    this.ambulances.set([]);
    this.isLoading.set(false);
    this.isLoadingCases.set(false);
    this.isLoadingDetails.set(false);
    this.error.set(null);
    this.errorCases.set(null);
    this.errorDetails.set(null);
  }

  toggleCaseLog(): void {
    this.isCaseLogVisible.update(v => !v);
  }
  
  toggleAttendanceLog(): void {
    this.isAttendanceLogVisible.update(v => !v);
  }

  async fetchAttendance(): Promise<void> {
    const isSimMode = this.stateSvc.isSimulationMode();
    const latestEntryBeforeFetch = this.attendanceList().length > 0 ? this.attendanceList()[0] : null;

    if (!isSimMode && this.isLoading()) return;

    if (!isSimMode) {
      this.isLoading.set(true);
    }
    this.error.set(null);

    try {
      const oldListCount = this.attendanceList().length;
      const data = await this.apiSvc.getAttendance();
      if (Array.isArray(data)) {
        const reversedData = isSimMode ? data : data.reverse();
        
        if (oldListCount > 0 && reversedData.length > oldListCount) {
            const newCount = reversedData.length - oldListCount;
            const responderText = newCount > 1 ? 'responder baru telah' : 'responder baru telah';
            this.notificationSvc.show('info', 'Kehadiran Dikemaskini', `${newCount} ${responderText} mendaftar masuk.`);
        }

        this.attendanceList.set(reversedData);

        const latestEntryAfterFetch = this.attendanceList().length > 0 ? this.attendanceList()[0] : null;

        if (latestEntryAfterFetch && (!latestEntryBeforeFetch || (latestEntryAfterFetch.nama + latestEntryAfterFetch.mula) !== (latestEntryBeforeFetch.nama + latestEntryBeforeFetch.mula))) {
            const newEntryId = latestEntryAfterFetch.nama + latestEntryAfterFetch.mula;
            this.newlyAddedAttendanceId.set(newEntryId);
            setTimeout(() => {
                if (this.newlyAddedAttendanceId() === newEntryId) {
                    this.newlyAddedAttendanceId.set(null);
                }
            }, 5000); // Highlight for 5 seconds
        }

      } else {
        this.attendanceList.set([]);
        this.error.set('Format data kehadiran tidak sah.');
        console.error('Expected attendance data to be an array, but got:', data);
      }
    } catch (e) {
      let message = e instanceof Error ? e.message : 'Gagal memuatkan data kehadiran.';
      if (message.includes("'Nama Responder' and 'Mula Tugas' not found")) {
        message = 'Ralat Helaian: Pastikan Helaian "Attendance" mempunyai lajur "Nama Responder" dan "Mula Tugas".';
      }
      this.error.set(message);
      this.attendanceList.set([]);
      console.error('Failed to fetch attendance:', e);
    } finally {
      if (!isSimMode) {
        this.isLoading.set(false);
      }
    }
  }

  async manualFetchCaseReports(): Promise<void> {
    if (this.isManualRefreshingCases() || this.isLoadingCases()) return;
    this.isManualRefreshingCases.set(true);
    try {
        await this.fetchCaseReports();
    } finally {
        this.isManualRefreshingCases.set(false);
    }
  }

  async fetchCaseReports(): Promise<void> {
    const activeProgram = this.stateSvc.activeProgram();
    const isSimMode = this.stateSvc.isSimulationMode();

    if (!activeProgram) return;

    if (!isSimMode && this.caseReports().length === 0 && !this.errorCases()) {
      this.isLoadingCases.set(true);
    }

    try {
      const oldReportsCount = this.caseReports().length;
      const reports = await this.apiSvc.getCaseReports(activeProgram.id);
      this.errorCases.set(null);
      
      if (oldReportsCount > 0 && reports.length > oldReportsCount) {
        const newCount = reports.length - oldReportsCount;
        const caseText = newCount > 1 ? 'laporan kes baru telah' : 'laporan kes baru telah';
        this.notificationSvc.show('case', 'Laporan Kes Baru', `${newCount} ${caseText} diterima.`);
      }
      this.caseReports.set(reports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal memuat turun laporan kes.';
      this.errorCases.set(errorMessage);
      this.caseReports.set([]);
    } finally {
      if (!isSimMode) {
        this.isLoadingCases.set(false);
      }
    }
  }

  async fetchProgramDetails(): Promise<void> {
    const activeProgram = this.stateSvc.activeProgram();
    if (!activeProgram) return;

    if (!this.checkpoints().length && !this.ambulances().length) {
        this.isLoadingDetails.set(true);
    }
    this.errorDetails.set(null);

    try {
      const oldCheckpointsCount = this.checkpoints().length;
      const oldAmbulancesCount = this.ambulances().length;
      const details = await this.apiSvc.getProgramDetails(activeProgram.id);

      const newCheckpoints = details.filter(d => d.jenis === 'Cekpoint');
      const newAmbulances = details.filter(d => d.jenis === 'Ambulan');

      if (oldCheckpointsCount > 0 && newCheckpoints.length > oldCheckpointsCount) {
          this.notificationSvc.show('info', 'Cekpoint Dikemaskini', 'Data cekpoint baru telah direkodkan.');
      }
      if (oldAmbulancesCount > 0 && newAmbulances.length > oldAmbulancesCount) {
          this.notificationSvc.show('info', 'Ambulans Dikemaskini', 'Data ambulans baru telah direkodkan.');
      }
      
      this.checkpoints.set(newCheckpoints);
      this.ambulances.set(newAmbulances);
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal memuat turun maklumat operasi.';
        this.errorDetails.set(msg);
        this.checkpoints.set([]);
        this.ambulances.set([]);
    } finally {
        this.isLoadingDetails.set(false);
    }
  }

  async updateCaseStatus(caseId: string, status: 'Selesai'): Promise<void> {
    if (this.updatingCaseId()) return;
    this.updatingCaseId.set(caseId);
    try {
      const result = await this.apiSvc.updateCaseStatus(caseId, status);
      if (result.success) {
        this.notificationSvc.show('case', 'Status Dikemaskini', `Kes ${caseId} telah ditandakan sebagai selesai.`);
        this.caseReports.update(reports => reports.map(r => r.id === caseId ? {...r, status: 'Selesai'} : r));
      } else {
        this.notificationSvc.show('error', 'Gagal Mengemas kini', result.message || 'Ralat tidak diketahui.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ralat berhubung dengan server.';
      this.notificationSvc.show('error', 'Gagal Mengemas kini', errorMessage);
    } finally {
      this.updatingCaseId.set(null);
    }
  }

  getFormattedTime(dateString: string | null): string {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  getFormattedDateTimeShort(dateString: string | null): string {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const day = ('0' + date.getDate()).slice(-2);
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const year = date.getFullYear().toString().slice(-2);
    return `${time}\n${day}/${month}/${year}`;
  }

  getFormattedDateTime(dateString: string | null): string {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString('ms-MY', { 
        day: '2-digit', month: 'short', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', hour12: true 
    });
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
        } catch (e) { return timeString; }
    }
    return timeString;
  }
}