import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((a, b) => {
  const i = b.indexOf('=');
  if (i > 0) a[b.substring(0, i).trim()] = b.substring(i + 1).trim();
  return a;
}, {});

const pool = new Pool({
  connectionString: env['DATABASE_URL'],
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  console.log('Iniciando migração de Metas por Ciclo...');
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('1. Adicionando UUID em locations...');
    await client.query(`
      ALTER TABLE locations ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
      DO $$ BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'locations_id_unique'
        ) THEN
            ALTER TABLE locations ADD CONSTRAINT locations_id_unique UNIQUE (id);
        END IF;
      END $$;
    `);

    console.log('2. Atualizando tabelas com chaves estrangeiras de IDs...');
    await client.query(`
      ALTER TABLE assignments ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id);
      ALTER TABLE assignments ADD COLUMN IF NOT EXISTS technician_id TEXT REFERENCES technicians(id);
      ALTER TABLE assignments ADD COLUMN IF NOT EXISTS year INTEGER;
      ALTER TABLE assignments ADD COLUMN IF NOT EXISTS cycle INTEGER;
      ALTER TABLE assignments ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
      ALTER TABLE assignments ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;
      ALTER TABLE assignments ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

      ALTER TABLE checklists ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id);
      ALTER TABLE checklists ADD COLUMN IF NOT EXISTS technician_id TEXT REFERENCES technicians(id);
      ALTER TABLE checklists ADD COLUMN IF NOT EXISTS year INTEGER;
      ALTER TABLE checklists ADD COLUMN IF NOT EXISTS cycle INTEGER;
      ALTER TABLE checklists ADD COLUMN IF NOT EXISTS month INTEGER;
    `);

    console.log('3. Populando location_id e technician_id nas tabelas...');
    await client.query(`
      UPDATE assignments a
      SET 
        location_id = l.id,
        technician_id = t.id
      FROM locations l, technicians t
      WHERE a.location_name = l.name AND a.technician_name = t.name;

      UPDATE checklists c
      SET 
        location_id = l.id,
        technician_id = t.id
      FROM locations l, technicians t
      WHERE c.location_name = l.name AND c.technician_name = t.name;
    `);

    console.log('4. Populando datas de checklists e assignments...');
    // Para checklists, extrair ano, mes, ciclo da data de visita
    await client.query(`
      UPDATE checklists
      SET 
        year = EXTRACT(YEAR FROM visit_date),
        month = EXTRACT(MONTH FROM visit_date),
        cycle = FLOOR((EXTRACT(MONTH FROM visit_date) - 1) / 4) + 1
      WHERE year IS NULL;
    `);

    // Para assignments, converter month_key (YYYY-MM) para year, cycle, start_date
    const assignmentsRes = await client.query(`SELECT id, month_key FROM assignments WHERE year IS NULL`);
    for (const a of assignmentsRes.rows) {
      if (!a.month_key) continue;
      const [y, m] = a.month_key.split('-');
      const year = parseInt(y, 10);
      const month = parseInt(m, 10);
      const cycle = Math.floor((month - 1) / 4) + 1;
      const startDateStr = `${y}-${m}-01T00:00:00Z`;
      
      await client.query(`
        UPDATE assignments
        SET year = $1, cycle = $2, start_date = $3
        WHERE id = $4
      `, [year, cycle, startDateStr, a.id]);
    }

    console.log('5. Criando tabelas monthly_goals e cycle_goals...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS monthly_goals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          technician_id TEXT NOT NULL REFERENCES technicians(id),
          year INTEGER NOT NULL,
          cycle INTEGER NOT NULL,
          month INTEGER NOT NULL,
          position_in_cycle INTEGER NOT NULL,
          assigned_locations INTEGER NOT NULL DEFAULT 0,
          expected_checklists INTEGER NOT NULL DEFAULT 0,
          completed_checklists INTEGER NOT NULL DEFAULT 0,
          percentage NUMERIC(10,4),
          status TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(technician_id, year, cycle, month)
      );

      CREATE TABLE IF NOT EXISTS cycle_goals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          technician_id TEXT NOT NULL REFERENCES technicians(id),
          year INTEGER NOT NULL,
          cycle INTEGER NOT NULL,
          month_1_percentage NUMERIC(10,4),
          month_2_percentage NUMERIC(10,4),
          month_3_percentage NUMERIC(10,4),
          average_percentage NUMERIC(10,4),
          status TEXT NOT NULL,
          closed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(technician_id, year, cycle)
      );
    `);

    await client.query('COMMIT');
    console.log('✅ Migração concluída com sucesso!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na migração:', error);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
