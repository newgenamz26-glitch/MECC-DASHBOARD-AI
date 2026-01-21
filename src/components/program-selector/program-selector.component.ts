import { Component, ChangeDetectionStrategy, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { NotificationService } from '../../services/notification.service';
import { Program } from '../../models';
import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';
import { ProgramDetailsComponent } from '../program-details/program-details.component';
import { SimulationService } from '../../services/simulation.service';
import { ProgramEditComponent } from '../program-edit/program-edit.component';

@Component({
  selector: 'app-program-selector',
  imports: [CommonModule, LoadingIndicatorComponent, ProgramDetailsComponent, ProgramEditComponent],
  templateUrl: './program-selector.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgramSelectorComponent {
  stateSvc = inject(StateService);
  private apiSvc = inject(ApiService);
  private notificationSvc = inject(NotificationService);
  private simulationSvc = inject(SimulationService);

  programs = signal<Program[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);
  lockingProgramId = signal<string | null>(null);

  // Signal for Details Modal
  isDetailsModalVisible = signal<Program | null>(null);
  
  // Signal for Edit Modal
  editingProgram = signal<Program | null>(null);

  constructor() {
    effect(() => {
      // Re-fetch programs when version changes or simulation mode toggles
      this.stateSvc.programListVersion();
      this.stateSvc.isSimulationMode();
      this.fetchPrograms();
    });
  }

  openDetailsModal(program: Program): void {
    this.isDetailsModalVisible.set(program);
  }

  closeDetailsModal(): void {
    this.isDetailsModalVisible.set(null);
  }

  openEditModal(program: Program): void {
    this.editingProgram.set(program);
  }

  closeEditModal(): void {
    this.editingProgram.set(null);
  }
  
  handleProgramUpdated(updatedProgram: Program): void {
    this.closeEditModal();
    this.fetchPrograms(); // Refreshes the list visually

    // Immediately update the active program if it was the one edited
    if (this.stateSvc.activeProgram()?.id === updatedProgram.id) {
        this.stateSvc.activeProgram.set(updatedProgram);
        this.notificationSvc.show('info', 'Program Aktif Dikemaskini', 'Maklumat pada papan pemuka telah disegarkan.');
    }
  }


  async fetchPrograms(): Promise<void> {
    if (!this.stateSvc.isCloudConnected() && !this.stateSvc.isSimulationMode()) {
        this.programs.set([]);
        this.isLoading.set(false);
        this.stateSvc.activeProgram.set(null);
        return;
    }
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const data = await this.apiSvc.getPrograms();
      // Sort by date descending
      data.sort((a, b) => {
          const dateA = a.tarikh ? new Date(a.tarikh).getTime() : 0;
          const dateB = b.tarikh ? new Date(b.tarikh).getTime() : 0;
          return dateB - dateA;
      });
      this.programs.set(data);
      
      const activeProgramInList = data.find(p => p.status === 'Aktif');
      const currentActiveId = this.stateSvc.activeProgram()?.id;
      
      if (activeProgramInList) {
        if (currentActiveId !== activeProgramInList.id) {
          this.stateSvc.activeProgram.set(activeProgramInList);
        }
      } else {
        if (currentActiveId) {
            this.stateSvc.activeProgram.set(null);
        }
      }

    } catch (error) {
      this.programs.set([]);
      this.stateSvc.activeProgram.set(null);
      let message = error instanceof Error ? error.message : 'Gagal memuat turun senarai program.';
      
      if (message === 'SERVER_NOT_CONFIGURED') {
        message = 'Server belum dikonfigurasi. Sila tetapkan Spreadsheet ID dalam skrip anda dan deploy semula.';
      } else {
        const isOldScriptError = message.includes("'namaprogram'");
        const isNewScriptError = message.includes("'Nama Program'");
        if (isOldScriptError || isNewScriptError) {
           message = 'Ralat Konfigurasi Helaian: Pastikan Helaian "Programs" anda mempunyai lajur "ID Program" dan "Nama Program". Jika ralat berterusan, deploy semula skrip "Code.gs" terkini.';
        }
      }

      this.error.set(message);
      if (error instanceof Error && error.message !== 'SERVER_NOT_CONFIGURED') {
        console.error('Failed to fetch programs:', error);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  async setProgramStatus(program: Program, status: 'Aktif' | 'Belum Mula' | 'Selesai'): Promise<void> {
    this.lockingProgramId.set(program.id);
    try {
        const result = await this.apiSvc.setProgramStatus(program.id, status);
        if (result.success) {
            const statusMap: Record<string, string> = {
                'Aktif': 'diaktifkan',
                'Belum Mula': 'dinyahaktifkan',
                'Selesai': 'ditandakan sebagai selesai'
            };
            this.notificationSvc.show('info', 'Status Dikemaskini', `Program "${program.namaprogram}" telah ${statusMap[status]}.`);
            this.fetchPrograms(); 
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Ralat tidak diketahui.';
        this.notificationSvc.show('error', 'Gagal Kemaskini Status', msg);
    } finally {
        this.lockingProgramId.set(null);
    }
}

  formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    // This safely handles ISO strings from Google Sheets (e.g., "2024-07-26T...") and "YYYY-MM-DD"
    return dateString.substring(0, 10);
  }

  formatTime(timeString?: string): string {
    if (!timeString) return 'N/A';
    // If Google Sheets converts time to a full Date object, it becomes an ISO string.
    if (timeString.includes('T')) {
        try {
            const date = new Date(timeString);
            if (isNaN(date.getTime())) return timeString;
            
            const hours = ('0' + date.getHours()).slice(-2);
            const minutes = ('0' + date.getMinutes()).slice(-2);
            return `${hours}:${minutes}`;
        } catch (e) {
            return timeString; // Fallback on parsing error
        }
    }
    // If it's already in HH:mm format, return as is.
    return timeString;
  }
}
