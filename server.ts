import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { testConnection } from './src/lib/db.js';
import apiRoutes from './src/backend/routes/index.js';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Content-Security-Policy fica desabilitada por ora: o index.html carrega
// scripts/estilos de CDNs externos (Tailwind CDN, Google Fonts) que exigiriam
// diretivas explícitas. Os demais headers de segurança do helmet permanecem ativos.
app.use(helmet({ contentSecurityPolicy: false }));

// CORS restrito: por padrão só aceita requisições same-origin (front e API
// no mesmo processo Express). Para liberar origens externas, defina
// ALLOWED_ORIGINS="https://exemplo.com,https://outro.com" no ambiente.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins.length > 0 ? allowedOrigins : false }));

app.use(express.json({ limit: '100mb' })); // Limite maior para imagens base64 e PDFs
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Mount MVC API routes
app.use('/api', apiRoutes);

// Handler global de erro para JSON malformado (ex: imagens base64 com chars especiais)
// DEVE vir DEPOIS das rotas para capturar erros de parse
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    console.error('[JSON Parse Error]', err.message);
    res.status(400).json({ error: 'Corpo da requisição inválido. Verifique o formato JSON enviado.' });
    return;
  }
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// Vite middleware for development
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  // Serve static files in production
  app.use(express.static('dist'));
}

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  try {
    await testConnection();
  } catch (err) {
    console.error('⚠️  Aviso: Falha ao testar conexão com BD na inicialização:', err);
    // Não crasha o servidor — a conexão pode estar disponível mais tarde
  }
});
