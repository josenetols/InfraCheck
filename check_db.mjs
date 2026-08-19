import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((a, b) => {
  const i = b.indexOf('=');
  if (i > 0) a[b.substring(0, i).trim()] = b.substring(i + 1).trim();
  return a;
}, {});

const pool = new pg.Pool({ connectionString: env['DATABASE_URL'] });

async function run() {
  const techs = await pool.query("SELECT id, name, username FROM technicians WHERE name LIKE '%Test Tech%' OR name = 'Test Tech'");
  console.log('Technicians:');
  console.table(techs.rows);

  const locs = await pool.query("SELECT id, name FROM locations WHERE name::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'");
  console.log('Locations count:', locs.rowCount);
  
  // if any exist, delete them
  if (techs.rowCount > 0) {
    const ids = techs.rows.map(t => t.id);
    await pool.query('DELETE FROM checklists WHERE technician_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM assignments WHERE technician_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM cycle_goals WHERE technician_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM monthly_goals WHERE technician_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM technicians WHERE id = ANY($1)', [ids]);
    console.log('Deleted test techs');
  }
  
  if (locs.rowCount > 0) {
    const locIds = locs.rows.map(l => l.id);
    await pool.query('DELETE FROM locations WHERE id = ANY($1)', [locIds]);
    console.log('Deleted test locations');
  }

  process.exit(0);
}

run();
