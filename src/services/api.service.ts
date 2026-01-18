import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { StateService } from './state.service';
import { Attendance, Program, SheetsValidationResponse } from '../models';

interface BackendConfig {
  actions: string[];
  sheetNames: Record<string, string>;
}


@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private http = inject(HttpClient);
  private stateSvc = inject(StateService);

  async ping(): Promise<boolean> {
    const url = this.stateSvc.gasUrl();
    if (!url) return false;

    try {
        const response = await fetch(`${url}?type=ping`);
        return response.ok;
    } catch (error) {
        return false;
    }
  }

  getAttendance(): Promise<Attendance[]> {
    const url = this.stateSvc.gasUrl();
    if (!url) return Promise.resolve([]);
    return firstValueFrom(
      this.http.get<{success: boolean, data: any}>(`${url}?type=getAttendance`).pipe(
        map(response => {
            if (response && response.success && Array.isArray(response.data)) {
                return response.data as Attendance[];
            }
            const errorMessage = (response && response.data) ? String(response.data) : 'Invalid data format from server.';
            throw new Error(errorMessage);
        }),
        catchError(error => {
            const errorMessage = error.message || 'Gagal berhubung dengan Cloud.';
            return throwError(() => new Error(errorMessage));
        })
      )
    );
  }

  getPrograms(): Promise<Program[]> {
    const url = this.stateSvc.gasUrl();
    if (!url) return Promise.resolve([]);
    return firstValueFrom(
      this.http.get<{success: boolean, data: any}>(`${url}?type=getPrograms`).pipe(
        map(response => {
            if (response && response.success && Array.isArray(response.data)) {
                return response.data as Program[];
            }
            const errorMessage = (response && response.data) ? String(response.data) : 'Invalid data format from server.';
            throw new Error(errorMessage);
        }),
        catchError(error => {
            const errorMessage = error.message || 'Gagal berhubung dengan Cloud.';
            return throwError(() => new Error(errorMessage));
        })
      )
    );
  }
  
  getLatestProgram(): Promise<Program | null> {
    const url = this.stateSvc.gasUrl();
    if (!url) return Promise.resolve(null);

    return firstValueFrom(
      this.http.get<any>(`${url}?type=getLatestProgram`).pipe(
        map(response => {
          if (response && response.success && response.data) {
            return response.data as Program;
          }
          if (response && !response.success) {
            console.info('getLatestProgram:', response.data); // e.g., "Tiada program ditemui"
            return null;
          }
          throw new Error('Format respons tidak sah dari server.');
        }),
        catchError((error) => {
          console.error('getLatestProgram: API call failed.', error);
          const errorMessage = error.message || 'Gagal berhubung dengan Cloud.';
          return throwError(() => new Error(errorMessage));
        })
      )
    );
  }

  getNewProgramId(): Promise<string> {
    const url = this.stateSvc.gasUrl();
    if (!url) return Promise.reject(new Error('URL Cloud tidak ditetapkan.'));

    return firstValueFrom(
      this.http.get<any>(`${url}?type=getNewProgramId`).pipe(
        map(response => {
          if (response && response.success && typeof response.data === 'string') {
            return response.data;
          }
          const errorMessage = (response && response.data) ? String(response.data) : 'Format respons tidak sah dari server untuk ID baru.';
          throw new Error(errorMessage);
        }),
        catchError((error) => {
          console.error('getNewProgramId: API call failed.', error);
          const errorMessage = error.message || 'Gagal mendapatkan ID program baru dari Cloud.';
          return throwError(() => new Error(errorMessage));
        })
      )
    );
  }

  async saveProgram(payload: any): Promise<{success: boolean, newProgram?: Program, message?: string}> {
      const url = this.stateSvc.gasUrl();
      if (!url) return { success: false, message: 'URL Cloud tidak ditetapkan.' };
      try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain;charset=utf-8', // Use text/plain to avoid CORS preflight issues with GAS
            },
            body: JSON.stringify({ action: 'saveProgram', payload })
        });

        if (!response.ok) {
           const errorText = await response.text();
           console.error('saveProgram: Network response was not ok.', response.statusText, errorText);
           return { success: false, message: `Ralat rangkaian: ${response.statusText}` };
        }

        const result = await response.json();
        if (result.success && result.data && result.data.newProgram) {
            return { success: true, newProgram: result.data.newProgram };
        }

        const errorMessage = result.data || 'Operasi simpan gagal tanpa mesej ralat spesifik.';
        console.error('Save operation was not successful.', result);
        return { success: false, message: String(errorMessage) };

      } catch (e) {
        console.error('saveProgram: API call failed.', e);
        const errorMessage = e instanceof Error ? e.message : 'Ralat tidak diketahui semasa menyimpan.';
        return { success: false, message: errorMessage };
      }
  }

  validateSheets(): Promise<SheetsValidationResponse> {
    const url = this.stateSvc.gasUrl();
    if (!url) return Promise.reject(new Error('URL Cloud tidak ditetapkan.'));

    return firstValueFrom(
      this.http.get<{success: boolean, data: SheetsValidationResponse}>(`${url}?type=validateSheets`).pipe(
        map(response => {
          if (response && response.success && response.data) {
            return response.data;
          }
  
          const errorMessage = (response && response.data) ? String(response.data) : 'Format respons tidak sah dari server untuk validasi.';
          throw new Error(errorMessage);
        }),
        catchError((error) => {
          console.error('validateSheets: API call failed.', error);
          const errorMessage = error.message || 'Gagal menyemak struktur sheet.';
          return throwError(() => new Error(errorMessage));
        })
      )
    );
  }

  getConfig(): Promise<BackendConfig> {
    const url = this.stateSvc.gasUrl();
    if (!url) return Promise.reject(new Error('URL Cloud tidak ditetapkan.'));

    return firstValueFrom(
      this.http.get<{success: boolean, data: BackendConfig}>(`${url}?type=getConfig`).pipe(
        map(response => {
          if (response && response.success && response.data && Array.isArray(response.data.actions)) {
            return response.data;
          }
          throw new Error('Konfigurasi backend tidak sah atau versi lama.');
        }),
        catchError((error) => {
          console.error('getConfig: API call failed.', error);
          return throwError(() => new Error('Gagal mendapatkan konfigurasi backend.'));
        })
      )
    );
  }
}