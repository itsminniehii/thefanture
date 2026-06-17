import 'dotenv/config';
import express from 'express';
import authRouter from './routes/auth.js';
import usageRouter from './routes/usage.js';
import aiRouter from './routes/ai.js';

const app = express();
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/usage', usageRouter);
app.use('/api/ai', aiRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend listening on :${PORT}`));
