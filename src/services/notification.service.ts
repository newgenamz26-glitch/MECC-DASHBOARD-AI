import { Injectable, signal } from '@angular/core';

export type NotificationType = 'login' | 'logout' | 'case' | 'error' | 'info' | 'version';

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  icon: string;
  color: string;
  hiding?: boolean;
}

const NOTIFICATION_CONFIGS = {
    login: { icon: "💎", color: "#0369a1" },
    logout: { icon: "🌙", color: "#64748b" },
    case: { icon: "✅", color: "#0891b2" },
    error: { icon: "⚠️", color: "#e11d48" },
    info: { icon: "ℹ️", color: "#3b82f6" },
    version: { icon: "🚀", color: "#14b8a6" }
};

const MAX_NOTIFICATIONS = 3;
const HIDE_ANIMATION_DURATION = 400; // Corresponds to animation duration in CSS

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  notifications = signal<Notification[]>([]);
  private nextId = 0;

  show(type: NotificationType, title: string, message: string, duration: number = 5000): void {
    const config = NOTIFICATION_CONFIGS[type];
    const newNotification: Notification = {
      id: this.nextId++,
      type,
      title,
      message,
      ...config
    };

    this.notifications.update(currentNotifications => {
      const newArray = [...currentNotifications, newNotification];
      // If we exceed the max, remove the oldest one
      if (newArray.length > MAX_NOTIFICATIONS) {
        return newArray.slice(newArray.length - MAX_NOTIFICATIONS);
      }
      return newArray;
    });
    
    if (duration > 0) {
      setTimeout(() => this.hide(newNotification.id), duration);
    }
  }

  hide(id: number): void {
    // First, trigger the leaving animation
    this.notifications.update(current => 
      current.map(n => n.id === id ? { ...n, hiding: true } : n)
    );

    // Then, remove the notification from the array after the animation completes
    setTimeout(() => {
      this.notifications.update(current => current.filter(n => n.id !== id));
    }, HIDE_ANIMATION_DURATION);
  }
}