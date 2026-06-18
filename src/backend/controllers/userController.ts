import { Request, Response } from 'express';
import * as userModel from '../models/userModel.js';

export const getUsers = async (_req: Request, res: Response) => {
  try {
    const users = await userModel.getUsers();
    res.json(users);
  } catch (err) {
    console.error('Erro ao buscar usuários:', err);
    res.status(500).json({ error: 'Erro ao buscar usuários do banco.' });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const { name, username, password, role, region_name, email, smtp_password } = req.body;

    // Apenas name e username são obrigatórios.
    // Password é opcional — usuário define no primeiro login.
    // Role tem default 'technician' se não informado.
    if (!name || !username) {
      res.status(400).json({ error: 'Nome e username são obrigatórios.' });
      return;
    }

    if (username.length < 3 || username.includes(' ')) {
      res.status(400).json({ error: 'Username deve ter no mínimo 3 caracteres e sem espaços.' });
      return;
    }

    const existingUser = await userModel.getUserByUsername(username);
    if (existingUser) {
      res.status(400).json({ error: 'Username já existe.' });
      return;
    }

    const id = await userModel.createUser({
      name,
      username,
      password: password || undefined,          // null → sem senha (primeiro acesso)
      role: role || 'technician',               // default: técnico operacional
      region_name,
      email,
      smtp_password,
    });

    res.status(201).json({ message: 'Usuário cadastrado com sucesso!', id });
  } catch (err) {
    console.error('Erro ao salvar usuário:', err);
    res.status(500).json({ error: 'Falha ao persistir usuário.' });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, username, role, region_name, email, smtp_password } = req.body;

    if (!name || !username || !role) {
      res.status(400).json({ error: 'Nome, username e role são obrigatórios para edição.' });
      return;
    }

    if (username.length < 3 || username.includes(' ')) {
      res.status(400).json({ error: 'Username deve ter no mínimo 3 caracteres e sem espaços.' });
      return;
    }

    // Valida se o username novo colide com outro usuário ativo
    const existingUser = await userModel.getUserByUsername(username);
    if (existingUser && existingUser.id !== id) {
      res.status(400).json({ error: 'Username já está em uso por outro cadastro.' });
      return;
    }

    await userModel.updateUser(id, { name, username, role, region_name, email, smtp_password });
    res.json({ message: 'Usuário atualizado com sucesso!' });
  } catch (err) {
    console.error('Erro ao atualizar usuário:', err);
    res.status(500).json({ error: 'Falha ao atualizar usuário.' });
  }
};

export const updatePassword = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres.' });
      return;
    }

    await userModel.updatePassword(id, newPassword);
    res.json({ message: 'Senha redefinida com sucesso!' });
  } catch (err) {
    console.error('Erro ao redefinir senha do usuário:', err);
    res.status(500).json({ error: 'Falha ao redefinir senha.' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await userModel.deleteUser(id);
    res.json({ message: 'Usuário removido com sucesso.' });
  } catch (err) {
    console.error('Erro ao deletar usuário:', err);
    res.status(500).json({ error: 'Erro ao remover usuário.' });
  }
};
