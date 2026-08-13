/**
 * csvSyncService.ts
 * Lê a planilha de lideranças da SAGA (CSV com separador ;) e sincroniza
 * a tabela store_contacts no banco de dados.
 *
 * Estrutura do CSV:
 *   Col A (0)  → UF
 *   Col C (2)  → UNIDADE (nome da loja)
 *   Col D (3)  → DEPARTAMENTO: "NOVOS" ou "OFICINA"
 *   Col E (4)  → NOME DO DIRETOR
 *   Col F (5)  → E-MAIL DO DIRETOR
 *   Col I (8)  → NOME DO GERENTE
 *   Col J (9)  → E-MAIL DO GERENTE
 *
 * Uma mesma loja aparece em múltiplas linhas (uma por departamento).
 * O sistema consolida: NOVOS → manager_sales, OFICINA → manager_aftersales.
 */

import { parse } from 'csv-parse/sync';
import { pool } from '../../lib/db.js';

export interface StoreContactRow {
  uf: string;
  store_name: string;
  director_name: string | null;
  director_email: string | null;
  manager_sales_name: string | null;
  manager_sales_email: string | null;
  manager_aftersales_name: string | null;
  manager_aftersales_email: string | null;
}

interface CsvRow {
  uf: string;
  store_name: string;
  department: string;
  director_name: string;
  director_email: string;
  manager_name: string;
  manager_email: string;
}

/** Limpa string: remove espaços extras e retorna null se vazio */
const clean = (s: string): string | null => {
  const trimmed = (s || '').trim().replace(/\r/g, '');
  return trimmed.length > 0 ? trimmed : null;
};

/** Normaliza encoding comum em CSVs brasileiros (substitui caracteres corrompidos) */
const normalizeEncoding = (text: string): string => {
  return text
    .replace(/\u00e2\u0080\u0099/g, "'")
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
};

/**
 * Parseia o buffer do CSV e retorna contatos consolidados por loja.
 */
export const parseCSV = (fileBuffer: Buffer): StoreContactRow[] => {
  const text = normalizeEncoding(fileBuffer.toString('latin1'));

  const rows: string[][] = parse(text, {
    delimiter: ';',
    skip_empty_lines: true,
    relax_column_count: true,
  });

  // Pula o cabeçalho
  const dataRows = rows.slice(1);

  // Extrai os campos relevantes de cada linha
  const csvRows: CsvRow[] = dataRows
    .map(cols => ({
      uf: clean(cols[0]) || '',
      store_name: clean(cols[2]) || '',
      department: (clean(cols[3]) || '').toUpperCase(),
      director_name: clean(cols[4]) || '',
      director_email: clean(cols[5]) || '',
      manager_name: clean(cols[8]) || '',
      manager_email: clean(cols[9]) || '',
    }))
    .filter(r => r.store_name.length > 0);

  // Consolida por UNIDADE (uma loja tem linhas NOVOS e OFICINA)
  const consolidated = new Map<string, StoreContactRow>();

  for (const row of csvRows) {
    const existing = consolidated.get(row.store_name) || {
      uf: row.uf,
      store_name: row.store_name,
      director_name: null,
      director_email: null,
      manager_sales_name: null,
      manager_sales_email: null,
      manager_aftersales_name: null,
      manager_aftersales_email: null,
    };

    // Diretor é igual em todas as linhas — pega o primeiro válido
    if (!existing.director_email && row.director_email) {
      existing.director_name = row.director_name || null;
      existing.director_email = row.director_email || null;
    }

    if (row.department === 'NOVOS') {
      existing.manager_sales_name = row.manager_name || null;
      existing.manager_sales_email = row.manager_email || null;
    } else if (row.department === 'OFICINA') {
      existing.manager_aftersales_name = row.manager_name || null;
      existing.manager_aftersales_email = row.manager_email || null;
    }

    consolidated.set(row.store_name, existing);
  }

  return Array.from(consolidated.values());
};

/**
 * Sincroniza os contatos parseados do CSV com a tabela locations.
 * Usa UPSERT por name (nome da loja).
 */
export const syncStoreContacts = async (fileBuffer: Buffer): Promise<{ synced: number; total: number }> => {
  const contacts = parseCSV(fileBuffer);

  let synced = 0;
  for (const c of contacts) {
    // Insere ou atualiza a tabela locations
    // O region_name pode ser null inicialmente se for uma loja nova
    await pool.query(
      `INSERT INTO locations
         (name, uf, director_name, director_email,
          manager_sales_name, manager_sales_email,
          manager_aftersales_name, manager_aftersales_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (name) DO UPDATE SET
         uf = EXCLUDED.uf,
         director_name = EXCLUDED.director_name,
         director_email = EXCLUDED.director_email,
         manager_sales_name = EXCLUDED.manager_sales_name,
         manager_sales_email = EXCLUDED.manager_sales_email,
         manager_aftersales_name = EXCLUDED.manager_aftersales_name,
         manager_aftersales_email = EXCLUDED.manager_aftersales_email`,
      [
        c.store_name, c.uf,
        c.director_name, c.director_email,
        c.manager_sales_name, c.manager_sales_email,
        c.manager_aftersales_name, c.manager_aftersales_email,
      ]
    );
    synced++;
  }

  return { synced, total: contacts.length };
};

/**
 * Busca os contatos de uma loja específica.
 */
export const getStoreContacts = async (storeName: string): Promise<StoreContactRow | null> => {
  const result = await pool.query(
    `SELECT 
      name as store_name, uf, director_name, director_email,
      manager_sales_name, manager_sales_email,
      manager_aftersales_name, manager_aftersales_email
     FROM locations 
     WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [storeName]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Lista todas as lojas com seus contatos.
 */
export const listStoreContacts = async (): Promise<StoreContactRow[]> => {
  const result = await pool.query(`
    SELECT 
      name as store_name, uf, director_name, director_email,
      manager_sales_name, manager_sales_email,
      manager_aftersales_name, manager_aftersales_email
    FROM locations 
    ORDER BY uf, name
  `);
  return result.rows;
};

