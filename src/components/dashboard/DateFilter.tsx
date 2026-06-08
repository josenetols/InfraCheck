import React from 'react';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface DateFilterProps {
  startDate: Date;
  endDate: Date;
  onChange: (start: Date, end: Date) => void;
}

export const DateFilter: React.FC<DateFilterProps> = ({ startDate, endDate, onChange }) => {
  return (
    <div className="flex flex-col md:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <Calendar className="w-5 h-5" />
        <span className="text-sm font-bold">Período:</span>
      </div>
      <div className="flex items-center gap-2">
        <input 
          type="date" 
          className="p-2 text-sm rounded-lg border border-slate-200 focus:border-blue-500 outline-none"
          value={format(startDate, 'yyyy-MM-dd')}
          onChange={(e) => onChange(new Date(e.target.value), endDate)}
        />
        <span className="text-slate-400">até</span>
        <input 
          type="date" 
          className="p-2 text-sm rounded-lg border border-slate-200 focus:border-blue-500 outline-none"
          value={format(endDate, 'yyyy-MM-dd')}
          onChange={(e) => onChange(startDate, new Date(e.target.value))}
        />
      </div>
    </div>
  );
};
