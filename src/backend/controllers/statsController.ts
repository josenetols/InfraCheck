import { Request, Response } from 'express';
import * as statsModel from '../models/statsModel.js';

/** GET /api/stats?startDate=...&endDate=... */
export const getStats = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const summary = await statsModel.getStatsSummary(startDate as string, endDate as string, req.user);
    const daily = await statsModel.getDailyStats(startDate as string, endDate as string, req.user);
    
    // Calcula o relatório de técnicos
    const currentMonth = new Date().toISOString().slice(0, 7);
    const technicianReport = await statsModel.getTechnicianReport(currentMonth);

    res.json({ summary, daily, technicianReport });
  } catch (err) {
    console.error('Erro ao calcular estatísticas:', err);
    res.status(500).json({ error: 'Erro ao processar métricas de BI.' });
  }
};

/** GET /api/stats/status-distribution */
export const getStatusDistribution = async (req: Request, res: Response) => {
  try {
    const distribution = await statsModel.getStatusDistribution(req.user);
    res.json(distribution);
  } catch (err) {
    console.error('Erro ao calcular distribuição:', err);
    res.status(500).json({ error: 'Erro ao calcular distribuição de status.' });
  }
};

/** GET /api/stats/admin-summary — somente admin */
export const getAdminSummary = async (_req: Request, res: Response) => {
  try {
    const summary = await statsModel.getAdminSummary();
    res.json(summary);
  } catch (err) {
    console.error('Erro ao gerar resumo admin:', err);
    res.status(500).json({ error: 'Erro ao gerar resumo administrativo.' });
  }
};
