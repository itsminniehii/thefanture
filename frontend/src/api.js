const BASE = '/api';

function authHeader(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function post(path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: token ? authHeader(token) : { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'Error'), { status: res.status, data });
  return data;
}

async function get(path, token) {
  const res = await fetch(`${BASE}${path}`, { headers: authHeader(token) });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'Error'), { status: res.status, data });
  return data;
}

export const auth = {
  register: (email, password) => post('/auth/register', { email, password }),
  login:    (email, password) => post('/auth/login',    { email, password }),
};

export const usage = {
  today: (token) => get('/usage/today', token),
};

export const me = {
  get:        (token)                  => get('/me/', token),
  setModel:   (token, preferredModel) => post('/me/model', { preferredModel }, token),
};

export const ai = {
  chat: (token, worldId, message, history, preferredModel) =>
    post('/ai/chat', { worldId, message, history, preferredModel }, token),
};
