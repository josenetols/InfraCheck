import { ChecklistData, LocationInfo, Photo } from '../types';
import { 
  LoginResponse, TechnicianResponse, LocationResponse, 
  StatsResponse, StatusDistributionRow, AdminSummaryResponse, LoginUserListResponse
} from '../types/api';

const API_BASE_URL = '/api';

/**
 * Utilitário para Headers Dinâmicos: Retorna o token da sessão.
 * Nota: Lê apenas o token puro, sem dados sensíveis/state.
 */
const getHeaders = (contentType = 'application/json') => {
  const token = localStorage.getItem('infracheck_auth_token');
  const headers: Record<string, string> = {};
  if (contentType) headers['Content-Type'] = contentType;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

/**
 * Proxy fetch para tratar erros globais (401 Expirado).
 */
const fetchAPI = async (endpoint: string, options: RequestInit = {}) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: { ...getHeaders(options.headers ? '' : 'application/json'), ...options.headers }
  });

  if (response.status === 401 && endpoint !== '/auth/login') {
    // Session expired or invalid - clear token and reload to force login screen
    localStorage.removeItem('infracheck_auth_token');
    window.location.href = '/'; 
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  return response;
};

// ─── Helpers de Fotos ──────────────────────────────────────────────────

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Converte fotos base64 (salvas no banco) de volta para objetos Photo
 * com previewUrl válido para exibição no PhotoUpload.
 */
const restorePhotos = (photos: any[]): Photo[] => {
  if (!photos || !Array.isArray(photos)) return [];
  return photos.map(p => {
    // blob: URLs são válidos apenas na sessão atual do browser.
    // Após reload ou carregamento do banco, precisamos usar o base64 salvo.
    const hasValidPreview = p.previewUrl && !p.previewUrl.startsWith('blob:');
    if (hasValidPreview) return p as Photo;

    if (p.base64) {
      const dataUrl = p.base64.startsWith('data:')
        ? p.base64
        : `data:image/jpeg;base64,${p.base64}`;
      return { ...p, previewUrl: dataUrl, blob: null as any } as Photo;
    }
    return p as Photo;
  });
};

import { supabase } from '../lib/supabaseClient';

const prepareForBackend = async (data: ChecklistData): Promise<any> => {
  const cloned = JSON.parse(JSON.stringify(data));

  const processPhotos = async (sourcePhotos: Photo[]) => {
    const processed = [];
    for (const p of sourcePhotos) {
      if (p.blob) {
        // Upload para o Supabase Storage
        const fileExt = p.filename.split('.').pop() || 'jpg';
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error } = await supabase.storage
          .from('infracheck-photos')
          .upload(filePath, p.blob);

        if (error) {
          console.error('Erro no upload da foto:', error);
          throw new Error('Falha ao fazer o upload da imagem para o Supabase.');
        }

        const { data: publicData } = supabase.storage
          .from('infracheck-photos')
          .getPublicUrl(filePath);

        processed.push({ ...p, blob: undefined, url: publicData.publicUrl, previewUrl: publicData.publicUrl });
      } else {
        processed.push(p);
      }
    }
    return processed;
  };

  if (data.cpdPhotos) cloned.cpdPhotos = await processPhotos(data.cpdPhotos);
  if (data.problematicMachines) {
      cloned.problematicMachines = await Promise.all(data.problematicMachines.map(async (pm) => ({
          ...pm, photos: await processPhotos(pm.photos || [])
      })));
  }
  if (data.problematicNetworkPoints) {
      cloned.problematicNetworkPoints = await Promise.all(data.problematicNetworkPoints.map(async (np) => ({
          ...np, photos: await processPhotos(np.photos || [])
      })));
  }
  return cloned;
};

// ─── Generic API Client Exportado ─────────────────────────────────────

export const api = {
  get: async <T>(endpoint: string): Promise<{ data: T }> => {
    const res = await fetchAPI(endpoint);
    if (!res.ok) throw new Error(`GET ${endpoint} failed`);
    return { data: await res.json() };
  },
  post: async <T>(endpoint: string, payload?: any): Promise<{ data: T }> => {
    const res = await fetchAPI(endpoint, {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `POST ${endpoint} failed`);
    }
    return { data: await res.json().catch(() => ({} as T)) };
  },
  put: async <T>(endpoint: string, payload?: any): Promise<{ data: T }> => {
    const res = await fetchAPI(endpoint, {
      method: 'PUT',
      body: payload ? JSON.stringify(payload) : undefined
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `PUT ${endpoint} failed`);
    }
    return { data: await res.json().catch(() => ({} as T)) };
  },
  delete: async <T>(endpoint: string): Promise<{ data: T }> => {
    const res = await fetchAPI(endpoint, { method: 'DELETE' });
    if (!res.ok) throw new Error(`DELETE ${endpoint} failed`);
    return { data: await res.json().catch(() => ({} as T)) };
  }
};

// ─── ApiService Exportado ─────────────────────────────────────────────

export const apiService = {



  // ─── BI / DASHBOARD ───
  async getStats(startDate: Date, endDate: Date): Promise<StatsResponse> {
    const s = startDate.toISOString().split('T')[0];
    const e = endDate.toISOString().split('T')[0];
    const res = await fetchAPI(`/stats?startDate=${s}&endDate=${e}`);
    if (!res.ok) throw new Error('Falha ao obter estatísticas');
    return res.json();
  },

  async getStatusDistribution(): Promise<StatusDistributionRow[]> {
    const res = await fetchAPI('/stats/status-distribution');
    if (!res.ok) return [];
    return res.json();
  },

  async getAdminSummary(): Promise<AdminSummaryResponse | null> {
    const res = await fetchAPI('/stats/admin-summary');
    if (!res.ok) return null;
    return res.json();
  },

  // ─── ASSIGNMENTS ───
  async getAssignments(month: string, region?: string): Promise<Record<string, string>> {
    const query = new URLSearchParams({ month });
    if (region) query.append('region', region);
    const res = await fetchAPI(`/assignments?${query.toString()}`);
    if (!res.ok) return {};
    return res.json();
  },

  async regenerateAssignments(month: string, region?: string, technicians?: string[]): Promise<Record<string, string>> {
    const res = await fetchAPI('/assignments/regenerate', {
      method: 'POST',
      body: JSON.stringify({ month, region, technicians })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao regerar distribuição');
    return data.assignments;
  },



  // ─── ADMIN (Regiões/Lojas) ───
  async getRegions(): Promise<string[]> {
    const res = await fetchAPI('/regions');
    if (!res.ok) return [];
    return res.json();
  },

  async addRegion(name: string): Promise<void> {
    const res = await fetchAPI('/regions', {
      method: 'POST', body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error('Erro ao adicionar região');
  },

  async deleteRegion(name: string): Promise<void> {
    const res = await fetchAPI(`/regions/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erro ao remover região');
  },

  async getLocations(): Promise<LocationInfo[]> {
    const res = await fetchAPI('/locations');
    if (!res.ok) return [];
    const data: LocationResponse[] = await res.json();
    return data.map(d => ({ 
      name: d.name, 
      region: d.region,
      lastCheckDate: d.last_check_date,
      lastCheckTechnician: d.last_check_technician
    }));
  },

  async saveLocation(name: string, region: string): Promise<void> {
    const res = await fetchAPI('/locations', {
      method: 'POST', body: JSON.stringify({ name, region })
    });
    if (!res.ok) throw new Error('Erro ao salvar loja');
  },

  async deleteLocation(name: string): Promise<void> {
    const res = await fetchAPI(`/locations/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erro ao remover loja');
  },

  // ─── CHECKLISTS ───
  async getAllChecklists(location?: string): Promise<any[]> {
    const res = await fetchAPI(`/checklists${location ? `?location=${encodeURIComponent(location)}` : ''}`);
    if (!res.ok) throw new Error('Falha ao carregar checklists');
    return res.json();
  },

  async saveChecklist(data: ChecklistData): Promise<string> {
    const preparedData = await prepareForBackend(data);
    const res = await fetchAPI('/checklists', {
      method: 'POST', body: JSON.stringify(preparedData),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Falha ao salvar no servidor');
    return result.id;
  },

  async deleteChecklist(id: string): Promise<void> {
    const res = await fetchAPI(`/checklists/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Falha ao remover checklist');
  },

  async getBaseline(locationName: string): Promise<ChecklistData | undefined> {
    const res = await fetchAPI(`/checklists?location=${encodeURIComponent(locationName)}`);
    if (!res.ok) return undefined;
    const results = await res.json();
    if (results.length > 0) {
        const latestId = results[0].id;
        if (!latestId) return undefined;
        const resDetail = await fetchAPI(`/checklists/${latestId}`);
        if (!resDetail.ok) return undefined;
        const detailData = await resDetail.json();
        const raw = detailData.data as ChecklistData;
        // Restaurar fotos base64 para exibição
        return {
          ...raw,
          cpdPhotos: restorePhotos(raw.cpdPhotos || []),
          problematicMachines: (raw.problematicMachines || []).map(m => ({
            ...m, photos: restorePhotos(m.photos || [])
          })),
          problematicNetworkPoints: (raw.problematicNetworkPoints || []).map(p => ({
            ...p, photos: restorePhotos(p.photos || [])
          })),
        };
    }
    return undefined;
  },

  /**
   * Busca o checklist mais recente do mês anterior para um local.
   * Usado no fluxo de revisão mensal.
   */
  async getChecklistHistory(locationName: string): Promise<{ found: boolean; data: ChecklistData | null; visitDate?: string }> {
    const res = await fetchAPI(`/checklists/history/${encodeURIComponent(locationName)}`);
    if (!res.ok) return { found: false, data: null };
    const result = await res.json();
    if (!result.found || !result.data) return { found: false, data: null };
    const raw = result.data as ChecklistData;
    // Restaurar fotos base64
    const restored: ChecklistData = {
      ...raw,
      cpdPhotos: restorePhotos(raw.cpdPhotos || []),
      problematicMachines: (raw.problematicMachines || []).map(m => ({
        ...m, photos: restorePhotos(m.photos || [])
      })),
      problematicNetworkPoints: (raw.problematicNetworkPoints || []).map(p => ({
        ...p, photos: restorePhotos(p.photos || [])
      })),
    };
    return { found: true, data: restored, visitDate: result.visitDate };
  }
};
