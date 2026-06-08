import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'red' | 'yellow' | 'slate';
}

const colorMap = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700 font-bold',
  green: 'bg-green-50 border-green-200 text-green-700 font-bold',
  red: 'bg-red-50 border-red-200 text-red-700 font-bold',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700 font-bold',
  slate: 'bg-white border-slate-200 text-slate-800 font-bold'
};

const iconColorMap = {
  blue: 'text-blue-500',
  green: 'text-green-500',
  red: 'text-red-500',
  yellow: 'text-yellow-500',
  slate: 'text-slate-400'
};

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, color }) => {
  return (
    <div className={`p-4 rounded-xl border shadow-sm flex flex-col justify-center transition-all hover:shadow-md ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`${color === 'slate' ? 'text-slate-500' : ''} text-xs uppercase font-bold`}>{label}</span>
        <Icon className={`w-4 h-4 ${iconColorMap[color]}`} />
      </div>
      <span className="text-2xl font-bold">{value}</span>
    </div>
  );
};
