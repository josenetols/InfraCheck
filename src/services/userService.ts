import { api } from './apiService';
import type { UserRole } from '../types';

export interface UserResponse {
  id: string;
  name: string;
  username: string;
  region_name: string | null;
  role: UserRole;
  active: boolean;
  email?: string;
  smtp_password?: string;
}

export interface CreateUserPayload {
  name: string;
  username: string;
  role: UserRole;
  password?: string;
  region_name?: string;
  email?: string;
  smtp_password?: string;
}

export interface UpdateUserPayload {
  name: string;
  username: string;
  role: UserRole;
  region_name?: string;
  email?: string;
  smtp_password?: string;
}

export const userService = {
  getUsers: async (): Promise<UserResponse[]> => {
    const { data } = await api.get<UserResponse[]>('/users');
    return data;
  },

  createUser: async (payload: CreateUserPayload): Promise<void> => {
    await api.post('/users', payload);
  },

  updateUser: async (id: string, payload: UpdateUserPayload): Promise<void> => {
    await api.put(`/users/${id}`, payload);
  },

  updatePassword: async (id: string, newPassword: string): Promise<void> => {
    await api.put(`/users/${id}/password`, { newPassword });
  },

  deleteUser: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  }
};
