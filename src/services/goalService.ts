import { MonthlyGoal, CycleGoal } from '../types';

const getAuthHeaders = () => {
  const token = localStorage.getItem('infracheck_auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const goalService = {
  getCurrentCycleGoal: async (technicianId?: string) => {
    const url = technicianId ? `/api/goals/current/${technicianId}` : `/api/goals/current`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Erro ao buscar metas do ciclo atual');
    return response.json();
  },

  getHistory: async (filters: { technicianId?: string; year?: number; cycle?: number; month?: number }) => {
    const queryParams = new URLSearchParams();
    if (filters.technicianId) queryParams.append('technicianId', filters.technicianId);
    if (filters.year) queryParams.append('year', filters.year.toString());
    if (filters.cycle) queryParams.append('cycle', filters.cycle.toString());
    if (filters.month) queryParams.append('month', filters.month.toString());

    const response = await fetch(`/api/goals/history?${queryParams.toString()}`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Erro ao buscar histórico de metas');
    return response.json();
  },

  closeCycle: async (technicianId: string, year: number, cycle: number) => {
    const response = await fetch(`/api/goals/close-cycle`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ technicianId, year, cycle })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao fechar ciclo');
    }
    return response.json();
  },

  recalculate: async (year: number, month: number) => {
    const response = await fetch(`/api/goals/recalculate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ year, month })
    });
    if (!response.ok) throw new Error('Erro ao recalcular metas');
    return response.json();
  }
};
