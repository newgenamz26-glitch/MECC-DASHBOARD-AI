import { Component, ChangeDetectionStrategy, signal, inject, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ProgramSelectorComponent } from './components/program-selector/program-selector.component';
import { SettingsComponent } from './components/settings/settings.component';
import { NotificationComponent } from './components/notification/notification.component';
import { StateService } from './services/state.service';
import { ApiService } from './services/api.service';
import { NotificationService } from './services/notification.service';
import { LoginComponent } from './components/login/login.component';
import { ResponderLoginComponent } from './components/responder-login/responder-login.component';
import { SimulationService } from './services/simulation.service';
import { FeedbackFormComponent } from './components/feedback-form/feedback-form.component';
import { ResponderDashboardComponent } from './components/responder-dashboard/responder-dashboard.component';
import { GpsService } from './services/gps.service';
import { UserGuideComponent } from './components/user-guide/user-guide.component';
import { LocalStorageService } from './services/local-storage.service';
import { ReportGeneratorComponent } from './components/report-generator/report-generator.component';
import { AiAssistantComponent } from './components/ai-assistant/ai-assistant.component';

type ActiveTab = 'dashboard' | 'program' | 'settings' | 'report';

const APP_VERSION = '2.6.0';
const LAST_SEEN_VERSION_KEY = 'MECC_LAST_SEEN_VERSION_V1';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    DashboardComponent,
    ProgramSelectorComponent,
    SettingsComponent,
    NotificationComponent,
    LoginComponent,
    ResponderLoginComponent,
    FeedbackFormComponent,
    ResponderDashboardComponent,
    UserGuideComponent,
    ReportGeneratorComponent,
    AiAssistantComponent,
  ],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  stateSvc = inject(StateService);
  private apiSvc = inject(ApiService);
  private notificationSvc = inject(NotificationService);
  private simulationSvc = inject(SimulationService);
  private gpsSvc = inject(GpsService);
  private localStorageSvc = inject(LocalStorageService);
  
  activeTab = signal<ActiveTab>('dashboard');
  isOutdatedBackendWarningShown = signal(false);
  isFeedbackModalVisible = signal(false);
  isAiAssistantVisible = signal(false);
  readonly appVersion = APP_VERSION;
  
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

  private statusCheckInterval: any;

  constructor() {
    this.gpsSvc.startWatching(); // Start GPS tracking immediately on app load.
    this.apiSvc.primeSuggestionCache(); // Prime cache on startup regardless of login state.
    this.checkAppVersion();

    effect((onCleanup) => {
        const loggedIn = this.stateSvc.isLoggedIn();

        if (loggedIn) {
            // Start checking cloud status once logged in.
            this.checkCloudStatus();
            this.statusCheckInterval = setInterval(() => this.checkCloudStatus(), 30000);
        }

        onCleanup(() => {
            if (this.statusCheckInterval) {
                clearInterval(this.statusCheckInterval);
                this.statusCheckInterval = null;
            }
        });
    });

    effect(() => {
      const initialTab = this.stateSvc.initialTab();
      if (initialTab) {
        this.activeTab.set(initialTab);
        this.stateSvc.initialTab.set(null); // Consume it
      }
    });
  }

  private checkAppVersion(): void {
    const lastSeenVersion = this.localStorageSvc.getItem<string>(LAST_SEEN_VERSION_KEY);
    if (lastSeenVersion !== APP_VERSION) {
      // Use a small delay to ensure the app has rendered before showing the notification
      setTimeout(() => {
        const message = `Sistem telah dikemaskini kepada v${this.appVersion}. Sila muat semula untuk mendapatkan fungsi terkini.`;
        // Show notification which will auto-hide after the default 5 seconds.
        this.notificationSvc.show('version', 'Versi Baru Tersedia!', message); 
        this.localStorageSvc.setItem(LAST_SEEN_VERSION_KEY, APP_VERSION);
      }, 1000);
    }
  }

  async checkCloudStatus() {
    if (this.stateSvc.isSimulationMode()) {
        this.stateSvc.isCloudConnected.set(true); // In simulation, we are always "connected" to the simulator
        return;
    }

    if (this.stateSvc.gasUrl()) {
      const isOnline = await this.apiSvc.ping();
      this.stateSvc.isCloudConnected.set(isOnline);
      if (isOnline) {
        try {
            const config = await this.apiSvc.getConfig();
            this.stateSvc.backendCapabilities.set(config.actions);
            this.stateSvc.sheetNames.set(config.sheetNames);
            this.stateSvc.spreadsheetId.set(config.spreadsheetId || null);
            this.isOutdatedBackendWarningShown.set(false); // Reset on success
        } catch (e) {
            this.stateSvc.backendCapabilities.set([]);
            this.stateSvc.sheetNames.set(null);
            this.stateSvc.spreadsheetId.set(null);

            if (e instanceof Error && e.message === 'SERVER_NOT_CONFIGURED') {
                 if (!this.isOutdatedBackendWarningShown()) { // Re-use the flag to show only once
                    this.notificationSvc.show(
                        'error', 
                        'Server Belum Dikonfigurasi', 
                        'Sila tetapkan ID Pangkalan Data (Spreadsheet ID) di dalam fail skrip Google (Code.gs) dan deploy semula.'
                    );
                    this.isOutdatedBackendWarningShown.set(true);
                 }
            } else {
                // This indicates an older backend or other connection error
                if (!this.isOutdatedBackendWarningShown()) {
                    this.notificationSvc.show(
                        'error', 
                        'Backend Versi Lama Dikesan', 
                        'Skrip Cloud anda mungkin versi lama atau terdapat ralat sambungan. Sila deploy semula versi terkini.'
                    );
                    this.isOutdatedBackendWarningShown.set(true);
                }
                console.warn("Could not get config. Backend might be outdated or unreachable.", e);
            }
        }
      } else {
        // If offline, clear capabilities and reset warning flag
        this.stateSvc.backendCapabilities.set([]);
        this.stateSvc.sheetNames.set(null);
        this.stateSvc.spreadsheetId.set(null);
        this.isOutdatedBackendWarningShown.set(false);
      }
    } else {
      this.stateSvc.isCloudConnected.set(false);
      this.stateSvc.backendCapabilities.set([]);
      this.stateSvc.sheetNames.set(null);
      this.stateSvc.spreadsheetId.set(null);
      this.isOutdatedBackendWarningShown.set(false);
    }
  }

  navigate(tab: ActiveTab): void {
    this.activeTab.set(tab);
  }

  showAiAssistant(): void {
    this.isAiAssistantVisible.set(true);
  }

  hideAiAssistant(): void {
    this.isAiAssistantVisible.set(false);
  }

  showFeedbackModal(): void {
    this.isFeedbackModalVisible.set(true);
  }

  hideFeedbackModal(): void {
    this.isFeedbackModalVisible.set(false);
  }

  confirmLogout(): void {
    this.stateSvc.isLogoutConfirmVisible.set(true);
  }

  cancelLogout(): void {
    this.stateSvc.isLogoutConfirmVisible.set(false);
  }

  logout(): void {
    if (this.stateSvc.isSimulationMode()) {
      this.simulationSvc.stopSimulation();
    }
    this.stateSvc.logoutResponder(); // Clears responder-specific state
    this.stateSvc.activeProgram.set(null);
    this.stateSvc.isCloudConnected.set(false);
    this.stateSvc.isLoggedIn.set(false);
    this.stateSvc.isLogoutConfirmVisible.set(false);
    this.notificationSvc.show('logout', 'Sesi Ditamatkan', 'Anda telah log keluar. Sila pilih mod untuk sambung semula.');
  }
}