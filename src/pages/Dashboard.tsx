import React, { useState } from 'react';
import {
  Search, CheckCircle2, AlertCircle, CalendarClock,
  PlayCircle, RefreshCw, User, MapPin, ClipboardCheck,
  TrendingUp, BarChart3, Printer, History, FileText
} from 'lucide-react';
import { StatCard } from '../components/dashboard/StatCard';
import { DateFilter } from '../components/dashboard/DateFilter';
import { DashboardCharts } from '../components/dashboard/DashboardCharts';
import { ChecklistHistoryModal } from '../components/dashboard/ChecklistHistoryModal';
import { useDashboardData } from '../hooks/useDashboardData';
import { useAuth } from '../contexts/AuthContext';
import { downloadProductivityPDF } from '../utils/exportService';
import { CycleGoalCard } from '../components/dashboard/CycleGoalCard';
import type { LocationStatus, StatusFilter } from '../types';

interface DashboardProps {
  onStartChecklist: (locationName?: string) => void;
  onLoadReport?: (checklistId: string) => void;
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ loc: LocationStatus }> = React.memo(({ loc }) => {
  if (loc.isWarning) return <span className="bg-yellow-100 text-yellow-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Alerta</span>;
  if (loc.isValid) return <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Em Dia</span>;
  return <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Pendente</span>;
});
StatusBadge.displayName = 'StatusBadge';

const FilterButton: React.FC<{
  value: StatusFilter;
  current: StatusFilter;
  label: string;
  onClick: (v: StatusFilter) => void;
}> = React.memo(({ value, current, label, onClick }) => (
  <button
    onClick={() => onClick(value)}
    className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${
      current === value ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
    }`}
  >
    {label}
  </button>
));
FilterButton.displayName = 'FilterButton';

const LocationCard: React.FC<{
  loc: LocationStatus;
  currentUserName: string;
  isAdmin: boolean;
  onStart: (loc: LocationStatus) => void;
  onViewHistory: (name: string) => void;
  onLoadReport?: (checklistId: string) => void;
}> = React.memo(({ loc, currentUserName, isAdmin, onStart, onViewHistory, onLoadReport }) => {
  // Só mostra "Fora da rota" para técnicos, nunca para admin
  const isNotMyRoute = !isAdmin && !!currentUserName && loc.assignedTechnician !== currentUserName;
  const borderColor = loc.isWarning
    ? 'border-l-yellow-500'
    : loc.isValid
    ? 'border-l-green-500'
    : 'border-l-red-500';

  return (
    <div className={`bg-white p-5 rounded-2xl border border-l-4 shadow-sm transition-all hover:shadow-md ${borderColor} ${isNotMyRoute ? 'opacity-60' : ''}`}>
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-bold text-slate-800 text-lg flex-1 pr-2 leading-tight">
          {loc.name}
          {isNotMyRoute && (
            <span className="block text-[10px] text-red-500 font-extrabold mt-1 uppercase">
              Fora da sua rota
            </span>
          )}
        </h3>
        <StatusBadge loc={loc} />
      </div>

      <div className="space-y-2 mb-6">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <User className="w-3 h-3 text-slate-400" />
          Roteiro: <span className="text-slate-800">{loc.assignedTechnician ?? 'N/A'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <CalendarClock className="w-3 h-3 text-slate-400" />
          Último Checklist:{' '}
          <span className="font-medium text-slate-700">
            {loc.lastCheckDate
              ? new Date(loc.lastCheckDate).toLocaleDateString('pt-BR')
              : 'Sem registro'}
          </span>
        </div>
      </div>

      {loc.isValid ? (
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-50">
          <span className={`text-xs font-bold ${loc.isWarning ? 'text-yellow-600' : 'text-green-600'}`}>
            Expira em {loc.daysRemaining} dia{loc.daysRemaining !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => onStart(loc)}
            className="text-xs font-bold text-blue-600 hover:underline"
          >
            Refazer
          </button>
        </div>
      ) : (
        <button
          onClick={() => onStart(loc)}
          className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
        >
          <PlayCircle className="w-5 h-5" />
          Iniciar Checklist
        </button>
      )}

      {/* Botões de histórico e relatório */}
      <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
        <button
          onClick={() => onViewHistory(loc.name)}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 font-medium transition-colors py-1"
        >
          <History className="w-3 h-3" />
          Histórico
        </button>
        {loc.lastCheckId && onLoadReport && (
          <button
            onClick={() => onLoadReport(loc.lastCheckId as string)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 py-1 rounded transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Relatório
          </button>
        )}
      </div>
    </div>
  );
});
LocationCard.displayName = 'LocationCard';

// ─── Componente Principal ─────────────────────────────────────────────────────

export const Dashboard: React.FC<DashboardProps> = ({ onStartChecklist, onLoadReport }) => {
  const { user, isAdmin } = useAuth();
  if (!user) return null;
  const {
    filteredLocations,
    regionTechs,
    availableRegions,
    biStats,
    barData,
    pieData,
    lineData,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    techFilter, setTechFilter,
    regionFilter, setRegionFilter,
    showOnlyMine, setShowOnlyMine,
    startDate, setStartDate,
    endDate, setEndDate,
    regenerateDistribution,
    technicianReport,
  } = useDashboardData();

  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [selectedTechs, setSelectedTechs] = useState<string[]>([]);
  const [historyLocation, setHistoryLocation] = useState<string | null>(null);

  const handleStartChecklistClick = (loc: LocationStatus) => {
    // Admin pode realizar checklist em qualquer loja
    if (!isAdmin && user.name && loc.assignedTechnician !== user.name) {
      alert('Este local não está atribuído a você neste mês.');
      return;
    }
    onStartChecklist(loc.name);
  };

  const openRegenerateModal = () => {
    // Inicializar os técnicos selecionados com todos da região (se aplicável), incluindo admin se quiserem
    const initialSelected = [...regionTechs, user.name].filter((v, i, a) => a.indexOf(v) === i);
    setSelectedTechs(initialSelected);
    setShowRegenerateModal(true);
  };

  const confirmRegenerate = async () => {
    if (selectedTechs.length === 0) {
      alert('Selecione ao menos um técnico para distribuir as lojas.');
      return;
    }
    await regenerateDistribution(selectedTechs);
    setShowRegenerateModal(false);
    alert('Distribuição regenerada com sucesso!');
  };

  return (
    <div className="pb-20 max-w-7xl mx-auto px-4">
      {/* Banner de região ativa */}
      {user.region && (
        <div className="bg-blue-900 text-white p-4 rounded-xl mb-6 flex flex-col md:flex-row justify-between items-center shadow-lg gap-4">
          <span className="font-bold text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5" /> Região Ativa: {user.region}
          </span>
          <div className="flex items-center gap-4">
            <span className="text-sm bg-white/20 px-3 py-1 rounded-full font-medium">{user.name}</span>
          {isAdmin && (
              <span className="text-[10px] bg-red-500 text-white font-bold px-2 py-1 rounded-md uppercase">
                Modo Admin
              </span>
            )}
          </div>
        </div>
      )}

      {/* Header + Filtro de Data */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard de Performance</h1>
          <p className="text-slate-500">Visualize métricas e gerencie a saúde da infraestrutura.</p>
        </div>
        <DateFilter
          startDate={startDate}
          endDate={endDate}
          onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
        />
      </div>

      {/* Cards de KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Histórico"     value={biStats.total}            icon={ClipboardCheck} color="slate" />
        <StatCard label="Checklists no Período" value={biStats.completed}       icon={CheckCircle2}   color="green" />
        <StatCard label="Lojas Pendentes"     value={biStats.pending}           icon={AlertCircle}    color="red"   />
        <StatCard label="Média Diária"        value={biStats.averagePerPeriod}  icon={TrendingUp}     color="blue"  />
      </div>

      <CycleGoalCard />

      {/* Gráficos de BI */}
      <DashboardCharts barData={barData} pieData={pieData} lineData={lineData} />

      {/* Relatório de Técnicos */}
      {technicianReport && technicianReport.length > 0 && (
        <div className="mt-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:m-0 print:border-none print:shadow-none print:p-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" /> Relatório de Produtividade (Atribuídas vs Realizadas)
            </h2>
            <div className="flex items-center gap-4">
              {isAdmin && (
                <select
                  className="p-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 outline-none transition-all bg-white shadow-sm text-sm"
                  value={regionFilter}
                  onChange={e => setRegionFilter(e.target.value)}
                  title="Filtrar por Região"
                >
                  <option value="all">Todas as Regiões</option>
                  {availableRegions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              )}
              <button
                onClick={async () => await downloadProductivityPDF(technicianReport)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors print:hidden"
                title="Baixar PDF"
              >
                <Printer className="w-4 h-4" />
                Baixar PDF
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Técnico</th>
                  <th className="px-6 py-4">Lojas Atribuídas</th>
                  <th className="px-6 py-4">Checklists Realizados</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {technicianReport.map((rep: any) => {
                  const done = rep.completed >= rep.attributed && rep.attributed > 0;
                  const ratio = rep.attributed > 0 ? Math.round((rep.completed / rep.attributed) * 100) : 0;
                  return (
                    <tr key={rep.technician} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800">{rep.technician}</td>
                      <td className="px-6 py-4 text-slate-600">{rep.attributed}</td>
                      <td className="px-6 py-4 text-slate-600 font-medium">{rep.completed}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md font-bold text-[10px] ${
                          done ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {rep.attributed === 0 ? 'N/A' : `${ratio}%`}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Seção Operacional */}
      <div className="mt-12 mb-6 flex items-center gap-2 text-slate-800">
        <BarChart3 className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-bold">Gestão Operacional de Locais</h2>
      </div>

      {/* Barra de Controles */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6 sticky top-20 z-10">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          {/* Busca */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar local pelo nome..."
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all shadow-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Selects */}
          <div className="flex flex-col md:flex-row gap-4 flex-1">
          {isAdmin && (
              <select
                className="flex-1 p-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 outline-none transition-all bg-white shadow-sm"
                value={regionFilter}
                onChange={e => setRegionFilter(e.target.value)}
              >
                <option value="all">Todas as Regiões</option>
                {availableRegions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}
            <select
              className="flex-1 p-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 outline-none transition-all bg-white shadow-sm"
              value={techFilter}
              onChange={e => setTechFilter(e.target.value)}
            >
              <option value="all">Filtro por Técnico</option>
              {regionTechs.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 justify-between items-center">
          <div className="flex items-center gap-6 w-full lg:w-auto">
            {user.name && (
              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  checked={showOnlyMine}
                  onChange={e => setShowOnlyMine(e.target.checked)}
                />
                Minha Rota
              </label>
            )}
            <div className="flex p-1 bg-slate-100 rounded-lg border border-slate-200">
              {([
                { value: 'all',     label: 'Todos'    },
                { value: 'valid',   label: 'Ok'       },
                { value: 'warning', label: 'Vencendo' },
                { value: 'expired', label: 'Pendentes'},
              ] as { value: StatusFilter; label: string }[]).map(f => (
                <FilterButton
                  key={f.value}
                  value={f.value}
                  current={statusFilter}
                  label={f.label}
                  onClick={setStatusFilter}
                />
              ))}
            </div>
          </div>

          {/* Botão regenerar — visível apenas para admin */}
          {isAdmin && (
            <button
              onClick={openRegenerateModal}
              className="w-full lg:w-auto flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Regerar Distribuição
            </button>
          )}
        </div>
      </div>

      {/* Grid de Locais */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredLocations.map(loc => (
          <LocationCard
            key={loc.name}
            loc={loc}
            currentUserName={user.name}
            isAdmin={isAdmin}
            onStart={handleStartChecklistClick}
            onViewHistory={setHistoryLocation}
            onLoadReport={onLoadReport}
          />
        ))}

        {filteredLocations.length === 0 && (
          <div className="col-span-full text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">Nenhum local coincide com os filtros atuais.</p>
          </div>
        )}
      </div>

      {showRegenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative">
            <div className="p-8 pb-6">
              <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Participantes do Mês</h2>
              <p className="text-sm text-slate-500 font-medium mb-6">
                Selecione os técnicos (ou admin) que receberão as lojas na distribuição de {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                {isAdmin && regionFilter !== 'all' ? ` para a região ${regionFilter}` : ''}.
              </p>
              
              <div className="space-y-3 max-h-60 overflow-y-auto mb-6 pr-2">
                {/* Obter lista única de todos na região + usuário */}
                {Array.from(new Set([...regionTechs, user.name])).map(t => (
                  <label key={t} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition-colors">
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      checked={selectedTechs.includes(t)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedTechs([...selectedTechs, t]);
                        else setSelectedTechs(selectedTechs.filter(x => x !== t));
                      }}
                    />
                    <span className="font-bold text-slate-700">{t}</span>
                    {t === user.name && <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold ml-auto">VOCÊ</span>}
                  </label>
                ))}
              </div>
            </div>
            
            <div className="bg-slate-50 border-t border-slate-100 p-6 flex justify-end gap-3">
              <button
                onClick={() => setShowRegenerateModal(false)}
                className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmRegenerate}
                className="px-6 py-3 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm shadow-md active:scale-95 flex items-center gap-2"
              >
                <RefreshCw size={18} />
                Confirmar Distribuição
              </button>
            </div>
          </div>
        </div>
      )}

      {historyLocation && (
        <ChecklistHistoryModal
          locationName={historyLocation}
          onClose={() => setHistoryLocation(null)}
          onLoadReport={onLoadReport}
        />
      )}
    </div>
  );
};

