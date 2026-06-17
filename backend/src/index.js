import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import usageRouter from './routes/usage.js';
import aiRouter from './routes/ai.js';
import meRouter from './routes/me.js';

const app = express();

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:4173',
    ...(process.env.FRONTEND_ORIGIN ? [process.env.FRONTEND_ORIGIN] : []),
  ],
  credentials: true,
}));

app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/usage', usageRouter);
app.use('/api/ai', aiRouter);
app.use('/api/me', meRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend listening on :${PORT}`));
