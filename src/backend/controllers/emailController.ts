import { Request, Response } from 'express';
import nodemailer from 'nodemailer';

export const sendReportEmail = async (req: Request, res: Response) => {
  const { recipientEmail, subject, message, pdfBase64 } = req.body;

  if (!recipientEmail || !pdfBase64) {
    return res.status(400).json({ error: 'Recipient email and PDF are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(recipientEmail)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipientEmail,
      subject: subject || 'Relatório de Checklist - InfraCheck BR',
      text: message || 'Segue em anexo o relatório técnico.',
      attachments: [
        {
          filename: 'Relatorio_Tecnico.pdf',
          content: pdfBase64.split('base64,')[1], // Remove data URI prefix if present
          encoding: 'base64',
        },
      ],
    });

    console.log('Message sent: %s', info.messageId);
    res.status(200).json({ message: 'Email sent successfully!', messageId: info.messageId });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email.', details: error instanceof Error ? error.message : String(error) });
  }
};
