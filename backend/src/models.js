// Central model registry. Change a provider's model string in ONE place here.
// Gemini strings get retired periodically — when a call 404s, swap the string
// for the current same-tier model and nothing else in the codebase changes.

export const MODELS = {
  // logical name        provider     modelString
  'opus':               { provider: 'anthropic', modelString: 'claude-opus-4-8' },
  'sonnet':             { provider: 'anthropic', modelString: 'claude-sonnet-4-6' },
  'haiku':              { provider: 'anthropic', modelString: 'claude-haiku-4-5-20251001' },
  'gemini-pro':         { provider: 'google',    modelString: 'gemini-2.5-pro' },
  'gemini-flash':       { provider: 'google',    modelString: 'gemini-2.5-flash' },
  'gemini-flash-lite':  { provider: 'google',    modelString: 'gemini-2.5-flash-lite' },
};

// ── Plan configuration (single source of truth) ──────────────────────────────
// Daily turn caps, price, and per-plan model allowlists all live here. usage.js
// derives DAILY_LIMIT from this; never duplicate these numbers elsewhere.
// NOTE: the Plan enum in prisma still has only FREE/PRO — the MID/ADVANCED enum
// values land in a later migration. ADVANCED is the renamed top tier (was PRO).
export const PLAN_CONFIG = {
  FREE: {
    dailyTurns: 7,
    priceNTD: 0,
    allowlist: ['gemini-flash-lite', 'haiku'],
    defaultModel: 'gemini-flash-lite',
  },
  MID: {
    dailyTurns: 15,
    priceNTD: 79,
    allowlist: ['gemini-flash-lite', 'haiku'],
    defaultModel: 'haiku',
  },
  ADVANCED: {
    dailyTurns: 23,
    priceNTD: 469,
    allowlist: ['opus', 'sonnet', 'gemini-pro'],
    defaultModel: 'opus',
  },
};

// Derived lookups — backend-authoritative; the frontend never picks a raw string.
export const PLAN_ALLOWLIST = Object.fromEntries(
  Object.entries(PLAN_CONFIG).map(([plan, c]) => [plan, c.allowlist]),
);

export const PLAN_DEFAULT_MODEL = Object.fromEntries(
  Object.entries(PLAN_CONFIG).map(([plan, c]) => [plan, c.defaultModel]),
);

export const DAILY_LIMIT = Object.fromEntries(
  Object.entries(PLAN_CONFIG).map(([plan, c]) => [plan, c.dailyTurns]),
);

// Output length cap shared across providers (~1300 tokens ≈ 750-800 zh chars).
export const MAX_OUTPUT_TOKENS = 1300;

// ── Server-side routing knobs (adjustable; model choice is backend-only) ──────
export const OPUS_SUBQUOTA = 6;   // advanced: daily Opus turns before downgrading to Sonnet
export const SONNET_BUFFER = 8;   // advanced: daily Sonnet buffer before downgrading to Gemini Pro
export const FREE_LITE_QUOTA = 5; // free: first 5 turns on Lite, rest on Haiku (5 + 2)
export const MID_LITE_QUOTA = 3;  // mid:  first 3 turns on Lite, rest on Haiku (3 + 12)

// Count-based routing for FREE/MID. turnNumber is the 1-based turn-of-day from
// consumeTurn. ADVANCED routing is atomic and lives in usage.claimAdvancedSlot.
export function routeBasicModel(plan, turnNumber) {
  const liteQuota = plan === 'MID' ? MID_LITE_QUOTA : FREE_LITE_QUOTA;
  return turnNumber <= liteQuota ? 'gemini-flash-lite' : 'haiku';
}
