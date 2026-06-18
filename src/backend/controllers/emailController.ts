import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { pool } from '../../lib/db.js';

export const sendReportEmail = async (req: Request, res: Response) => {
  const { recipientEmail, subject, message } = req.body;

  if (!recipientEmail) {
    return res.status(400).json({ error: 'E-mail do destinatário é obrigatório.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(recipientEmail)) {
    return res.status(400).json({ error: 'Formato de e-mail inválido.' });
  }

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }

  // Busca as credenciais do técnico no banco de dados
  let smtpUser: string | null = null;
  let smtpPass: string | null = null;
  let senderName: string = 'TI Field GO';

  try {
    const result = await pool.query('SELECT name, email, smtp_password FROM technicians WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado no sistema.' });
    }
    const userRow = result.rows[0];
    smtpUser = userRow.email;
    smtpPass = userRow.smtp_password;
    senderName = userRow.name;
  } catch (err) {
    console.error('Erro ao buscar credenciais do técnico:', err);
    return res.status(500).json({ error: 'Erro ao verificar credenciais de e-mail.' });
  }

  if (!smtpUser || !smtpPass) {
    return res.status(403).json({ 
      error: 'E-mail não configurado. Solicite ao administrador que cadastre seu e-mail corporativo e senha de aplicativo no painel.' 
    });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.office365.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false
    }
  });

  const data = req.body.data;
  let advancedHtml = '';

  if (data) {
    const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
    const boolText = (b: boolean) => b ? 'Sim' : 'Não';

    advancedHtml += `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; max-width: 700px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        
        <!-- Header -->
        <div style="background-color: #003366; padding: 20px; text-align: center;">
          <h2 style="color: #fff; margin: 0; font-size: 20px;">Relatório de Visita Técnica</h2>
          <p style="color: #aac4e0; margin: 5px 0 0 0; font-size: 13px;">SAGA - TI Field GO</p>
        </div>

        <!-- Meta Info -->
        <div style="background-color: #f4f7fa; padding: 15px 20px; border-bottom: 1px solid #ddd;">
          <p style="margin: 0 0 5px 0;"><strong>Local:</strong> ${data.locationName}</p>
          <p style="margin: 0 0 5px 0;"><strong>Data da Visita:</strong> ${data.visitDate ? formatDate(data.visitDate) : 'N/A'}</p>
          <p style="margin: 0;"><strong>Técnico:</strong> ${data.technicianName}</p>
        </div>

        <!-- Mensagem do Técnico -->
        <div style="padding: 20px; background: #fff; border-bottom: 1px solid #eee;">
          ${(message || '').replace(/\n/g, '<br/>')}
        </div>
    `;

    // Função auxiliar para renderizar fotos
    const renderPhotos = (photos: any[]) => {
      if (!photos || photos.length === 0) return '';
      const imagesHtml = photos.map(p => {
        const src = p.url || p.previewUrl || (p.base64 ? `data:image/jpeg;base64,${p.base64}` : null);
        if (!src) return '';
        return `<img src="${src}" style="max-width: 200px; max-height: 150px; border-radius: 4px; border: 1px solid #ccc; margin: 5px;" alt="Foto do problema" />`;
      }).join('');
      return imagesHtml ? `<div style="margin-top: 10px;">${imagesHtml}</div>` : '';
    };

    // Detalhamento de Problemas
    let hasProblems = false;
    let problemsHtml = `<div style="padding: 20px; background: #fff;">
      <h3 style="color: #d32f2f; border-bottom: 2px solid #ffcdd2; padding-bottom: 5px; margin-top: 0;">Detalhamento de Anomalias</h3>`;

    // Máquinas com problema
    if (!data.allMachinesOk && data.problematicMachines && data.problematicMachines.length > 0) {
      hasProblems = true;
      problemsHtml += `<h4 style="color: #003366; margin-bottom: 10px;">🖥️ Estações de Trabalho</h4>`;
      data.problematicMachines.forEach((pm: any, idx: number) => {
        problemsHtml += `
          <div style="background: #fff8f8; border-left: 4px solid #d32f2f; padding: 10px 15px; margin-bottom: 15px; border-radius: 0 4px 4px 0;">
            <p style="margin: 0 0 5px 0;"><strong>ID da Máquina:</strong> ${pm.identifier}</p>
            <p style="margin: 0 0 5px 0;"><strong>Processador:</strong> ${pm.processorGen || 'N/A'} | <strong>Windows 11:</strong> ${boolText(pm.osUpdated)}</p>
            <p style="margin: 0 0 10px 0; color: #b71c1c;"><strong>Problema Relatado:</strong> ${pm.problemDescription}</p>
            ${renderPhotos(pm.photos || [])}
          </div>
        `;
      });
    }

    // Pontos de rede com problema
    if (!data.networkPointsOk && data.problematicNetworkPoints && data.problematicNetworkPoints.length > 0) {
      hasProblems = true;
      problemsHtml += `<h4 style="color: #003366; margin-bottom: 10px; margin-top: 20px;">🔌 Pontos de Rede Física</h4>`;
      data.problematicNetworkPoints.forEach((np: any, idx: number) => {
        problemsHtml += `
          <div style="background: #fff8f8; border-left: 4px solid #d32f2f; padding: 10px 15px; margin-bottom: 15px; border-radius: 0 4px 4px 0;">
            <p style="margin: 0 0 5px 0;"><strong>Local do Ponto:</strong> ${np.location}</p>
            <p style="margin: 0 0 10px 0; color: #b71c1c;"><strong>Descrição:</strong> ${np.description}</p>
            ${renderPhotos(np.photos || [])}
          </div>
        `;
      });
    }

    problemsHtml += `</div>`;

    if (hasProblems) {
      advancedHtml += problemsHtml;
    }

    // Fotos do CPD
    if (data.cpdPhotos && data.cpdPhotos.length > 0) {
      advancedHtml += `
        <div style="padding: 20px; background: #fff; border-top: 1px solid #eee;">
          <h3 style="color: #003366; border-bottom: 2px solid #bbdefb; padding-bottom: 5px; margin-top: 0;">📸 Fotos do CPD / Rack</h3>
          ${renderPhotos(data.cpdPhotos)}
        </div>
      `;
    }

    advancedHtml += `
        <!-- Footer -->
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; border-top: 1px solid #ddd;">
          <p style="font-size: 11px; color: #999; margin: 0;">Este e-mail foi gerado automaticamente pelo sistema InfraCheck BR.</p>
        </div>
      </div>
    `;
  } else {
    // Fallback if no data is provided
    advancedHtml = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; max-width: 650px;">
        <div style="background-color: #003366; padding: 16px 24px; border-radius: 6px 6px 0 0;">
          <h2 style="color: #fff; margin: 0; font-size: 18px;">InfraCheck BR — Relatório de Visita Técnica</h2>
          <p style="color: #aac4e0; margin: 4px 0 0 0; font-size: 12px;">SAGA - TI Field GO</p>
        </div>
        <div style="background: #f9f9f9; border: 1px solid #e0e0e0; border-top: none; padding: 24px; border-radius: 0 0 6px 6px; white-space: pre-wrap;">
          ${(message || '').replace(/\n/g, '<br/>')}
        </div>
        <p style="font-size: 11px; color: #999; margin-top: 12px;">Este e-mail foi gerado automaticamente pelo sistema InfraCheck BR.</p>
      </div>
    `;
  }


  try {
    const info = await transporter.sendMail({
      from: `"${senderName}" <${smtpUser}>`,
      to: recipientEmail,
      subject: subject || 'Relatório de Visita Técnica - InfraCheck BR',
      text: message || '',
      html: advancedHtml,
    });

    console.log('E-mail enviado:', info.messageId);
    res.status(200).json({ message: 'E-mail enviado com sucesso!', messageId: info.messageId });
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    res.status(500).json({ error: 'Falha ao enviar e-mail.', details: error instanceof Error ? error.message : String(error) });
  }
};
