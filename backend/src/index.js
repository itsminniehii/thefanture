import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import prisma from './db.js';
import authRouter from './routes/auth.js';
import usageRouter from './routes/usage.js';
import aiRouter from './routes/ai.js';
import meRouter from './routes/me.js';
import savesRouter from './routes/saves.js';
import settingPacksRouter from './routes/settingPacks.js';

const app = express();

// Behind a single hosting proxy (Render/Vercel etc.) so req.ip reflects the real
// client via X-Forwarded-For — needed for per-IP rate limiting to be meaningful.
app.set('trust proxy', 1);

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:4173',
    ...(process.env.FRONTEND_ORIGIN ? [process.env.FRONTEND_ORIGIN] : []),
  ],
  credentials: true,
}));

app.use(express.json());

// Per-minute rate limits (per IP). General cap guards against spam/bursts; the
// daily turn cap (usage.js) is the real quota. Auth is stricter to slow brute force.
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, max: 60,
  standardHeaders: true, legacyHeaders: false,
  message: { error: '請求過於頻繁，請稍後再試。' },
});
const authLimiter = rateLimit({
  windowMs: 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: '嘗試次數過多，請稍後再試。' },
});

// Health check for external uptime monitors (e.g. UptimeRobot). Registered BEFORE
// the limiter so probes are never throttled. Pings the DB: 200 if reachable, 503 if not.
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.use('/api', generalLimiter);

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/usage', usageRouter);
app.use('/api/ai', aiRouter);
app.use('/api/me', meRouter);
app.use('/api/saves', savesRouter);
app.use('/api/setting-packs', settingPacksRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend listening on :${PORT}`));
