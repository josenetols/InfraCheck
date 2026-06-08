import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { testConnection } from './src/lib/db.js';
import apiRoutes from './src/backend/routes/index.js';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for PDF base64

// Mount MVC API routes
app.use('/api', apiRoutes);

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
  await testConnection();
});
