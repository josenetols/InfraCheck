import React, { useState } from 'react';
import {
  CheckCircle2, XCircle, ChevronRight, ChevronLeft,
  Server, Monitor, Network, Wifi, ShieldCheck, Users, Cable
} from 'lucide-react';
import { ChecklistData } from '../../types';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ReviewQuestion {
  id: string;
  icon: React.ElementType;
  title: string;
  question: string;
  detail: (data: ChecklistData) => string | null;
}

interface MonthlyReviewModalProps {
  locationName: string;
  previousData: ChecklistData;
  previousMonth: string; // ex: "março de 2026"
  onComplete: (confirmedData: Partial<ChecklistData>, skippedFields: string[]) => void;
  onSkip: () => void;
}

// ─── Perguntas de revisão ─────────────────────────────────────────────────────

const REVIEW_QUESTIONS: ReviewQuestion[] = [
  {
    id: 'cpdOrganization',
    icon: Cable,
    title: 'Organização do CPD',
    question: 'O CPD ainda está organizado da mesma forma?',
    detail: (d) => {
      const map: Record<string, string> = {
        Organizado: 'Bem Organizado',
        Parcial: 'Parcialmente Organizado',
        Desorganizado: 'Desorganizado',
      };
      return `Condição anterior: ${map[d.cableCondition] ?? d.cableCondition}`;
    },
  },
  {
    id: 'switches',
    icon: Server,
    title: 'Switches de Rede',
    question: 'O CPD ainda possui os mesmos switches de rede?',
    detail: (d) =>
      d.switches.length > 0
        ? `${d.switches.length} switch(es) cadastrado(s): ${d.switches.map(s => s.brand || 'Sem marca').join(', ')}`
        : 'Nenhum switch cadastrado anteriormente.',
  },
  {
    id: 'antennas',
    icon: Wifi,
    title: 'Antenas Wi-Fi',
    question: 'As antenas Wi-Fi ainda são as mesmas?',
    detail: (d) =>
      d.antennas.length > 0
        ? `${d.antennas.length} antena(s): ${d.antennas.map(a => a.brand || 'Sem marca').join(', ')}`
        : 'Nenhuma antena cadastrada anteriormente.',
  },

  {
    id: 'machines',
    icon: Monitor,
    title: 'Máquinas e Usuários',
    question: 'As máquinas continuam sem problemas?',
    detail: (d) =>
      d.allMachinesOk
        ? 'Todas as máquinas estavam OK no mês anterior.'
        : `${d.problematicMachines.length} máquina(s) com problema cadastradas.`,
  },
  {
    id: 'networkPoints',
    icon: Network,
    title: 'Pontos de Rede',
    question: 'Os pontos de rede continuam funcionando?',
    detail: (d) =>
      d.networkPointsOk
        ? 'Todos os pontos de rede estavam OK.'
        : `${d.problematicNetworkPoints.length} ponto(s) com deflto cadastrados.`,
  },
  {
    id: 'satisfaction',
    icon: Users,
    title: 'Satisfação dos Funcionários',
    question: 'Os funcionários continuam satisfeitos com a infraestrutura?',
    detail: (d) =>
      d.employeesSatisfied
        ? 'Funcionários satisfeitos no mês anterior.'
        : `Havia reclamações: ${d.complaints || 'sem detalhes'}`,
  },
];

// ─── Mapeamento de campos confirmados ────────────────────────────────────────

function buildConfirmedData(
  previousData: ChecklistData,
  answers: Record<string, boolean>
): { confirmed: Partial<ChecklistData>; skipped: string[] } {
  const confirmed: Partial<ChecklistData> = {};
  const skipped: string[] = [];

  if (answers['cpdOrganization']) {
    confirmed.cableCondition = previousData.cableCondition;
    confirmed.cableNotes = previousData.cableNotes;
    confirmed.cpdPhotos = previousData.cpdPhotos;
  } else {
    skipped.push('cpdOrganization');
  }

  if (answers['switches']) {
    confirmed.switches = previousData.switches.map(s => ({ ...s, status: 'unchanged' as const }));
  } else {
    confirmed.switches = [];
    skipped.push('switches');
  }

  if (answers['antennas']) {
    confirmed.antennas = previousData.antennas.map(a => ({ ...a, status: 'unchanged' as const }));
  } else {
    confirmed.antennas = [];
    skipped.push('antennas');
  }



  if (answers['machines']) {
    confirmed.allMachinesOk = previousData.allMachinesOk;
    // Preservar lista completa de máquinas problemáticas incluindo fotos
    confirmed.problematicMachines = (previousData.problematicMachines || []).map(m => ({
      ...m,
      status: 'unchanged' as const,
    }));
  } else {
    confirmed.allMachinesOk = true;
    confirmed.problematicMachines = [];
    skipped.push('machines');
  }

  if (answers['networkPoints']) {
    confirmed.networkPointsOk = previousData.networkPointsOk;
    confirmed.networkPointsNotes = previousData.networkPointsNotes;
    // Preservar lista completa de pontos problemáticos incluindo fotos
    confirmed.problematicNetworkPoints = (previousData.problematicNetworkPoints || []).map(p => ({
      ...p,
      status: 'unchanged' as const,
    }));
  } else {
    confirmed.networkPointsOk = true;
    confirmed.networkPointsNotes = '';
    confirmed.problematicNetworkPoints = [];
    skipped.push('networkPoints');
  }

  if (answers['satisfaction']) {
    confirmed.employeesSatisfied = previousData.employeesSatisfied;
    confirmed.complaints = previousData.complaints;
  } else {
    skipped.push('satisfaction');
  }

  return { confirmed, skipped };
}

// ─── Componente principal ─────────────────────────────────────────────────────

export const MonthlyReviewModal: React.FC<MonthlyReviewModalProps> = ({
  locationName,
  previousData,
  previousMonth,
  onComplete,
  onSkip,
}) => {
  const [step, setStep] = useState<'intro' | 'questions' | 'done'>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});

  const currentQuestion = REVIEW_QUESTIONS[currentIndex];
  const progress = ((currentIndex) / REVIEW_QUESTIONS.length) * 100;

  const handleAnswer = (answer: boolean) => {
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);

    if (currentIndex < REVIEW_QUESTIONS.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Todas as perguntas respondidas
      const { confirmed, skipped } = buildConfirmedData(previousData, newAnswers);
      setStep('done');
      setTimeout(() => onComplete(confirmed, skipped), 800);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else {
      setStep('intro');
    }
  };

  // ── Tela intro ──
  if (step === 'intro') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-8 text-white text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-extrabold mb-2">Revisão Mensal</h2>
            <p className="text-blue-100 text-sm">
              Existe um checklist de <strong>{previousMonth}</strong> para:
            </p>
            <p className="font-bold text-lg mt-1">{locationName}</p>
          </div>

          <div className="p-8">
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              Vamos verificar campo a campo se as informações do mês anterior ainda são válidas.
              Você poderá confirmar ou editar cada item individualmente.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setStep('questions'); setCurrentIndex(0); }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                <ChevronRight className="w-5 h-5" />
                Iniciar Revisão ({REVIEW_QUESTIONS.length} campos)
              </button>
              <button
                onClick={onSkip}
                className="w-full text-slate-500 hover:text-slate-700 font-medium py-2 text-sm transition-colors"
              >
                Ignorar e preencher do zero
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Tela concluída ──
  if (step === 'done') {
    const confirmedCount = Object.values(answers).filter(Boolean).length;
    const editCount = REVIEW_QUESTIONS.length - confirmedCount;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl text-center p-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-extrabold text-slate-800 mb-2">Revisão Concluída!</h3>
          <p className="text-slate-500 text-sm">
            <span className="font-bold text-green-600">{confirmedCount} campo(s)</span> confirmado(s) •{' '}
            <span className="font-bold text-orange-600">{editCount} campo(s)</span> para editar
          </p>
          <p className="text-slate-400 text-xs mt-2">Carregando formulário...</p>
        </div>
      </div>
    );
  }

  // ── Tela de perguntas ──
  const Icon = currentQuestion.icon;
  const detail = currentQuestion.detail(previousData);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">

        {/* Header com progresso */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-blue-100 text-xs font-bold uppercase tracking-widest">
              Revisão Mensal — {locationName}
            </span>
            <span className="text-white text-xs font-bold">
              {currentIndex + 1} / {REVIEW_QUESTIONS.length}
            </span>
          </div>
          <div className="w-full bg-blue-800/40 rounded-full h-2">
            <div
              className="bg-white h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Conteúdo da pergunta */}
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Icon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">{currentQuestion.title}</p>
              <h3 className="text-lg font-extrabold text-slate-800 leading-tight mt-0.5">
                {currentQuestion.question}
              </h3>
            </div>
          </div>

          {detail && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Mês anterior ({previousMonth})</p>
              <p className="text-sm text-slate-700 font-medium">{detail}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleAnswer(true)}
              className="flex flex-col items-center gap-2 p-4 bg-green-50 border-2 border-green-200 hover:border-green-500 hover:bg-green-100 rounded-xl transition-all group"
            >
              <CheckCircle2 className="w-8 h-8 text-green-500 group-hover:scale-110 transition-transform" />
              <span className="font-bold text-green-700 text-sm">Sim, continua igual</span>
              <span className="text-xs text-green-500">Manter dados anteriores</span>
            </button>

            <button
              onClick={() => handleAnswer(false)}
              className="flex flex-col items-center gap-2 p-4 bg-orange-50 border-2 border-orange-200 hover:border-orange-500 hover:bg-orange-100 rounded-xl transition-all group"
            >
              <XCircle className="w-8 h-8 text-orange-500 group-hover:scale-110 transition-transform" />
              <span className="font-bold text-orange-700 text-sm">Não, preciso editar</span>
              <span className="text-xs text-orange-500">Deixar em branco</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-100 px-8 py-4 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </button>
          <button
            onClick={onSkip}
            className="text-slate-400 hover:text-red-500 text-xs font-medium transition-colors"
          >
            Cancelar revisão
          </button>
        </div>
      </div>
    </div>
  );
};
