import { Component, ChangeDetectionStrategy, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { Program } from '../../models';
import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';
import { AiAssistantComponent } from '../ai-assistant/ai-assistant.component';

@Component({
  selector: 'app-responder-dashboard',
  standalone: true,
  imports: [CommonModule, LoadingIndicatorComponent, AiAssistantComponent],
  templateUrl: './responder-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResponderDashboardComponent implements OnInit, OnDestroy {
  stateSvc = inject(StateService);
  private apiSvc = inject(ApiService);
  
  activePrograms = signal<Program[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  isAiAssistantVisible = signal(false);

  gpsStatusMessage = computed(() => {
    switch (this.stateSvc.gpsStatus()) {
      case 'CONNECTED': return 'GPS OK';
      case 'REQUESTING': return 'Mencari...';
      case 'ERROR': return 'GPS Ralat';
      case 'UNSUPPORTED': return 'GPS Tiada';
      default: return 'GPS Putus';
    }
  });

  isGpsConnected = computed(() => this.stateSvc.gpsStatus() === 'CONNECTED');

  currentLocationDisplay = computed(() => {
    const pos = this.stateSvc.currentPosition();
    if (!pos) return '';
    return `Lat: ${pos.latitude.toFixed(4)}, Lon: ${pos.longitude.toFixed(4)}`;
  });

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

  showAiAssistant(): void {
    this.isAiAssistantVisible.set(true);
  }

  hideAiAssistant(): void {
    this.isAiAssistantVisible.set(false);
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