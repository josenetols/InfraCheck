import { pool } from '../../lib/db.js';
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
  const upsertQuery = `
    INSERT INTO checklists (id, location_name, technician_name, visit_date, data, is_baseline)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (id) DO UPDATE SET
      location_name = EXCLUDED.location_name,
      technician_name = EXCLUDED.technician_name,
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
    data.visitDate,
    data, // Objeto completo no JSONB
    data.isBaseline || false
  ];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
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
 *
 * 🧪 MODO TESTE (Opção B): retorna qualquer checklist, sem filtro de mês nem is_baseline.
 * Para produção (Opção A), usar:
 *   AND is_baseline = true
 *   AND visit_date < [início do mês atual]
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
