import React, { useState, useMemo } from 'react';
import {
  UserPlus, Trash2, MapPin, LayoutDashboard, Map, Store, Users,
  AlertCircle, CalendarClock, Building2, ShieldCheck, PlusCircle, KeyRound, Edit, Bell
} from 'lucide-react';
import { CollectionManager } from './CollectionManager';
import { UserRole } from '../types';
import { StatCard } from '../components/dashboard/StatCard';
import { useAdminData } from '../hooks/useAdminData';
import { AdminSummaryResponse, RegionStatResponse, AdminPendingStore } from '../types/api';
import { UserEditModal } from '../components/UserEditModal';
import { UserResponse } from '../services/userService';

type TabType = 'dashboard' | 'regions' | 'stores' | 'users' | 'collection';

// ─── Toast simples (substitui alert/confirm quando não há modal disponível) ────
// TODO: substituir por um componente <Modal /> quando o backend for integrado.
const confirmAction = (msg: string): boolean => window.confirm(msg);
const notifyError = (msg: string): void => alert(msg); // TODO: Toast component

// ─── Sub-componentes de abas ──────────────────────────────────────────────────

interface ExecutiveSummaryTabProps extends AdminSummaryResponse {
  locations: number;
}

const ExecutiveSummaryTab: React.FC<ExecutiveSummaryTabProps> =
  React.memo(({ totalEmDia, totalPendentes, percentage, regionStats, pendentesList, locations }) => (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total de Lojas"   value={locations}      icon={Building2}     color="slate" />
        <StatCard label="Em Dia"           value={totalEmDia}     icon={ShieldCheck}   color="green" />
        <StatCard label="Pendentes"        value={totalPendentes} icon={AlertCircle}   color="red"   />
        <StatCard label="Eficiência Geral" value={`${percentage}%`} icon={LayoutDashboard} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tabela de regiões */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50/50 p-5 border-b border-slate-200">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Map className="w-5 h-5 text-blue-600" /> Cobertura por Região
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Região</th>
                  <th className="px-6 py-4">Lojas</th>
                  <th className="px-6 py-4">OK</th>
                  <th className="px-6 py-4">Pendente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {regionStats.map((stat: RegionStatResponse) => (
                  <tr key={stat.region} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{stat.region}</td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{stat.total} unidades</td>
                    <td className="px-6 py-4">
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded-md font-bold text-[10px]">
                        {stat.ok} OK
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-red-100 text-red-700 px-2 py-1 rounded-md font-bold text-[10px]">
                        {stat.pending} PENDENTE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lista de alertas */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-red-50 p-5 border-b border-red-100 flex items-center gap-2">
            <AlertCircle className="text-red-500 w-5 h-5 animate-pulse" />
            <h3 className="font-extrabold text-red-800">
              Alertas Críticos ({pendentesList.length})
            </h3>
          </div>
          <ul className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            {pendentesList.map((store: AdminPendingStore) => (
              <li key={store.name} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start mb-1">
                  <p className="font-bold text-slate-800 text-sm">{store.name}</p>
                  <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                    {store.region}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mb-2 font-medium">
                  Resp: {store.technicianAssigned}
                </p>
                <div className="flex items-center gap-2">
                  {store.lastCheck ? (
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />
                      {store.daysOverdue} dias de atraso
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded uppercase">
                      Nunca realizado
                    </span>
                  )}
                </div>
              </li>
            ))}
            {pendentesList.length === 0 && (
              <li className="p-12 text-center text-slate-400 font-medium">
                Nenhum alerta crítico ativo.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  ));
ExecutiveSummaryTab.displayName = 'ExecutiveSummaryTab';

// ─── Componente Principal ─────────────────────────────────────────────────────

export const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // Form states
  const [newRegion, setNewRegion] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreRegion, setNewStoreRegion] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserLogin, setNewUserLogin] = useState('');
  const [newUserRegion, setNewUserRegion] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('technician');
  
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);

  const {
    users, regions, locations, adminSummary,
    addRegion, removeRegion,
    addStore, removeStore,
    addUser, removeUser, updatePassword, updateUser
  } = useAdminData();



  // Inicializa selects quando regiões carregam
  React.useEffect(() => {
    if (regions.length > 0 && !newStoreRegion) setNewStoreRegion(regions[0]);
    if (regions.length > 0 && !newUserRegion) setNewUserRegion(regions[0]);
  }, [regions, newStoreRegion, newUserRegion]);

  // Resumo calculado sob demanda (aba dashboard)
  const summary = activeTab === 'dashboard' ? adminSummary : null;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleAddRegion = async () => {
    const result = await addRegion(newRegion);
    if (!result.ok) { notifyError(result.error!); return; }
    setNewRegion('');
  };

  const handleRemoveRegion = (r: string) => {
    if (confirmAction(`Remover região "${r}"? Esta ação pode impactar lojas e usuários desta região.`))
      removeRegion(r);
  };

  const handleAddStore = async () => {
    const result = await addStore(newStoreName, newStoreRegion);
    if (!result.ok) { notifyError(result.error!); return; }
    setNewStoreName('');
  };

  const handleRemoveStore = (name: string) => {
    if (confirmAction(`Remover loja "${name}"?`)) removeStore(name);
  };



  const handleAddUser = async () => {
    const result = await addUser({
      name: newUserName,
      username: newUserLogin,
      region_name: newUserRegion,
      role: newUserRole
    });
    if (!result.ok) { notifyError(result.error!); return; }
    setNewUserName('');
    setNewUserLogin('');
  };

  const handleRemoveUser = (id: string, name: string) => {
    if (confirmAction(`Remover usuário "${name}"?`)) removeUser(id, name);
  };

  const handleResetPassword = async (id: string, name: string) => {
    const newPass = window.prompt(`Digite a nova senha provisória para ${name} (Mínimo 6 caracteres):`);
    if (!newPass) return;
    if (newPass.length < 6) {
      notifyError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    const result = await updatePassword(id, newPass);
    if (result.ok) {
      alert('Senha redefinida com sucesso.');
    } else {
      notifyError(result.error!);
    }
  };

  // ── Tabs ─────────────────────────────────────────────────────────────────────

  const tabs: { key: TabType; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'dashboard',  label: 'Resumo Executivo',  icon: LayoutDashboard },
    { key: 'regions',    label: 'Regiões Ativas',    icon: Map             },
    { key: 'stores',     label: 'Lojas',             icon: Store,           count: locations.length },
    { key: 'users',      label: 'Gestão de Pessoas', icon: Users,           count: users.length },
    { key: 'collection', label: 'Régua de Cobrança', icon: Bell            },
  ];

  return (
    <div className="pb-20 max-w-7xl mx-auto px-4">
      {/* Cabeçalho */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Painel Administrativo</h1>
        <p className="text-slate-500 font-medium">
          Gerenciamento de recursos, usuários e monitoramento de rede global.
        </p>
      </div>

      {/* Navegação por abas */}
      <div className="flex overflow-x-auto gap-1 mb-10 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 max-w-fit shadow-inner">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-extrabold whitespace-nowrap transition-all ${
                isActive ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={18} />
              {tab.label}
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  isActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Conteúdo das abas */}
      <div className="min-h-[600px]">

        {/* ── Resumo Executivo ─────────────────────────────────────────────── */}
        {activeTab === 'dashboard' && summary && (
          <ExecutiveSummaryTab {...summary} locations={locations.length} />
        )}

        {/* ── Regiões ──────────────────────────────────────────────────────── */}
        {activeTab === 'regions' && (
          <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
              <div className="p-8 border-b border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Map size={24} className="text-blue-600" /> Gestão de Regiões
                </h2>
                <div className="flex gap-3">
                  <input
                    type="text"
                    className="flex-1 p-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none uppercase font-bold text-slate-700 transition-all"
                    placeholder="Sigla da Região (ex: SP, GO, RJ)"
                    value={newRegion}
                    onChange={e => setNewRegion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddRegion()}
                  />
                  <button
                    onClick={handleAddRegion}
                    disabled={!newRegion.trim()}
                    className="px-8 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                  >
                    <PlusCircle size={20} /> Adicionar
                  </button>
                </div>
              </div>
              <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {regions.map(r => (
                  <div
                    key={r}
                    className="p-4 bg-slate-50 rounded-xl flex justify-between items-center hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all"
                  >
                    <span className="font-extrabold text-slate-800 text-lg">{r}</span>
                    <button
                      onClick={() => handleRemoveRegion(r)}
                      className="text-slate-300 hover:text-red-500 p-2 transition-colors"
                      aria-label={`Remover região ${r}`}
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
                {regions.length === 0 && (
                  <p className="col-span-2 p-4 text-slate-400 text-center">
                    Nenhuma região cadastrada.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Lojas ────────────────────────────────────────────────────────── */}
        {activeTab === 'stores' && (
          <div className="animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-8 border-b border-slate-200 bg-slate-50/30">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Store size={24} className="text-blue-600" /> Cadastro Geral de Lojas
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-7">
                    <input
                      type="text"
                      className="w-full p-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
                      placeholder="Nome completo da unidade/loja..."
                      value={newStoreName}
                      onChange={e => setNewStoreName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddStore()}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <select
                      className="w-full p-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none bg-white font-bold text-slate-700 transition-all"
                      value={newStoreRegion}
                      onChange={e => setNewStoreRegion(e.target.value)}
                    >
                      {regions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <button
                    onClick={handleAddStore}
                    disabled={!newStoreName.trim() || !newStoreRegion}
                    className="md:col-span-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-all shadow-md py-3 flex items-center justify-center gap-2"
                  >
                    <PlusCircle size={18} /> Salvar
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {locations.map(loc => (
                    <div
                      key={loc.name}
                      className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-blue-200 transition-all hover:shadow-md"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Store className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-800 text-sm leading-tight">{loc.name}</p>
                            <span className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">{loc.region}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveStore(loc.name)}
                          className="text-slate-300 hover:text-red-500 p-1.5 transition-colors"
                          aria-label={`Remover loja ${loc.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Usuários ─────────────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <div className="animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-8 border-b border-slate-200 bg-slate-50/30">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Users size={24} className="text-blue-600" /> Controle de Acesso e Perfis
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-4">
                    <input
                      type="text"
                      className="w-full p-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
                      placeholder="Nome completo..."
                      value={newUserName}
                      onChange={e => setNewUserName(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <input
                      type="text"
                      className="w-full p-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium"
                      placeholder="Username (sem espaços)..."
                      value={newUserLogin}
                      onChange={e => setNewUserLogin(e.target.value.trim())}
                      onKeyDown={e => e.key === 'Enter' && handleAddUser()}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <select
                      className="w-full p-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none bg-white font-bold transition-all"
                      value={newUserRegion}
                      onChange={e => setNewUserRegion(e.target.value)}
                    >
                      {regions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-3 lg:col-span-2">
                    <select
                      className="w-full p-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none bg-white font-bold transition-all"
                      value={newUserRole}
                      onChange={e => setNewUserRole(e.target.value as UserRole)}
                    >
                      <option value="technician">Técnico Operacional</option>
                      <option value="admin">Administrador Geral</option>
                    </select>
                  </div>
                  <button
                    onClick={handleAddUser}
                    disabled={!newUserName.trim() || !newUserLogin.trim() || !newUserRegion}
                    className="md:col-span-12 lg:col-span-1 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-all shadow-md py-3 flex items-center justify-center gap-2"
                  >
                    <UserPlus size={18} /> Cadastrar
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {users.map(u => (
                    <div
                      key={u.name}
                      className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between hover:border-blue-200 transition-all hover:shadow-md"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                            u.role === 'admin' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                          }`}
                          aria-label={`Avatar de ${u.name}`}
                        >
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-800 text-sm leading-tight">{u.name}</p>
                          <p className="text-[10px] text-slate-500 font-medium">@{u.username}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                              {u.region_name}
                            </span>
                            {u.role === 'admin' && (
                              <span className="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                Admin
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingUser(u)}
                          className="text-slate-300 hover:text-blue-500 p-2 transition-colors"
                          aria-label={`Editar usuário ${u.name}`}
                          title="Editar e Configurar E-mail"
                        >
                          <Edit size={20} />
                        </button>
                        <button
                          onClick={() => handleResetPassword(u.id, u.name)}
                          className="text-slate-300 hover:text-blue-500 p-2 transition-colors"
                          aria-label={`Redefinir senha de ${u.name}`}
                          title="Redefinir Senha"
                        >
                          <KeyRound size={20} />
                        </button>
                        <button
                          onClick={() => handleRemoveUser(u.id, u.name)}
                          className="text-slate-300 hover:text-red-500 p-2 transition-colors"
                          aria-label={`Remover usuário ${u.name}`}
                          title="Desativar"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <UserEditModal
              isOpen={!!editingUser}
              onClose={() => setEditingUser(null)}
              user={editingUser}
              regions={regions}
              onSave={updateUser}
            />
          </div>
        )}

        {/* ── Régua de Cobrança ─────────────────────────────────────────────── */}
        {activeTab === 'collection' && (
          <div className="animate-in slide-in-from-bottom-4 duration-300">
            <CollectionManager />
          </div>
        )}

      </div>
    </div>
  );
};

export default Admin;
