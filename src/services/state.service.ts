import { Injectable, signal, effect, inject } from '@angular/core';
import { LocalStorageService } from './local-storage.service';
import { Program } from '../models';

const MECC_CLOUD_URL_KEY = 'MECC_CLOUD_URL_V14';
const MECC_CLOUD_LOCKED_KEY = 'MECC_CLOUD_LOCKED_V14';
const MECC_ACTIVE_PROG_KEY = 'MECC_ACTIVE_PROG_V14';
const MECC_SIMULATION_MODE_KEY = 'MECC_SIMULATION_MODE_V15';
const MECC_LOGGED_IN_STATUS_KEY = 'MECC_LOGGED_IN_STATUS_V1';
const MECC_RESPONDER_KEY = 'MECC_RESPONDER_V1';

const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzJEUmkNIkmFGiBQiBrtpEVEn3ZZIFsM0ynVUrBbqkfOIA3Oh1mFa5qwoQGAubkaoju1g/exec';

type ActiveTab = 'dashboard' | 'program' | 'settings';
export type GpsStatus = 'IDLE' | 'REQUESTING' | 'CONNECTED' | 'ERROR' | 'UNSUPPORTED';

export interface Position {
  latitude: number;
  longitude: number;
  accuracy: number;
}

@Injectable({
  providedIn: 'root',
})
export class StateService {
  private localStorageSvc = inject(LocalStorageService);

  // Command Center State
  isLoggedIn = signal<boolean>(this.localStorageSvc.getItem<boolean>(MECC_LOGGED_IN_STATUS_KEY) || false);
  
  // Responder State
  isResponderLoginFlow = signal<boolean>(false);
  loggedInResponder = signal<{ name: string, role: string } | null>(this.localStorageSvc.getItem<{ name: string, role: string }>(MECC_RESPONDER_KEY) || null);
  
  // General State
  gasUrl = signal<string>(this.localStorageSvc.getItem<string>(MECC_CLOUD_URL_KEY) || DEFAULT_GAS_URL);
  isCloudConnected = signal<boolean>(this.localStorageSvc.getItem<boolean>(MECC_CLOUD_LOCKED_KEY) || false);
  activeProgram = signal<Program | null>(this.localStorageSvc.getItem<Program>(MECC_ACTIVE_PROG_KEY) || null);
  programListVersion = signal<number>(0);
  isSimulationMode = signal<boolean>(this.localStorageSvc.getItem<boolean>(MECC_SIMULATION_MODE_KEY) || false);
  initialTab = signal<ActiveTab | null>(null);
  isLogoutConfirmVisible = signal(false);
  isUserGuideVisible = signal(false);

  // GPS State
  gpsStatus = signal<GpsStatus>('IDLE');
  currentPosition = signal<Position | null>(null);
  gpsErrorMessage = signal<string | null>(null);

  // Signals for backend capabilities and configuration
  backendCapabilities = signal<string[]>([]);
  sheetNames = signal<Record<string, string> | null>(null);
  spreadsheetId = signal<string | null>(null);

  // Signals for autocomplete suggestions
  uniqueCheckpointLocations = signal<string[]>([]);
  uniqueAmbulanceVehicleNumbers = signal<string[]>([]);


  constructor() {
    effect(() => {
      this.localStorageSvc.setItem(MECC_LOGGED_IN_STATUS_KEY, this.isLoggedIn());
    });
     effect(() => {
      this.localStorageSvc.setItem(MECC_RESPONDER_KEY, this.loggedInResponder());
    });
    effect(() => {
      this.localStorageSvc.setItem(MECC_CLOUD_URL_KEY, this.gasUrl());
    });
    effect(() => {
      this.localStorageSvc.setItem(MECC_CLOUD_LOCKED_KEY, this.isCloudConnected());
    });
    effect(() => {
      this.localStorageSvc.setItem(MECC_ACTIVE_PROG_KEY, this.activeProgram());
    });
    effect(() => {
      this.localStorageSvc.setItem(MECC_SIMULATION_MODE_KEY, this.isSimulationMode());
    });
  }

  enterResponderLogin(): void {
    this.isResponderLoginFlow.set(true);
    this.loggedInResponder.set(null);
    this.isLoggedIn.set(false);
  }

  logoutResponder(): void {
    this.loggedInResponder.set(null);
    this.isResponderLoginFlow.set(false);
  }
}