const BASE = '/api/storage-logs'

const firstError = (data) => (data.errors ? Object.values(data.errors)[0][0] : data.message)

const reportQuery = ({ period, date, server }) => {
  const query = new URLSearchParams({
    period,
    date,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
  if (server) query.set('server', server)
  return query.toString()
}

async function req(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...options,
  })
  if (res.status === 204) return null
  const data = await res.json()
  if (!res.ok) {
    throw new Error(firstError(data) || 'Request failed')
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
  report: (params) => req(`${BASE}/report?${reportQuery(params)}`),
  exportReport: async (params) => {
    const res = await fetch(`${BASE}/report/export?${reportQuery(params)}`, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(firstError(data) || 'Export failed')
    }
    const name = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'storage-report.xlsx'
    return { blob: await res.blob(), name }
  },
}
