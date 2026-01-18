import { Injectable, signal, effect, inject } from '@angular/core';
import { LocalStorageService } from './local-storage.service';
import { Program } from '../models';

const MECC_CLOUD_URL_KEY = 'MECC_CLOUD_URL_V14';
const MECC_CLOUD_LOCKED_KEY = 'MECC_CLOUD_LOCKED_V14';
const MECC_ACTIVE_PROG_KEY = 'MECC_ACTIVE_PROG_V14';
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbwqPRxGvfp8aCLSe0vmVjnGJxLrWRCHeZDe4n21ReiTUqTOX6m9gWT0CLRGoNRnlCbRCw/exec';

@Injectable({
  providedIn: 'root',
})
export class StateService {
  private localStorageSvc = inject(LocalStorageService);

  gasUrl = signal<string>(this.localStorageSvc.getItem<string>(MECC_CLOUD_URL_KEY) || DEFAULT_GAS_URL);
  isCloudConnected = signal<boolean>(this.localStorageSvc.getItem<boolean>(MECC_CLOUD_LOCKED_KEY) || false);
  activeProgram = signal<Program | null>(this.localStorageSvc.getItem<Program>(MECC_ACTIVE_PROG_KEY) || null);
  programListVersion = signal<number>(0);

  // Signals for backend capabilities and configuration
  backendCapabilities = signal<string[]>([]);
  sheetNames = signal<Record<string, string> | null>(null);


  constructor() {
    effect(() => {
      this.localStorageSvc.setItem(MECC_CLOUD_URL_KEY, this.gasUrl());
    });
    effect(() => {
      this.localStorageSvc.setItem(MECC_CLOUD_LOCKED_KEY, this.isCloudConnected());
    });
    effect(() => {
      this.localStorageSvc.setItem(MECC_ACTIVE_PROG_KEY, this.activeProgram());
    });
  }
}