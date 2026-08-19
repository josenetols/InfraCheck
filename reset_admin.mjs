import fs from 'fs';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((a, b) => {
  const i = b.indexOf('=');
  if (i > 0) a[b.substring(0, i).trim()] = b.substring(i + 1).trim();
  return a;
}, {});

const pool = new pg.Pool({ connectionString: env['DATABASE_URL'] });

async function run() {
  const hash = bcrypt.hashSync('admin123', 10);
  await pool.query('UPDATE technicians SET password_hash = $1 WHERE username = $2', [hash, 'admin']);
  console.log('Admin password updated to: admin123');
  process.exit(0);
}
run();
