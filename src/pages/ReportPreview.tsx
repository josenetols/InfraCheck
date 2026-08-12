import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Download, FileText, Mail, LayoutDashboard, Hash, Copy, Check } from 'lucide-react';
import { useChecklist } from '../contexts/ChecklistContext';
import { getConclusion, downloadDOCX, downloadPDF, downloadTXT } from '../utils/exportService';
import { EmailModal } from '../components/EmailModal';

/** Copia texto para a área de transferência com fallback para HTTP (sem HTTPS) */
const copyToClipboard = (text: string): Promise<void> => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback: cria um textarea temporário e usa execCommand
  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      resolve();
    } catch (err) {
      document.body.removeChild(textarea);
      reject(err);
    }
  });
};

export const ReportPreview = ({ onEdit, onDashboard, checklistId }: { onEdit: () => void, onDashboard: () => void, checklistId?: string | null }) => {
  const { data } = useChecklist();
  const conclusion = getConclusion(data);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyToClipboard(conclusion)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); })
      .catch(() => alert('Não foi possível copiar. Selecione o texto manualmente.'));
  };

  /** Converte um File/Blob para base64 string (sem o prefixo data:...) */
  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] ?? '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  /** Converte array de fotos: substitui blob/previewUrl por base64 ou passa URL do Supabase */
  const serializePhotos = async (photos: any[]): Promise<any[]> => {
    if (!photos?.length) return [];
    return Promise.all(photos.map(async (p) => {
      try {
        // 1. Se ainda tem blob em memória (foto recém-tirada, não salva ainda)
        if (p.blob instanceof Blob) {
          const base64 = await blobToBase64(p.blob);
          return {
            id: p.id,
            filename: p.filename,
            mimeType: p.mimeType || 'image/jpeg',
            base64,
          };
        }
        // 2. Se já tem base64 salvo
        if (p.base64) {
          return {
            id: p.id,
            filename: p.filename,
            mimeType: p.mimeType || 'image/jpeg',
            base64: p.base64,
          };
        }
        // 3. Foto já foi enviada ao Supabase Storage — passa a URL pública
        // O backend vai baixar e embutir no e-mail via CID
        const url = p.url || (p.previewUrl && !p.previewUrl.startsWith('blob:') ? p.previewUrl : null);
        return {
          id: p.id,
          filename: p.filename || 'foto.jpg',
          mimeType: p.mimeType || 'image/jpeg',
          url,
        };
      } catch {
        return { id: p.id, filename: p.filename, mimeType: p.mimeType };
      }
    }));
  };

  const handleSendEmail = async (recipientEmail: string, subject: string, message: string, rawData: any) => {
    try {
      // Serializa fotos para base64 antes de enviar (blob URLs não funcionam em emails)
      const emailData = {
        ...rawData,
        cpdPhotos: await serializePhotos(rawData.cpdPhotos || []),
        problematicMachines: rawData.problematicMachines
          ? await Promise.all(rawData.problematicMachines.map(async (m: any) => ({
              ...m,
              photos: await serializePhotos(m.photos || []),
            })))
          : [],
        problematicNetworkPoints: rawData.problematicNetworkPoints
          ? await Promise.all(rawData.problematicNetworkPoints.map(async (np: any) => ({
              ...np,
              photos: await serializePhotos(np.photos || []),
            })))
          : [],
      };

      const response = await fetch('/api/email/send-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('infracheck_auth_token')}`
        },
        body: JSON.stringify({ recipientEmail, subject, message, data: emailData }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao enviar e-mail');
      }
      alert('E-mail enviado com sucesso! ✅');
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
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-blue-900">Texto para E-mail</h3>
              <button
                type="button"
                onClick={handleCopy}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition font-medium ${
                  copied ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {copied ? <><Check size={13}/> Copiado!</> : <><Copy size={13}/> Copiar</>}
              </button>
            </div>
            <pre className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-sans">{conclusion}</pre>
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
        defaultMessage={conclusion}
        data={data}
      />
    </div>
  );
};
