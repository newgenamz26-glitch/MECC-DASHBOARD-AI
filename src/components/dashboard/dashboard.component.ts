import { Component, OnInit, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { Attendance } from '../../models';
import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, LoadingIndicatorComponent],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  stateSvc = inject(StateService);
  private apiSvc = inject(ApiService);

  attendanceList = signal<Attendance[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);
  
  activeResponderCount = computed(() => this.attendanceList().filter(r => !r.tamat).length);

  ngOnInit(): void {
    this.fetchAttendance();
  }

  async fetchAttendance(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const data = await this.apiSvc.getAttendance();
      if (Array.isArray(data)) {
        this.attendanceList.set(data.reverse());
      } else {
        this.attendanceList.set([]);
        this.error.set('Format data kehadiran tidak sah.');
        console.error('Expected attendance data to be an array, but got:', data);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Gagal memuatkan data kehadiran.';
      this.error.set(message);
      console.error('Failed to fetch attendance:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  getFormattedTime(dateString: string | null): string {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
}