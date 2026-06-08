import fs from 'fs';
import pg from 'pg';

const connectionString = 'postgresql://postgres.kwjulnzfwrkeqdmaioxg:Y_i5M9+4g8!fN6_@aws-1-us-west-2.pooler.supabase.com:5432/postgres';

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync('src/lib/init.sql', 'utf8');
    console.log('Running init.sql...');
    await client.query(sql);
    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
