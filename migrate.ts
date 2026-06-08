import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pool } from './src/lib/db.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrate() {
  const sqlPath = join(__dirname, 'src', 'lib', 'init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  console.log('🚀 Iniciando migração do banco de dados...');
  
  try {
      await pool.query(sql);
      console.log('✅ Tabelas criadas/verificadas com sucesso!');
  } catch (err) {
      console.error('❌ Erro na migração:', err);
      process.exit(1);
  } finally {
      process.exit(0);
  }
}

migrate();
