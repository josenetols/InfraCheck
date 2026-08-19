import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((a, b) => {
  const i = b.indexOf('=');
  if (i > 0) a[b.substring(0, i).trim()] = b.substring(i + 1).trim();
  return a;
}, {});

const pool = new pg.Pool({ connectionString: env['DATABASE_URL'] });

async function run() {
  await pool.query(`
    ALTER TABLE monthly_goals ALTER COLUMN percentage DROP NOT NULL;
    ALTER TABLE cycle_goals ALTER COLUMN month_1_percentage DROP NOT NULL;
    ALTER TABLE cycle_goals ALTER COLUMN month_2_percentage DROP NOT NULL;
    ALTER TABLE cycle_goals ALTER COLUMN month_3_percentage DROP NOT NULL;
    ALTER TABLE cycle_goals ALTER COLUMN average_percentage DROP NOT NULL;
  `);
  console.log('Migrado');
}
run().then(() => process.exit(0));
