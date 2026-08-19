import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((a, b) => {
  const i = b.indexOf('=');
  if (i > 0) a[b.substring(0, i).trim()] = b.substring(i + 1).trim();
  return a;
}, {});

const pool = new pg.Pool({ connectionString: env['DATABASE_URL'] });

async function run() {
  console.log('Aplicando índices de performance e correções de schema (BUG-012, BUG-016)...');
  
  // BUG-016: Criar índices ausentes para performance
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_monthly_goals_tech_year_cycle 
      ON monthly_goals (technician_id, year, cycle);

    CREATE INDEX IF NOT EXISTS idx_cycle_goals_tech_year 
      ON cycle_goals (technician_id, year);

    CREATE INDEX IF NOT EXISTS idx_assignments_location_active 
      ON assignments (location_id, active);

    CREATE INDEX IF NOT EXISTS idx_assignments_tech_dates 
      ON assignments (technician_id, start_date, end_date);

    CREATE INDEX IF NOT EXISTS idx_checklists_tech_year_month 
      ON checklists (technician_id, year, month);

    CREATE INDEX IF NOT EXISTS idx_checklists_loc_year_month 
      ON checklists (location_id, year, month);
  `);
  console.log('✅ Índices criados com sucesso.');

  await pool.end();
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
