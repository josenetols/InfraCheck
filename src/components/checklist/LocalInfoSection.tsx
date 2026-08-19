
import React from 'react';
import { FileText } from 'lucide-react';
import { Autocomplete } from '../Autocomplete';
import { useChecklist } from '../../contexts/ChecklistContext';

const SectionTitle = ({ icon: Icon, title }: { icon: React.ElementType, title: string }) => (
  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-200 text-blue-900">
    <Icon className="w-6 h-6" />
    <h2 className="text-xl font-bold">{title}</h2>
  </div>
);

const InputLabel = ({ children, htmlFor }: { children?: React.ReactNode, htmlFor?: string }) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 mb-1">{children}</label>
);

const StyledInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" {...props} />
);

export const LocalInfoSection = () => {
  const { data, updateField } = useChecklist();

  return (
    <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <SectionTitle icon={FileText} title="1. Informações do Local" />
      <div className="grid md:grid-cols-2 gap-4">
        <Autocomplete id="locationName" label="Nome do Local" value={data.locationName} onChange={val => updateField('locationName', val)} placeholder="Busque ou digite o nome do local..." />
        <div>
            <InputLabel htmlFor="responsibleName">Responsável pelo Local</InputLabel>
            <StyledInput id="responsibleName" placeholder="Ex: Cliente (João Silva)" value={data.responsibleName} onChange={e => updateField('responsibleName', e.target.value)} />
        </div>
      </div>
    </section>
  );
};

