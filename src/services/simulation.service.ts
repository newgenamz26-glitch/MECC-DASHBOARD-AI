import { Injectable, inject, computed } from '@angular/core';
import { signal } from '@angular/core';
import { Program, Attendance, CaseReport, Checkpoint, Ambulance, OtherInfo } from '../models';
import { NotificationService } from './notification.service';

const SAMPLE_PROGRAMS: Program[] = [
    { id: 'SIM-01', namaprogram: 'Simulasi: Larian Amal 2024', lokasi: 'Dataran Merdeka', tarikh: '2024-08-15', masa: '07:00', locked: false, status: 'Belum Mula' },
    { id: 'SIM-02', namaprogram: 'Simulasi: Konsert Gegar Suara', lokasi: 'Stadium Bukit Jalil', tarikh: '2024-09-01', masa: '20:00', locked: true, status: 'Belum Mula' },
    { id: 'SIM-03', namaprogram: 'Simulasi: Bantuan Banjir Pantai Timur', lokasi: 'Kuantan', tarikh: '2024-12-25', masa: '09:00', locked: false, status: 'Selesai' },
];

const SAMPLE_RESPONDERS = [
    'Ahmad Faizal', 'Siti Nurhaliza', 'Badrul Hisham', 'Nurul Izzah', 'Khairul Anuar', 
    'Farah Ann', 'Lee Chong Wei', 'Nicol David', 'Pandelela Rinong', 'Azizulhasni Awang'
];

const SAMPLE_CASES = [
    { details: 'Peserta pengsan, dehidrasi.', location: 'Checkpoint 3' },
    { details: 'Lutut tercedera akibat terjatuh.', location: 'KM 5.2' },
    { details: 'Sakit dada dan sesak nafas.', location: 'Berhampiran Garisan Penamat' },
    { details: 'Kaki terseliuh.', location: 'Zon Air Minuman 2' },
    { details: 'Penonton diserang asma.', location: 'Kawasan Pentas Utama' },
];

const SAMPLE_CHECKPOINTS_DATA = [
    { name: 'Pelepasan', location: 'Garis Mula/Tamat', pic: 'En. Razak', callSign: 'CP-START', crew: 'Pasukan A' },
    { name: 'Stesen Air 1', location: 'KM 2.5', pic: 'Pn. Aisha', callSign: 'CP-W1', crew: 'Pasukan B' },
    { name: 'Stesen Air 2', location: 'KM 5.0', pic: 'En. Budi', callSign: 'CP-W2', crew: 'Pasukan C' },
    { name: 'Stesen Perubatan', location: 'KM 7.5', pic: 'Dr. Kamal', callSign: 'CP-MED', crew: 'St. John Ambulance' }
];

const SAMPLE_AMBULANCES_DATA = [
    { callSign: 'Alpha 1', vehicleNumber: 'VCS 1234', crew: 'Ali, Abu' },
    { callSign: 'Bravo 2', vehicleNumber: 'VCS 5678', crew: 'Siti, Fatimah' }
];

type ProgramDetail = (Checkpoint | Ambulance | OtherInfo) & { jenis: 'Cekpoint' | 'Ambulan' | 'Lain' };

const initialProgramDetails: ProgramDetail[] = [];
SAMPLE_PROGRAMS.forEach((program, index) => {
    const cpData = SAMPLE_CHECKPOINTS_DATA[index % SAMPLE_CHECKPOINTS_DATA.length];
    initialProgramDetails.push({
        ...cpData,
        id: `SIM-CP-INIT-${program.id}`,
        programId: program.id,
        jenis: 'Cekpoint',
    });
    const ambData = SAMPLE_AMBULANCES_DATA[index % SAMPLE_AMBULANCES_DATA.length];
    initialProgramDetails.push({
        ...ambData,
        id: `SIM-AMB-INIT-${program.id}`,
        programId: program.id,
        jenis: 'Ambulan',
    });
});


@Injectable({
  providedIn: 'root',
})
export class SimulationService {
  private notificationSvc = inject(NotificationService);

  private programs = signal<Program[]>(SAMPLE_PROGRAMS);
  private attendance = signal<Attendance[]>([]);
  private caseReports = signal<CaseReport[]>([]);
  private programDetails = signal<ProgramDetail[]>(initialProgramDetails);
  
  private simulationTimers: any[] = [];

  getPrograms = (): Promise<Program[]> => Promise.resolve(this.programs());
  getAttendance = (): Promise<Attendance[]> => Promise.resolve(this.attendance());
  getCaseReports = (): Promise<CaseReport[]> => Promise.resolve(this.caseReports());
  
  getProgramDetails = (programId: string): Promise<any[]> => {
    return Promise.resolve(this.programDetails().filter(d => d.programId === programId));
  }
  
  exportedData = computed(() => ({
    programs: this.programs(),
    attendance: this.attendance(),
    caseReports: this.caseReports(),
    programDetails: this.programDetails(),
  }));

  createProgram(payload: { name: string, date: string, time: string, location: string }): Promise<{success: boolean, newProgram?: Program, message?: string}> {
    const newProgram: Program = {
      id: `SIM-${Date.now()}`,
      namaprogram: payload.name,
      tarikh: payload.date,
      masa: payload.time,
      lokasi: payload.location,
      locked: false,
      status: 'Belum Mula'
    };

    this.programs.update(programs => [...programs, newProgram]);
    this.notificationSvc.show('case', 'Program Simulasi Dicipta', `Program "${newProgram.namaprogram}" telah ditambah ke senarai simulasi.`);
    
    return Promise.resolve({
      success: true,
      newProgram: newProgram
    });
  }

  setProgramStatus(programId: string, status: string): Promise<{success: boolean, message?: string}> {
    this.programs.update(programs => {
      let programToActivateName = '';
      const wasActiveProgram = programs.find(p => p.id === programId && p.status === 'Aktif');

      const updatedPrograms = programs.map(p => {
        if (status === 'Aktif') {
          if (p.id === programId) {
            programToActivateName = p.namaprogram;
            return { ...p, status: 'Aktif' as const };
          } else if (p.status === 'Aktif') {
            return { ...p, status: 'Belum Mula' as const };
          }
        } else if (p.id === programId) {
          return { ...p, status: status as 'Belum Mula' | 'Selesai' };
        }
        return p;
      });

      if (status === 'Aktif') {
        this.startSimulation(programId);
      } else if (wasActiveProgram) {
          this.stopSimulation();
      }

      return updatedPrograms;
    });
    return Promise.resolve({ success: true, message: 'Status program simulasi dikemaskini.' });
  }

  startSimulation(programId: string): void {
    this.stopSimulation();
    console.log(`Starting simulation for program: ${programId}`);

    const activeResponders = [...SAMPLE_RESPONDERS].sort(() => 0.5 - Math.random()).slice(0, 5);
    let responderLoginIndex = 0;

    const loginInterval = setInterval(() => {
        if (responderLoginIndex < activeResponders.length) {
            const responderName = activeResponders[responderLoginIndex];
            const newAttendance: Attendance = {
                nama: responderName,
                mula: new Date().toISOString(),
                tamat: null,
                kes: 0,
            };
            this.attendance.update(list => [newAttendance, ...list]);
            this.notificationSvc.show('login', 'Responder Mula Tugas', `${responderName} telah log masuk.`);
            
            const logoutTimer = setTimeout(() => {
                this.attendance.update(list => 
                    list.map(att => 
                        att.nama === responderName && att.tamat === null 
                        ? { ...att, tamat: new Date().toISOString() } 
                        : att
                    )
                );
                this.notificationSvc.show('logout', 'Responder Tamat Tugas', `${responderName} telah log keluar.`);
            }, 30000);
            this.simulationTimers.push(logoutTimer);

            responderLoginIndex++;
        } else {
            clearInterval(loginInterval);
            this.startCaseReporting(programId);
        }
    }, 2500);
    this.simulationTimers.push(loginInterval);
  }

  private startCaseReporting(programId: string): void {
    const shuffledCases = [...SAMPLE_CASES].sort(() => 0.5 - Math.random());
    
    const caseTimer1 = setTimeout(() => this.createCaseReport(programId, shuffledCases[0]), 4000);
    const caseTimer2 = setTimeout(() => this.createCaseReport(programId, shuffledCases[1]), 4100);
    const caseTimer3 = setTimeout(() => this.createCaseReport(programId, shuffledCases[2]), 8000);
    const caseTimer4 = setTimeout(() => this.createCaseReport(programId, shuffledCases[3]), 12000);
    
    this.simulationTimers.push(caseTimer1, caseTimer2, caseTimer3, caseTimer4);
  }

  private createCaseReport(programId: string, caseData: { details: string, location: string }): void {
    const activeRespondersWithNoTamat = this.attendance().filter(a => !a.tamat);
    let reporterName = 'Sistem';
    if (activeRespondersWithNoTamat.length > 0) {
        reporterName = activeRespondersWithNoTamat[Math.floor(Math.random() * activeRespondersWithNoTamat.length)].nama;
    }

    const now = new Date();
    const day = ('0' + now.getDate()).slice(-2);
    const month = ('0' + (now.getMonth() + 1)).slice(-2);
    const year = now.getFullYear().toString().slice(-2);
    const datePart = `${day}${month}${year}`;
    
    const caseCounter = this.caseReports().filter(c => c.programId === programId).length + 1;
    const caseNumberPart = 'kes' + ('0' + caseCounter).slice(-2);

    const newCaseId = `${programId}-${datePart}-${caseNumberPart}`;

    const newCase: CaseReport = {
        id: newCaseId,
        programId: programId,
        details: caseData.details,
        status: 'Baru',
        timestamp: new Date().toISOString(),
        location: caseData.location,
        reporterName: reporterName,
    };
    this.caseReports.update(list => [newCase, ...list]);
    this.notificationSvc.show('case', 'Laporan Kes Baru', `Kes baru dilaporkan oleh ${reporterName} di ${caseData.location}.`);

    this.attendance.update(list => 
        list.map(att => 
            att.nama === reporterName && att.tamat === null
            ? { ...att, kes: att.kes + 1 } 
            : att
        )
    );
  }

  stopSimulation(): void {
    console.log('Stopping all simulations.');
    this.simulationTimers.forEach(timer => clearTimeout(timer));
    this.simulationTimers = [];
    this.attendance.set([]);
    this.caseReports.set([]);
  }

  saveProgramDetail(payload: any): Promise<{success: boolean, data?: any, message?: string}> {
    const newDetail = {
        ...payload,
        id: `SIM-DET-${Date.now()}`
    };
    this.programDetails.update(list => [newDetail, ...list]);
    return Promise.resolve({ success: true, data: newDetail });
  }

  // FIX: Make the 'data' property in the return type optional to match the real API service signature and resolve the type error on the failure path.
  updateProgramDetail(payload: any): Promise<{success: boolean, data?: any, message?: string}> {
    let updatedDetail: any = null;
    this.programDetails.update(list => 
        list.map(item => {
            if (item.id === payload.id) {
                updatedDetail = { ...item, ...payload };
                return updatedDetail;
            }
            return item;
        })
    );
    if (updatedDetail) {
      return Promise.resolve({ success: true, data: updatedDetail });
    }
    return Promise.resolve({ success: false, message: 'Item tidak ditemui.' });
  }

  loginResponder(name: string, role: string): Promise<{success: boolean, message?: string}> {
    const responderFullName = `${name} (${role})`;
    const newAttendance: Attendance = {
        nama: responderFullName,
        mula: new Date().toISOString(),
        tamat: null,
        kes: 0,
    };
    this.attendance.update(list => [newAttendance, ...list]);
    this.notificationSvc.show('login', `Selamat Datang, ${name}!`, `Anda telah log masuk sebagai ${role}.`);
    return Promise.resolve({ success: true, message: 'Log masuk berjaya.' });
  }
}
