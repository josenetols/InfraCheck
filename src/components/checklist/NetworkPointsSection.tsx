
import React from 'react';
import { Network, CheckCircle2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { useChecklist } from '../../contexts/ChecklistContext';
import { PhotoUpload } from '../PhotoUpload';

const SectionTitle = ({ icon: Icon, title }: { icon: React.ElementType, title: string }) => (
  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-200 text-blue-900">
    <Icon className="w-6 h-6" />
    <h2 className="text-xl font-bold">{title}</h2>
  </div>
);

const InputLabel = ({ children }: { children?: React.ReactNode }) => (
  <label className="block text-sm font-medium text-slate-700 mb-1">{children}</label>
);

const StyledInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" {...props} />
);

export const NetworkPointsSection = () => {
  const { data, updateField, addNetworkPoint, removeNetworkPoint, updateNetworkPoint } = useChecklist();

  return (
    <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <SectionTitle icon={Network} title="4. Pontos de Rede" />
        <div className="grid grid-cols-2 gap-4 mb-4">
            <button onClick={() => updateField('networkPointsOk', true)} className={`p-4 rounded-xl border flex flex-col items-center gap-2 ${data.networkPointsOk ? 'border-green-500 bg-green-50 text-green-700' : 'bg-white'}`}><CheckCircle2 size={24} /><span className="text-sm font-bold">Pontos OK</span></button>
            <button onClick={() => updateField('networkPointsOk', false)} className={`p-4 rounded-xl border flex flex-col items-center gap-2 ${!data.networkPointsOk ? 'border-red-500 bg-red-50 text-red-700' : 'bg-white'}`}><AlertCircle size={24} /><span className="text-sm font-bold">Problemas</span></button>
        </div>
        <div className="mb-4">
            <InputLabel>Observações Gerais</InputLabel>
            <textarea className="w-full border rounded-md p-2" rows={2} placeholder="Estado geral dos pontos..." value={data.networkPointsNotes} onChange={e => updateField('networkPointsNotes', e.target.value)} />
        </div>
        
        {!data.networkPointsOk && (
            <div className="space-y-4 mt-6 border-t pt-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">Pontos com Defeito</h3>
                    <button onClick={addNetworkPoint} className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full hover:bg-red-200 flex items-center gap-1 font-medium"><Plus size={14} /> Adicionar Ponto</button>
                </div>
                {data.problematicNetworkPoints.map((np) => (
                    <div key={np.id} className="bg-red-50 p-4 rounded-lg border border-red-200 relative">
                        <button onClick={() => removeNetworkPoint(np.id)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                        <div className="grid md:grid-cols-2 gap-4 mb-3">
                            <div><InputLabel>Localização</InputLabel><StyledInput value={np.location} onChange={e => updateNetworkPoint(np.id, 'location', e.target.value)} placeholder="Ex: Sala 02 - Parede Norte" /></div>
                            <div><InputLabel>Descrição do Defeito</InputLabel><StyledInput value={np.description} onChange={e => updateNetworkPoint(np.id, 'description', e.target.value)} placeholder="Ex: Tomada quebrada, sem sinal" /></div>
                        </div>
                        <PhotoUpload photos={np.photos} onPhotosChange={photos => updateNetworkPoint(np.id, 'photos', photos)} label="Fotos do Ponto" />
                    </div>
                ))}
            </div>
        )}
    </section>
  );
};


