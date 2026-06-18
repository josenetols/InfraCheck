import React, { useState, useEffect } from 'react';
import { UserResponse, UpdateUserPayload } from '../services/userService';
import { UserRole } from '../types';

interface UserEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserResponse | null;
  regions: string[];
  onSave: (id: string, data: UpdateUserPayload) => Promise<{ ok: boolean; error?: string }>;
}

export const UserEditModal: React.FC<UserEditModalProps> = ({ isOpen, onClose, user, regions, onSave }) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<UserRole>('technician');
  const [regionName, setRegionName] = useState('');
  const [email, setEmail] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setUsername(user.username);
      setRole(user.role);
      setRegionName(user.region_name || (regions.length > 0 ? regions[0] : ''));
      setEmail(user.email || '');
      setSmtpPassword(user.smtp_password || '');
      setError(null);
    }
  }, [user, regions]);

  if (!isOpen || !user) return null;

  const handleSave = async () => {
    if (!name.trim() || !username.trim()) {
      setError('Nome e Username são obrigatórios.');
      return;
    }
    
    setLoading(true);
    setError(null);
    const result = await onSave(user.id, {
      name,
      username,
      role,
      region_name: regionName,
      email: email.trim() || undefined,
      smtp_password: smtpPassword.trim() || undefined
    });
    setLoading(false);

    if (result.ok) {
      onClose();
    } else {
      setError(result.error || 'Erro desconhecido ao salvar usuário.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[100] backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="bg-blue-600 p-5 text-white">
          <h2 className="text-xl font-bold">Editar Usuário</h2>
          <p className="text-sm opacity-90">Altere informações básicas e configure o E-mail corporativo.</p>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && <div className="p-3 bg-red-100 text-red-700 text-sm font-bold rounded-lg">{error}</div>}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nome Completo</label>
              <input type="text" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-100 outline-none" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Username (Login)</label>
              <input type="text" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-100 outline-none" value={username} onChange={e => setUsername(e.target.value.trim())} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Perfil</label>
              <select className="w-full p-2 border rounded-lg outline-none" value={role} onChange={e => setRole(e.target.value as UserRole)}>
                <option value="technician">Técnico Operacional</option>
                <option value="admin">Administrador Geral</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Região Base</label>
              <select className="w-full p-2 border rounded-lg outline-none" value={regionName} onChange={e => setRegionName(e.target.value)}>
                {regions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4">
            <h3 className="font-bold text-slate-800 mb-4">Configuração de E-mail SMTP (Envio)</h3>
            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">E-mail Corporativo</label>
                <input 
                  type="email" 
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none text-sm focus:border-blue-500" 
                  placeholder="ex: nome@gruposaga.com.br"
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Senha de Aplicativo (Office 365)</label>
                <input 
                  type="text" 
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none text-sm focus:border-blue-500" 
                  placeholder="Senha de app gerada na conta Microsoft"
                  value={smtpPassword} 
                  onChange={e => setSmtpPassword(e.target.value)} 
                />
                <p className="text-[11px] text-slate-500 mt-1 leading-tight">
                  A senha fica visível apenas para o administrador. Isso permite que o sistema envie os checklists automaticamente usando o e-mail do técnico.
                </p>
              </div>
            </div>
          </div>

        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-slate-600 hover:bg-slate-200 font-bold rounded-lg transition-all">Cancelar</button>
          <button onClick={handleSave} disabled={loading} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all shadow-md">{loading ? 'Salvando...' : 'Salvar Alterações'}</button>
        </div>
      </div>
    </div>
  );
};
