import { pool } from '../../lib/db.js';

export const getAssignments = async (monthKey: string, region?: string): Promise<Record<string, string>> => {
  // O formato do monthKey é "YYYY-MM"
  const [yStr, mStr] = monthKey.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);

  // Consideramos ativa no mês qualquer atribuição que started ANTES do fim do mês
  // e ended DEPOIS do inicio do mês (ou end_date IS NULL)
  const monthStart = `${year}-${mStr}-01T00:00:00Z`;
  const monthEnd = new Date(year, month, 0, 23, 59, 59).toISOString();

  let query = `
    SELECT l.name as location_name, t.name as technician_name 
    FROM assignments a
    JOIN locations l ON a.location_id = l.id
    JOIN technicians t ON a.technician_id = t.id
    WHERE a.start_date <= $2 AND (a.end_date IS NULL OR a.end_date >= $1)
  `;
  const params: any[] = [monthStart, monthEnd];

  if (region) {
    query += ` AND l.region_name = $3`;
    params.push(region);
  }

  // Pegamos a última atribuição por loja (caso tenha havido mudança no mês, pegamos a mais recente)
  query += ` ORDER BY a.start_date DESC`;

  const result = await pool.query(query, params);
  const assignments: Record<string, string> = {};
  
  result.rows.forEach(r => { 
    if (!assignments[r.location_name]) {
      assignments[r.location_name] = r.technician_name; 
    }
  });
  return assignments;
};

export const regenerateAssignments = async (monthKey: string, region?: string, participatingTechnicians?: string[]): Promise<Record<string, string>> => {
  const [yStr, mStr] = monthKey.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const cycle = Math.floor((month - 1) / 4) + 1;
  const now = new Date().toISOString();

  // Buscar lojas com seus IDs
  let locQuery = 'SELECT id, name FROM locations';
  const locParams: any[] = [];
  if (region) {
    locQuery += ' WHERE region_name = $1';
    locParams.push(region);
  }
  locQuery += ' ORDER BY name';
  const locations = await pool.query(locQuery, locParams);

  let techNames: string[] = [];
  let techniciansData: any[] = [];

  if (participatingTechnicians && participatingTechnicians.length > 0) {
    techNames = participatingTechnicians;
    const techs = await pool.query('SELECT id, name FROM technicians WHERE name = ANY($1)', [techNames]);
    techniciansData = techs.rows;
  } else {
    // Buscar técnicos ativos 
    let techQuery = "SELECT id, name FROM technicians WHERE active = true";
    const techParams: any[] = [];
    if (region) {
      techQuery += ' AND region_name = $1';
      techParams.push(region);
    }
    techQuery += ' ORDER BY name';
    const techniciansRes = await pool.query(techQuery, techParams);
    techniciansData = techniciansRes.rows;
    techNames = techniciansData.map(t => t.name);
  }

  if (techNames.length === 0 || locations.rows.length === 0) {
    return {};
  }

  // Embaralhar com Fisher-Yates
  const shuffled = [...locations.rows];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const assignments: Record<string, string> = {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (let i = 0; i < shuffled.length; i++) {
      const loc = shuffled[i];
      const techName = techNames[i % techNames.length];
      const tech = techniciansData.find(t => t.name === techName);
      
      if (!tech) continue;
      
      assignments[loc.name] = tech.name;

      // 1. Fechar atribuição ativa da loja, se houver, caso não seja do mesmo técnico
      await client.query(`
        UPDATE assignments 
        SET active = false, end_date = $1 
        WHERE location_id = $2 AND active = true AND technician_id != $3
      `, [now, loc.id, tech.id]);

      // 2. Criar ou manter a atribuição
      // Se já houver uma ativa para o mesmo técnico e mesma loja, não precisamos fazer nada
      const checkActive = await client.query(`
        SELECT id FROM assignments WHERE location_id = $1 AND technician_id = $2 AND active = true
      `, [loc.id, tech.id]);

      if (checkActive.rows.length === 0) {
        // Insere nova
        await client.query(`
          INSERT INTO assignments (location_name, technician_name, location_id, technician_id, year, cycle, start_date, active, month_key)
          VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
        `, [loc.name, tech.name, loc.id, tech.id, year, cycle, now, monthKey]);
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return assignments;
};
