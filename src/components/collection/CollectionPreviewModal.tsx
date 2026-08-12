import React from 'react';
import { X, Mail, Users, AlertTriangle, ChevronRight, Send } from 'lucide-react';

interface Recipient { name: string; email: string; }

interface CollectionPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  storeName: string;
  currentLevel: number;
  nextLevel: number;
  recipients: { to: Recipient[]; cc: Recipient[]; };
  loading?: boolean;
}

const LEVEL_LABELS: Record<number, { label: string; color: string; bg: string; desc: string }> = {
  0: { label: 'Não iniciado', color: 'text-slate-500', bg: 'bg-slate-100', desc: '' },
  1: { label: 'Nível 1', color: 'text-blue-700', bg: 'bg-blue-100', desc: 'Notificação inicial para Gerentes' },
  2: { label: 'Nível 2', color: 'text-yellow-700', bg: 'bg-yellow-100', desc: '1ª cobrança ao Diretor da Loja' },
  3: { label: 'Nível 3', color: 'text-orange-700', bg: 'bg-orange-100', desc: '2ª cobrança ao Diretor da Loja' },
  4: { label: 'Nível 4', color: 'text-red-700', bg: 'bg-red-100', desc: 'Escalonamento para Diretor de TI' },
};

const RecipientList: React.FC<{ title: string; recipients: Recipient[]; icon: React.ReactNode; }> = ({ title, recipients, icon }) => {
  if (recipients.length === 0) return null;
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</span>
      </div>
      <div className="space-y-1.5">
        {recipients.map((r, i) => (
          <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
              {r.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{r.name}</p>
              <p className="text-xs text-slate-400 truncate">{r.email}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const CollectionPreviewModal: React.FC<CollectionPreviewModalProps> = ({
  isOpen, onClose, onConfirm, storeName, currentLevel, nextLevel, recipients, loading,
}) => {
  if (!isOpen) return null;

  const next = LEVEL_LABELS[nextLevel] || LEVEL_LABELS[4];
  const curr = LEVEL_LABELS[currentLevel] || LEVEL_LABELS[0];
  const hasRecipients = recipients.to.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-start justify-between rounded-t-2xl">
          <div>
            <h2 className="font-bold text-slate-900 text-lg leading-tight">Confirmar Disparo</h2>
            <p className="text-sm text-slate-500 mt-0.5 truncate max-w-[320px]">{storeName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Progressão de nível */}
          <div className="flex items-center gap-3 mb-6 p-4 bg-slate-50 rounded-xl">
            <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${curr.bg} ${curr.color}`}>
              {curr.label}
            </div>
            <ChevronRight size={18} className="text-slate-400 flex-shrink-0" />
            <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${next.bg} ${next.color} ring-2 ring-offset-1 ${nextLevel >= 4 ? 'ring-red-300' : nextLevel >= 2 ? 'ring-orange-300' : 'ring-blue-300'}`}>
              {next.label}
            </div>
            <span className="text-xs text-slate-500 ml-1">{next.desc}</span>
          </div>

          {!hasRecipients ? (
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200 text-red-700 mb-4">
              <AlertTriangle size={20} className="flex-shrink-0" />
              <p className="text-sm">Nenhum destinatário encontrado. Verifique se os contatos da loja foram sincronizados.</p>
            </div>
          ) : (
            <>
              <RecipientList
                title="Para (To)"
                recipients={recipients.to}
                icon={<Mail size={14} className="text-blue-600" />}
              />
              <RecipientList
                title="Cópia (CC)"
                recipients={recipients.cc}
                icon={<Users size={14} className="text-slate-500" />}
              />
            </>
          )}

          {nextLevel === 4 && hasRecipients && (
            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-200 text-red-700 mb-4 text-sm">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span><strong>Escalonamento máximo.</strong> Este e-mail vai para o Diretor de TI. Após este nível, não há mais disparos automáticos.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!hasRecipients || loading}
            className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition
              ${nextLevel >= 4 ? 'bg-red-600 hover:bg-red-700' : nextLevel >= 2 ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}
              text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <><Send size={15} /> Confirmar Disparo</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
