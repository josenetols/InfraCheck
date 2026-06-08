import { Request, Response } from 'express';
import * as locationModel from '../models/locationModel.js';

export const getAllLocations = async (req: Request, res: Response) => {
  try {
    const locations = await locationModel.getLocations(req.user);
    res.json(locations);
  } catch (err) {
    console.error('Erro ao listar lojas:', err);
    res.status(500).json({ error: 'Erro ao listar lojas' });
  }
};

export const addLocation = async (req: Request, res: Response) => {
  try {
    const { name, region } = req.body as { name: string; region: string };
    await locationModel.upsertLocation(name, region);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar loja' });
  }
};

export const removeLocation = async (req: Request, res: Response) => {
  try {
    const { name } = req.params as { name: string };
    await locationModel.deleteLocation(name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover loja' });
  }
};
