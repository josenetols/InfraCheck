/**
 * Módulo de conexão com o banco de dados PostgreSQL.
 * Pool criado de forma lazy para garantir que as variáveis de ambiente
 * já estejam carregadas pelo dotenv antes da instanciação.
 */

import pg from 'pg';

const { Pool } = pg;

let _pool: pg.Pool | null = null;

/** 
 * Retorna (ou cria na primeira chamada) o pool de conexões. 
 * Exportado para permitir uso de client.connect() e transações no servidor.
 */
export function getPool(): pg.Pool {
  if (!_pool) {
    if (process.env.DATABASE_URL) {
      _pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // Necessário para nuvem (Supabase/Railway)
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    } else {
      _pool = new Pool({
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME     || 'infracheck',
        user:     process.env.DB_USER     || 'infracheck_user',
        password: String(process.env.DB_PASS || ''),
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    }
  }
  return _pool;
}

/** 
 * Objeto conveniente para consultas simples.
 * Mantido para compatibilidade, mas encaminha para o Pool real.
 */
export const pool = {
  query: (text: string, params?: any[]) => getPool().query(text, params),
  connect: () => getPool().connect(),
};

/** Testa a conexão ao iniciar o servidor */
export async function testConnection(): Promise<void> {
  const client = await getPool().connect();
  try {
    const result = await client.query('SELECT NOW() AS hora_atual');
    console.log('✅ PostgreSQL conectado:', result.rows[0].hora_atual);
  } finally {
    client.release();
  }
}
