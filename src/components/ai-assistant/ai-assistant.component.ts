import { Component, ChangeDetectionStrategy, output, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../services/state.service';
import { AiService, Facility } from '../../services/ai.service';
import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';

@Component({
  selector: 'app-ai-assistant',
  imports: [CommonModule, LoadingIndicatorComponent],
  templateUrl: './ai-assistant.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAssistantComponent implements OnInit {
  close = output<void>();

  private aiSvc = inject(AiService);
  stateSvc = inject(StateService);

  isLoading = signal(true);
  error = signal<string | null>(null);
  facilities = signal<Facility[]>([]);

  hospitals = computed(() => this.facilities().filter(f => f.jenis === 'Hospital'));
  clinics = computed(() => this.facilities().filter(f => f.jenis === 'Klinik'));

  ngOnInit(): void {
    this.findFacilities();
  }

  async findFacilities(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    this.facilities.set([]);

    try {
      const result = await this.aiSvc.findNearbyMedicalFacilities();
      this.facilities.set(result);
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
}
