import React, { useState } from 'react';
import { Server, LayoutDashboard, ClipboardList, User } from 'lucide-react';

import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { SetPassword } from './pages/SetPassword';
import { Admin } from './pages/Admin';
import { ReportPreview } from './pages/ReportPreview';

import { ChecklistProvider, useChecklist } from './contexts/ChecklistContext';
import { LocalInfoSection } from './components/checklist/LocalInfoSection';
import { CpdSection } from './components/checklist/CpdSection';
import { MachinesSection } from './components/checklist/MachinesSection';
import { NetworkPointsSection } from './components/checklist/NetworkPointsSection';
import { FinalizationSection } from './components/checklist/FinalizationSection';
import { MonthlyReviewModal } from './components/checklist/MonthlyReviewModal';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useChecklistFlow } from './hooks/useChecklistFlow';

const ChecklistForm = ({ onGenerateReport }: { onGenerateReport: () => void }) => {
  return (
    <div className="space-y-6">
      <LocalInfoSection />
      <CpdSection />
      <MachinesSection />
      <NetworkPointsSection />
      <FinalizationSection onGenerateReport={onGenerateReport} />
    </div>
  );
};

function AppContent() {
  const { data, setData } = useChecklist();
  const {
    view, setView,
    monthlyReview,
    savedChecklistId,
    startChecklistFromDashboard,
    applyMonthlyReview,
    skipMonthlyReview,
    handleGenerateReport,
    loadChecklistForReport,
  } = useChecklistFlow(data, setData);
  const { user, isAdmin, loading, logout, firstLogin } = useAuth();

  if (loading) return null;

  // Primeiro acesso — redirecionar para definição de senha
  if (firstLogin) {
    return <SetPassword userId={firstLogin.userId} userName={firstLogin.name} />;
  }

  if (!user) {
    return <Login />;
  }

  const renderContent = () => {
    if (view === 'admin' && isAdmin) return <Admin />;
    if (view === 'dashboard') return <Dashboard onStartChecklist={startChecklistFromDashboard} onLoadReport={loadChecklistForReport} />;
    if (view === 'preview') return <ReportPreview onEdit={() => setView('form')} onDashboard={() => setView('dashboard')} checklistId={savedChecklistId} />;
    return <ChecklistForm onGenerateReport={handleGenerateReport} />;
  };

  // Dinamic max-width: dashboard/admin need more space (7xl) than the form (3xl)
  const isWideScreen = view === 'dashboard' || view === 'admin';
  const containerClass = `mx-auto px-4 py-6 transition-all duration-300 w-full ${isWideScreen ? 'max-w-7xl' : 'max-w-3xl'}`;

  return (
    <div className="min-h-screen bg-slate-100 pb-20">
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className={`mx-auto px-4 py-3 flex flex-col gap-3 transition-all duration-300 w-full ${isWideScreen ? 'max-w-7xl' : 'max-w-3xl'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-900">
                <Server className="w-8 h-8" />
                <div>
                    <h1 className="font-bold text-lg leading-tight">InfraCheck BR</h1>
                    <p className="text-xs text-slate-500">Checklist Mensal</p>
                </div>
            </div>
            <div className="text-right hidden sm:flex items-center gap-4">
                <div>
                  <p className="text-xs text-slate-400">Técnico Ativo</p>
                  <p className="text-sm font-bold text-blue-900">{user.name}</p>
                </div>
                <button onClick={logout} className="text-xs bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 px-3 py-2 rounded-lg font-bold transition-all">
                  Sair
                </button>
            </div>
          </div>
          <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
              <button onClick={() => setView('dashboard')} className={`flex-1 flex min-w-[140px] items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-bold transition-all ${view === 'dashboard' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}><LayoutDashboard size={18} /> Painel Mensal</button>
              <button onClick={() => setView('form')} className={`flex-1 flex min-w-[140px] items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-bold transition-all ${view === 'form' || view === 'preview' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}><ClipboardList size={18} /> Novo Checklist</button>
              {isAdmin && (
                  <button onClick={() => setView('admin')} className={`flex-1 flex min-w-[140px] items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-bold transition-all ${view === 'admin' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}><User size={18} /> Equipe / Admin</button>
              )}
          </div>
        </div>
      </header>

      <main className={containerClass}>
        {renderContent()}
      </main>

      {/* Modal de Revisão Mensal — aparece sobre qualquer view */}
      {monthlyReview && (
        <MonthlyReviewModal
          locationName={monthlyReview.locationName}
          previousData={monthlyReview.previousData}
          previousMonth={monthlyReview.previousMonth}
          onComplete={applyMonthlyReview}
          onSkip={skipMonthlyReview}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ChecklistProvider>
        <AppContent />
      </ChecklistProvider>
    </AuthProvider>
  );
}

export default App;
