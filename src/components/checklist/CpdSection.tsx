
import React from 'react';
import { Server, CheckCircle2, LayoutGrid, AlertCircle, Plus, Trash2, ShieldCheck } from 'lucide-react';
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

const StyledSelect = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-white" {...props} />
);

const QuantitySelector = ({ value, onChange }: { value: number, onChange: (val: number) => void }) => (
  <div className="flex items-center h-[42px] w-full">
    <button 
      type="button"
      onClick={() => onChange(Math.max(1, value - 1))}
      className="h-full w-10 bg-slate-100 border border-slate-300 border-r-0 rounded-l-md text-slate-600 hover:bg-slate-200 active:bg-slate-300 transition-colors flex items-center justify-center flex-shrink-0"
    >
      <Minus size={16} />
    </button>
    <div className="h-full flex-1 border-y border-slate-300 relative min-w-[2rem]">
        <input 
          type="number" 
          min="1"
          value={value}
          onChange={(e) => {
             const val = parseInt(e.target.value);
             if (!isNaN(val) && val > 0) onChange(val);
             else if (e.target.value === '') onChange(1);
          }}
          className="w-full h-full text-center border-none focus:ring-0 p-0 text-slate-700 font-medium bg-white"
        />
    </div>
    <button 
      type="button"
      onClick={() => onChange(value + 1)}
      className="h-full w-10 bg-slate-100 border border-slate-300 border-l-0 rounded-r-md text-slate-600 hover:bg-slate-200 active:bg-slate-300 transition-colors flex items-center justify-center flex-shrink-0"
    >
      <Plus size={16} />
    </button>
  </div>
);

import { Minus } from 'lucide-react';

const RadioCard = ({ 
  label, 
  description, 
  checked, 
  onClick, 
  icon: Icon,
  color = 'blue' 
}: { 
  label: string, 
  description?: string, 
  checked: boolean, 
  onClick: () => void,
  icon: React.ElementType,
  color?: 'blue' | 'green' | 'yellow' | 'red'
}) => {
  const styles = {
    blue: { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-500' },
    green: { border: 'border-green-500', bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-500' },
    yellow: { border: 'border-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-800', ring: 'ring-yellow-500' },
    red: { border: 'border-red-500', bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-500' },
  };
  const currentStyle = styles[color];
  return (
    <div 
      onClick={onClick}
      className={`relative flex items-center p-4 cursor-pointer border rounded-xl transition-all shadow-sm ${
        checked 
          ? `${currentStyle.border} ${currentStyle.bg} ring-1 ${currentStyle.ring}` 
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white'
      }`}
    >
        <div className={`flex-shrink-0 mr-4 ${checked ? currentStyle.text : 'text-slate-400'}`}>
            <Icon size={24} />
        </div>
        <div className="flex-1">
            <h3 className={`font-bold text-sm ${checked ? 'text-slate-900' : 'text-slate-700'}`}>{label}</h3>
            {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
        </div>
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ml-2 ${checked ? `border-${color}-500 bg-${color}-500` : 'border-slate-300'}`}>
             {checked && <div className="w-2 h-2 bg-white rounded-full" />}
        </div>
    </div>
  );
};

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
const SWITCH_BRANDS = ["ARUBA", "CISCO", "3COM", "HPE", "INTELBRAS", "DELL"];
const SWITCH_PORTS = ["8", "16", "24", "48"];
const ANTENNA_BRANDS = ["ARUBA", "UNIFI"];

const Combobox = ({ options, value, onChange, placeholder, type = 'text' }: { options: string[], value: string | number, onChange: (val: string) => void, placeholder?: string, type?: string }) => {
  const [forceCustom, setForceCustom] = React.useState(false);
  const isCustom = forceCustom || (value !== '' && value !== 0 && value !== null && !options.includes(String(value)));
  const selectValue = isCustom ? 'OUTRO' : (value === 0 || value === null || value === '' ? '' : String(value));

  return (
    <div className="flex gap-2 w-full">
      <div className={isCustom ? "w-1/3" : "w-full"}>
        <StyledSelect 
          value={selectValue} 
          onChange={e => {
            if (e.target.value === 'OUTRO') {
               setForceCustom(true);
               onChange('');
            } else {
               setForceCustom(false);
               onChange(e.target.value);
            }
          }}
        >
          <option value="" disabled>Selecione...</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
          <option value="OUTRO">Outro...</option>
        </StyledSelect>
      </div>
      {isCustom && (
        <div className="min-w-0 flex-1 relative">
          <StyledInput 
             type={type} 
             autoFocus 
             placeholder={placeholder} 
             value={value === 0 ? '' : value} 
             onChange={e => {
                setForceCustom(true);
                onChange(e.target.value);
             }} 
          />
          <button 
             type="button" 
             onClick={() => { setForceCustom(false); onChange(''); }} 
             className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 font-bold text-xs p-2" 
             title="Cancelar"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
export const CpdSection = () => {
  const { 
    data, updateField, handleCpdPhotosChange, 
    addSwitch, removeSwitch, updateSwitch,
    addAntenna, removeAntenna, updateAntenna
  } = useChecklist();

  return (
    <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <SectionTitle icon={Server} title="2. CPD / Infraestrutura" />
      <div className="mb-6">
        <InputLabel>2.1 Organização dos Cabos</InputLabel>
        <div className="grid grid-cols-1 gap-3 mt-3">
            <RadioCard label="Bem Organizado" description="Cabeamento estruturado, identificado e sem emaranhados." color="green" icon={CheckCircle2} checked={data.cableCondition === 'Organizado'} onClick={() => updateField('cableCondition', 'Organizado')} />
            <RadioCard label="Parcialmente Organizado" description="Alguns cabos soltos ou sem identificação, mas funcional." color="yellow" icon={LayoutGrid} checked={data.cableCondition === 'Parcial'} onClick={() => updateField('cableCondition', 'Parcial')} />
            <RadioCard label="Desorganizado" description="Emaranhado crítico, difícil identificação ou risco de desconexão." color="red" icon={AlertCircle} checked={data.cableCondition === 'Desorganizado'} onClick={() => updateField('cableCondition', 'Desorganizado')} />
        </div>
        <div className="mt-3">
          <InputLabel htmlFor="cableNotes">Observações sobre Cabos</InputLabel>
          <textarea id="cableNotes" className="w-full p-2 border rounded-md text-sm" placeholder="Detalhes adicionais..." rows={2} value={data.cableNotes} onChange={e => updateField('cableNotes', e.target.value)} />
        </div>
        <div className="mt-4">
            <PhotoUpload photos={data.cpdPhotos} onPhotosChange={handleCpdPhotosChange} label="Fotos do CPD / Rack" />
        </div>
      </div>
      <div className="mb-6 border-t pt-4">
        <div className="flex justify-between items-center mb-3">
            <InputLabel>2.2 Switches de Rede</InputLabel>
            <button type="button" onClick={addSwitch} className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200 flex items-center gap-1 font-medium"><Plus size={14} /> Adicionar</button>
        </div>
        <div className="space-y-3">
            {data.switches.map((sw, index) => (
                <div key={sw.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200 relative group">
                    <button type="button" onClick={() => removeSwitch(sw.id)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 p-1"><Trash2 size={16} /></button>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <div><label className="text-xs text-slate-500 block mb-1">Qtd.</label><QuantitySelector value={sw.quantity} onChange={val => updateSwitch(sw.id, 'quantity', val)} /></div>
                        <div className="col-span-2"><label className="text-xs text-slate-500 block mb-1">Marca/Modelo</label><Combobox options={SWITCH_BRANDS} placeholder="Ex: CISCO" value={sw.brand} onChange={val => updateSwitch(sw.id, 'brand', val)} /></div>
                        <div><label className="text-xs text-slate-500 block mb-1">Portas</label><Combobox options={SWITCH_PORTS} type="number" placeholder="24" value={sw.ports} onChange={val => updateSwitch(sw.id, 'ports', val ? parseInt(val) : 0)} /></div>
                        <div className="col-span-2"><label className="text-xs text-slate-500 block mb-1">Condição</label><SegmentedControl value={sw.conditionOk} onChange={val => updateSwitch(sw.id, 'conditionOk', val)} options={[{ label: 'OK', value: true, color: 'text-green-600' }, { label: 'Falha', value: false, color: 'text-red-600' }]} /></div>
                    </div>
                </div>
            ))}
        </div>
      </div>
      <div className="mb-6 border-t pt-4">
        <div className="flex justify-between items-center mb-3">
            <InputLabel>2.3 Antenas Wi-Fi</InputLabel>
            <button type="button" onClick={addAntenna} className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200 flex items-center gap-1 font-medium"><Plus size={14} /> Adicionar</button>
        </div>
        <div className="space-y-3">
            {data.antennas.map((ant) => (
                <div key={ant.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200 relative group">
                    <button type="button" onClick={() => removeAntenna(ant.id)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 p-1"><Trash2 size={16} /></button>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <div><label className="text-xs text-slate-500 block mb-1">Qtd.</label><QuantitySelector value={ant.quantity} onChange={val => updateAntenna(ant.id, 'quantity', val)} /></div>
                        <div className="col-span-2"><label className="text-xs text-slate-500 block mb-1">Marca/Modelo</label><Combobox options={ANTENNA_BRANDS} placeholder="Ex: UNIFI" value={ant.brand} onChange={val => updateAntenna(ant.id, 'brand', val)} /></div>
                        <div className="col-span-3"><label className="text-xs text-slate-500 block mb-1">Local</label><StyledInput placeholder="Ex: Teto - Recepção" value={ant.location} onChange={e => updateAntenna(ant.id, 'location', e.target.value)} /></div>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </section>
  );
};


