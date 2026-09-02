import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((a, b) => {
  const i = b.indexOf('=');
  if (i > 0) a[b.substring(0, i).trim()] = b.substring(i + 1).trim();
  return a;
}, {});

const pool = new pg.Pool({
  connectionString: env['DATABASE_URL'],
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Fixing inactive usernames...');
    const res = await client.query(`
      UPDATE technicians 
      SET username = username || '-deleted-' || extract(epoch from now())::int
      WHERE active = false AND username NOT LIKE '%-deleted-%'
    `);
    console.log(`Updated ${res.rowCount} inactive users.`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
