import pg from 'pg';

const connectionString = 'postgresql://postgres.kwjulnzfwrkeqdmaioxg:Y_i5M9+4g8!fN6_@aws-1-us-west-2.pooler.supabase.com:5432/postgres';

const pool = new pg.Pool({
  connectionString,
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
