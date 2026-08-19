import { pool } from '../../lib/db.js';

// ─── Tipos de pendência extraídos do JSONB ────────────────────────────────────

export interface PendingItem {
  category: string;
  description: string;
}
import { randomUUID } from 'crypto';
import { JwtPayload } from '../middleware/authMiddleware.js';

export const getChecklists = async (location?: string, user?: JwtPayload) => {
  let query = 'SELECT id, location_name, technician_name, visit_date, is_baseline FROM checklists WHERE 1=1';
  const params: any[] = [];

  if (location) {
    params.push(`%${location}%`);
    query += ` AND location_name ILIKE $${params.length}`;
  }

  if (user?.role === 'technician') {
    params.push(user.name);
    query += ` AND technician_name = $${params.length}`;
  }

  query += ' ORDER BY visit_date DESC LIMIT 50';
  const result = await pool.query(query, params);
  return result.rows;
};

export const getChecklistById = async (id: string) => {
  const result = await pool.query('SELECT * FROM checklists WHERE id = $1', [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

export const upsertChecklist = async (data: any) => {
  const id = data.id || randomUUID();
  const visitDate = new Date(data.visitDate);
  const year = visitDate.getFullYear();
  const month = visitDate.getMonth() + 1;
  const cycle = Math.floor((month - 1) / 4) + 1;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Look up location_id and technician_id
    const locRes = await client.query('SELECT id FROM locations WHERE name = $1', [data.locationName]);
    const techRes = await client.query('SELECT id FROM technicians WHERE name = $1', [data.technicianName]);
    
    // BUG-006: Não salvar checklist com IDs nulos — gera perda silenciosa nos cálculos de meta
    if (!locRes.rows[0]) {
      throw new Error(`Loja '${data.locationName}' não encontrada. Verifique o nome e tente novamente.`);
    }
    if (!techRes.rows[0]) {
      throw new Error(`Técnico '${data.technicianName}' não encontrado. Verifique o cadastro.`);
    }
    
    const location_id = locRes.rows[0].id;
    const technician_id = techRes.rows[0].id;

    const upsertQuery = `
      INSERT INTO checklists (id, location_name, technician_name, location_id, technician_id, year, month, cycle, visit_date, data, is_baseline)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        location_name = EXCLUDED.location_name,
        technician_name = EXCLUDED.technician_name,
        location_id = EXCLUDED.location_id,
        technician_id = EXCLUDED.technician_id,
        year = EXCLUDED.year,
        month = EXCLUDED.month,
        cycle = EXCLUDED.cycle,
        visit_date = EXCLUDED.visit_date,
        data = EXCLUDED.data,
        is_baseline = EXCLUDED.is_baseline,
        updated_at = NOW()
      RETURNING id
    `;
    const values = [
      id,
      data.locationName,
      data.technicianName,
      location_id,
      technician_id,
      year,
      month,
      cycle,
      data.visitDate,
      data, 
      data.isBaseline || false
    ];

    const result = await client.query(upsertQuery, values);
    await client.query('COMMIT');
    return result.rows[0].id;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const deleteChecklist = async (id: string) => {
  await pool.query('DELETE FROM checklists WHERE id = $1', [id]);
};

/**
 * Retorna o sumário dos checklists de um local para a tela de histórico.
 * Extrai campos chave do JSONB sem carregar fotos (base64 enorme).
 */
export const getLocationHistory = async (locationName: string) => {
  const result = await pool.query(
    `SELECT id, location_name, technician_name, visit_date, is_baseline
     FROM checklists
     WHERE location_name = $1
     ORDER BY visit_date DESC
     LIMIT 5`,
    [locationName]
  );
  return result.rows;
};

/**
 * Retorna o checklist completo (com JSONB data) mais recente de um local.
 */
export const getLatestChecklistByLocation = async (locationName: string) => {
  const result = await pool.query(
    `SELECT id, location_name, technician_name, visit_date, data, is_baseline
     FROM checklists
     WHERE location_name ILIKE $1
     ORDER BY visit_date DESC
     LIMIT 1`,
    [locationName]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Extrai os itens pendentes/reprovados do JSONB de um checklist.
 */
export const extractPendingItems = (checklistData: any): { category: string; description: string }[] => {
  const items: { category: string; description: string }[] = [];
  if (!checklistData) return items;

  // Máquinas com problema
  if (Array.isArray(checklistData.problematicMachines)) {
    for (const m of checklistData.problematicMachines) {
      const desc = [
        m.identifier   ? `ID: ${m.identifier}`               : null,
        m.processorGen ? `Processador: ${m.processorGen}`     : null,
        m.problemDescription                                   || null,
      ].filter(Boolean).join(' | ');
      if (desc) items.push({ category: 'Máquina com Problema', description: desc });
    }
  }

  // Pontos de rede com problema
  if (Array.isArray(checklistData.problematicNetworkPoints)) {
    for (const p of checklistData.problematicNetworkPoints) {
      const desc = [
        p.location    ? `Ponto: ${p.location}` : null,
        p.description                           || null,
      ].filter(Boolean).join(' | ');
      if (desc) items.push({ category: 'Ponto de Rede com Problema', description: desc });
    }
  }

  // Switches com condição ruim
  if (Array.isArray(checklistData.switches)) {
    for (const s of checklistData.switches) {
      if (s.conditionOk === false) {
        const desc = [
          s.brand ? `Marca: ${s.brand}` : null,
          s.model ? `Modelo: ${s.model}` : null,
          s.notes                        || null,
        ].filter(Boolean).join(' | ');
        items.push({ category: 'Switch com Condição Ruim', description: desc || 'Switch sem detalhes' });
      }
    }
  }

  // Antenas não funcionando
  if (Array.isArray(checklistData.antennas)) {
    for (const a of checklistData.antennas) {
      if (a.isWorking === false) {
        const desc = [
          a.brand    ? `Marca: ${a.brand}`   : null,
          a.location ? `Local: ${a.location}` : null,
          a.notes                             || null,
        ].filter(Boolean).join(' | ');
        items.push({ category: 'Antena com Falha', description: desc || 'Antena sem detalhes' });
      }
    }
  }

  // Cabeamento com problema
  if (checklistData.cableCondition && checklistData.cableCondition !== 'Organizado') {
    const note = checklistData.cableNotes ? ` — ${checklistData.cableNotes}` : '';
    items.push({ category: 'Cabeamento', description: `Condição: ${checklistData.cableCondition}${note}` });
  }

  // Firewall com problema
  if (checklistData.hasFirewall && checklistData.firewallWorking === false) {
    const note = checklistData.firewallNotes ? ` — ${checklistData.firewallNotes}` : '';
    items.push({ category: 'Firewall', description: `Firewall com problema${note}` });
  }

  // Reclamações dos funcionários
  if (checklistData.employeesSatisfied === false && checklistData.complaints) {
    items.push({ category: 'Reclamações de Funcionários', description: checklistData.complaints });
  }

  // Observações gerais
  if (checklistData.observations && checklistData.observations.trim().length > 0) {
    items.push({ category: 'Observações Gerais', description: checklistData.observations.trim() });
  }

  return items;
};
