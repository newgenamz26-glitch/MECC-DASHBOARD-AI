import { Component, ChangeDetectionStrategy, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { Program } from '../../models';
import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';

@Component({
  selector: 'app-program-selector',
  standalone: true,
  imports: [CommonModule, LoadingIndicatorComponent],
  templateUrl: './program-selector.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgramSelectorComponent {
  stateSvc = inject(StateService);
  private apiSvc = inject(ApiService);

  programs = signal<Program[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  constructor() {
    effect(() => {
      // This effect will re-run whenever programListVersion changes,
      // automatically keeping the program list up-to-date.
      this.stateSvc.programListVersion(); // Establish dependency on the signal
      this.fetchPrograms();
    });
  }

  async fetchPrograms(): Promise<void> {
    if (!this.stateSvc.isCloudConnected()) {
        this.programs.set([]);
        this.isLoading.set(false);
        return;
    }
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const data = await this.apiSvc.getPrograms();
      this.programs.set(data);
    } catch (error) {
      this.programs.set([]);
      const message = error instanceof Error ? error.message : 'Gagal memuat turun senarai program.';
      this.error.set(message);
      console.error('Failed to fetch programs:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  selectProgram(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const programId = selectElement.value;
    const selectedProgram = this.programs().find(p => (p.id || p.idprogram) === programId);
    
    if (selectedProgram) {
      // Normalize the ID property and store the full object
      const programToStore: Program = {
        ...selectedProgram,
        id: selectedProgram.id || selectedProgram.idprogram || '',
      };
      this.stateSvc.activeProgram.set(programToStore);
    } else if (!programId) {
      // If user selects the placeholder "-- Pilih Program --", clear the active program
      this.stateSvc.activeProgram.set(null);
    }
  }
}