import React, { useEffect, useState } from 'react';
import { X, Clock, User, Calendar, FileText } from 'lucide-react';

interface HistoryEntry {
  id: string;
  location_name: string;
  technician_name: string;
  visit_date: string;
  is_baseline: boolean;
}

interface ChecklistHistoryModalProps {
  locationName: string;
  onClose: () => void;
  onLoadReport?: (checklistId: string) => void;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

export const ChecklistHistoryModal: React.FC<ChecklistHistoryModalProps> = ({
  locationName,
  onClose,
  onLoadReport,
}) => {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('infracheck_auth_token');
        const res = await fetch(
          `/api/checklists/location-history/${encodeURIComponent(locationName)}`,
          { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'Erro ao buscar histórico');
        }
        const data = await res.json();
        setItems(data);
      } catch (e: any) {
        console.error('Erro no histórico:', e);
        setError(e.message || 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [locationName]);

  const handleViewReport = (checklistId: string) => {
    if (onLoadReport) {
      onClose();
      onLoadReport(checklistId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white h-full sm:h-auto sm:max-h-[80vh] w-full sm:max-w-md flex flex-col shadow-2xl sm:rounded-2xl sm:mr-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 flex items-center justify-between flex-shrink-0 sm:rounded-t-2xl">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Histórico de Visitas</p>
            <h2 className="text-white text-lg font-extrabold mt-0.5 truncate max-w-xs">{locationName}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto p-6">

          {loading && (
            <div className="flex flex-col items-center justify-center h-32 gap-3">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-500">Carregando...</p>
            </div>
          )}

          {!loading && error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
              <Clock className="w-10 h-10 text-slate-300" />
              <p className="font-bold text-slate-600">Nenhum checklist encontrado</p>
              <p className="text-sm text-slate-400">Ainda não há registros para este local.</p>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">
                Últimas {items.length} visita(s)
              </p>
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition-all
                    ${idx === 0
                      ? 'border-blue-200 bg-blue-50/50 shadow-sm'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Ícone numerado */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm
                      ${idx === 0 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Data */}
                      <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDate(item.visit_date)}
                        {idx === 0 && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full">
                            Mais recente
                          </span>
                        )}
                      </div>

                      {/* Técnico */}
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                        <User className="w-3 h-3" />
                        <span>{item.technician_name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Botão Ver Relatório */}
                  {onLoadReport && (
                    <button
                      onClick={() => handleViewReport(item.id)}
                      className="mt-3 w-full flex items-center justify-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 py-2 rounded-lg border border-blue-200 transition-all"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Ver Relatório
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
