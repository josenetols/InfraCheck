import { useState, useEffect, useMemo, useCallback } from 'react';
import { subDays, format, parseISO } from 'date-fns';
import { LocationStatus, StatusFilter } from '../types';
import { getChecklistStatus } from '../utils/checklistStatus';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { userService } from '../services/userService';
import { StatusDistributionRow } from '../types/api';

export const useDashboardData = () => {
  const { user, isAdmin } = useAuth();

  // ── Estado Operacional ────────────────────────────────────────────────────
  const [locations, setLocations] = useState<LocationStatus[]>([]);
  const [regionTechs, setRegionTechs] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [locationRegionMap, setLocationRegionMap] = useState<Record<string, string>>({});
  
  // ── Estado de Loading ─────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);

  // ── BI / Gráficos ─────────────────────────────────────────────────────────
  const [biStats, setBiStats] = useState({ total: 0, completed: 0, pending: 0, averagePerPeriod: '0' });
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<StatusDistributionRow[]>([]);

  const [technicianReport, setTechnicianReport] = useState<any[]>([]);

  // ── Filtros de UI ─────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [techFilter, setTechFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  // ── Período de BI ─────────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState(() => subDays(new Date(), 30));
  const [endDate, setEndDate] = useState(() => new Date());

  // ── Carregamento de Dados ─────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // 1. Fetching em paralelo
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // Técnicos não têm acesso a /api/users (requireAdmin)
      // Buscamos a lista de usuários apenas para admins
      const usersFetch = isAdmin ? userService.getUsers() : Promise.resolve([]);

      const [
        dbChecklists,
        statsResult,
        statusDistData,
        dbLocations,
        allTechs,
        dbRegions,
        assignments
      ] = await Promise.all([
        apiService.getAllChecklists(),
        apiService.getStats(startDate, endDate),
        apiService.getStatusDistribution(),
        apiService.getLocations(),
        usersFetch,
        apiService.getRegions(),
        apiService.getAssignments(currentMonth)
      ]);


      // 2. Mapas e Filtros Básicos
      const regionMap: Record<string, string> = {};
      dbLocations.forEach((l) => { regionMap[l.name] = l.region; });
      setLocationRegionMap(regionMap);
      setAvailableRegions(dbRegions);

      const availableTechs = (isAdmin || !user.region)
        ? allTechs.filter((u) => u.active).map((u) => u.name)
        : allTechs.filter((u) => u.active && u.region_name === user.region).map((u) => u.name);
      setRegionTechs(availableTechs);

      const locationNamesToProcess = dbLocations.map((l: any) => l.name);

      // 3. Processamento do Grid de Lojas
      const processed: LocationStatus[] = dbLocations.map((loc: any) => {
        const { name } = loc;
        const lastCheckDate = loc.lastCheckDate || null;
        const technician = loc.lastCheckTechnician || null;
        const { isValid, isWarning, daysRemaining } = getChecklistStatus(lastCheckDate);

        return {
          name,
          lastCheckDate,
          lastCheckId: loc.lastCheckId || null,
          technician,
          assignedTechnician: assignments[name] || 'Não atribuído', // Agora obrigatório pelo Tipo
          isValid,
          isWarning,
          daysRemaining,
          region: regionMap[name] || user.region || 'Desconhecida',
        };
      });

      const techRegionMap: Record<string, string> = {};
      allTechs.forEach((u: any) => { techRegionMap[u.name] = u.region_name; });

      // Base: todos os técnicos ativos
      const baseReport = allTechs
        .filter((u: any) => u.role === 'technician' && u.active)
        .map((u: any) => {
          const stats = (statsResult.technicianReport || []).find((r: any) => r.technician === u.name);
          return {
            technician: u.name,
            attributed: stats?.attributed || 0,
            completed: stats?.completed || 0,
            region: u.region_name || 'Desconhecida'
          };
        });

      // Incluir inativos caso tenham checklists realizados no período
      (statsResult.technicianReport || []).forEach((stats: any) => {
         if (!baseReport.some((r: any) => r.technician === stats.technician)) {
             baseReport.push({
               technician: stats.technician,
               attributed: stats.attributed || 0,
               completed: stats.completed || 0,
               region: techRegionMap[stats.technician] || 'Desconhecida'
             });
         }
      });

      setLocations(processed);
      setBiStats(statsResult.summary);
      setDailyData(statsResult.daily);
      setPieData(statusDistData);
      setTechnicianReport(baseReport);

    } catch (err) {
      console.error("Erro ao carregar dados do Dashboard via API:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, isAdmin, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Ações ─────────────────────────────────────────────────────────────────

  const regenerateDistribution = useCallback(async (selectedTechnicians?: string[], targetRegion?: string) => {
    if (!isAdmin) return;
    setIsLoading(true);
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      // Se targetRegion foi informado, use-o; senão, se regionFilter != 'all', use-o;
      // senão, se user.region existir (admin restrito), use-o; senão, undefined.
      let regionToRegenerate = targetRegion;
      if (!regionToRegenerate) {
        regionToRegenerate = regionFilter !== 'all' ? regionFilter : (user?.region ? user.region : undefined);
      }
      await apiService.regenerateAssignments(currentMonth, regionToRegenerate, selectedTechnicians);
      // Recarrega todos os dados para refletir a nova distribuição
      await loadData();
    } catch (err) {
      console.error('Erro ao regenerar distribuição:', err);
      alert('Falha ao regenerar distribuição. Acesso restrito a administradores.');
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, user?.region, regionFilter, loadData]);

  // ── Filtragem de Lojas (Client-side) ──────────────────────────────────────

  const filteredLocations = useMemo(() => {
    return locations.filter(loc => {
      // Filtragem por 'Minha Rota' já é garantida pelo backend para os técnicos,
      // mas mantemos aqui para UI admin testando a funcionalidade.
      if (showOnlyMine && user?.name && loc.assignedTechnician !== user.name) return false;
      if (techFilter !== 'all' && loc.assignedTechnician !== techFilter) return false;

      const locRegion = loc.region ?? locationRegionMap[loc.name] ?? user?.region;
      if (isAdmin && regionFilter !== 'all' && locRegion !== regionFilter) return false;

      if (!loc.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

      if (statusFilter === 'valid') return loc.isValid && !loc.isWarning;
      if (statusFilter === 'warning') return loc.isWarning;
      if (statusFilter === 'expired') return !loc.isValid;
      return true;
    });
  }, [
    locations, showOnlyMine, user?.name, isAdmin,
    techFilter, regionFilter, locationRegionMap, searchTerm, statusFilter, user?.region,
  ]);

  const filteredTechnicianReport = useMemo(() => {
    return technicianReport.filter(r => {
      // Filtrar pelo regionFilter do Dashboard, se for admin
      if (isAdmin && regionFilter !== 'all' && r.region !== regionFilter) return false;
      // Técnicos só veem eles mesmos ou sua própria região? Na prática TechnicianReport deve refletir a mesma tela.
      return true;
    });
  }, [technicianReport, isAdmin, regionFilter]);

  // ── Dados Formatação Recharts ─────────────────────────────────────────────
  
  const barData = useMemo(() => {
    if (!Array.isArray(dailyData)) return [];
    
    return dailyData.map(d => {
      try {
        if (!d || !d.date) return { date: 'N/A', count: 0 };
        return {
          date: format(parseISO(d.date), 'dd/MM'),
          count: parseInt(String(d.count || 0), 10)
        };
      } catch (e) {
        return { date: 'N/A', count: 0 };
      }
    });
  }, [dailyData]);

  const lineData = useMemo(() => {
    let cumulative = 0;
    return barData.map(point => {
      cumulative += point.count;
      return { date: point.date, count: cumulative };
    });
  }, [barData]);

  return {
    isLoading,
    // Dados
    filteredLocations,
    regionTechs,
    availableRegions,
    biStats,
    barData,
    pieData,
    lineData,
    technicianReport: filteredTechnicianReport,
    // Filtros
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    techFilter, setTechFilter,
    regionFilter, setRegionFilter,
    showOnlyMine, setShowOnlyMine,
    startDate, setStartDate,
    endDate, setEndDate,
    // Ações
    regenerateDistribution,
  };
};
