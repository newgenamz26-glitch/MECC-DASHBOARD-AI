import { Component, ChangeDetectionStrategy, input, output, signal, OnInit, inject, computed, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { NotificationService } from '../../services/notification.service';
import { Program, Checkpoint, Ambulance, OtherInfo } from '../../models';
import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';

type ActiveTab = 'cekpoint' | 'ambulan' | 'lain';

@Component({
  selector: 'app-program-details',
  imports: [CommonModule, ReactiveFormsModule, LoadingIndicatorComponent],
  templateUrl: './program-details.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgramDetailsComponent implements OnInit {
  program = input.required<Program>();
  close = output<void>();

  private apiSvc = inject(ApiService);
  private notificationSvc = inject(NotificationService);
  private fb: FormBuilder = inject(FormBuilder);
  private stateSvc = inject(StateService);

  @ViewChild('formContainer') formContainer!: ElementRef<HTMLDivElement>;

  activeTab = signal<ActiveTab>('cekpoint');
  
  private allDetails = signal<any[]>([]);
  isLoading = signal(false);
  editingDetail = signal<any | null>(null);

  checkpoints = computed<Checkpoint[]>(() => this.allDetails().filter(d => d.jenis === 'Cekpoint'));
  ambulances = computed<Ambulance[]>(() => this.allDetails().filter(d => d.jenis === 'Ambulan'));
  otherInfos = computed<OtherInfo[]>(() => this.allDetails().filter(d => d.jenis === 'Lain'));

  isSubmitting = signal(false);

  locationQuery = signal('');
  showLocationSuggestions = signal(false);
  locationSuggestions = computed(() => {
    const query = this.locationQuery().toLowerCase();
    if (!query) return [];
    return this.stateSvc.uniqueCheckpointLocations().filter(loc => 
      loc.toLowerCase().includes(query) && loc.toLowerCase() !== query
    ).slice(0, 5);
  });

  vehicleNumberQuery = signal('');
  showVehicleNumberSuggestions = signal(false);
  vehicleNumberSuggestions = computed(() => {
    const query = this.vehicleNumberQuery().toLowerCase();
    if (!query) return [];
    return this.stateSvc.uniqueAmbulanceVehicleNumbers().filter(vn => 
      vn.toLowerCase().includes(query) && vn.toLowerCase() !== query
    ).slice(0, 5);
  });

  checkpointForm = this.fb.group({
    name: ['', Validators.required],
    location: ['', Validators.required],
    pic: [''],
    callSign: [''],
    crew: [''],
  });

  ambulanceForm = this.fb.group({
    callSign: ['', Validators.required],
    vehicleNumber: ['', Validators.required],
    crew: ['', Validators.required],
  });

  otherInfoForm = this.fb.group({
    title: ['', Validators.required],
    details: ['', Validators.required],
  });

  ngOnInit(): void {
    this.fetchDetails();
  }

  changeTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
    this.cancelEdit();
  }

  startEdit(detail: any): void {
    this.editingDetail.set(detail);
    if (detail.jenis === 'Cekpoint') {
      this.checkpointForm.patchValue(detail);
    } else if (detail.jenis === 'Ambulan') {
      this.ambulanceForm.patchValue(detail);
    } else if (detail.jenis === 'Lain') {
      this.otherInfoForm.patchValue(detail);
    }
    // Scroll to the form for better UX
    setTimeout(() => this.formContainer.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  cancelEdit(): void {
    this.editingDetail.set(null);
    this.checkpointForm.reset();
    this.ambulanceForm.reset();
    this.otherInfoForm.reset();
  }

  async fetchDetails(): Promise<void> {
    this.isLoading.set(true);
    try {
      const data = await this.apiSvc.getProgramDetails(this.program().id);
      this.allDetails.set(data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (e) {
      this.notificationSvc.show('error', 'Gagal Memuatkan', 'Tidak dapat memuat turun data program.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async handleFormSubmit(formType: 'Cekpoint' | 'Ambulan' | 'Lain'): Promise<void> {
    if (this.editingDetail()) {
      await this.updateDetail(formType);
    } else {
      if (formType === 'Cekpoint') await this.saveCheckpoint();
      else if (formType === 'Ambulan') await this.saveAmbulance();
      else if (formType === 'Lain') await this.saveOtherInfo();
    }
  }

  private async updateDetail(formType: 'Cekpoint' | 'Ambulan' | 'Lain'): Promise<void> {
    const currentForm = 
      formType === 'Cekpoint' ? this.checkpointForm :
      formType === 'Ambulan' ? this.ambulanceForm : 
      this.otherInfoForm;

    if (currentForm.invalid) return;
    this.isSubmitting.set(true);

    const payload = {
      id: this.editingDetail().id,
      ...currentForm.value
    };

    try {
      const result = await this.apiSvc.updateProgramDetail(payload);
      if (result.success && result.data) {
        this.allDetails.update(list => 
          list.map(item => item.id === result.data.id ? result.data : item)
        );
        this.notificationSvc.show('case', 'Berjaya Dikemaskini', `${formType} telah dikemaskini.`);
        this.cancelEdit();
        this.apiSvc.primeSuggestionCache();
      } else {
        throw new Error(result.message);
      }
    } catch(e) {
      const msg = e instanceof Error ? e.message : 'Ralat tidak diketahui.';
      this.notificationSvc.show('error', 'Gagal Mengemaskini', msg);
    } finally {
      this.isSubmitting.set(false);
    }
  }


  private async saveCheckpoint(): Promise<void> {
    if (this.checkpointForm.invalid) return;
    this.isSubmitting.set(true);
    try {
      const payload = { 
        programId: this.program().id, 
        jenis: 'Cekpoint',
        ...this.checkpointForm.value 
      };
      const result = await this.apiSvc.saveProgramDetail(payload);
      if (result.success && result.data) {
        this.allDetails.update(list => [result.data, ...list].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        this.checkpointForm.reset();
        this.notificationSvc.show('case', 'Berjaya', 'Cekpoint baru telah direkodkan.');
        this.apiSvc.primeSuggestionCache();
      } else {
        throw new Error(result.message);
      }
    } catch(e) {
      const msg = e instanceof Error ? e.message : 'Ralat tidak diketahui.';
      this.notificationSvc.show('error', 'Gagal Menyimpan', msg);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private async saveAmbulance(): Promise<void> {
    if (this.ambulanceForm.invalid) return;
    this.isSubmitting.set(true);
     try {
      const payload = { 
        programId: this.program().id, 
        jenis: 'Ambulan',
        ...this.ambulanceForm.value 
      };
      const result = await this.apiSvc.saveProgramDetail(payload);
      if (result.success && result.data) {
        this.allDetails.update(list => [result.data, ...list].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        this.ambulanceForm.reset();
        this.notificationSvc.show('case', 'Berjaya', 'Ambulans baru telah direkodkan.');
        this.apiSvc.primeSuggestionCache();
      } else {
        throw new Error(result.message);
      }
    } catch(e) {
      const msg = e instanceof Error ? e.message : 'Ralat tidak diketahui.';
      this.notificationSvc.show('error', 'Gagal Menyimpan', msg);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private async saveOtherInfo(): Promise<void> {
    if (this.otherInfoForm.invalid) return;
    this.isSubmitting.set(true);
    try {
      const payload = { 
        programId: this.program().id, 
        jenis: 'Lain',
        ...this.otherInfoForm.value 
      };
      const result = await this.apiSvc.saveProgramDetail(payload);
       if (result.success && result.data) {
        this.allDetails.update(list => [result.data, ...list].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        this.otherInfoForm.reset();
        this.notificationSvc.show('case', 'Berjaya', 'Maklumat baru telah direkodkan.');
      } else {
        throw new Error(result.message);
      }
    } catch(e) {
      const msg = e instanceof Error ? e.message : 'Ralat tidak diketahui.';
      this.notificationSvc.show('error', 'Gagal Menyimpan', msg);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  onLocationInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.locationQuery.set(value);
  }
  
  onLocationInputBlur(): void {
    setTimeout(() => this.showLocationSuggestions.set(false), 200);
  }

  selectLocationSuggestion(location: string): void {
    this.checkpointForm.get('location')?.setValue(location);
    this.locationQuery.set(location);
    this.showLocationSuggestions.set(false);
  }

  onVehicleNumberInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.vehicleNumberQuery.set(value);
  }

  onVehicleNumberInputBlur(): void {
    setTimeout(() => this.showVehicleNumberSuggestions.set(false), 200);
  }
  
  selectVehicleNumberSuggestion(vehicleNumber: string): void {
    this.ambulanceForm.get('vehicleNumber')?.setValue(vehicleNumber);
    this.vehicleNumberQuery.set(vehicleNumber);
    this.showVehicleNumberSuggestions.set(false);
  }
}