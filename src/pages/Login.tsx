import React, { useState } from 'react';
import { User, ShieldCheck, Loader2, KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const { login } = useAuth();
  
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;

    setSubmitting(true);
    setError('');

    try {
      const result = await login(username, password || undefined);
      // Se for primeiro acesso, o AuthContext já setou firstLogin
      // e o App.tsx vai renderizar <SetPassword /> automaticamente.
      if (!result.success) {
        setSubmitting(false);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border border-slate-200">
         <div className="flex flex-col items-center mb-6">
             <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
                 <ShieldCheck size={32} />
             </div>
             <h1 className="text-2xl font-bold text-slate-800 tracking-tight">InfraCheck Enterprise</h1>
             <p className="text-slate-500 text-sm mt-1">Acesso corporativo seguro</p>
         </div>

         <form onSubmit={handleLogin} className="space-y-5">
             {error && (
                 <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-200 shadow-sm font-medium">
                     {error}
                 </div>
             )}
             
             <div>
                 <label className="block text-sm font-bold text-slate-700 mb-1">Usuário</label>
                 <div className="relative">
                   <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
                   <input 
                      type="text"
                      className="w-full pl-10 p-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      value={username}
                      onChange={e => {
                        setUsername(e.target.value.trim()); // Sem espaços
                        setError('');
                      }}
                      placeholder="seu.usuario"
                      autoComplete="username"
                      required
                   />
                 </div>
             </div>

             <div>
                <label className="block text-sm font-bold text-slate-700 mb-1 flex justify-between">
                  <span>Senha</span>
                </label>
                <div className="relative">
                   <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
                   <input 
                      type="password"
                      className="w-full pl-10 p-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                   />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 italic">
                  Se for seu primeiro acesso, deixe a senha em branco.
                </p>
             </div>
             
             <button 
                type="submit"
                disabled={!username || submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-lg transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 mt-6"
             >
                {submitting ? <Loader2 className="animate-spin w-5 h-5" /> : null} 
                {submitting ? 'Autenticando...' : 'Entrar no Sistema'}
             </button>
         </form>
      </div>
    </div>
  );
};
