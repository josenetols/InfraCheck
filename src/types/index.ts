// ─── Tipos de Domínio ─────────────────────────────────────────────────────────

export type CableCondition = 'Organizado' | 'Parcial' | 'Desorganizado';

/** Papel do usuário no sistema */
export type UserRole = 'admin' | 'technician';

/** Filtro de status para o Dashboard */
export type StatusFilter = 'all' | 'valid' | 'warning' | 'expired';

/** Mapa de atribuições: nome da loja → nome do técnico */
export type Assignments = Record<string, string>;

/** Uma entrada individual no histórico de checklists */
export interface ChecklistEntry {
  date: string;       // ISO 8601
  technician: string;
}

/** Histórico completo: loja → lista de entradas */
export type ChecklistHistory = Record<string, ChecklistEntry[]>;

/** Dados de uma loja/localização */
export interface LocationInfo {
  name: string;
  region: string;
  lastCheckDate?: string | null;
  lastCheckTechnician?: string | null;
  lastCheckId?: string | null;
}

/** Status calculado de uma localização no Dashboard */
export interface LocationStatus {
  name: string;
  lastCheckDate: string | null;
  lastCheckId: string | null;
  technician: string | null;
  assignedTechnician: string;
  isValid: boolean;
  isWarning: boolean;
  daysRemaining: number | null;
  region: string;
}

export type ItemStatus = 'unchanged' | 'updated' | 'new' | 'removed';

export interface UserData {
  id?: string;
  name: string;
  username: string;
  region: string;
  role: UserRole;
}

export interface ImageMeta {
  id: string;
  checklistId?: string;
  section?: string;
  filename: string;
  mimeType: string;
  size: number;
  url?: string;
  localBlob?: Blob;
  description?: string;
  createdAt: string;
}

export interface Photo extends ImageMeta {
  blob: Blob;
  previewUrl: string;
  timestamp: string;
}

export interface Technician {
  id: string;
  name: string;
  email?: string;
  active: boolean;
}

export interface ListFilter {
  locationName?: string;
  startDate?: string;
  endDate?: string;
  technicianId?: string;
}

export interface SwitchDevice {
  id: string;
  quantity: number;
  brand: string;
  model: string;
  ports: number;
  conditionOk: boolean;
  notes: string;
  status?: ItemStatus;
}

export interface AntennaDevice {
  id: string;
  quantity: number;
  brand: string; // Marca/Modelo
  location: string; // Local
  isWorking: boolean; 
  notes: string;
  status?: ItemStatus;
}

export interface ProblematicMachine {
  id: string;
  identifier: string; // Asset tag or name
  processorGen: string;
  osUpdated: boolean; // Must be Windows 11 check
  problemDescription: string;
  photos: Photo[];
  status?: ItemStatus;
}

export interface ProblematicNetworkPoint {
  id: string;
  location: string; // e.g., "Sala de Reuniões"
  description: string;
  photos: Photo[];
  status?: ItemStatus;
}

export interface ChecklistData {
  id?: string;
  // 1. Local Info
  locationName: string;
  responsibleName: string; // Client contact
  visitDate: string; // ISO String

  // 2. CPD / Infrastructure
  cableCondition: CableCondition;
  cableNotes: string;
  cpdPhotos: Photo[]; 
  
  switches: SwitchDevice[];
  
  antennas: AntennaDevice[];

  hasFirewall: boolean;
  firewallBrand: string; 
  firewallWorking: boolean;
  firewallNotes: string;

  // 3. Machines
  allMachinesOk: boolean;
  problematicMachines: ProblematicMachine[];

  // 4. Network Points
  networkPointsOk: boolean;
  networkPointsNotes: string;
  problematicNetworkPoints: ProblematicNetworkPoint[]; 

  // 5. Satisfaction
  employeesSatisfied: boolean;
  complaints: string;

  // Meta
  observations: string;
  technicianName: string; // Responsible for the visit
  signatureUrl?: string | null;
  
  // Baseline / History
  baselineId?: string; 
  isBaseline?: boolean; 
  
  // Sync Status
  syncStatus?: 'synced' | 'pending' | 'failed';
  updatedAt?: string;
}

export const initialChecklistState: ChecklistData = {
  locationName: '',
  responsibleName: '',
  visitDate: new Date().toISOString(),
  
  cableCondition: 'Organizado',
  cableNotes: '',
  cpdPhotos: [],
  
  switches: [],
  
  antennas: [],
  
  hasFirewall: false,
  firewallBrand: 'Fortinet',
  firewallWorking: true,
  firewallNotes: '',
  
  allMachinesOk: true,
  problematicMachines: [],
  
  networkPointsOk: true,
  networkPointsNotes: '',
  problematicNetworkPoints: [],
  
  employeesSatisfied: true,
  complaints: '',
  
  observations: '',
  technicianName: '',
  signatureUrl: null,
};
