import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
// FIX: Consolidate RxJS imports to the modern path to fix type inference issues.
import { firstValueFrom, of, throwError, catchError, map } from 'rxjs';
import { StateService } from './state.service';
import { Attendance, Program, SheetsValidationResponse, CaseReport, Checkpoint, Ambulance, OtherInfo } from '../models';
import { LocalStorageService } from './local-storage.service';
import { SimulationService } from './simulation.service';

interface BackendConfig {
  actions: string[];
  sheetNames: Record<string, string>;
  spreadsheetId?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  // FIX: Explicitly typing the injected HttpClient to fix an issue where it was being inferred as 'unknown'.
  private http: HttpClient = inject(HttpClient);
  private stateSvc = inject(StateService);
  private localStorageSvc = inject(LocalStorageService);
  private simulationSvc = inject(SimulationService);

  primeSuggestionCache(): void {
    // This function previously relied on a local storage cache of all program details.
    // That cache has been removed in favor of direct API calls.
    // This function can be expanded in the future with a dedicated backend endpoint 
    // to fetch all unique suggestions efficiently.
    console.log('primeSuggestionCache is currently a no-op.');
  }

  async ping(): Promise<boolean> {
    if (this.stateSvc.isSimulationMode()) return true;
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
    if (this.stateSvc.isSimulationMode()) return this.simulationSvc.getAttendance();
    const url = this.stateSvc.gasUrl();
    if (!url) return Promise.resolve([]);
    return firstValueFrom(
      this.http.get<{success: boolean, data: any}>(`${url}?type=getDashboard`).pipe(
        map((response: { success: boolean, data: any }) => {
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
    if (this.stateSvc.isSimulationMode()) return this.simulationSvc.getPrograms();
    const url = this.stateSvc.gasUrl();
    if (!url) return Promise.resolve([]);
    return firstValueFrom(
      this.http.get<any>(`${url}?type=getPrograms`).pipe(
        map((response: any) => {
            if (response && response.success && Array.isArray(response.data)) {
                return response.data as Program[];
            }
            if (response && !response.success && typeof response.data === 'string' && response.data.includes('SERVER NOT CONFIGURED')) {
                throw new Error('SERVER_NOT_CONFIGURED');
            }
            const errorMessage = (response && response.data) ? String(response.data) : 'Invalid data format from server.';
            throw new Error(errorMessage);
        }),
        catchError(error => {
            if (error.message === 'SERVER_NOT_CONFIGURED') {
                return throwError(() => error); // Just re-throw
            }
            console.error('Failed to fetch programs:', error);
            const errorMessage = error.message || 'Gagal berhubung dengan Cloud.';
            return throwError(() => new Error(errorMessage));
        })
      )
    );
  }
  
  getLatestProgram(): Promise<Program | null> {
    if (this.stateSvc.isSimulationMode()) return Promise.resolve(null);
    const url = this.stateSvc.gasUrl();
    if (!url) return Promise.resolve(null);

    return firstValueFrom(
      this.http.get<any>(`${url}?type=getLatestProgram`).pipe(
        map((response: any) => {
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
    if (this.stateSvc.isSimulationMode()) return Promise.resolve(`SIM-${Date.now()}`);
    const url = this.stateSvc.gasUrl();
    if (!url) return Promise.reject(new Error('URL Cloud tidak ditetapkan.'));

    return firstValueFrom(
      this.http.get<any>(`${url}?type=getNewProgramId`).pipe(
        map((response: any) => {
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
      if (this.stateSvc.isSimulationMode()) {
        return this.simulationSvc.createProgram(payload);
      }
      const url = this.stateSvc.gasUrl();
      if (!url) return { success: false, message: 'URL Cloud tidak ditetapkan.' };
      try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain;charset=utf-8',
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

        const rawError = result.data || 'Operasi simpan gagal tanpa mesej ralat spesifik.';
        const errorMessage = typeof rawError === 'object' && rawError !== null ? JSON.stringify(rawError) : String(rawError);
        console.error('Save operation was not successful.', result);
        return { success: false, message: errorMessage };

      } catch (e) {
        console.error('saveProgram: API call failed.', e);
        const errorMessage = e instanceof Error ? e.message : 'Ralat tidak diketahui semasa menyimpan.';
        return { success: false, message: errorMessage };
      }
  }

  async updateProgram(programId: string, updates: Partial<Program>): Promise<{success: boolean, message?: string}> {
    if (this.stateSvc.isSimulationMode()) return { success: true, message: 'Fungsi dilumpuhkan dalam Mode Simulasi.' };
    const url = this.stateSvc.gasUrl();
    if (!url) return { success: false, message: 'URL Cloud tidak ditetapkan.' };
    
    try {
        const payload = { id: programId, ...updates };
        const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify({ action: 'updateProgram', payload })
        });

        if (!response.ok) {
           const errorText = await response.text();
           console.error('updateProgram: Network response was not ok.', response.statusText, errorText);
           return { success: false, message: `Ralat rangkaian: ${response.statusText}` };
        }
        
        const result = await response.json();
        if (result.success) {
            return { success: true, message: result.data.message };
        }

        const rawError = result.data || 'Operasi kemas kini gagal.';
        const errorMessage = typeof rawError === 'object' && rawError !== null ? JSON.stringify(rawError) : String(rawError);
        console.error('Update operation was not successful.', result);
        return { success: false, message: errorMessage };

    } catch (e) {
        console.error('updateProgram: API call failed.', e);
        const errorMessage = e instanceof Error ? e.message : 'Ralat tidak diketahui semasa mengemas kini.';
        return { success: false, message: errorMessage };
    }
  }

  async setProgramStatus(programId: string, status: string): Promise<{success: boolean, message?: string}> {
    if (this.stateSvc.isSimulationMode()) {
        return this.simulationSvc.setProgramStatus(programId, status);
    }
    const url = this.stateSvc.gasUrl();
    if (!url) return { success: false, message: 'URL Cloud tidak ditetapkan.' };
    
    try {
        const payload = { programId, status };
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'setProgramStatus', payload })
        });

        if (!response.ok) {
           const errorText = await response.text();
           return { success: false, message: `Ralat rangkaian: ${response.statusText} - ${errorText}` };
        }
        
        const result = await response.json();
        if (result.success) {
            return { success: true, message: result.data.message };
        }
        const errorMessage = result.data || 'Operasi kemas kini status gagal.';
        return { success: false, message: String(errorMessage) };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Ralat tidak diketahui semasa mengemas kini status.';
        return { success: false, message: errorMessage };
    }
  }

  validateSheets(): Promise<SheetsValidationResponse> {
    if (this.stateSvc.isSimulationMode()) {
      const mockResult: SheetsValidationResponse = {
        programs: { isValid: true, message: 'Simulasi Aktif' },
        attendance: { isValid: true, message: 'Simulasi Aktif' },
        caseReports: { isValid: true, message: 'Simulasi Aktif' },
        programDetails: { isValid: true, message: 'Simulasi Aktif' },
      };
      return Promise.resolve(mockResult);
    }
    const url = this.stateSvc.gasUrl();
    if (!url) return Promise.reject(new Error('URL Cloud tidak ditetapkan.'));

    return firstValueFrom(
      this.http.get<{success: boolean, data: SheetsValidationResponse}>(`${url}?type=validateSheets`).pipe(
        map((response: { success: boolean, data: SheetsValidationResponse }) => {
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
    if (this.stateSvc.isSimulationMode()) return Promise.resolve({ actions: [], sheetNames: {} });
    const url = this.stateSvc.gasUrl();
    if (!url) return Promise.reject(new Error('URL Cloud tidak ditetapkan.'));

    return firstValueFrom(
      this.http.get<any>(`${url}?type=getConfig`).pipe(
        map((response: any) => {
          // Happy path
          if (response && response.success && response.data && Array.isArray(response.data.actions)) {
            return response.data as BackendConfig;
          }

          // Handle specific known errors
          if (response && !response.success && typeof response.data === 'string') {
            if (response.data.includes('SERVER NOT CONFIGURED')) {
              throw new Error('SERVER_NOT_CONFIGURED');
            }
            if (response.data.includes('Action GET tidak dikenali')) {
              throw new Error('Fungsi `getConfig` tidak ditemui. Sila deploy versi skrip Google Apps terkini.');
            }
          }
          
          // Propagate other backend errors or throw a generic one
          const errorMessage = (response && response.data) ? String(response.data) : 'Konfigurasi backend tidak sah atau versi lama.';
          throw new Error(errorMessage);
        }),
        catchError((error: Error) => {
          console.error('getConfig: API call failed.', error);
          if (error.message === 'SERVER_NOT_CONFIGURED') {
            return throwError(() => error);
          }
          const finalMessage = error.message || 'Gagal mendapatkan konfigurasi backend.';
          return throwError(() => new Error(finalMessage));
        })
      )
    );
  }

  getCaseReports(programId: string): Promise<CaseReport[]> {
    if (this.stateSvc.isSimulationMode()) return this.simulationSvc.getCaseReports();
    const url = this.stateSvc.gasUrl();
    if (!url) return Promise.resolve([]);
    return firstValueFrom(
      this.http.get<{success: boolean, data: any}>(`${url}?type=getCaseReports&programId=${programId}`).pipe(
        map((response: { success: boolean, data: any }) => {
            if (response && response.success && Array.isArray(response.data)) {
                return response.data as CaseReport[];
            }
            const errorMessage = (response && response.data) ? String(response.data) : 'Format data laporan kes tidak sah.';
            throw new Error(errorMessage);
        }),
        catchError(error => {
            const errorMessage = error.message || 'Gagal memuat turun laporan kes.';
            return throwError(() => new Error(errorMessage));
        })
      )
    );
  }
  
  async updateCaseStatus(caseId: string, status: 'Selesai'): Promise<{success: boolean, message?: string}> {
      if (this.stateSvc.isSimulationMode()) return { success: true, message: 'Fungsi dilumpuhkan dalam Mode Simulasi.' };
      const url = this.stateSvc.gasUrl();
      if (!url) return { success: false, message: 'URL Cloud tidak ditetapkan.' };
      
      try {
          const payload = { id: caseId, status };
          const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({ action: 'updateCaseStatus', payload })
          });
  
          if (!response.ok) {
             const errorText = await response.text();
             return { success: false, message: `Ralat rangkaian: ${response.statusText} - ${errorText}` };
          }
          
          const result = await response.json();
          if (result.success) {
              return { success: true, message: result.data.message };
          }
  
          const errorMessage = result.data || 'Operasi kemas kini kes gagal.';
          return { success: false, message: String(errorMessage) };
  
      } catch (e) {
          const errorMessage = e instanceof Error ? e.message : 'Ralat tidak diketahui semasa mengemas kini kes.';
          return { success: false, message: errorMessage };
      }
    }

  getProgramDetails(programId: string): Promise<any[]> {
    if (this.stateSvc.isSimulationMode()) return this.simulationSvc.getProgramDetails(programId);
    const url = this.stateSvc.gasUrl();
    if (!url) return Promise.resolve([]);
    return firstValueFrom(
      this.http.get<{success: boolean, data: any}>(`${url}?type=getProgramDetails&programId=${programId}`).pipe(
        map((response: { success: boolean, data: any }) => {
            if (response && response.success && Array.isArray(response.data)) {
                return response.data;
            }
            const errorMessage = (response && response.data) ? String(response.data) : 'Format data tidak sah.';
            throw new Error(errorMessage);
        }),
        catchError(error => {
            const errorMessage = error.message || 'Gagal memuat turun data.';
            return throwError(() => new Error(errorMessage));
        })
      )
    );
  }

  async saveProgramDetail(payload: any): Promise<{success: boolean, message?: string, data?: any}> {
    if (this.stateSvc.isSimulationMode()) {
        return this.simulationSvc.saveProgramDetail(payload);
    }
    
    const url = this.stateSvc.gasUrl();
    if (!url) return { success: false, message: 'URL Cloud tidak ditetapkan.' };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'saveProgramDetail', payload })
        });
        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, message: `Ralat rangkaian: ${response.statusText} - ${errorText}` };
        }
        const result = await response.json();
        if (result.success) {
            return { success: true, data: result.data };
        }
        const errorMessage = result.data || `Operasi simpan gagal.`;
        return { success: false, message: String(errorMessage) };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : `Ralat tidak diketahui.`;
        return { success: false, message: errorMessage };
    }
  }

  async updateProgramDetail(payload: any): Promise<{success: boolean, message?: string, data?: any}> {
    if (this.stateSvc.isSimulationMode()) {
        return this.simulationSvc.updateProgramDetail(payload);
    }
    
    const url = this.stateSvc.gasUrl();
    if (!url) return { success: false, message: 'URL Cloud tidak ditetapkan.' };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'updateProgramDetail', payload })
        });
        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, message: `Ralat rangkaian: ${response.statusText} - ${errorText}` };
        }
        const result = await response.json();
        if (result.success) {
            return { success: true, data: result.data };
        }
        const errorMessage = result.data || `Operasi kemas kini gagal.`;
        return { success: false, message: String(errorMessage) };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : `Ralat tidak diketahui.`;
        return { success: false, message: errorMessage };
    }
  }

  async saveFeatureListToDocs(title: string, content: string): Promise<{success: boolean, message?: string, url?: string}> {
    if (this.stateSvc.isSimulationMode()) {
      return { success: false, message: 'Fungsi ini tidak tersedia dalam Mod Simulasi.' };
    }
    
    const url = this.stateSvc.gasUrl();
    if (!url) return { success: false, message: 'URL Cloud tidak ditetapkan.' };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'saveFeatureListToDocs', payload: { title, content } })
        });
        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, message: `Ralat rangkaian: ${response.statusText} - ${errorText}` };
        }
        const result = await response.json();
        if (result.success) {
            return { success: true, url: result.data.url };
        }
        const errorMessage = result.data || `Operasi saveFeatureListToDocs gagal.`;
        return { success: false, message: String(errorMessage) };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : `Ralat tidak diketahui semasa saveFeatureListToDocs.`;
        return { success: false, message: errorMessage };
    }
  }

  async addSampleDataToCloud(): Promise<{success: boolean, message?: string}> {
    if (this.stateSvc.isSimulationMode()) {
      return { success: false, message: 'Fungsi ini tidak tersedia dalam Mod Simulasi.' };
    }
    const url = this.stateSvc.gasUrl();
    if (!url) return { success: false, message: 'URL Cloud tidak ditetapkan.' };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'addSampleData', payload: {} })
        });
        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, message: `Ralat rangkaian: ${response.statusText} - ${errorText}` };
        }
        const result = await response.json();
        if (result.success) {
            return { success: true, message: result.data.message };
        }
        const errorMessage = result.data || `Operasi gagal.`;
        return { success: false, message: String(errorMessage) };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : `Ralat tidak diketahui.`;
        return { success: false, message: errorMessage };
    }
  }

  async sendFeedback(payload: { feedbackType: string, rating: number, message: string, contactInfo?: string }): Promise<{success: boolean, message?: string}> {
    // Simulation mode can just return success
    if (this.stateSvc.isSimulationMode()) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // simulate network delay
        return { success: true, message: 'Maklum balas simulasi diterima.' };
    }

    const url = this.stateSvc.gasUrl();
    if (!url) return { success: false, message: 'URL Cloud tidak ditetapkan.' };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'sendFeedback', payload })
        });
        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, message: `Ralat rangkaian: ${response.statusText} - ${errorText}` };
        }
        const result = await response.json();
        if (result.success) {
            return { success: true, message: result.data.message };
        }
        const errorMessage = result.data || `Operasi gagal.`;
        return { success: false, message: String(errorMessage) };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : `Ralat tidak diketahui.`;
        return { success: false, message: errorMessage };
    }
  }

  async loginResponder(name: string, role: string): Promise<{success: boolean, message?: string}> {
    // This function is only for simulation mode
    if (this.stateSvc.isSimulationMode()) {
        return this.simulationSvc.loginResponder(name, role);
    }
    return Promise.resolve({ success: false, message: 'Fungsi ini hanya untuk mod simulasi.' });
  }
}