import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../db.js';

const router = Router();
const SALT_ROUNDS = 12;

router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  try {
    const user = await prisma.user.create({ data: { email, passwordHash } });
    const token = jwt.sign({ sub: user.id, plan: user.plan }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, plan: user.plan });
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Email already registered' });
    // Don't let an unexpected DB error escape as an unhandled rejection (crashes the process).
    console.error('[auth] register failed:', e.message);
    return res.status(500).json({ error: '註冊失敗，請稍後再試。' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  // Guard before querying: findUnique({ where: { email: undefined } }) throws and,
  // with no catch here, would crash the process — a one-request DoS.
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ sub: user.id, plan: user.plan }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, plan: user.plan });
});

export default router;
