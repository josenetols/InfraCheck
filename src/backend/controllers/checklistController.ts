import { Request, Response } from 'express';
import * as checklistModel from '../models/checklistModel.js';
import { exec } from 'child_process';
import path from 'path';

export const getAllChecklists = async (req: Request, res: Response) => {
  try {
    const { location } = req.query as { location?: string };
    const checklists = await checklistModel.getChecklists(location, req.user);
    res.json(checklists);
  } catch (err) {
    console.error('Erro ao buscar checklists:', err);
    res.status(500).json({ error: 'Erro ao buscar checklists no banco.' });
  }
};

export const getChecklistById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const checklist = await checklistModel.getChecklistById(id);
    if (!checklist) {
      return res.status(404).json({ error: 'Checklist não encontrado.' });
    }
    res.json(checklist);
  } catch (err) {
    console.error('Erro ao buscar checklist:', err);
    res.status(500).json({ error: 'Erro ao buscar detalhes do checklist.' });
  }
};

export const createOrUpdateChecklist = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const id = await checklistModel.upsertChecklist(data);
    
    // Dispara a régua de cobrança em background imediatamente após salvar qualquer checklist
    exec('node autoCollectionJob.mjs', { cwd: '/home/ubuntu/InfraCheck' }, (err) => {
       if (err) console.error('Erro ao acionar autoCollectionJob pós-checklist:', err);
    });

    res.status(201).json({ message: 'Checklist salvo com sucesso!', id });
  } catch (err) {
    console.error('Erro ao salvar checklist:', err);
    res.status(500).json({ error: 'Falha ao persistir checklist no Postgres.' });
  }
};

export const removeChecklist = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    await checklistModel.deleteChecklist(id);
    res.json({ message: 'Checklist removido com sucesso.' });
  } catch (err) {
    console.error('Erro ao deletar checklist:', err);
    res.status(500).json({ error: 'Erro ao remover checklist.' });
  }
};

/**
 * GET /api/checklists/history/:locationName
 * Retorna o checklist mais recente do mês anterior para um determinado local.
 * Usado pelo frontend para o fluxo de revisão mensal.
 */
export const getChecklistHistory = async (req: Request, res: Response) => {
  try {
    const { locationName } = req.params as { locationName: string };
    const record = await checklistModel.getLatestChecklistByLocation(
      decodeURIComponent(locationName)
    );
    if (!record) {
      return res.json({ found: false, data: null });
    }
    // Retorna os dados JSONB diretamente
    res.json({ found: true, data: record.data, visitDate: record.visit_date });
  } catch (err) {
    console.error('Erro ao buscar histórico do checklist:', err);
    res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
};

/**
 * GET /api/checklists/location-history/:locationName
 * Retorna o sumário de todos os checklists de um local (sem JSONB completo)
 * para exibir na tela de histórico.
 */
export const getLocationHistoryController = async (req: Request, res: Response) => {
  try {
    const { locationName } = req.params as { locationName: string };
    const rows = await checklistModel.getLocationHistory(
      decodeURIComponent(locationName)
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar histórico por local:', err);
    res.status(500).json({ error: 'Erro ao buscar histórico por local.' });
  }
};
