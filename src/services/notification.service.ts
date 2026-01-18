
import { Injectable, signal } from '@angular/core';

export type NotificationType = 'login' | 'logout' | 'case' | 'error' | 'info';

export interface Notification {
  type: NotificationType;
  title: string;
  message: string;
  icon: string;
  color: string;
}

const NOTIFICATION_CONFIGS = {
    login: { icon: "💎", color: "#0369a1" },
    logout: { icon: "🌙", color: "#64748b" },
    case: { icon: "✅", color: "#0891b2" },
    error: { icon: "⚠️", color: "#e11d48" },
    info: { icon: "ℹ️", color: "#3b82f6" }
};

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  notification = signal<Notification | null>(null);
  private timer: any;

  show(type: NotificationType, title: string, message: string): void {
    clearTimeout(this.timer);
    const config = NOTIFICATION_CONFIGS[type];
    this.notification.set({ type, title, message, ...config });
    this.timer = setTimeout(() => this.hide(), 8000); // Increased timeout for info
  }

  hide(): void {
    clearTimeout(this.timer);
    this.notification.set(null);
  }
}