import { pool } from '../../lib/db.js';
import { JwtPayload } from '../middleware/authMiddleware.js';

const VALIDITY_DAYS = 30;
const WARNING_THRESHOLD_DAYS = 5;

// ─── KPIs do Dashboard ───────────────────────────────────────────────

export const getStatsSummary = async (startDate?: string, endDate?: string, user?: JwtPayload) => {
  const s = startDate || '1970-01-01';
  const e = endDate || '9999-12-31';

  let totalQuery = 'SELECT COUNT(*)::int AS count FROM checklists WHERE 1=1';
  let periodQuery = 'SELECT COUNT(*)::int AS count FROM checklists WHERE visit_date BETWEEN $1 AND $2';
  
  const currentMonth = new Date().toISOString().slice(0, 7);
  let pendingQuery = `
    SELECT COUNT(l.name)::int AS count FROM locations l
    WHERE NOT EXISTS (
      SELECT 1 FROM checklists c
      WHERE c.location_name = l.name
        AND c.visit_date > NOW() - INTERVAL '${VALIDITY_DAYS} days'
    )
  `;

  const queryParams: any[] = [s, e];
  const pendingParams: any[] = [];

  if (user?.role === 'technician') {
    totalQuery += ` AND technician_name = $1`;
    periodQuery += ` AND technician_name = $3`;
    queryParams.push(user.name);

    pendingQuery = `
      WITH check_month AS (SELECT COUNT(*)::int as cnt FROM assignments WHERE month_key = $1),
      target_month AS (SELECT CASE WHEN (SELECT cnt FROM check_month) > 0 THEN $1 ELSE (SELECT MAX(month_key) FROM assignments) END as mk)
      SELECT COUNT(l.name)::int AS count FROM locations l
      INNER JOIN assignments a ON a.location_name = l.name
      WHERE a.month_key = (SELECT mk FROM target_month) AND a.technician_name = $2
      AND NOT EXISTS (
        SELECT 1 FROM checklists c
        WHERE c.location_name = l.name
          AND c.visit_date > NOW() - INTERVAL '${VALIDITY_DAYS} days'
      )
    `;
    pendingParams.push(currentMonth, user.name);
  }

  const totalResult = await pool.query(totalQuery, user?.role === 'technician' ? [user.name] : []);
  const periodResult = await pool.query(periodQuery, queryParams);
  const pendingResult = await pool.query(pendingQuery, pendingParams);

  const totalCount = totalResult.rows[0].count;
  const completedCount = periodResult.rows[0].count;
  const pendingCount = pendingResult.rows[0].count;

  const diffMs = new Date(e).getTime() - new Date(s).getTime();
  const diffDays = Math.max(1, Math.ceil(diffMs / 86_400_000));

  return {
    total: totalCount,
    completed: completedCount,
    pending: pendingCount,
    averagePerPeriod: (completedCount / diffDays).toFixed(1),
  };
};

// ─── Dados diários (gráfico de barras) ───────────────────────────────

export const getDailyStats = async (startDate?: string, endDate?: string, user?: JwtPayload) => {
  const s = startDate || '1970-01-01';
  const e = endDate || '9999-12-31';

  let query = `
    SELECT TO_CHAR(visit_date, 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
    FROM checklists
    WHERE visit_date BETWEEN $1 AND $2
  `;
  const params: any[] = [s, e];

  if (user?.role === 'technician') {
    params.push(user.name);
    query += ` AND technician_name = $3`;
  }

  query += `
    GROUP BY TO_CHAR(visit_date, 'YYYY-MM-DD')
    ORDER BY date
  `;

  const result = await pool.query(query, params);
  return result.rows;
};

// ─── Distribuição de Status (gráfico de pizza) ───────────────────────

export const getStatusDistribution = async (user?: JwtPayload) => {
  let query = '';
  const params: any[] = [];

  if (user?.role === 'technician') {
    const currentMonth = new Date().toISOString().slice(0, 7);
    params.push(currentMonth, user.name);
    query = `
      WITH check_month AS (SELECT COUNT(*)::int as cnt FROM assignments WHERE month_key = $1),
      target_month AS (SELECT CASE WHEN (SELECT cnt FROM check_month) > 0 THEN $1 ELSE (SELECT MAX(month_key) FROM assignments) END as mk),
      latest_checks AS (
        SELECT DISTINCT ON (location_name) location_name, visit_date
        FROM checklists
        ORDER BY location_name, visit_date DESC
      )
      SELECT
        COALESCE(SUM(CASE
          WHEN lc.visit_date IS NOT NULL AND EXTRACT(EPOCH FROM (NOW() - lc.visit_date)) / 86400 <= ${VALIDITY_DAYS - WARNING_THRESHOLD_DAYS} THEN 1 ELSE 0 END), 0)::int AS ok,
        COALESCE(SUM(CASE
          WHEN lc.visit_date IS NOT NULL AND EXTRACT(EPOCH FROM (NOW() - lc.visit_date)) / 86400 > ${VALIDITY_DAYS - WARNING_THRESHOLD_DAYS} AND EXTRACT(EPOCH FROM (NOW() - lc.visit_date)) / 86400 <= ${VALIDITY_DAYS} THEN 1 ELSE 0 END), 0)::int AS warning,
        COALESCE(SUM(CASE
          WHEN lc.visit_date IS NULL OR EXTRACT(EPOCH FROM (NOW() - lc.visit_date)) / 86400 > ${VALIDITY_DAYS} THEN 1 ELSE 0 END), 0)::int AS critical
      FROM locations l
      INNER JOIN assignments a ON a.location_name = l.name
      LEFT JOIN latest_checks lc ON l.name = lc.location_name
      WHERE a.month_key = (SELECT mk FROM target_month) AND a.technician_name = $2
    `;
  } else {
    query = `
      WITH latest_checks AS (
        SELECT DISTINCT ON (location_name)
          location_name, visit_date
        FROM checklists
        ORDER BY location_name, visit_date DESC
      )
      SELECT
        COALESCE(SUM(CASE
          WHEN lc.visit_date IS NOT NULL
            AND EXTRACT(EPOCH FROM (NOW() - lc.visit_date)) / 86400 <= ${VALIDITY_DAYS - WARNING_THRESHOLD_DAYS}
          THEN 1 ELSE 0 END), 0)::int AS ok,
        COALESCE(SUM(CASE
          WHEN lc.visit_date IS NOT NULL
            AND EXTRACT(EPOCH FROM (NOW() - lc.visit_date)) / 86400 > ${VALIDITY_DAYS - WARNING_THRESHOLD_DAYS}
            AND EXTRACT(EPOCH FROM (NOW() - lc.visit_date)) / 86400 <= ${VALIDITY_DAYS}
          THEN 1 ELSE 0 END), 0)::int AS warning,
        COALESCE(SUM(CASE
          WHEN lc.visit_date IS NULL
            OR EXTRACT(EPOCH FROM (NOW() - lc.visit_date)) / 86400 > ${VALIDITY_DAYS}
          THEN 1 ELSE 0 END), 0)::int AS critical
      FROM locations l
      LEFT JOIN latest_checks lc ON l.name = lc.location_name
    `;
  }

  const result = await pool.query(query, params);
  const row = result.rows[0] || { ok: 0, warning: 0, critical: 0 };
  
  return [
    { name: 'Em Dia', value: row.ok, color: '#22c55e' },
    { name: 'A Vencer', value: row.warning, color: '#eab308' },
    { name: 'Vencidos', value: row.critical, color: '#ef4444' },
  ];
};

// ─── Relatório de Técnicos ───────────────────────────────────────────

export const getTechnicianReport = async (monthKey: string) => {
  const result = await pool.query(`
    WITH check_month AS (SELECT COUNT(*)::int as cnt FROM assignments WHERE month_key = $1),
    target_month AS (SELECT CASE WHEN (SELECT cnt FROM check_month) > 0 THEN $1 ELSE (SELECT MAX(month_key) FROM assignments) END as mk),
    assignments_count AS (
      SELECT technician_name, COUNT(*)::int AS total_assigned
      FROM assignments
      WHERE month_key = (SELECT mk FROM target_month)
      GROUP BY technician_name
    ),
    checklists_count AS (
      SELECT c.technician_name, COUNT(DISTINCT c.location_name)::int AS total_completed
      FROM checklists c
      INNER JOIN assignments a ON a.location_name = c.location_name AND a.month_key = (SELECT mk FROM target_month) AND a.technician_name = c.technician_name
      WHERE to_char(c.visit_date, 'YYYY-MM') = $1
      GROUP BY c.technician_name
    )
    SELECT
      a.technician_name as technician,
      COALESCE(a.total_assigned, 0) as attributed,
      COALESCE(c.total_completed, 0) as completed
    FROM assignments_count a
    LEFT JOIN checklists_count c ON a.technician_name = c.technician_name
    ORDER BY a.technician_name
  `, [monthKey]);

  return result.rows;
};

// ─── Resumo Executivo do Admin ───────────────────────────────────────

export const getAdminSummary = async () => {
  const regionStatsResult = await pool.query(`
    WITH latest_checks AS (
      SELECT DISTINCT ON (location_name)
        location_name, visit_date
      FROM checklists
      ORDER BY location_name, visit_date DESC
    )
    SELECT
      COALESCE(l.region_name, 'Sem Região') AS region,
      COUNT(l.name)::int AS total,
      COALESCE(SUM(CASE
        WHEN lc.visit_date IS NOT NULL
          AND EXTRACT(EPOCH FROM (NOW() - lc.visit_date)) / 86400 <= ${VALIDITY_DAYS}
        THEN 1 ELSE 0 END), 0)::int AS ok,
      COALESCE(SUM(CASE
        WHEN lc.visit_date IS NULL
          OR EXTRACT(EPOCH FROM (NOW() - lc.visit_date)) / 86400 > ${VALIDITY_DAYS}
        THEN 1 ELSE 0 END), 0)::int AS pending
    FROM locations l
    LEFT JOIN latest_checks lc ON l.name = lc.location_name
    GROUP BY l.region_name
    ORDER BY l.region_name
  `);

  const pendingResult = await pool.query(`
    WITH latest_checks AS (
      SELECT DISTINCT ON (location_name)
        location_name, technician_name, visit_date
      FROM checklists
      ORDER BY location_name, visit_date DESC
    )
    SELECT
      l.name,
      COALESCE(l.region_name, 'Sem Região') AS region,
      COALESCE(lc.technician_name, 'N/A') AS technician_name,
      lc.visit_date AS last_check,
      CASE
        WHEN lc.visit_date IS NOT NULL
          THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - lc.visit_date)) / 86400)::int - ${VALIDITY_DAYS})
        ELSE 999
      END AS days_overdue
    FROM locations l
    LEFT JOIN latest_checks lc ON l.name = lc.location_name
    WHERE lc.visit_date IS NULL
      OR EXTRACT(EPOCH FROM (NOW() - lc.visit_date)) / 86400 > ${VALIDITY_DAYS}
    ORDER BY days_overdue DESC
  `);

  const regionStats = regionStatsResult.rows.map(r => ({
    region: r.region,
    total: r.total,
    ok: r.ok,
    pending: r.pending,
  }));

  const totalOk = regionStats.reduce((s, r) => s + r.ok, 0);
  const totalPending = regionStats.reduce((s, r) => s + r.pending, 0);
  const totalStores = regionStats.reduce((s, r) => s + r.total, 0);
  const percentage = totalStores > 0 ? Math.round((totalOk / totalStores) * 100) : 0;

  const pendentesList = pendingResult.rows.map(r => ({
    name: r.name,
    region: r.region,
    technicianAssigned: r.technician_name,
    lastCheck: r.last_check || null,
    isValid: false,
    daysOverdue: r.days_overdue,
  }));

  return { regionStats, totalEmDia: totalOk, totalPendentes: totalPending, percentage, pendentesList };
};
