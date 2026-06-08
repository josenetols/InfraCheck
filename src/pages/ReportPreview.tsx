import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Download, FileText, Mail, LayoutDashboard, Hash } from 'lucide-react';
import { useChecklist } from '../contexts/ChecklistContext';
import { getConclusion, downloadDOCX, downloadPDF, downloadTXT } from '../utils/exportService';
import { EmailModal } from '../components/EmailModal';

export const ReportPreview = ({ onEdit, onDashboard, checklistId }: { onEdit: () => void, onDashboard: () => void, checklistId?: string | null }) => {
  const { data } = useChecklist();
  const conclusion = getConclusion(data);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  const handleSendEmail = async (recipientEmail: string, subject: string, message: string) => {
    try {
      const pdfBase64 = "base64_placeholder"; 
      
      const response = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail, subject, message, pdfBase64 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao enviar e-mail');
      }
      alert('E-mail enviado com sucesso!');
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  };

  const isOnline = navigator.onLine;

  return (
    <div className="bg-white rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-blue-900 p-6 text-white flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Relatório Gerado</h1>
          <p className="opacity-80 text-sm">Verifique os dados antes de exportar</p>
        </div>
        <button onClick={onEdit} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition text-sm">Editar</button>
      </div>
      <div className="p-8 space-y-6">
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg flex items-center gap-2 mb-6">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-semibold">Checklist registrado com sucesso para o banco e localmente!</span>
        </div>

        {/* ID do Checklist */}
        {checklistId && (
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex items-center gap-2">
            <Hash className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wide">ID do Checklist:</span>
            <code className="text-xs text-blue-700 font-mono bg-blue-50 px-2 py-1 rounded">{checklistId}</code>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
           <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="font-bold text-slate-700 mb-2">Informações</h3>
              <p><span className="font-semibold">Local:</span> {data.locationName}</p>
              <p><span className="font-semibold text-blue-700">Técnico:</span> {data.technicianName}</p>
              {data.visitDate && (
                <p><span className="font-semibold">Data:</span> {new Date(data.visitDate).toLocaleDateString('pt-BR')}</p>
              )}
           </div>
           <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="font-bold text-slate-700 mb-2">Resumo Status</h3>
              <p className="flex items-center gap-2">
                <span className="font-semibold">Máquinas:</span> 
                {data.allMachinesOk ? <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={16}/> OK</span> : <span className="text-red-600 flex items-center gap-1"><AlertCircle size={16}/> Problemas</span>}
              </p>
              <p className="flex items-center gap-2 mt-1">
                <span className="font-semibold">Rede:</span> 
                {data.networkPointsOk ? <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={16}/> OK</span> : <span className="text-red-600 flex items-center gap-1"><AlertCircle size={16}/> Problemas</span>}
              </p>
           </div>
        </div>
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg">
            <h3 className="font-bold text-blue-900 mb-2">Conclusão Gerada</h3>
            <p className="text-slate-800 text-sm leading-relaxed">{conclusion}</p>
        </div>
        <div className="border-t pt-6">
            <h3 className="text-lg font-bold mb-4">Exportar Relatório</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <button onClick={async () => { await downloadPDF(data, checklistId || undefined); }} className="flex items-center justify-center gap-2 bg-red-600 text-white p-4 rounded-lg hover:bg-red-700 transition shadow-sm font-semibold"><Download size={20} /> Baixar PDF</button>
              <button 
                onClick={() => setIsEmailModalOpen(true)} 
                disabled={!isOnline}
                className="flex items-center justify-center gap-2 bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 transition shadow-sm font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed"
                title={!isOnline ? "Envio de e-mail disponível apenas online." : "Enviar relatório por e-mail"}
              >
                <Mail size={20} /> {isOnline ? "Enviar por E-mail" : "Offline"}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={async () => { await downloadDOCX(data); }} className="flex items-center justify-center gap-2 bg-blue-700 text-white p-4 rounded-lg hover:bg-blue-800 transition shadow-sm font-semibold"><FileText size={20} /> Baixar Word</button>
              <button onClick={() => downloadTXT(data)} className="flex items-center justify-center gap-2 bg-slate-700 text-white p-4 rounded-lg hover:bg-slate-800 transition shadow-sm font-semibold"><FileText size={20} /> Baixar TXT</button>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-200">
                <button onClick={onDashboard} className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white hover:bg-slate-900 font-bold p-4 rounded-lg transition-all"><LayoutDashboard size={20} /> Voltar para o Painel</button>
            </div>
        </div>
      </div>
      
      <EmailModal 
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onSend={handleSendEmail}
        defaultSubject={`Relatório de Checklist - ${data.locationName}`}
      />
    </div>
  );
};
