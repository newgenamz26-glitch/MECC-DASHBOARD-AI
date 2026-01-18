
import { Component, ChangeDetectionStrategy, signal, inject, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ProgramSelectorComponent } from './components/program-selector/program-selector.component';
import { SettingsComponent } from './components/settings/settings.component';
import { NotificationComponent } from './components/notification/notification.component';
import { StateService } from './services/state.service';
import { ApiService } from './services/api.service';
import { NotificationService } from './services/notification.service';

type ActiveTab = 'dashboard' | 'program' | 'settings';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    DashboardComponent,
    ProgramSelectorComponent,
    SettingsComponent,
    NotificationComponent,
  ],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  stateSvc = inject(StateService);
  private apiSvc = inject(ApiService);
  private notificationSvc = inject(NotificationService);
  
  activeTab = signal<ActiveTab>('dashboard');
  isOutdatedBackendWarningShown = signal(false);
  
  private statusCheckInterval: any;

  constructor() {
    effect(() => {
        // When URL is updated and we are not connected, try to connect.
        const url = this.stateSvc.gasUrl();
        const connected = this.stateSvc.isCloudConnected();
        if (url && !connected) {
            this.checkCloudStatus();
        }
    });
  }

  ngOnInit() {
    this.checkCloudStatus();
    this.statusCheckInterval = setInterval(() => this.checkCloudStatus(), 30000); // Check every 30 seconds
  }

  ngOnDestroy() {
    clearInterval(this.statusCheckInterval);
  }

  async checkCloudStatus() {
    if (this.stateSvc.gasUrl()) {
      const isOnline = await this.apiSvc.ping();
      this.stateSvc.isCloudConnected.set(isOnline);
      if (isOnline) {
        try {
            const config = await this.apiSvc.getConfig();
            this.stateSvc.backendCapabilities.set(config.actions);
            this.stateSvc.sheetNames.set(config.sheetNames);
            this.isOutdatedBackendWarningShown.set(false); // Reset on success
        } catch (e) {
            // This indicates an older backend that doesn't support getConfig
            this.stateSvc.backendCapabilities.set([]);
            this.stateSvc.sheetNames.set(null);
            
            if (!this.isOutdatedBackendWarningShown()) {
                this.notificationSvc.show(
                    'error', 
                    'Backend Versi Lama Dikesan', 
                    'Skrip Cloud anda mungkin versi lama. Sila deploy semula versi terkini untuk kefungsian penuh.'
                );
                this.isOutdatedBackendWarningShown.set(true);
            }
            console.warn("Backend is outdated, getConfig endpoint not found.");
        }
      } else {
        // If offline, clear capabilities and reset warning flag
        this.stateSvc.backendCapabilities.set([]);
        this.stateSvc.sheetNames.set(null);
        this.isOutdatedBackendWarningShown.set(false);
      }
    } else {
      this.stateSvc.isCloudConnected.set(false);
      this.stateSvc.backendCapabilities.set([]);
      this.stateSvc.sheetNames.set(null);
      this.isOutdatedBackendWarningShown.set(false);
    }
  }

  navigate(tab: ActiveTab): void {
    this.activeTab.set(tab);
  }
}