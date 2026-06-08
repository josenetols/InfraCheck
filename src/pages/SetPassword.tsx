import React, { useState } from 'react';
import { ShieldCheck, KeyRound, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { AuthContextUser } from '../types/api';

interface SetPasswordProps {
  userId: string;
  userName: string;
}

export const SetPassword: React.FC<SetPasswordProps> = ({ userId, userName }) => {
  const { loginWithToken, clearFirstLogin } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const passwordsMatch = password === confirmPassword;
  const isValid = password.length >= 6 && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await authService.setPassword(userId, password);

      // Autenticação imediata — loginWithToken salva JWT e redireciona
      const userPayload: AuthContextUser = {
        id: response.user.id,
        name: response.user.name,
        username: response.user.username,
        region: response.user.region_name || '',
        role: response.user.role,
      };

      loginWithToken(response.token, userPayload);
    } catch (err: any) {
      setError(err.message || 'Erro ao definir a senha.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border border-slate-200">
        {/* Cabeçalho */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Bem-vindo, {userName}!
          </h1>
          <p className="text-slate-500 text-sm mt-1 text-center">
            Este é seu primeiro acesso. Defina sua senha para continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-200 shadow-sm font-medium">
              {error}
            </div>
          )}

          {/* Nova Senha */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              Nova Senha
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full pl-10 pr-12 p-3 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {password.length > 0 && password.length < 6 && (
              <p className="text-[11px] text-orange-500 mt-1 font-medium">
                A senha deve ter no mínimo 6 caracteres.
              </p>
            )}
          </div>

          {/* Confirmar Senha */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              Confirmar Senha
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                className={`w-full pl-10 p-3 rounded-lg border outline-none transition-all ${
                  confirmPassword && !passwordsMatch
                    ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                }`}
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                placeholder="Repita a senha"
                autoComplete="new-password"
                required
              />
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="text-[11px] text-red-500 mt-1 font-medium">
                As senhas não coincidem.
              </p>
            )}
            {confirmPassword && passwordsMatch && password.length >= 6 && (
              <p className="text-[11px] text-emerald-500 mt-1 font-medium">
                ✓ Senhas conferem.
              </p>
            )}
          </div>

          {/* Botão Definir */}
          <button
            type="submit"
            disabled={!isValid || submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-lg transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 mt-6"
          >
            {submitting ? <Loader2 className="animate-spin w-5 h-5" /> : null}
            {submitting ? 'Definindo senha...' : 'Definir Senha e Entrar'}
          </button>

          {/* Botão Voltar */}
          <button
            type="button"
            onClick={clearFirstLogin}
            className="w-full text-slate-400 hover:text-slate-600 text-sm font-medium py-2 flex items-center justify-center gap-1 transition-colors"
          >
            <ArrowLeft size={14} />
            Voltar para a tela de login
          </button>
        </form>
      </div>
    </div>
  );
};
