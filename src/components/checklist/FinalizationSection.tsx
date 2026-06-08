import React, { useEffect } from 'react';
import { ShieldCheck, Save, User } from 'lucide-react';
import { useChecklist } from '../../contexts/ChecklistContext';
import { useAuth } from '../../contexts/AuthContext';

const SectionTitle = ({ icon: Icon, title }: { icon: React.ElementType, title: string }) => (
  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-200 text-blue-900">
    <Icon className="w-6 h-6" />
    <h2 className="text-xl font-bold">{title}</h2>
  </div>
);

const InputLabel = ({ children }: { children?: React.ReactNode }) => (
  <label className="block text-sm font-medium text-slate-700 mb-1">{children}</label>
);

interface FinalizationSectionProps {
  onGenerateReport: () => void;
}

export const FinalizationSection = ({ onGenerateReport }: FinalizationSectionProps) => {
  const { data, updateField } = useChecklist();
  const { user } = useAuth();

  // Sincroniza automaticamente o técnico com o usuário logado
  useEffect(() => {
    if (user?.name && data.technicianName !== user.name) {
      updateField('technicianName', user.name);
    }
  }, [user?.name]);

  return (
    <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <SectionTitle icon={ShieldCheck} title="Finalização" />
        <div className="mb-6">
            <InputLabel>Observações Gerais</InputLabel>
            <textarea className="w-full border rounded-md p-2" rows={3} placeholder="Notas adicionais..." value={data.observations} onChange={e => updateField('observations', e.target.value)} />
        </div>
        <div className="mb-6">
            <InputLabel>Técnico Responsável</InputLabel>
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <User className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-blue-900 text-sm">{user?.name ?? '—'}</p>
                <p className="text-xs text-blue-500">Sincronizado com o usuário logado</p>
              </div>
            </div>
        </div>
        <button
          onClick={onGenerateReport}
          disabled={!data.locationName || !data.technicianName}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-lg"
        >
            <Save className="w-6 h-6" /> Gerar Relatório
        </button>
    </section>
  );
};
