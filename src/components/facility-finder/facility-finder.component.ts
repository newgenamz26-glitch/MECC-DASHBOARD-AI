import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../services/state.service';
import { AiService, Facility } from '../../services/ai.service';
import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';

@Component({
  selector: 'app-facility-finder',
  standalone: true,
  imports: [CommonModule, LoadingIndicatorComponent],
  templateUrl: './facility-finder.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FacilityFinderComponent {
  private aiSvc = inject(AiService);
  private stateSvc = inject(StateService);

  isExpanded = signal(false);
  isLoading = signal(false);
  error = signal<string | null>(null);
  facilities = signal<Facility[]>([]);
  hasFetchedOnce = signal(false);

  isGpsConnected = computed(() => this.stateSvc.gpsStatus() === 'CONNECTED');
  hospitals = computed(() => this.facilities().filter(f => f.jenis === 'Hospital'));
  clinics = computed(() => this.facilities().filter(f => f.jenis === 'Klinik'));

  toggleExpansion(): void {
    this.isExpanded.update(v => !v);
    if (this.isExpanded() && !this.hasFetchedOnce()) {
      this.findFacilities();
    }
  }

  async findFacilities(): Promise<void> {
    if (!this.isGpsConnected()) {
      this.error.set('Sila aktifkan GPS dan berikan kebenaran lokasi untuk menggunakan fungsi ini.');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);
    if (!this.hasFetchedOnce()) {
      this.facilities.set([]);
    }

    try {
      const result = await this.aiSvc.findNearbyMedicalFacilities();
      this.facilities.set(result);
      this.hasFetchedOnce.set(true);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Satu ralat tidak diketahui telah berlaku.';
      this.error.set(errorMessage);
    } finally {
      this.isLoading.set(false);
    }
  }

  openInMaps(facilityName: string): void {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(facilityName)}`;
    window.open(url, '_blank');
  }

  getStatusColor(status?: string): string {
    if (!status) return 'bg-slate-400';
    const s = status.toLowerCase();
    if (s.includes('buka') || s.includes('open')) return 'bg-green-500';
    if (s.includes('tutup') || s.includes('closed')) return 'bg-red-500';
    return 'bg-slate-400';
  }
}