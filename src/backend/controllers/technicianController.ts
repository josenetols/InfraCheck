import { Request, Response } from 'express';
import * as technicianModel from '../models/technicianModel.js';

export const getAllTechnicians = async (_req: Request, res: Response) => {
  try {
    const technicians = await technicianModel.getTechnicians();
    res.json(technicians);
  } catch (err) {
    console.error('Erro ao buscar técnicos:', err);
    res.status(500).json({ error: 'Erro ao listar técnicos' });
  }
};

export const createOrUpdateTechnician = async (req: Request, res: Response) => {
  try {
    const techId = await technicianModel.upsertTechnician(req.body);
    res.status(201).json({ success: true, id: techId });
  } catch (err) {
    console.error('Erro ao salvar técnico:', err);
    res.status(500).json({ error: 'Erro ao salvar técnico' });
  }
};

export const removeTechnician = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    await technicianModel.deleteTechnician(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao desativar técnico' });
  }
};
