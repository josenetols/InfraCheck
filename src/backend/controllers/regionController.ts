import { Request, Response } from 'express';
import * as regionModel from '../models/regionModel.js';

export const getAllRegions = async (_req: Request, res: Response) => {
  try {
    const regions = await regionModel.getRegions();
    res.json(regions);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar regiões' });
  }
};

export const addRegion = async (req: Request, res: Response) => {
  try {
    await regionModel.createRegion(req.body.name);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao adicionar região' });
  }
};

export const removeRegion = async (req: Request, res: Response) => {
  try {
    const { name } = req.params as { name: string };
    await regionModel.deleteRegion(name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover região' });
  }
};
