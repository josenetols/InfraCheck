import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/authService';
import { AuthContextUser } from '../types/api.js';

interface FirstLoginInfo {
  userId: string;
  name: string;
}

interface AuthContextType {
  user: AuthContextUser | null;
  isAdmin: boolean;
  token: string | null;
  loading: boolean;
  firstLogin: FirstLoginInfo | null;
  login: (username: string, password?: string) => Promise<{ mustChangePassword?: boolean; success: boolean }>;
  loginWithToken: (token: string, user: AuthContextUser) => void;
  clearFirstLogin: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthContextUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstLogin, setFirstLogin] = useState<FirstLoginInfo | null>(null);

  useEffect(() => {
    // Restaurar sessão
    const storedToken = localStorage.getItem('infracheck_auth_token');
    const storedUser = localStorage.getItem('infracheck_auth_user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password?: string) => {
    try {
      const response = await authService.login(username, password);

      // ── Primeiro acesso: sem JWT, redirecionar para definição de senha ──
      if (response.firstLogin && response.userId) {
        setFirstLogin({ userId: response.userId, name: response.name || username });
        return { success: false, firstLogin: true };
      }

      // ── Login normal: JWT emitido ──
      if (!response.token || !response.user) {
        throw new Error('Resposta de login inválida.');
      }

      const userPayload: AuthContextUser = {
        id: response.user.id,
        name: response.user.name,
        username: response.user.username,
        region: response.user.region_name || '',
        role: response.user.role
      };

      setToken(response.token);
      setUser(userPayload);

      localStorage.setItem('infracheck_auth_token', response.token);
      localStorage.setItem('infracheck_auth_user', JSON.stringify(userPayload));

      return { success: true, mustChangePassword: response.mustChangePassword };
    } catch (err) {
      throw err;
    }
  };

  /**
   * Usado pelo SetPassword para autenticar imediatamente
   * após o usuário definir a senha no primeiro acesso.
   */
  const loginWithToken = (newToken: string, newUser: AuthContextUser) => {
    setToken(newToken);
    setUser(newUser);
    setFirstLogin(null);

    localStorage.setItem('infracheck_auth_token', newToken);
    localStorage.setItem('infracheck_auth_user', JSON.stringify(newUser));
  };

  /** Limpa o estado de primeiro login (ex: botão Voltar) */
  const clearFirstLogin = () => {
    setFirstLogin(null);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setFirstLogin(null);
    localStorage.removeItem('infracheck_auth_token');
    localStorage.removeItem('infracheck_auth_user');
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAdmin: user?.role === 'admin',
      token,
      loading,
      firstLogin,
      login,
      loginWithToken,
      clearFirstLogin,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
