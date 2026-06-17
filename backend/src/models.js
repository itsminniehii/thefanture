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

// Per-plan allowlists — backend-authoritative; the frontend never picks a raw string.
export const PLAN_ALLOWLIST = {
  FREE: ['gemini-flash-lite', 'haiku'],
  PRO:  ['opus', 'sonnet', 'haiku', 'gemini-pro', 'gemini-flash', 'gemini-flash-lite'],
};

export const PLAN_DEFAULT_MODEL = {
  FREE: 'gemini-flash-lite',
  PRO:  'opus',
};

// Output length cap shared across providers (~500 tokens).
export const MAX_OUTPUT_TOKENS = 500;

// Resolve the model key actually used: honor the stored/hinted preference only if
// it is in the plan's allowlist, otherwise fall back to the plan default.
export function resolveModelKey(plan, preferredModel) {
  const list = PLAN_ALLOWLIST[plan] ?? [];
  if (preferredModel && list.includes(preferredModel)) return preferredModel;
  return PLAN_DEFAULT_MODEL[plan];
}
