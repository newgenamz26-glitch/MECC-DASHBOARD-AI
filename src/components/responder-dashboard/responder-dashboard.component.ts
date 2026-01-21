import { Component, ChangeDetectionStrategy, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { Program } from '../../models';
import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';

@Component({
  selector: 'app-responder-dashboard',
  standalone: true,
  imports: [CommonModule, LoadingIndicatorComponent],
  templateUrl: './responder-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResponderDashboardComponent implements OnInit, OnDestroy {
  stateSvc = inject(StateService);
  private apiSvc = inject(ApiService);
  
  activePrograms = signal<Program[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);

  private refreshInterval: any;

  ngOnInit(): void {
    this.fetchActivePrograms();
    this.refreshInterval = setInterval(() => this.fetchActivePrograms(), 5000); // Refresh every 5 seconds
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  async fetchActivePrograms(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      // This is a simulation-only feature, so we use the API which routes to the simulation service
      const allPrograms = await this.apiSvc.getPrograms();
      this.activePrograms.set(allPrograms.filter(p => p.status === 'Aktif'));
    } catch (e) {
      this.error.set('Gagal memuat turun senarai program.');
      console.error(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  confirmLogout(): void {
    this.stateSvc.isLogoutConfirmVisible.set(true);
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
