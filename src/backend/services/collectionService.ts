/**
 * collectionService.ts
 * Core da lógica da Régua de Cobrança.
 * Gerencia o estado de escalonamento por loja/mês e dispara os e-mails.
 */

import nodemailer from 'nodemailer';
import { pool } from '../../lib/db.js';
import { getStoreContacts, StoreContactRow } from './csvSyncService.js';
import { getLatestChecklistByLocation, extractPendingItems } from '../models/checklistModel.js';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface TISupervisor {
  id: string;
  name: string;
  email: string;
  ti_role: 'coordinator' | 'manager' | 'director';
  active: boolean;
}

export interface CollectionState {
  id: string;
  store_name: string;
  month: string;
  current_level: number;
  last_sent_at: string | null;
  last_sent_by: string | null;
}

export interface EmailRecipients {
  to: { name: string; email: string }[];
  cc: { name: string; email: string }[];
}

export interface CollectionPreview {
  store: StoreContactRow | null;
  tiTeam: {
    technicians: { name: string; email: string }[];
    coordinator: TISupervisor | null;
    manager: TISupervisor | null;
    director: TISupervisor | null;
  };
  state: CollectionState | null;
  currentLevel: number;
  nextLevel: number;
  recipients: EmailRecipients;
  canFire: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const addr = (name: string | null, email: string | null) =>
  name && email ? { name, email } : null;

const compact = (list: (ReturnType<typeof addr>)[]): { name: string; email: string }[] =>
  list.filter((x): x is { name: string; email: string } => x !== null && x.email.length > 0);

// ─── TI Team ─────────────────────────────────────────────────────────────────

export const getTITeam = async () => {
  const [supervisors, technicians] = await Promise.all([
    pool.query(
      `SELECT id, name, email, ti_role, active FROM ti_supervisors WHERE active = true ORDER BY ti_role`
    ),
    pool.query(
      `SELECT name, email FROM technicians WHERE active = true AND role = 'technician' AND email IS NOT NULL ORDER BY name`
    ),
  ]);

  const sups: TISupervisor[] = supervisors.rows;
  const techs: { name: string; email: string }[] = technicians.rows;

  return {
    technicians: techs,
    coordinator: sups.find(s => s.ti_role === 'coordinator') || null,
    manager:     sups.find(s => s.ti_role === 'manager')     || null,
    director:    sups.find(s => s.ti_role === 'director')    || null,
    all:         sups,
  };
};

// ─── Lógica de destinatários por nível ───────────────────────────────────────

/**
 * Monta os destinatários (To e CC) conforme o nível de cobrança.
 *
 * Nível 1: To = Gerente Vendas + Gerente Pós-Venda
 *          CC = Técnicos + Coordenador TI + Gestor TI
 *
 * Nível 2: To = Diretor da Loja
 *          CC = Gerentes + Técnicos + Coordenador TI + Gestor TI
 *
 * Nível 3: To = Diretor da Loja (mensagem reforçada)
 *          CC = Gerentes + Técnicos + Coordenador TI + Gestor TI
 *
 * Nível 4: To = Diretor de TI
 *          CC = Diretor Loja + Gerentes + Técnicos + Coordenador TI + Gestor TI
 */
export const buildEmailRecipients = (
  level: number,
  store: StoreContactRow,
  tiTeam: Awaited<ReturnType<typeof getTITeam>>
): EmailRecipients => {
  const salesMgr       = addr(store.manager_sales_name, store.manager_sales_email);
  const aftersalesMgr  = addr(store.manager_aftersales_name, store.manager_aftersales_email);
  const director       = addr(store.director_name, store.director_email);
  const coordinator    = tiTeam.coordinator ? addr(tiTeam.coordinator.name, tiTeam.coordinator.email) : null;
  const tiManager      = tiTeam.manager     ? addr(tiTeam.manager.name,     tiTeam.manager.email)     : null;
  const tiDirector     = tiTeam.director    ? addr(tiTeam.director.name,    tiTeam.director.email)    : null;
  const technicians    = tiTeam.technicians.map(t => addr(t.name, t.email));

  const baseCC = compact([...technicians, coordinator, tiManager]);
  const managers = compact([salesMgr, aftersalesMgr]);

  switch (level) {
    case 1:
      return {
        to: managers,
        cc: baseCC,
      };
    case 2:
      return {
        to: compact([director]),
        cc: [...managers, ...baseCC],
      };
    case 3:
      return {
        to: compact([director]),
        cc: [...managers, ...baseCC],
      };
    case 4:
      return {
        to: compact([tiDirector]),
        cc: [...compact([director]), ...managers, ...baseCC],
      };
    default:
      return { to: [], cc: [] };
  }
};

// ─── Emails de cobrança ───────────────────────────────────────────────────────

const LEVEL_SUBJECTS: Record<number, string> = {
  1: 'Checklist de Infraestrutura Pendente — Ação Necessária',
  2: '⚠️ 1ª Cobrança — Checklist de TI ainda pendente',
  3: '🔴 2ª Cobrança — Checklist de TI sem resposta',
  4: '🚨 Escalonamento Máximo — Checklist de TI pendente sem solução',
};

const buildEmailBody = (
  level: number,
  storeName: string,
  month: string,
  sentBy: string,
  pendingItems: { category: string; description: string }[] = []
): string => {
  const monthLabel = new Date(`${month}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const levelMessages: Record<number, string> = {
    1: `Prezado(a),<br><br>
       Informamos que o <strong>Checklist Mensal de Infraestrutura de TI</strong> referente ao mês de <strong>${monthLabel}</strong>
       da unidade <strong>${storeName}</strong> ainda não foi realizado ou está com pendências.<br><br>
       Solicitamos que seja providenciada a disponibilização do espaço e contato com o responsável para que nossa equipe técnica possa realizar a visita.<br><br>
       Em caso de dúvidas, entre em contato com a equipe de TI.`,

    2: `Prezado(a) Diretor(a),<br><br>
       Esta é a <strong>primeira cobrança formal</strong> referente ao <strong>Checklist Mensal de Infraestrutura de TI</strong>
       de <strong>${monthLabel}</strong> da unidade <strong>${storeName}</strong>.<br><br>
       Os gerentes responsáveis foram notificados anteriormente, porém o checklist permanece pendente.
       Solicitamos sua intervenção para que seja regularizada a situação.`,

    3: `Prezado(a) Diretor(a),<br><br>
       Esta é a <strong>segunda e última cobrança</strong> diretamente ao(à) senhor(a) referente ao 
       <strong>Checklist Mensal de Infraestrutura de TI</strong> de <strong>${monthLabel}</strong> — <strong>${storeName}</strong>.<br><br>
       Não houve resposta às notificações anteriores. Caso não haja providências, o caso será escalado para a Diretoria de TI.`,

    4: `Prezado(a) Diretor(a) de TI,<br><br>
       Informamos que após <strong>3 notificações</strong> (gerentes e diretor da loja), o 
       <strong>Checklist Mensal de Infraestrutura de TI</strong> de <strong>${monthLabel}</strong>
       da unidade <strong>${storeName}</strong> permanece sem solução.<br><br>
       Solicitamos orientação e intervenção para regularização imediata.`,
  };

  // Seção de pendências reais do checklist
  const pendingSection = pendingItems.length > 0
    ? `<div style="margin-top: 20px; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden;">
        <div style="background: #fff3e0; padding: 10px 16px; border-bottom: 1px solid #e0e0e0;">
          <strong style="color: #e65100; font-size: 13px;">⚠️ Itens Pendentes Identificados no Checklist (${pendingItems.length})</strong>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 8px 12px; text-align: left; color: #555; font-weight: bold; width: 35%;">Categoria</th>
              <th style="padding: 8px 12px; text-align: left; color: #555; font-weight: bold;">Descrição</th>
            </tr>
          </thead>
          <tbody>
            ${pendingItems.map((item, idx) => `
              <tr style="background: ${idx % 2 === 0 ? '#fff' : '#fafafa'}; border-top: 1px solid #eee;">
                <td style="padding: 8px 12px; color: #c62828; font-weight: bold;">${item.category}</td>
                <td style="padding: 8px 12px; color: #333;">${item.description}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`
    : '';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
      <div style="background: #003366; padding: 20px; text-align: center;">
        <h2 style="color: #fff; margin: 0; font-size: 18px;">Régua de Cobrança — Checklist de TI</h2>
        <p style="color: #aac4e0; margin: 6px 0 0; font-size: 12px;">SAGA Grupo — Equipe de Infraestrutura</p>
      </div>
      <div style="padding: 24px; background: #fff;">
        <div style="background: ${level >= 4 ? '#fff3e0' : level >= 3 ? '#fff8e1' : '#f9f9f9'};
                    border-left: 4px solid ${level >= 4 ? '#e53935' : level >= 3 ? '#f57c00' : '#1565c0'};
                    padding: 12px 16px; border-radius: 0 4px 4px 0; margin-bottom: 20px;">
          <strong>Nível ${level} de 4</strong> — ${LEVEL_SUBJECTS[level]}
        </div>
        <p>${levelMessages[level]}</p>
        ${pendingSection}
        <br>
        <p style="color: #555; font-size: 13px;">Disparado por: <strong>${sentBy}</strong></p>
      </div>
      <div style="background: #f9f9f9; padding: 12px; text-align: center; border-top: 1px solid #eee;">
        <p style="font-size: 11px; color: #999; margin: 0;">
          Este e-mail foi gerado automaticamente pelo sistema InfraCheck BR.
        </p>
      </div>
    </div>`;
};

// ─── Estado ───────────────────────────────────────────────────────────────────

export const getCollectionState = async (storeName: string, month: string): Promise<CollectionState | null> => {
  const result = await pool.query(
    `SELECT * FROM collection_state WHERE LOWER(store_name) = LOWER($1) AND month = $2 LIMIT 1`,
    [storeName, month]
  );
  const rows: CollectionState[] = result.rows;
  return rows[0] || null;
};

export const getCurrentMonth = () => new Date().toISOString().slice(0, 7); // 'YYYY-MM'

// ─── Preview ─────────────────────────────────────────────────────────────────

export const previewCollection = async (storeName: string, month?: string): Promise<CollectionPreview> => {
  const m = month || getCurrentMonth();
  const [store, tiTeam, state] = await Promise.all([
    getStoreContacts(storeName),
    getTITeam(),
    getCollectionState(storeName, m),
  ]);

  const currentLevel = state?.current_level || 0;
  const nextLevel = Math.min(currentLevel + 1, 4);
  const canFire = nextLevel <= 4 && currentLevel < 4;

  const recipients = store && canFire
    ? buildEmailRecipients(nextLevel, store, tiTeam)
    : { to: [], cc: [] };

  return { store, tiTeam, state, currentLevel, nextLevel, recipients, canFire };
};

// ─── Disparo ─────────────────────────────────────────────────────────────────

export interface FireCollectionOptions {
  storeName: string;
  month?: string;
  technicianName: string;
  smtpUser: string;
  smtpPass: string;
  autoFired?: boolean; // true = disparo automático do job PM2, false = disparo manual
}

export const fireCollection = async (opts: FireCollectionOptions): Promise<{ level: number; messageId: string }> => {
  const m = opts.month || getCurrentMonth();
  const preview = await previewCollection(opts.storeName, m);

  if (!preview.canFire) {
    throw new Error('Cobrança já no nível máximo (4) ou loja sem contatos cadastrados.');
  }
  if (!preview.store) {
    throw new Error(`Contatos da loja "${opts.storeName}" não encontrados. Sincronize a planilha CSV.`);
  }
  if (preview.recipients.to.length === 0) {
    throw new Error(`Nenhum destinatário encontrado para o nível ${preview.nextLevel}. Verifique os contatos da loja.`);
  }

  const level = preview.nextLevel;

  // Busca o checklist mais recente da loja e extrai pendências reais
  const latestChecklist = await getLatestChecklistByLocation(opts.storeName);
  const pendingItems = latestChecklist ? extractPendingItems(latestChecklist.data) : [];

  // Monta o transporter com o SMTP do técnico logado
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.office365.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: opts.smtpUser, pass: opts.smtpPass },
    tls: { ciphers: 'SSLv3', rejectUnauthorized: false },
  });

  const toAddresses = preview.recipients.to.map(r => `"${r.name}" <${r.email}>`).join(', ');
  const ccAddresses = preview.recipients.cc.map(r => `"${r.name}" <${r.email}>`).join(', ');

  const info = await transporter.sendMail({
    from:    `"${opts.technicianName}" <${opts.smtpUser}>`,
    to:      toAddresses,
    cc:      ccAddresses || undefined,
    subject: LEVEL_SUBJECTS[level],
    html:    buildEmailBody(level, opts.storeName, m, opts.technicianName, pendingItems),
  });

  // Atualiza o estado no banco
  await pool.query(
    `INSERT INTO collection_state (store_name, month, current_level, last_sent_at, last_sent_by, auto_fired)
     VALUES ($1, $2, $3, NOW(), $4, $5)
     ON CONFLICT (store_name, month) DO UPDATE SET
       current_level = EXCLUDED.current_level,
       last_sent_at  = NOW(),
       last_sent_by  = EXCLUDED.last_sent_by,
       auto_fired    = EXCLUDED.auto_fired`,
    [opts.storeName, m, level, opts.technicianName, opts.autoFired ?? false]
  );

  console.log(`[Collection] Nível ${level} disparado para "${opts.storeName}" por ${opts.technicianName}. MsgID: ${info.messageId}`);
  return { level, messageId: info.messageId };
};

// ─── Reset ────────────────────────────────────────────────────────────────────

export const resetCollectionState = async (storeName: string, month: string): Promise<void> => {
  await pool.query(
    `DELETE FROM collection_state WHERE LOWER(store_name) = LOWER($1) AND month = $2`,
    [storeName, month]
  );
};

// ─── Lista estados do mês ─────────────────────────────────────────────────────

// ─── Resolver Cobrança ───────────────────────────────────────────────────────

export const resolveCollection = async (
  storeName: string,
  month: string,
  resolvedBy: string
): Promise<void> => {
  await pool.query(
    `UPDATE collection_state
     SET resolved_at = NOW(), resolved_by = $1
     WHERE LOWER(store_name) = LOWER($2) AND month = $3`,
    [resolvedBy, storeName, month]
  );
  console.log(`[Collection] Resolvido: "${storeName}" mês ${month} por ${resolvedBy}`);
};

export const listCollectionStates = async (month: string): Promise<CollectionState[]> => {
  const result = await pool.query(
    `SELECT * FROM collection_state WHERE month = $1 ORDER BY last_sent_at DESC`,
    [month]
  );
  return result.rows as CollectionState[];
};

// ─── CRUD Supervisores TI ─────────────────────────────────────────────────────

export const listSupervisors = async (): Promise<TISupervisor[]> => {
  const r = await pool.query(
    `SELECT id, name, email, ti_role, active FROM ti_supervisors WHERE active = true ORDER BY ti_role, name`
  );
  return r.rows as TISupervisor[];
};

export const addSupervisor = async (data: { name: string; email: string; ti_role: string }): Promise<TISupervisor> => {
  const r = await pool.query(
    `INSERT INTO ti_supervisors (name, email, ti_role) VALUES ($1, $2, $3) RETURNING *`,
    [data.name, data.email, data.ti_role]
  );
  return r.rows[0] as TISupervisor;
};

export const removeSupervisor = async (id: string): Promise<void> => {
  await pool.query(`UPDATE ti_supervisors SET active = false WHERE id = $1`, [id]);
};
