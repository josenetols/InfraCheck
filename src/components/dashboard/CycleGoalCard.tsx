import React, { useEffect, useState } from 'react';
import { Target, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { goalService } from '../../services/goalService';
import { useAuth } from '../../contexts/AuthContext';

export const CycleGoalCard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      goalService.getCurrentCycleGoal(user.id)
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (loading) return <div className="animate-pulse bg-slate-100 h-32 rounded-2xl mb-8"></div>;
  if (!data) return null;

  const { cycle_goal, monthly_goals, year, cycle } = data;

  const renderMonth = (pos: number) => {
    const mg = monthly_goals?.find((m: any) => m.position_in_cycle === pos);
    if (!mg) {
      return (
        <div className="flex flex-col items-center">
          <span className="text-xs font-bold text-slate-400">Mês {pos}</span>
          <span className="text-lg font-bold text-slate-300">-</span>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center">
        <span className="text-xs font-bold text-slate-500">Mês {pos}</span>
        <span className={`text-lg font-bold ${mg.percentage >= 100 ? 'text-green-600' : 'text-slate-700'}`}>
          {mg.percentage}%
        </span>
        <span className="text-[10px] text-slate-400">{mg.completed_checklists}/{mg.expected_checklists}</span>
      </div>
    );
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-600" />
            Meta do Ciclo Atual
          </h2>
          <p className="text-sm text-slate-500 font-medium">Ciclo {cycle} - {year}</p>
        </div>
        
        {cycle_goal && (
          <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 ${
            cycle_goal.status === 'META ATINGIDA' 
              ? 'bg-green-50 border-green-200 text-green-700' 
              : 'bg-yellow-50 border-yellow-200 text-yellow-700'
          }`}>
            {cycle_goal.status === 'META ATINGIDA' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <div>
              <span className="block text-[10px] font-bold uppercase opacity-80">Resultado</span>
              <span className="block font-extrabold text-lg leading-none">{Number(cycle_goal.average_percentage).toFixed(2)}%</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 divide-x divide-slate-100 bg-slate-50 rounded-xl p-4 border border-slate-100">
        {renderMonth(1)}
        {renderMonth(2)}
        {renderMonth(3)}
        <div className="flex flex-col items-center justify-center">
          <span className="text-xs font-bold text-slate-400 mb-1">Mês 4</span>
          <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-1 rounded font-bold uppercase">Fechamento</span>
        </div>
      </div>
    </div>
  );
};
