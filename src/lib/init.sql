-- ─── Esquema de Banco de Dados InfraCheck ──────────────────────────────

-- Limpeza (Opcional: Remover em produção)
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS checklists CASCADE;
DROP TABLE IF EXISTS technicians CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS regions CASCADE;

-- 0. Tabela de Regiões
CREATE TABLE IF NOT EXISTS regions (
    name TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1. Tabela de Técnicos (com autenticação)
CREATE TABLE IF NOT EXISTS technicians (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    active BOOLEAN DEFAULT true,
    region_name TEXT REFERENCES regions(name) ON DELETE SET NULL,
    role TEXT NOT NULL DEFAULT 'technician' CHECK (role IN ('admin', 'technician')),
    password_hash TEXT,
    must_change_password BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Lojas
CREATE TABLE IF NOT EXISTS locations (
    name TEXT PRIMARY KEY,
    region_name TEXT REFERENCES regions(name) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela Principal de Checklists
CREATE TABLE IF NOT EXISTS checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_name TEXT NOT NULL,
    technician_name TEXT NOT NULL,
    visit_date TIMESTAMPTZ NOT NULL,
    data JSONB NOT NULL,
    is_baseline BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Fotos
CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    checklist_id UUID REFERENCES checklists(id) ON DELETE CASCADE,
    section TEXT,
    filename TEXT,
    mime_type TEXT,
    size INTEGER,
    blob_data BYTEA,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela de Atribuições Mensais
CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    month_key TEXT NOT NULL,
    location_name TEXT NOT NULL REFERENCES locations(name) ON DELETE CASCADE,
    technician_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(month_key, location_name)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_checklists_location ON checklists(location_name);
CREATE INDEX IF NOT EXISTS idx_checklists_date ON checklists(visit_date);
CREATE INDEX IF NOT EXISTS idx_assignments_month ON assignments(month_key);

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_checklists_updated_at'
  ) THEN
    CREATE TRIGGER update_checklists_updated_at
      BEFORE UPDATE ON checklists
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_technicians_updated_at'
  ) THEN
    CREATE TRIGGER update_technicians_updated_at
      BEFORE UPDATE ON technicians
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ─── Seed Inicial ───────────────────────────────────────────────────

-- Regiões
INSERT INTO regions (name) VALUES ('GO'), ('SP'), ('DF'), ('MG') ON CONFLICT DO NOTHING;

-- Lojas GO
INSERT INTO locations (name, region_name) VALUES 
('Volkswagen T7', 'GO'), ('Toyota T7', 'GO'), ('RAM Castelo Branco', 'GO'), ('Marketing Galpão', 'GO'),
('Compliance', 'GO'), ('Primeira Mão T7', 'GO'), ('Primeira Mão Off Road T7', 'GO'), ('BYD Marista', 'GO'),
('Tudo Chevrolet Mutirão', 'GO'), ('Nissan 85', 'GO'), ('Primeira Mão 85', 'GO'), ('BMW Carros', 'GO'),
('CRT', 'GO'), ('Jeep / RAM BR', 'GO'), ('Triumph', 'GO'), ('BMW Motos', 'GO'), ('Seminovos Motos', 'GO'),
('Tudo Chevrolet Buriti', 'GO'), ('Toyota Buriti', 'GO'), ('Primeira Mão Buriti', 'GO'), ('Hyundai T9', 'GO'),
('Jeep T9', 'GO'), ('BYD Cidade Jardim', 'GO'), ('Hyundai Cidade Jardim', 'GO'), ('Primeira Mão Cidade Jardim', 'GO'),
('Outlet Shopping', 'GO'), ('Primeira Mão Shopping', 'GO'), ('Toyota Anapolis', 'GO'), ('Hyundai Anapolis', 'GO'),
('Primeira Mão Anapolis', 'GO'), ('Jeep / RAM Anapolis', 'GO'), ('Nissan Anapolis', 'GO'), ('Fazendinha', 'GO'),
('Primeira Mão Galpão', 'GO'), ('Primeira Mão Digital Galpão', 'GO'), ('Corretora', 'GO'), ('Seguros', 'GO'),
('CSC', 'GO'), ('DP', 'GO'), ('Contabilidade', 'GO'), ('Controladoria', 'GO'), ('Administrativo', 'GO'),
('Diretoria', 'GO'), ('Auditoria Galpão', 'GO'), ('Compras Galpão', 'GO'), ('RH Galpão', 'GO'), ('Compras CRT', 'GO'),
('CRT Galpão', 'GO'), ('Marketing BYD', 'GO'), ('CRM T.I', 'GO'), ('Compliance Galpão', 'GO')
ON CONFLICT DO NOTHING;

-- Técnicos (password_hash NULL = primeiro acesso exigirá criação de senha)
INSERT INTO technicians (id, name, username, active, region_name, role, password_hash, must_change_password)
VALUES 
    ('tech-1', 'José Neto de Oliveira Silva', 'joseneto', true, 'GO', 'admin', NULL, true),
    ('tech-2', 'Felipe Agustos Costa Souza', 'felipe', true, 'GO', 'technician', NULL, true),
    ('tech-3', 'Rone Augusto Oliveira Jacob', 'rone', true, 'GO', 'technician', NULL, true),
    ('tech-4', 'Matheus Cavalcante dos Reis', 'matheus', true, 'GO', 'technician', NULL, true)
ON CONFLICT (id) DO UPDATE SET 
    username = EXCLUDED.username,
    role = EXCLUDED.role,
    name = EXCLUDED.name,
    region_name = EXCLUDED.region_name;
