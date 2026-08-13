import { pool } from '../../lib/db.js';
import { JwtPayload } from '../middleware/authMiddleware.js';

export const getLocations = async (user?: JwtPayload) => {
  if (user?.role === 'technician') {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const result = await pool.query(`
      WITH check_month AS (
        SELECT COUNT(*)::int as cnt FROM assignments WHERE month_key = $1
      ),
      target_month AS (
        SELECT CASE WHEN (SELECT cnt FROM check_month) > 0 THEN $1 ELSE (SELECT MAX(month_key) FROM assignments) END as mk
      ),
      latest_checks AS (
        SELECT DISTINCT ON (location_name) id, location_name, visit_date, technician_name
        FROM checklists
        ORDER BY location_name, visit_date DESC
      )
      SELECT l.name, l.region_name as region, lc.id as last_check_id, lc.visit_date as last_check_date, lc.technician_name as last_check_technician
      FROM locations l
      INNER JOIN assignments a ON a.location_name = l.name
      LEFT JOIN latest_checks lc ON l.name = lc.location_name
      WHERE a.month_key = (SELECT mk FROM target_month) AND a.technician_name = $2
      ORDER BY l.name
    `, [currentMonth, user.name]);
    return result.rows;
  } else {
    const result = await pool.query(`
      WITH latest_checks AS (
        SELECT DISTINCT ON (location_name) id, location_name, visit_date, technician_name
        FROM checklists
        ORDER BY location_name, visit_date DESC
      )
      SELECT l.name, l.region_name as region,
             lc.id as last_check_id, lc.visit_date as last_check_date, lc.technician_name as last_check_technician
      FROM locations l
      LEFT JOIN latest_checks lc ON l.name = lc.location_name
      ORDER BY l.name
    `);
    return result.rows;
  }
};

export const upsertLocation = async (name: string, region: string) => {
  await pool.query(
    'INSERT INTO locations (name, region_name) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET region_name = EXCLUDED.region_name',
    [name, region]
  );
};


export const deleteLocation = async (name: string) => {
  await pool.query('DELETE FROM locations WHERE name = $1', [name]);
};
