export interface Program {
  id: string;
  namaprogram: string;
  // The original API might return id or idprogram
  idprogram?: string;
  tarikh?: string;
  masa?: string;
  lokasi?: string;
  locked?: boolean;
  status?: 'Belum Mula' | 'Aktif' | 'Selesai' | string;
}

export interface Attendance {
  nama: string;
  mula: string;
  tamat: string | null;
  kes: number;
}

export interface CaseReport {
  id: string;
  programId: string;
  details: string;
  status: 'Baru' | 'Selesai';
  timestamp: string;
  location: string;
  reporterName?: string;
}

export interface Checkpoint {
  id: string;
  programId: string;
  name: string;
  location: string;
  pic?: string;
  callSign?: string;
  crew?: string;
}

export interface Ambulance {
  id: string;
  programId: string;
  callSign: string;
  vehicleNumber: string;
  crew: string;
}

export interface OtherInfo {
  id: string;
  programId: string;
  title: string;
  details: string;
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
  caseReports: SheetValidationResult;
  programDetails: SheetValidationResult;
}