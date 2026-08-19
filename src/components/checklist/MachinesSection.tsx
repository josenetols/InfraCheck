
import React from 'react';
import { Monitor, CheckCircle2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { useChecklist } from '../../contexts/ChecklistContext';
import { PhotoUpload } from '../PhotoUpload';

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

const SegmentedControl = ({ 
  options, 
  value, 
  onChange 
}: { 
  options: { label: string, value: any, color?: string }[], 
  value: any, 
  onChange: (val: any) => void 
}) => (
  <div className="flex p-1 bg-slate-100 rounded-lg w-full">
    {options.map((opt) => {
      const isSelected = value === opt.value;
      let textColor = 'text-slate-500';
      if (isSelected) textColor = opt.color || 'text-blue-700';
      return (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={`flex-1 text-xs font-bold py-2 px-2 rounded-md transition-all shadow-sm ${
            isSelected
              ? `bg-white ${textColor} shadow-sm ring-1 ring-black/5` 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 shadow-none'
          }`}
        >
          {opt.label}
        </button>
      )
    })}
  </div>
);

export const MachinesSection = () => {
  const { data, updateField, addMachine, removeMachine, updateMachine } = useChecklist();

  return (
    <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <SectionTitle icon={Monitor} title="3. Máquinas e Usuários" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <button type="button" onClick={() => updateField('allMachinesOk', true)} className={`p-4 rounded-xl border flex flex-col items-center gap-2 ${data.allMachinesOk === true ? 'border-green-500 bg-green-50 text-green-700' : 'bg-white'}`}><CheckCircle2 size={24} /><span className="text-sm font-bold whitespace-nowrap">Máquinas OK</span></button>
          <button type="button" onClick={() => updateField('allMachinesOk', false)} className={`p-4 rounded-xl border flex flex-col items-center gap-2 ${data.allMachinesOk === false ? 'border-red-500 bg-red-50 text-red-700' : 'bg-white'}`}><AlertCircle size={24} /><span className="text-sm font-bold whitespace-nowrap">Problemas</span></button>
      </div>
      <div className="mt-6">
        {data.allMachinesOk === false && (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">Máquinas com Problemas</h3>
                    <button type="button" onClick={addMachine} className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full hover:bg-red-200 flex items-center gap-1 font-medium"><Plus size={14} /> Adicionar Máquina</button>
                </div>
                {data.problematicMachines.map((pm, index) => (
                    <div key={pm.id} className="bg-red-50 p-4 rounded-lg border border-red-200 relative">
                        <button type="button" onClick={() => removeMachine(pm.id)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                        <div className="grid md:grid-cols-2 gap-4 mb-3">
                            <div><InputLabel>Identificação (Tag/Nome)</InputLabel><StyledInput value={pm.identifier} onChange={e => updateMachine(pm.id, 'identifier', e.target.value)} placeholder="PC-01 / Recepção" /></div>
                            <div><InputLabel>Processador</InputLabel><StyledInput value={pm.processorGen} onChange={e => updateMachine(pm.id, 'processorGen', e.target.value)} placeholder="i5 8ª Geração" /></div>
                            <div><InputLabel>Windows 11?</InputLabel><SegmentedControl value={pm.osUpdated} onChange={val => updateMachine(pm.id, 'osUpdated', val)} options={[{ label: 'Sim', value: true, color: 'text-green-600' }, { label: 'Não', value: false, color: 'text-red-600' }]} /></div>
                            <div><InputLabel>Descrição do Problema</InputLabel><StyledInput value={pm.problemDescription} onChange={e => updateMachine(pm.id, 'problemDescription', e.target.value)} placeholder="Lentidão, HD antigo..." /></div>
                        </div>
                        <PhotoUpload photos={pm.photos} onPhotosChange={photos => updateMachine(pm.id, 'photos', photos)} label="Fotos do Problema" />
                    </div>
                ))}
            </div>
        )}
      </div>
      <div className="mt-6">
         <InputLabel>Satisfação Geral</InputLabel>
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
             <button type="button" onClick={() => updateField('employeesSatisfied', true)} className={`p-4 rounded-xl border flex flex-col items-center gap-2 ${data.employeesSatisfied === true ? 'border-green-500 bg-green-50 text-green-700' : 'bg-white'}`}><CheckCircle2 size={24} /><span className="text-sm font-bold whitespace-nowrap">Usuários Satisfeitos</span></button>
             <button type="button" onClick={() => updateField('employeesSatisfied', false)} className={`p-4 rounded-xl border flex flex-col items-center gap-2 ${data.employeesSatisfied === false ? 'border-red-500 bg-red-50 text-red-700' : 'bg-white'}`}><AlertCircle size={24} /><span className="text-sm font-bold whitespace-nowrap">Há Reclamações</span></button>
         </div>
      </div>
    </section>
  );
};


