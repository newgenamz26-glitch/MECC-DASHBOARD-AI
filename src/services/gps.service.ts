import { Injectable, signal, OnDestroy, inject } from '@angular/core';
import { StateService, GpsStatus, Position } from './state.service';

@Injectable({
  providedIn: 'root',
})
export class GpsService implements OnDestroy {
  private stateSvc = inject(StateService);
  private watchId: number | null = null;

  constructor() {
    this.stateSvc.gpsStatus.set('IDLE');
  }

  startWatching(): void {
    if (this.watchId !== null) {
      return; // Already watching
    }

    if (!navigator.geolocation) {
      this.stateSvc.gpsStatus.set('UNSUPPORTED');
      return;
    }

    this.stateSvc.gpsStatus.set('REQUESTING');
    
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        // We have a position, so we are connected
        this.stateSvc.gpsStatus.set('CONNECTED');
        this.stateSvc.gpsErrorMessage.set(null); // Clear error on success
        this.stateSvc.currentPosition.set({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        console.error('GPS Error:', error);
        if (error.code === error.PERMISSION_DENIED) {
            this.stateSvc.gpsStatus.set('ERROR');
            this.stateSvc.gpsErrorMessage.set('Kebenaran lokasi ditolak. Sila benarkan akses dalam tetapan pelayar anda.');
        } else {
            this.stateSvc.gpsStatus.set('ERROR');
            this.stateSvc.gpsErrorMessage.set('Gagal mendapatkan lokasi GPS. Pastikan GPS peranti anda aktif.');
        }
        this.stateSvc.currentPosition.set(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  stopWatching(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.stateSvc.gpsStatus.set('IDLE');
      this.stateSvc.currentPosition.set(null);
    }
  }

  testCurrentLocation(): Promise<{ status: GpsStatus, position: Position | null }> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        this.stateSvc.gpsStatus.set('UNSUPPORTED');
        resolve({ status: 'UNSUPPORTED', position: null });
        return;
      }

      this.stateSvc.gpsStatus.set('REQUESTING');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          this.stateSvc.gpsStatus.set('CONNECTED');
          this.stateSvc.gpsErrorMessage.set(null); // Clear error
          this.stateSvc.currentPosition.set(pos);
          resolve({ status: 'CONNECTED', position: pos });
        },
        (error) => {
          console.error('GPS Error (one-time test):', error);
           if (error.code === error.PERMISSION_DENIED) {
              this.stateSvc.gpsStatus.set('ERROR');
              this.stateSvc.gpsErrorMessage.set('Kebenaran lokasi ditolak. Sila benarkan akses dalam tetapan pelayar anda.');
          } else {
              this.stateSvc.gpsStatus.set('ERROR');
              this.stateSvc.gpsErrorMessage.set('Gagal mendapatkan lokasi GPS. Pastikan GPS peranti anda aktif.');
          }
          this.stateSvc.currentPosition.set(null);
          resolve({ status: 'ERROR', position: null });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }

  ngOnDestroy(): void {
    this.stopWatching();
  }
}