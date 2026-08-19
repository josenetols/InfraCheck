import React, { useEffect, useState } from 'react';
import { goalService } from '../services/goalService';
import { useAuth } from '../contexts/AuthContext';
import { History, Target, Calendar, User, Search } from 'lucide-react';

export const GoalHistory: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [filters, setFilters] = useState({
    year: '',
    cycle: '',
    technicianId: ''
  });

  useEffect(() => {
    fetchHistory();
  }, [filters, user]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const queryFilters: any = {};
      if (filters.year) queryFilters.year = parseInt(filters.year);
      if (filters.cycle) queryFilters.cycle = parseInt(filters.cycle);
      if (isAdmin && filters.technicianId) queryFilters.technicianId = filters.technicianId;
      else if (!isAdmin && user?.id) queryFilters.technicianId = user.id;

      const data = await goalService.getHistory(queryFilters);
      setHistory(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pb-20">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <History className="w-6 h-6 text-blue-600" /> Histórico de Metas
        </h1>
        <p className="text-slate-500">Consulte o desempenho de ciclos anteriores.</p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Ano</label>
          <input 
            type="number" 
            value={filters.year} 
            onChange={(e) => setFilters({...filters, year: e.target.value})}
            className="w-full p-3 rounded-lg border border-slate-200 focus:border-blue-500 outline-none"
            placeholder="Ex: 2026"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Ciclo</label>
          <select 
            value={filters.cycle} 
            onChange={(e) => setFilters({...filters, cycle: e.target.value})}
            className="w-full p-3 rounded-lg border border-slate-200 focus:border-blue-500 outline-none"
          >
            <option value="">Todos</option>
            <option value="1">Ciclo 1</option>
            <option value="2">Ciclo 2</option>
            <option value="3">Ciclo 3</option>
          </select>
        </div>
        {isAdmin && (
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Técnico (ID)</label>
            <input 
              type="text" 
              value={filters.technicianId} 
              onChange={(e) => setFilters({...filters, technicianId: e.target.value})}
              className="w-full p-3 rounded-lg border border-slate-200 focus:border-blue-500 outline-none"
              placeholder="Ex: tech-1"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="animate-pulse bg-white h-64 rounded-2xl"></div>
      ) : (
        <div className="space-y-8">
          <h2 className="text-xl font-bold text-slate-800 border-b pb-2">Ciclos Concluídos</h2>
          {history?.cycles?.length === 0 ? (
            <div className="text-center py-10 text-slate-400">Nenhum ciclo encontrado.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {history?.cycles?.map((cycle: any) => (
                <div key={cycle.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className={`absolute top-0 left-0 w-full h-1 ${
                    cycle.status === 'META ATINGIDA' ? 'bg-green-500' : 
                    (cycle.status === 'CICLO INCOMPLETO' || cycle.status === 'SEM DADOS') ? 'bg-amber-400' :
                    'bg-red-500'
                  }`}></div>
                  <h3 className="font-bold text-lg text-slate-800 mb-1">{cycle.technician_name}</h3>
                  <p className="text-sm text-slate-500 mb-4">{cycle.year} - Ciclo {cycle.cycle}</p>
                  
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <span className="block text-xs text-slate-400 font-bold uppercase">Resultado</span>
                      {cycle.average_percentage !== null && cycle.average_percentage !== undefined ? (
                        <span className={`text-2xl font-extrabold ${cycle.status === 'META ATINGIDA' ? 'text-green-600' : 'text-slate-800'}`}>
                          {Number(cycle.average_percentage).toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-xl font-extrabold text-slate-400">SEM DADOS</span>
                      )}
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${cycle.status === 'META ATINGIDA' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {cycle.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-sm border-t pt-4">
                    <div>
                      <span className="block text-xs text-slate-400">M1</span>
                      <span className="font-bold">{cycle.month_1_percentage !== null && cycle.month_1_percentage !== undefined ? `${Number(cycle.month_1_percentage).toFixed(0)}%` : 'SEM DADOS'}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-400">M2</span>
                      <span className="font-bold">{cycle.month_2_percentage !== null && cycle.month_2_percentage !== undefined ? `${Number(cycle.month_2_percentage).toFixed(0)}%` : 'SEM DADOS'}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-400">M3</span>
                      <span className="font-bold">{cycle.month_3_percentage !== null && cycle.month_3_percentage !== undefined ? `${Number(cycle.month_3_percentage).toFixed(0)}%` : 'SEM DADOS'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h2 className="text-xl font-bold text-slate-800 border-b pb-2 mt-12">Detalhamento Mensal</h2>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-4">Período</th>
                  <th className="p-4">Técnico</th>
                  <th className="p-4 text-center">Atribuídas</th>
                  <th className="p-4 text-center">Checklists</th>
                  <th className="p-4 text-right">Desempenho</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history?.monthly?.map((m: any) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="p-4 font-medium text-slate-800">{m.month}/{m.year} (Ciclo {m.cycle})</td>
                    <td className="p-4">{m.technician_name}</td>
                    <td className="p-4 text-center text-slate-600">{m.assigned_locations}</td>
                    <td className="p-4 text-center font-bold text-slate-700">{m.completed_checklists}</td>
                    <td className="p-4 text-right font-extrabold text-blue-600">
                      {m.percentage !== null && m.percentage !== undefined ? (
                        <>
                          <span className="text-lg">{Number(m.percentage).toFixed(0)}%</span>
                          <span className="block text-[10px] text-slate-400 mt-1 font-normal uppercase tracking-wider">
                            {m.expected_checklists} ESP. / {m.completed_checklists} REAL.
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-slate-400">SEM DADOS</span>
                          <span className="block text-[10px] text-slate-400 mt-1 font-normal uppercase tracking-wider">
                            {m.expected_checklists} ESP. / {m.completed_checklists} REAL.
                          </span>
                        </>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="text-[10px] font-bold bg-slate-100 px-2 py-1 rounded">{m.status}</span>
                    </td>
                  </tr>
                ))}
                {history?.monthly?.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-400">Nenhum dado mensal.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
