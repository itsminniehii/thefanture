// Setting pack: app-layer validation, content filtering, and prompt assembly.
// Length caps mirror the DB VarChar limits. The content filter is a BASIC
// keyword-level adult-content blocklist (spec §4 — explicitly block adult
// content); it is intentionally not a semantic filter.

const FIELD_LIMITS = {
  playerBackground: 1000,
  customCharacters: 2000,
  termDictionary:   2000,
  difficulty:       50,
};

const FIELD_LABELS = {
  playerBackground: '玩家背景',
  customCharacters: '自訂角色',
  termDictionary:   '名詞字典',
  difficulty:       '難度偏好',
};

// Keyword-level blocklist (zh-TW + en). The minimum gate the spec asks for.
const BLOCKLIST = [
  '色情', '情色', '裸體', '性愛', '做愛', '性交', '陰道', '陰莖', '自慰',
  '強姦', '輪姦', '亂倫', '戀童', '兒童色情', '未成年性',
  'porn', 'nsfw', 'explicit sex', 'rape', 'incest', 'pedophil', 'child porn',
];

// Compose the player's pack into a zh-TW system block. Empty fields are skipped.
// Returns '' when there is nothing to add.
export function buildSettingPackBlock(pack) {
  if (!pack) return '';
  const parts = [];
  for (const key of Object.keys(FIELD_LABELS)) {
    const v = pack[key];
    if (v && String(v).trim()) parts.push(`${FIELD_LABELS[key]}：${String(v).trim()}`);
  }
  if (parts.length === 0) return '';
  return `【玩家自訂設定（補丁）】\n${parts.join('\n')}`;
}

// Validate + sanitize incoming pack fields.
// Returns { ok: true, clean } or { ok: false, error } (zh-TW message).
export function validateSettingPack(fields = {}) {
  const clean = {};
  for (const key of Object.keys(FIELD_LIMITS)) {
    if (fields[key] == null) { clean[key] = null; continue; }
    if (typeof fields[key] !== 'string') {
      return { ok: false, error: `${FIELD_LABELS[key]}格式不正確。` };
    }
    const v = fields[key].trim();
    if (v.length > FIELD_LIMITS[key]) {
      return { ok: false, error: `${FIELD_LABELS[key]}超過 ${FIELD_LIMITS[key]} 字上限。` };
    }
    clean[key] = v === '' ? null : v;
  }

  const haystack = Object.values(clean).filter(Boolean).join('\n').toLowerCase();
  for (const term of BLOCKLIST) {
    if (haystack.includes(term.toLowerCase())) {
      return { ok: false, error: '設定內容包含不被允許的成人向內容，請修改後再儲存。' };
    }
  }
  return { ok: true, clean };
}
