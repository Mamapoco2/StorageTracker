const BASE = '/api/storage-logs'

async function req(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...options,
  })
  if (res.status === 204) return null
  const data = await res.json()
  if (!res.ok) {
    const first = data.errors ? Object.values(data.errors)[0][0] : data.message
    throw new Error(first || 'Request failed')
  }
  return data
}

export const api = {
  summary: () => req(`${BASE}/summary`),
  servers: () => req(`${BASE}/servers`),
  history: (server) => req(`${BASE}/history?server=${encodeURIComponent(server)}`),
  list: (page = 1, server = '') =>
    req(`${BASE}?page=${page}&per_page=10${server ? `&server=${encodeURIComponent(server)}` : ''}`),
  create: (body) => req(BASE, { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => req(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id) => req(`${BASE}/${id}`, { method: 'DELETE' }),
}
