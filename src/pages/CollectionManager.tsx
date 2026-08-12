import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, Upload, Users, RefreshCw, CheckCircle2,
  AlertCircle, Clock, Flame, UploadCloud, Trash2,
  PlusCircle, Search, ChevronDown, Zap,
} from 'lucide-react';
import { CollectionPreviewModal } from '../components/collection/CollectionPreviewModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CollectionState {
  store_name: string;
  month: string;
  current_level: number;
  last_sent_at: string | null;
  last_sent_by: string | null;
  resolved_at: string | null;
  auto_fired: boolean;
}

interface StoreContact {
  uf: string;
  store_name: string;
  director_name: string | null;
  director_email: string | null;
  manager_sales_name: string | null;
  manager_sales_email: string | null;
  manager_aftersales_name: string | null;
  manager_aftersales_email: string | null;
  synced_at: string;
}

interface Supervisor {
  id: string;
  name: string;
  email: string;
  ti_role: 'coordinator' | 'manager' | 'director';
}

interface Recipient { name: string; email: string; }

interface PreviewData {
  store: StoreContact | null;
  currentLevel: number;
  nextLevel: number;
  recipients: { to: Recipient[]; cc: Recipient[]; };
  canFire: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  0: { label: 'Não iniciado', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  1: { label: 'Nível 1 — Gerentes',    color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  2: { label: 'Nível 2 — Diretor',     color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  3: { label: 'Nível 3 — 2ª Cobrança', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  4: { label: 'Nível 4 — Dir. TI',     color: 'bg-red-100 text-red-700',     dot: 'bg-red-500' },
};

const TI_ROLE_LABELS: Record<string, string> = {
  coordinator: 'Coordenador de TI',
  manager:     'Gestor de TI',
  director:    'Diretor de TI',
};

const apiHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('infracheck_auth_token')}`,
});

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

// ─── Sub-componentes ──────────────────────────────────────────────────────────

type InternalTab = 'cobrancas' | 'equipe' | 'importar';

// ─── Page Principal ───────────────────────────────────────────────────────────

export const CollectionManager: React.FC = () => {
  const [tab, setTab] = useState<InternalTab>('cobrancas');

  // Cobranças
  const [states, setStates] = useState<CollectionState[]>([]);
  const [stores, setStores] = useState<StoreContact[]>([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [search, setSearch] = useState('');
  const [loadingStates, setLoadingStates] = useState(false);

  // Preview Modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewStore, setPreviewStore] = useState('');
  const [firing, setFiring] = useState(false);

  // Supervisores
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [newSup, setNewSup] = useState({ name: '', email: '', ti_role: 'coordinator' });
  const [addingSupv, setAddingSupv] = useState(false);

  // CSV Upload
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null); // store_name being resolved

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchStates = useCallback(async () => {
    setLoadingStates(true);
    try {
      const [statesRes, storesRes] = await Promise.all([
        fetch(`/api/collection/states?month=${month}`, { headers: apiHeaders() }),
        fetch('/api/collection/stores', { headers: apiHeaders() }),
      ]);
      if (statesRes.ok) setStates(await statesRes.json());
      if (storesRes.ok) setStores(await storesRes.json());
    } finally {
      setLoadingStates(false);
    }
  }, [month]);

  const fetchSupervisors = useCallback(async () => {
    const res = await fetch('/api/collection/supervisors', { headers: apiHeaders() });
    if (res.ok) setSupervisors(await res.json());
  }, []);

  useEffect(() => { fetchStates(); }, [fetchStates]);
  useEffect(() => { fetchSupervisors(); }, [fetchSupervisors]);

  // ── Cobrança ──────────────────────────────────────────────────────────────

  const openPreview = async (storeName: string) => {
    setPreviewStore(storeName);
    setPreviewData(null);
    setPreviewOpen(true);
    try {
      const res = await fetch(`/api/collection/preview/${encodeURIComponent(storeName)}?month=${month}`, { headers: apiHeaders() });
      if (res.ok) {
        const data: PreviewData = await res.json();
        setPreviewData(data);
      }
    } catch {
      alert('Erro ao carregar preview.');
      setPreviewOpen(false);
    }
  };

  const handleFire = async () => {
    if (!previewData?.canFire) return;
    setFiring(true);
    try {
      const res = await fetch(`/api/collection/fire/${encodeURIComponent(previewStore)}`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ month }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao disparar');
      alert(`✅ ${data.message}`);
      setPreviewOpen(false);
      fetchStates();
    } catch (err: any) {
      alert(`❌ ${err.message}`);
    } finally {
      setFiring(false);
    }
  };

  const handleResolve = async (storeName: string) => {
    if (!confirm(`Marcar cobrança de "${storeName}" como resolvida?`)) return;
    setResolving(storeName);
    try {
      const res = await fetch(`/api/collection/resolve/${encodeURIComponent(storeName)}`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ month }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao resolver');
      fetchStates();
    } catch (err: any) {
      alert(`❌ ${err.message}`);
    } finally {
      setResolving(null);
    }
  };

  // ── Supervisores ──────────────────────────────────────────────────────────

  const handleAddSupervisor = async () => {
    if (!newSup.name || !newSup.email) return alert('Preencha nome e e-mail.');
    setAddingSupv(true);
    try {
      const res = await fetch('/api/collection/supervisors', {
        method: 'POST', headers: apiHeaders(), body: JSON.stringify(newSup),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setNewSup({ name: '', email: '', ti_role: 'coordinator' });
      fetchSupervisors();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setAddingSupv(false);
    }
  };

  const handleDeleteSupervisor = async (id: string) => {
    if (!confirm('Remover supervisor?')) return;
    await fetch(`/api/collection/supervisors/${id}`, { method: 'DELETE', headers: apiHeaders() });
    fetchSupervisors();
  };

  // ── CSV Upload ────────────────────────────────────────────────────────────

  const handleSync = async () => {
    if (!csvFile) return alert('Selecione um arquivo CSV.');
    setSyncing(true);
    setSyncResult(null);
    try {
      const fd = new FormData();
      fd.append('file', csvFile);
      const res = await fetch('/api/collection/upload-csv', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('infracheck_auth_token')}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSyncResult(`✅ ${data.message}`);
      fetchStates();
    } catch (err: any) {
      setSyncResult(`❌ Erro: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // ── Dados da tabela principal ─────────────────────────────────────────────

  // Mapa store_name → state
  const stateMap = new Map(states.map(s => [s.store_name.toLowerCase(), s]));

  // Lista combinada: lojas sincronizadas + lojas com estado mas sem contato
  const allStoreNames = new Set([
    ...stores.map(s => s.store_name),
    ...states.map(s => s.store_name),
  ]);

  const rows = Array.from(allStoreNames)
    .map(name => {
      const contact = stores.find(s => s.store_name.toLowerCase() === name.toLowerCase());
      const state   = stateMap.get(name.toLowerCase());
      return { name, uf: contact?.uf || '—', contact, state, level: state?.current_level || 0 };
    })
    .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.uf.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-orange-100 p-2.5 rounded-xl">
            <Bell className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Régua de Cobrança</h2>
            <p className="text-sm text-slate-500">Escalonamento de checklists pendentes</p>
          </div>
        </div>
      </div>

      {/* Tabs internas */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([['cobrancas', 'Cobranças do Mês', Bell], ['equipe', 'Equipe TI', Users], ['importar', 'Importar Planilha', UploadCloud]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
              ${tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Aba: Cobranças do Mês ─────────────────────────────────────── */}
      {tab === 'cobrancas' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar loja ou UF..."
                  className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 font-medium">Mês:</label>
                <input
                  type="month"
                  value={month}
                  onChange={e => setMonth(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button onClick={fetchStates} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-600 transition">
              <RefreshCw size={14} className={loadingStates ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>

          {stores.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <UploadCloud size={40} className="mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhuma loja sincronizada</p>
              <p className="text-sm mt-1">Importe a planilha CSV na aba "Importar Planilha"</p>
            </div>
          )}

          {stores.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-left">UF</th>
                    <th className="px-5 py-3 text-left">Loja</th>
                    <th className="px-5 py-3 text-left">Nível Atual</th>
                    <th className="px-5 py-3 text-left">Último Envio</th>
                    <th className="px-5 py-3 text-left">Por</th>
                    <th className="px-5 py-3 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(row => {
                    const cfg = LEVEL_CONFIG[row.level as keyof typeof LEVEL_CONFIG] || LEVEL_CONFIG[0];
                    const isMax = row.level >= 4;
                    return (
                      <tr key={row.name} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <span className="bg-slate-100 text-slate-600 font-bold text-xs px-2 py-1 rounded-md">{row.uf}</span>
                        </td>
                        <td className="px-5 py-3 font-medium text-slate-800 max-w-[240px]">
                          <div className="truncate">{row.name}</div>
                          {row.state?.auto_fired && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-purple-600 font-bold mt-0.5">
                              <Zap size={10} /> Disparo automático
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {row.state?.resolved_at ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                              <CheckCircle2 size={12} /> Resolvido
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                              {cfg.label}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-500 text-xs">{fmtDate(row.state?.last_sent_at || null)}</td>
                        <td className="px-5 py-3 text-slate-500 text-xs">{row.state?.last_sent_by || '—'}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-center gap-2">
                            {row.state?.resolved_at ? (
                              <span className="text-xs text-green-600 font-semibold">
                                {fmtDate(row.state.resolved_at)}
                              </span>
                            ) : isMax ? (
                              <button
                                onClick={() => handleResolve(row.name)}
                                disabled={resolving === row.name}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 hover:bg-green-700 text-white transition disabled:opacity-50"
                              >
                                <CheckCircle2 size={13} />
                                {resolving === row.name ? 'Resolvendo...' : 'Resolver'}
                              </button>
                            ) : (
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => openPreview(row.name)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition
                                    ${row.level === 0
                                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                      : row.level >= 3
                                      ? 'bg-red-600 hover:bg-red-700 text-white'
                                      : 'bg-orange-500 hover:bg-orange-600 text-white'}`}
                                >
                                  <Flame size={13} />
                                  {row.level === 0 ? 'Iniciar Cobrança' : 'Próximo Nível'}
                                </button>
                                {row.level > 0 && (
                                  <button
                                    onClick={() => handleResolve(row.name)}
                                    disabled={resolving === row.name}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-green-100 hover:bg-green-200 text-green-700 transition disabled:opacity-50"
                                    title="Marcar como resolvido"
                                  >
                                    <CheckCircle2 size={13} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length === 0 && search && (
                <div className="text-center py-8 text-slate-400 text-sm">Nenhuma loja encontrada para "{search}"</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Aba: Equipe TI ───────────────────────────────────────────────── */}
      {tab === 'equipe' && (
        <div className="space-y-4">
          {/* Adicionar */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <PlusCircle size={16} className="text-blue-600" /> Adicionar Supervisor / Liderança TI
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <input
                placeholder="Nome completo"
                value={newSup.name}
                onChange={e => setNewSup(p => ({ ...p, name: e.target.value }))}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                placeholder="E-mail corporativo"
                type="email"
                value={newSup.email}
                onChange={e => setNewSup(p => ({ ...p, email: e.target.value }))}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={newSup.ti_role}
                onChange={e => setNewSup(p => ({ ...p, ti_role: e.target.value }))}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="coordinator">Coordenador de TI</option>
                <option value="manager">Gestor de TI</option>
                <option value="director">Diretor de TI</option>
              </select>
            </div>
            <button
              onClick={handleAddSupervisor}
              disabled={addingSupv}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {addingSupv ? 'Adicionando...' : '+ Adicionar'}
            </button>
          </div>

          {/* Lista */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-700 text-sm">Supervisores Cadastrados ({supervisors.length})</h3>
            </div>
            {supervisors.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">Nenhum supervisor cadastrado ainda.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {supervisors.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{s.name}</p>
                        <p className="text-xs text-slate-400">{s.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                        {TI_ROLE_LABELS[s.ti_role]}
                      </span>
                      <button onClick={() => handleDeleteSupervisor(s.id)} className="text-slate-300 hover:text-red-500 transition">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Aba: Importar Planilha ───────────────────────────────────────── */}
      {tab === 'importar' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Upload size={16} className="text-blue-600" /> Importar Planilha de Contatos
          </h3>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <p className="font-bold mb-1">Formato esperado: CSV com separador ponto e vírgula (;)</p>
            <p>Colunas utilizadas: <strong>A (UF), C (Unidade), D (Departamento), E/F (Diretor), I/J (Gerente)</strong></p>
            <p className="mt-1 text-blue-600">Arquivo: <code>Planilha de Lideranças SAGA(Contatos).csv</code></p>
          </div>

          <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all"
            onClick={() => document.getElementById('csv-upload-input')?.click()}
          >
            <UploadCloud size={36} className="mx-auto mb-3 text-slate-400" />
            {csvFile ? (
              <div>
                <p className="font-semibold text-slate-700">{csvFile.name}</p>
                <p className="text-xs text-slate-400 mt-1">{(csvFile.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-slate-600">Clique para selecionar o arquivo CSV</p>
                <p className="text-xs text-slate-400 mt-1">ou arraste e solte aqui</p>
              </div>
            )}
            <input
              id="csv-upload-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) setCsvFile(e.target.files[0]); }}
            />
          </div>

          <button
            onClick={handleSync}
            disabled={!csvFile || syncing}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {syncing ? (
              <><span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Sincronizando...</>
            ) : (
              <><RefreshCw size={16} /> Sincronizar Contatos</>
            )}
          </button>

          {syncResult && (
            <div className={`p-3 rounded-xl text-sm font-medium ${syncResult.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {syncResult}
            </div>
          )}

          {stores.length > 0 && (
            <div className="text-sm text-slate-500 border-t pt-4">
              <p className="font-medium text-slate-700 mb-2">Lojas sincronizadas ({stores.length}):</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                {stores.map(s => (
                  <div key={s.store_name} className="flex items-center gap-1.5 text-xs">
                    <span className="bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded">{s.uf}</span>
                    <span className="truncate text-slate-600">{s.store_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Preview */}
      <CollectionPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onConfirm={handleFire}
        storeName={previewStore}
        currentLevel={previewData?.currentLevel ?? 0}
        nextLevel={previewData?.nextLevel ?? 1}
        recipients={previewData?.recipients ?? { to: [], cc: [] }}
        loading={firing || !previewData}
      />
    </div>
  );
};
