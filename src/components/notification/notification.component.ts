import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { NotificationService } from '../../services/notification.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-notification',
  imports: [CommonModule],
  templateUrl: './notification.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationComponent {
  notificationSvc = inject(NotificationService);

  refreshPage(): void {
    window.location.reload();
  }
}