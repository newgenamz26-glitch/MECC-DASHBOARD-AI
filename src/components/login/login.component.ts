import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { StateService } from '../../services/state.service';
import { NotificationService } from '../../services/notification.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  imports: [CommonModule],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  stateSvc = inject(StateService);
  private notificationSvc = inject(NotificationService);

  isAboutVisible = signal(false);

  showAboutModal(): void {
    this.isAboutVisible.set(true);
  }

  hideAboutModal(): void {
    this.isAboutVisible.set(false);
  }

  selectMode(isSimulation: boolean): void {
    this.stateSvc.isSimulationMode.set(isSimulation);
    this.stateSvc.isLoggedIn.set(true);
    if (isSimulation) {
      this.notificationSvc.show('login', 'Mod Simulasi Diaktifkan', 'Aplikasi kini menggunakan data sampel. Tiada data sebenar akan terjejas.');
    } else {
      this.notificationSvc.show('login', 'Mod Langsung Diaktifkan', 'Aplikasi akan cuba berhubung dengan data Cloud.');
    }
  }

  enterResponderLogin(): void {
    // This flow is only available in simulation mode.
    // Set simulation mode to true first.
    this.stateSvc.isSimulationMode.set(true);
    this.stateSvc.enterResponderLogin();
  }
}
