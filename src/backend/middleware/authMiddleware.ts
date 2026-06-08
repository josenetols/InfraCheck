/**
 * Middleware de autenticação e autorização via JWT.
 * Responsável por verificar tokens, extrair dados do usuário
 * e proteger rotas administrativas.
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// ─── Tipo do payload JWT ──────────────────────────────────────────────

export interface JwtPayload {
  id: string;
  name: string;
  username: string;
  region_name: string;
  role: 'admin' | 'technician';
}

// ─── Extensão do Request do Express ───────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

const getSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET não definido nas variáveis de ambiente.');
  }
  return secret;
};

const getExpiration = (): string => {
  return process.env.JWT_EXPIRES_IN || '8h';
};

// ─── Funções Exportadas ───────────────────────────────────────────────

/** Gera um token JWT assinado com os dados do usuário */
export const generateToken = (payload: any) => {
  return jwt.sign(payload, getSecret(), { expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as any });
};

/**
 * Middleware: exige autenticação válida.
 * Extrai o token do header Authorization e popula req.user.
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticação ausente.' });
    return;
  }

  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, getSecret()) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    const message = err instanceof jwt.TokenExpiredError
      ? 'Token expirado. Faça login novamente.'
      : 'Token inválido.';
    res.status(401).json({ error: message });
  }
};

/**
 * Middleware: exige role 'admin'.
 * Deve ser usado APÓS requireAuth.
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Usuário não autenticado.' });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Acesso restrito a administradores.' });
    return;
  }

  next();
};
