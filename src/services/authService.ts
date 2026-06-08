import { api } from './apiService';
import type { UserRole } from '../types';

export interface LoginResponse {
  // Resposta de login normal — JWT emitido
  token?: string;
  user?: {
    id: string;
    name: string;
    username: string;
    region_name?: string;
    role: UserRole;
  };
  mustChangePassword?: boolean;

  // Resposta de primeiro acesso — redirecionar para /set-password
  firstLogin?: boolean;
  userId?: string;
  name?: string;
}

export interface SetPasswordResponse {
  token: string;
  user: {
    id: string;
    name: string;
    username: string;
    region_name?: string;
    role: UserRole;
  };
  message: string;
}

export const authService = {
  /** POST /auth/login — retorna JWT ou firstLogin flag */
  login: async (username: string, password?: string): Promise<LoginResponse> => {
    const payload = password ? { username, password } : { username };
    const { data } = await api.post<LoginResponse>('/auth/login', payload);
    return data;
  },

  /**
   * POST /auth/set-password — define senha no primeiro acesso (sem JWT).
   * Retorna JWT + dados do usuário para autenticação imediata.
   */
  setPassword: async (userId: string, password: string): Promise<SetPasswordResponse> => {
    const { data } = await api.post<SetPasswordResponse>('/auth/set-password', {
      userId,
      password,
    });
    return data;
  },

  /** POST /auth/change-password — troca senha (requer JWT no header) */
  changePassword: async (newPassword: string): Promise<{ token: string; message: string }> => {
    const { data } = await api.post<{ token: string; message: string }>(
      '/auth/change-password',
      { newPassword }
    );
    return data;
  },
};
