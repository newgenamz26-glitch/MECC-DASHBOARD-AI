export interface Program {
  id: string;
  namaprogram: string;
  // The original API might return id or idprogram
  idprogram?: string;
  tarikh?: string;
  masa?: string;
  lokasi?: string;
  locked?: boolean;
}

export interface Attendance {
  nama: string;
  mula: string;
  tamat: string | null;
  kes: number;
}

export interface SheetValidationResult {
  isValid: boolean;
  message: string;
  details?: {
    missing: string[];
    found: string[];
  };
}

export interface SheetsValidationResponse {
  programs: SheetValidationResult;
  attendance: SheetValidationResult;
}