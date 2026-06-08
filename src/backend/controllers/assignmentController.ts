import { Request, Response } from 'express';
import * as assignmentModel from '../models/assignmentModel.js';

/** GET /api/assignments?month=2026-03&region=GO */
export const getAssignments = async (req: Request, res: Response) => {
  try {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const region = req.query.region as string | undefined;
    const assignments = await assignmentModel.getAssignments(month, region);
    res.json(assignments);
  } catch (err) {
    console.error('Erro ao buscar atribuições:', err);
    res.status(500).json({ error: 'Erro ao buscar atribuições.' });
  }
};

/** POST /api/assignments/regenerate — somente admin */
export const regenerateAssignments = async (req: Request, res: Response) => {
  try {
    const month = (req.body.month as string) || new Date().toISOString().slice(0, 7);
    const region = req.body.region as string | undefined;
    const participatingTechnicians = req.body.technicians as string[] | undefined;
    
    const assignments = await assignmentModel.regenerateAssignments(month, region, participatingTechnicians);
    
    // Logs obrigatórios exigidos
    const total = Object.keys(assignments).length;
    const techsCount = participatingTechnicians ? participatingTechnicians.length : new Set(Object.values(assignments)).size;
    console.log("Distribuição criada:", total);
    console.log("Técnicos:", techsCount);

    res.json({ message: 'Distribuição regenerada com sucesso.', assignments });
  } catch (err) {
    console.error('Erro ao regenerar atribuições:', err);
    res.status(500).json({ error: 'Erro ao regenerar distribuição.' });
  }
};
