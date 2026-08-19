import { useState } from 'react';
import { ChecklistData, initialChecklistState, SwitchDevice, AntennaDevice } from '../types';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';

export interface MonthlyReviewState {
  locationName: string;
  previousData: ChecklistData;
  previousMonth: string;
}

export const useChecklistFlow = (data: ChecklistData, setData: React.Dispatch<React.SetStateAction<ChecklistData>>) => {
  const { user } = useAuth();
  const [view, setView] = useState<'dashboard' | 'form' | 'preview' | 'admin' | 'history'>('dashboard');
  const [flowLoading, setFlowLoading] = useState(false);
  const [monthlyReview, setMonthlyReview] = useState<MonthlyReviewState | null>(null);
  const [savedChecklistId, setSavedChecklistId] = useState<string | null>(null);

  /** Formata uma data ISO para "mês de ano" em pt-BR */
  const formatMonth = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const saveChecklistData = async (location: string, dataToSave?: ChecklistData) => {
    if (!location) return;
    try {
      const id = await apiService.saveChecklist(dataToSave || data);
      setSavedChecklistId(id);
      return id;
    } catch (e: any) {
      console.error('Failed to save history', e);
      alert(e.message || 'Erro ao salvar dados. Verifique o console.');
    }
  };

  const startChecklistFromDashboard = async (location?: string) => {
    setFlowLoading(true);
    setSavedChecklistId(null);
    try {
      const technicianName = user?.name ?? '';

      if (location) {
        // 1. Buscar histórico do mês anterior via nova rota
        const history = await apiService.getChecklistHistory(location);

        if (history.found && history.data) {
          // Existe checklist de mês anterior → acionar revisão mensal
          setMonthlyReview({
            locationName: location,
            previousData: history.data,
            previousMonth: history.visitDate ? formatMonth(history.visitDate) : 'mês anterior',
          });
          // Pré-preenche apenas os campos de controle; o modal vai completar o restante
          setData({
            ...initialChecklistState,
            locationName: location,
            visitDate: new Date().toISOString(),
            technicianName,
          });
        } else {
          // Nenhum histórico disponível — formulário em branco
          setData({
            ...initialChecklistState,
            locationName: location,
            visitDate: new Date().toISOString(),
            technicianName,
          });
          setView('form');
          window.scrollTo(0, 0);
        }
      } else {
        setData({ ...initialChecklistState, visitDate: new Date().toISOString(), technicianName });
        setView('form');
        window.scrollTo(0, 0);
      }
    } catch (error) {
      console.error('Error loading history:', error);
      // Em caso de erro, iniciar formulário limpo
      setData({
        ...initialChecklistState,
        locationName: location ?? '',
        visitDate: new Date().toISOString(),
        technicianName: user?.name ?? '',
      });
      setView('form');
      window.scrollTo(0, 0);
    } finally {
      setFlowLoading(false);
    }
  };

  /**
   * Chamado pelo MonthlyReviewModal quando o técnico conclui a revisão.
   * Mescla os campos confirmados com o estado atual e abre o formulário.
   */
  const applyMonthlyReview = (
    confirmedData: Partial<ChecklistData>,
    _skippedFields: string[]
  ) => {
    setData(prev => ({
      ...prev,
      ...confirmedData,
    }));
    setMonthlyReview(null);
    setView('form');
    window.scrollTo(0, 0);
  };

  /**
   * Chamado quando o técnico escolhe ignorar a revisão e preencher do zero.
   */
  const skipMonthlyReview = () => {
    setMonthlyReview(null);
    setView('form');
    window.scrollTo(0, 0);
  };

  const handleGenerateReport = async () => {
    if (!data.locationName || !data.technicianName) {
      alert('Preencha o Nome do Local e do Técnico para continuar.');
      return;
    }
    setFlowLoading(true);
    const finalData = { ...data, isBaseline: true };
    const id = await saveChecklistData(data.locationName, finalData);
    if (id) {
      await loadChecklistForReport(id);
    } else {
      setView('preview');
      window.scrollTo(0, 0);
      setFlowLoading(false);
    }
  };

  /**
   * Carrega um checklist salvo no banco pelo ID e abre o ReportPreview.
   * Usado pelo ChecklistHistoryModal → "Ver Relatório".
   */
  const loadChecklistForReport = async (checklistId: string) => {
    setFlowLoading(true);
    try {
      const res = await fetch(`/api/checklists/${checklistId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('infracheck_auth_token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error('Checklist não encontrado');
      const record = await res.json();
      const raw = record.data as ChecklistData;

      // Restaurar fotos base64 para preview
      const restored: ChecklistData = {
        ...raw,
        cpdPhotos: (raw.cpdPhotos || []).map((p: any) => {
          if (p.url && !p.previewUrl) p.previewUrl = p.url;
          if (p.base64 && !p.previewUrl) return { ...p, previewUrl: p.base64.startsWith('data:') ? p.base64 : `data:image/jpeg;base64,${p.base64}` };
          return p;
        }),
        problematicMachines: (raw.problematicMachines || []).map((m: any) => ({
          ...m,
          photos: (m.photos || []).map((p: any) => {
            if (p.url && !p.previewUrl) p.previewUrl = p.url;
            if (p.base64 && !p.previewUrl) return { ...p, previewUrl: p.base64.startsWith('data:') ? p.base64 : `data:image/jpeg;base64,${p.base64}` };
            return p;
          })
        })),
        problematicNetworkPoints: (raw.problematicNetworkPoints || []).map((np: any) => ({
          ...np,
          photos: (np.photos || []).map((p: any) => {
            if (p.url && !p.previewUrl) p.previewUrl = p.url;
            if (p.base64 && !p.previewUrl) return { ...p, previewUrl: p.base64.startsWith('data:') ? p.base64 : `data:image/jpeg;base64,${p.base64}` };
            return p;
          })
        })),
      };

      setData(restored);
      setSavedChecklistId(checklistId);
      setView('preview');
      window.scrollTo(0, 0);
    } catch (err) {
      console.error('Erro ao carregar checklist:', err);
      alert('Não foi possível carregar o relatório deste checklist.');
    } finally {
      setFlowLoading(false);
    }
  };

  return {
    view, setView,
    flowLoading,
    monthlyReview,
    savedChecklistId,
    startChecklistFromDashboard,
    applyMonthlyReview,
    skipMonthlyReview,
    handleGenerateReport,
    loadChecklistForReport,
  };
};

