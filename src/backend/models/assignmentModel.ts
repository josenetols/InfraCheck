/**
 * Model de atribuições mensais — distribuição de lojas por técnico.
 * Substitui o localStorage infracheck_assignments por PostgreSQL.
 */
import { pool } from '../../lib/db.js';

export const getAssignments = async (monthKey: string, region?: string): Promise<Record<string, string>> => {
  // Fallback inteligente: se o mês solicitado ainda não tem distribuição, pega o último gravado.
  const checkRes = await pool.query('SELECT COUNT(*)::int as count FROM assignments WHERE month_key = $1', [monthKey]);
  let targetMonth = monthKey;
  if (checkRes.rows[0].count === 0) {
    const maxRes = await pool.query('SELECT MAX(month_key) as max_month FROM assignments');
    if (maxRes.rows[0].max_month) targetMonth = maxRes.rows[0].max_month;
  }

  let query = 'SELECT location_name, technician_name FROM assignments WHERE month_key = $1';
  const params: string[] = [targetMonth];

  if (region) {
    query += ` AND location_name IN (SELECT name FROM locations WHERE region_name = $2)`;
    params.push(region);
  }

  const result = await pool.query(query, params);
  const assignments: Record<string, string> = {};
  result.rows.forEach(r => { assignments[r.location_name] = r.technician_name; });
  return assignments;
};

/** Regenera a distribuição do mês — embaralha lojas entre técnicos */
export const regenerateAssignments = async (monthKey: string, region?: string, participatingTechnicians?: string[]): Promise<Record<string, string>> => {
  // Buscar lojas
  let locQuery = 'SELECT name FROM locations';
  const locParams: string[] = [];
  if (region) {
    locQuery += ' WHERE region_name = $1';
    locParams.push(region);
  }
  locQuery += ' ORDER BY name';
  const locations = await pool.query(locQuery, locParams);

  let techNames: string[] = [];

  if (participatingTechnicians && participatingTechnicians.length > 0) {
    techNames = participatingTechnicians;
  } else {
    // Buscar técnicos ativos (fallback se não enviado pelo frontend)
    let techQuery = "SELECT name FROM technicians WHERE active = true";
    const techParams: string[] = [];
    if (region) {
      techQuery += ' AND region_name = $1';
      techParams.push(region);
    }
    techQuery += ' ORDER BY name';
    const technicians = await pool.query(techQuery, techParams);
    techNames = technicians.rows.map(t => t.name);
  }

  if (techNames.length === 0 || locations.rows.length === 0) {
    return {};
  }

  // Embaralhar com Fisher-Yates (garante distribuição uniforme)
  // Nota: Math.random() - 0.5 é matematicamente inválido como comparador de sort()
  // e causa viés sistemático na distribuição.
  const shuffled = [...locations.rows];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const assignments: Record<string, string> = {};

  for (let i = 0; i < shuffled.length; i++) {
    const locName = shuffled[i].name;
    const techName = techNames[i % techNames.length];
    assignments[locName] = techName;

    await pool.query(
      `INSERT INTO assignments (month_key, location_name, technician_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (month_key, location_name) DO UPDATE SET technician_name = EXCLUDED.technician_name`,
      [monthKey, locName, techName]
    );
  }

  return assignments;
};
