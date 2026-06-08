/**
 * Definições estritas de tipagem para as respostas da API Backend.
 */

// ─── Autenticação ─────────────────────────────────────────────────────

export interface AuthContextUser {
  id: string;
  name: string;
  username: string;
  region: string;
  role: 'admin' | 'technician';
}

export interface LoginResponse {
  token: string;
  user: AuthContextUser;
  mustChangePassword?: boolean;
}

export interface LoginUserListResponse {
  id: string;
  name: string;
  region_name: string | null;
  has_password: boolean;
}

// ─── Técnicos, Lojas e Regiões ────────────────────────────────────────

export interface TechnicianResponse {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  region_name: string | null;
  role: 'admin' | 'technician';
}

export interface LocationResponse {
  name: string;
  region: string;
  last_check_date?: string | null;
  last_check_technician?: string | null;
}

// ─── Dashboard BI (Estatísticas) ──────────────────────────────────────

export interface DailyStatRow {
  date: string;
  count: number;
}

export interface TechnicianReportRow {
  technician: string;
  attributed: number;
  completed: number;
}

export interface StatsResponse {
  summary: {
    total: number;
    completed: number;
    pending: number;
    averagePerPeriod: string;
  };
  daily: DailyStatRow[];
  technicianReport?: TechnicianReportRow[];
}

export interface StatusDistributionRow {
  name: string;
  value: number;
  color: string;
}

// ─── Resumo Executivo Admin ───────────────────────────────────────────

export interface RegionStatResponse {
  region: string;
  total: number;
  ok: number;
  pending: number;
}

export interface AdminPendingStore {
  name: string;
  region: string;
  technicianAssigned: string;
  lastCheck: string | null;
  isValid: boolean;
  daysOverdue: number;
}

export interface AdminSummaryResponse {
  regionStats: RegionStatResponse[];
  totalEmDia: number;
  totalPendentes: number;
  percentage: number;
  pendentesList: AdminPendingStore[];
}
