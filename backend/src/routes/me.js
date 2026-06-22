import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../db.js';

const router = Router();

// NOTE: there is intentionally NO endpoint for the client to pick a model.
// Model selection is backend-only (see ai.js routing + the iron rules); exposing
// a setter would let a cheaper plan request a pricier model. The preferred_model
// column is now dead and is dropped in a later migration.

router.get('/', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { id: true, email: true, plan: true, uiTheme: true },
  });
  res.json(user);
});

export default router;
