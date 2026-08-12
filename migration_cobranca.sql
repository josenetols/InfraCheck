-- Migration para a Régua de Cobrança Automática

-- 1. Tabela de Liderança de TI (nova)
CREATE TABLE IF NOT EXISTS ti_supervisors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  ti_role TEXT NOT NULL CHECK (ti_role IN ('coordinator', 'manager', 'director')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Contatos das Lojas (criada anteriormente, garantindo existência)
CREATE TABLE IF NOT EXISTS store_contacts (
  uf TEXT,
  store_name TEXT PRIMARY KEY,
  director_name TEXT,
  director_email TEXT,
  manager_sales_name TEXT,
  manager_sales_email TEXT,
  manager_aftersales_name TEXT,
  manager_aftersales_email TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Adicionando vínculo CSV nas locations
ALTER TABLE locations ADD COLUMN IF NOT EXISTS store_contact_name TEXT;

-- 4. Adicionando campos novos na collection_state
ALTER TABLE collection_state ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE collection_state ADD COLUMN IF NOT EXISTS resolved_by TEXT;
ALTER TABLE collection_state ADD COLUMN IF NOT EXISTS auto_fired BOOLEAN DEFAULT false;
