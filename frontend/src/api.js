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

async function put(path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: authHeader(token),
    body: JSON.stringify(body),
  });
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
  get: (token) => get('/me/', token),
  // No setModel: the model is chosen backend-only; the client never picks one.
};

export const settingPacks = {
  get:    (token, worldId) => get(`/setting-packs/${worldId}`, token),
  update: (token, worldId, body) => put(`/setting-packs/${worldId}`, body, token),
};

export const ai = {
  chat: (token, worldId, message, history) =>
    post('/ai/chat', { worldId, message, history }, token),

  // Returns the raw Response so the caller can read the SSE stream.
  // The response is either text/event-stream (stream) or JSON (429 / save card).
  chatStream: (token, worldId, message, history) =>
    fetch(`${BASE}/ai/chat`, {
      method: 'POST',
      headers: authHeader(token),
      body: JSON.stringify({ worldId, message, history, stream: true }),
    }),
};

// Parse an SSE byte stream, invoking handlers per event type.
export async function readSSE(response, handlers) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Events are separated by a blank line.
    let sep;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      let event = 'message';
      let dataStr = '';
      for (const line of rawEvent.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
      }
      if (!dataStr) continue;
      const data = JSON.parse(dataStr);
      handlers[event]?.(data);
    }
  }
}
