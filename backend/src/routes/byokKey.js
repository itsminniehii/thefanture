import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../db.js';
import { encryptKey } from '../crypto.js';

const router = Router();

// Storage-only API for a user's own provider API key (BYOK). This route ONLY
// encrypts-at-rest and reports presence; it does not pick models or call any
// provider — that wiring lives in the AI route in a later phase.
// Never log, echo, or return the plaintext key or its ciphertext.

const MIN_KEY_LEN = 8;
const MAX_KEY_LEN = 512;

// PUT /api/byok-key — store the user's API key, encrypted. Body: { key }.
router.put('/', requireAuth, async (req, res) => {
  const { key } = req.body ?? {};
  if (typeof key !== 'string') {
    return res.status(400).json({ error: 'key is required' });
  }
  const trimmed = key.trim();
  if (trimmed.length < MIN_KEY_LEN || trimmed.length > MAX_KEY_LEN) {
    return res.status(400).json({ error: 'key length is invalid' });
  }

  const byokKeyEncrypted = encryptKey(trimmed);
  await prisma.user.update({
    where: { id: req.user.sub },
    data: { byokKeyEncrypted },
  });

  // Success only — never return the key or ciphertext.
  res.json({ ok: true });
});

// DELETE /api/byok-key — let the user revoke their stored key.
router.delete('/', requireAuth, async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.sub },
    data: { byokKeyEncrypted: null },
  });
  res.json({ ok: true });
});

// GET /api/byok-key — presence only, never the content.
router.get('/', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { byokKeyEncrypted: true },
  });
  res.json({ hasKey: !!user?.byokKeyEncrypted });
});

export default router;
