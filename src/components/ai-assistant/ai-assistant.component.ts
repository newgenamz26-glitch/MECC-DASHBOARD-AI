import { Component, ChangeDetectionStrategy, output, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../services/state.service';
import { AiService, Facility } from '../../services/ai.service';
import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-ai-assistant',
  imports: [CommonModule, LoadingIndicatorComponent],
  templateUrl: './ai-assistant.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAssistantComponent implements OnInit {
  close = output<void>();

  private aiSvc = inject(AiService);
  private notificationSvc = inject(NotificationService);
  stateSvc = inject(StateService);

  isLoading = signal(true);
  error = signal<string | null>(null);
  facilities = signal<Facility[]>([]);

  // Pagination state
  currentPage = signal(1);
  readonly itemsPerPage = 3;

  // Computed properties for facility types
  hospitals = computed(() => this.facilities().filter(f => f.jenis === 'Hospital'));
  clinics = computed(() => this.facilities().filter(f => f.jenis === 'Klinik'));
  
  // Computed properties for pagination logic
  paginatedHospitals = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.hospitals().slice(start, end);
  });

  paginatedClinics = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.clinics().slice(start, end);
  });

  totalHospitalPages = computed(() => Math.ceil(this.hospitals().length / this.itemsPerPage));
  totalClinicPages = computed(() => Math.ceil(this.clinics().length / this.itemsPerPage));
  totalPages = computed(() => Math.max(1, this.totalHospitalPages(), this.totalClinicPages()));

  hasNextPage = computed(() => this.currentPage() < this.totalPages());
  hasPreviousPage = computed(() => this.currentPage() > 1);


  ngOnInit(): void {
    this.findFacilities();
  }

  async findFacilities(): Promise<void> {
    this.currentPage.set(1);
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

  openInMaps(facility: Facility): void {
    window.open(this.generateMapsLink(facility), '_blank');
  }

  nextPage(): void {
    if (this.hasNextPage()) {
      this.currentPage.update(p => p + 1);
    }
  }

  previousPage(): void {
    if (this.hasPreviousPage()) {
      this.currentPage.update(p => p - 1);
    }
  }

  private generateMapsLink(facility: Facility): string {
    let url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(facility.nama)}`;
    if (facility.googleMapsPlaceId) {
      url += `&query_place_id=${facility.googleMapsPlaceId}`;
    }
    return url;
  }

  async shareFacilities(): Promise<void> {
    const allFacilities = this.facilities();
    if (allFacilities.length === 0) {
      this.notificationSvc.show('info', 'Tiada Data', 'Tiada fasiliti untuk dikongsi.');
      return;
    }

    const currentPos = this.stateSvc.currentPosition();
    if (!currentPos) {
        this.notificationSvc.show('error', 'Lokasi Tidak Ditemui', 'Tidak dapat mendapatkan lokasi semasa untuk pautan carian umum.');
        return;
    }

    let shareText = 'Senarai Fasiliti Perubatan Terdekat (dijana oleh AI):\n\n';

    const hospitals = allFacilities.filter(f => f.jenis === 'Hospital');
    if (hospitals.length > 0) {
      shareText += '--- HOSPITAL ---\n';
      hospitals.forEach((facility, index) => {
        const gmapsLink = this.generateMapsLink(facility);
        shareText += `${index + 1}. ${facility.nama}\n`;
        shareText += `   Jarak: ${facility.jarak}\n`;
        shareText += `   Peta: ${gmapsLink}\n\n`;
      });
    }
    
    const clinics = allFacilities.filter(f => f.jenis === 'Klinik');
    if (clinics.length > 0) {
      shareText += '--- KLINIK ---\n';
      clinics.forEach((facility, index) => {
        const gmapsLink = this.generateMapsLink(facility);
        shareText += `${index + 1}. ${facility.nama}\n`;
        shareText += `   Jarak: ${facility.jarak}\n`;
        shareText += `   Peta: ${gmapsLink}\n\n`;
      });
    }

    const genericSearchLink = `https://www.google.com/maps/search/fasiliti+perubatan+terdekat/@${currentPos.latitude},${currentPos.longitude},15z`;
    shareText += '---\n';
    shareText += 'Carian Umum di Peta Google (jika jarak di atas tidak tepat):\n';
    shareText += genericSearchLink;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Senarai Fasiliti Perubatan Terdekat',
          text: shareText,
        });
      } catch (error) {
        // User cancelling the share is not an error we need to report.
        console.log('Share operation was cancelled or failed.', error);
      }
    } else {
      this.notificationSvc.show('error', 'Kongsi Tidak Disokong', 'Pelayar anda tidak menyokong fungsi kongsi ini.');
    }
  }
}