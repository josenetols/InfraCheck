import { useState, useEffect, useCallback } from 'react';
import { LocationInfo, UserRole } from '../types';
import { apiService } from '../services/apiService';
import { userService, UserResponse, CreateUserPayload, UpdateUserPayload } from '../services/userService';
import { AdminSummaryResponse } from '../types/api';

/**
 * Hook para gerenciar os dados da Área Administrativa.
 * Ações de usuários utilizam REST userService
 */
export const useAdminData = () => {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [locations, setLocations] = useState<LocationInfo[]>([]);
  
  // Estado para o Dashboard do Admin
  const [adminSummary, setAdminSummary] = useState<AdminSummaryResponse | null>(null);

  const loadData = useCallback(async () => {
    try {
        const [loadedUsers, loadedRegions, loadedLocations, summary] = await Promise.all([
            userService.getUsers(),
            apiService.getRegions(),
            apiService.getLocations(),
            apiService.getAdminSummary()
        ]);
        
        setUsers(loadedUsers);
        setRegions(loadedRegions);
        setLocations(loadedLocations);
        setAdminSummary(summary);
    } catch (err) {
        console.error("Erro ao carregar dados administrativos:", err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── CRUD de Regiões ─────────────────────────────────────────────────────────
  const addRegion = useCallback(async (name: string): Promise<{ ok: boolean; error?: string }> => {
    const upper = name.trim().toUpperCase();
    if (!upper) return { ok: false, error: 'Nome inválido.' };
    try {
        await apiService.addRegion(upper);
        await loadData();
        return { ok: true };
    } catch (err: any) {
        return { ok: false, error: err.message || 'Erro ao salvar região.' };
    }
  }, [loadData]);

  const removeRegion = useCallback(async (region: string) => {
    try {
        await apiService.deleteRegion(region);
        await loadData();
    } catch (err: any) {
        alert(err.message || 'Erro ao remover região.');
    }
  }, [loadData]);

  // ── CRUD de Lojas ───────────────────────────────────────────────────────────
  const addStore = useCallback(async (name: string, region: string): Promise<{ ok: boolean; error?: string }> => {
    if (!name.trim() || !region) return { ok: false, error: 'Preencha todos os campos.' };
    try {
        await apiService.saveLocation(name.trim(), region);
        await loadData();
        return { ok: true };
    } catch (err: any) {
        return { ok: false, error: err.message || 'Erro ao salvar loja.' };
    }
  }, [loadData]);

  const removeStore = useCallback(async (name: string) => {
    if (!confirm(`Remover loja ${name}? Isso excluirá o histórico de checklists vinculados.`)) return;
    try {
        await apiService.deleteLocation(name);
        await loadData();
    } catch (err: any) {
        alert(err.message || 'Erro ao remover loja.');
    }
  }, [loadData]);

  const linkStoreContact = useCallback(async (locationName: string, storeContactName: string | null): Promise<{ ok: boolean; error?: string }> => {
    try {
      const token = localStorage.getItem('infracheck_auth_token');
      const res = await fetch(`/api/locations/${encodeURIComponent(locationName)}/link`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ store_contact_name: storeContactName }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erro ao vincular'); }
      await loadData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Erro ao vincular contato.' };
    }
  }, [loadData]);

  // ── CRUD de Usuários ────────────────────────────────────────────────────────
  const addUser = useCallback(async (payload: CreateUserPayload): Promise<{ ok: boolean; error?: string }> => {
    try {
      await userService.createUser(payload);
      await loadData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Erro ao criar usuário.' };
    }
  }, [loadData]);

  const updateUser = useCallback(async (id: string, payload: UpdateUserPayload): Promise<{ ok: boolean; error?: string }> => {
    try {
      await userService.updateUser(id, payload);
      await loadData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Erro ao atualizar usuário.' };
    }
  }, [loadData]);

  const updatePassword = useCallback(async (id: string, newPassword: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      await userService.updatePassword(id, newPassword);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Erro ao definir senha.' };
    }
  }, []);

  const removeUser = useCallback(async (id: string, name: string) => {
    try {
      await userService.deleteUser(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao desativar usuário.');
    }
  }, [loadData]);

  return {
    users, regions, locations, adminSummary,
    addRegion, removeRegion,
    addStore, removeStore, linkStoreContact,
    addUser, updateUser, updatePassword, removeUser,
  };
};
