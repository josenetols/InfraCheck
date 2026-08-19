import { Request, Response } from 'express';
import * as goalModel from '../models/goalModel.js';
import { JwtPayload } from '../middleware/authMiddleware.js';

export const getCurrentCycleGoal = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JwtPayload;
    
    // BUG-004: Técnico só pode ver os próprios dados
    if (user.role === 'technician' && req.params.technicianId && req.params.technicianId !== user.id) {
      return res.status(403).json({ error: 'Acesso negado. Você só pode consultar suas próprias metas.' });
    }
    
    const technicianId = req.params.technicianId || (user.role === 'technician' ? user.id : null);
    
    if (!technicianId) {
      return res.status(400).json({ error: 'ID do técnico não fornecido' });
    }
    
    const goalData = await goalModel.getCurrentCycleGoal(technicianId);
    res.json(goalData);
  } catch (err) {
    console.error('Erro ao buscar meta do ciclo atual:', err);
    res.status(500).json({ error: 'Erro ao buscar meta' });
  }
};

export const getHistory = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JwtPayload;
    
    const filters = {
      technicianId: req.query.technicianId as string || (user.role === 'technician' ? user.id : undefined),
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      cycle: req.query.cycle ? parseInt(req.query.cycle as string) : undefined,
      month: req.query.month ? parseInt(req.query.month as string) : undefined,
    };
    
    const history = await goalModel.getHistory(filters);
    res.json(history);
  } catch (err) {
    console.error('Erro ao buscar histórico de metas:', err);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
};

export const closeCycle = async (req: Request, res: Response) => {
  try {
    const { technicianId, year, cycle } = req.body;
    
    if (!technicianId || !year || !cycle) {
      return res.status(400).json({ error: 'technicianId, year e cycle são obrigatórios' });
    }
    
    const result = await goalModel.closeCycle(technicianId, year, cycle);
    res.json({ message: 'Ciclo fechado com sucesso', result });
  } catch (err: any) {
    console.error('Erro ao fechar ciclo:', err);
    res.status(400).json({ error: err.message || 'Erro ao fechar ciclo' });
  }
};

export const recalculate = async (req: Request, res: Response) => {
  try {
    const { year, month } = req.body;
    if (!year || !month) {
      return res.status(400).json({ error: 'year e month são obrigatórios' });
    }
    await goalModel.recalculateAll(year, month);
    res.json({ message: 'Metas recalculadas com sucesso' });
  } catch (err) {
    console.error('Erro ao recalcular metas:', err);
    res.status(500).json({ error: 'Erro ao recalcular metas' });
  }
};
