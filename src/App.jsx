import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

const fmt = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 })
const level = (pct) => (pct >= 90 ? 'crit' : pct >= 75 ? 'warn' : 'ok')
const toLocalInput = (d) => new Date(new Date(d) - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
const emptyForm = () => ({
  server_name: '', mount_point: '/', total_gb: '', used_gb: '', note: '', logged_by: '', logged_at: toLocalInput(new Date()),
})

function ServerCard({ log, active, onSelect }) {
  return (
    <button className={`card ${level(log.used_percent)} ${active ? 'active' : ''}`} onClick={onSelect}>
      <div className="card-top">
        <strong>{log.server_name}</strong>
        <span className="mount">{log.mount_point}</span>
      </div>
      <div className="free">{fmt(log.free_gb)} <small>GB free</small></div>
      <div className="bar"><div style={{ width: `${log.used_percent}%` }} /></div>
      <div className="card-bot">
        <span>{fmt(log.used_gb)} of {fmt(log.total_gb)} GB used ({log.used_percent}%)</span>
        <span>{new Date(log.logged_at).toLocaleDateString()}</span>
      </div>
    </button>
  )
}

function Trend({ server }) {
  const [rows, setRows] = useState([])
  useEffect(() => { server && api.history(server).then(setRows).catch(() => setRows([])) }, [server])
  if (!server) return null
  if (rows.length < 2) return <p className="muted">Add at least two entries for {server} to see its trend.</p>

  const W = 720, H = 180, P = 28
  const max = Math.max(...rows.map((r) => r.total_gb))
  const x = (i) => P + (i / (rows.length - 1)) * (W - P * 2)
  const y = (v) => H - P - (v / max) * (H - P * 2)
  const line = rows.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r.free_gb)}`).join(' ')

  return (
    <div className="panel">
      <h2>Free space over time: {server}</h2>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Free storage trend for ${server}`}>
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} className="axis" />
        <path d={line} className="trend" fill="none" />
        {rows.map((r, i) => (
          <circle key={r.id} cx={x(i)} cy={y(r.free_gb)} r="3.5" className="dot">
            <title>{`${new Date(r.logged_at).toLocaleDateString()}: ${fmt(r.free_gb)} GB free`}</title>
          </circle>
        ))}
        <text x={P} y={14} className="lbl">{fmt(max)} GB</text>
        <text x={P} y={H - 8} className="lbl">{new Date(rows[0].logged_at).toLocaleDateString()}</text>
        <text x={W - P} y={H - 8} textAnchor="end" className="lbl">{new Date(rows.at(-1).logged_at).toLocaleDateString()}</text>
      </svg>
    </div>
  )
}

function EntryForm({ initial, servers, onSaved, onCancel }) {
  const [f, setF] = useState(initial)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const body = { ...f, logged_at: new Date(f.logged_at).toISOString() }
      f.id ? await api.update(f.id, body) : await api.create(body)
      onSaved()
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  return (
    <form className="panel form" onSubmit={submit}>
      <h2>{f.id ? 'Edit entry' : 'Log storage'}</h2>
      <label>Server<input list="servers" required value={f.server_name} onChange={set('server_name')} placeholder="web-01" /></label>
      <datalist id="servers">{servers.map((s) => <option key={s} value={s} />)}</datalist>
      <label>Mount point<input value={f.mount_point} onChange={set('mount_point')} /></label>
      <label>Total (GB)<input type="number" step="0.01" min="0" required value={f.total_gb} onChange={set('total_gb')} /></label>
      <label>Used (GB)<input type="number" step="0.01" min="0" required value={f.used_gb} onChange={set('used_gb')} /></label>
      <label>Date and time<input type="datetime-local" required value={f.logged_at} onChange={set('logged_at')} /></label>
      <label>Logged by<input value={f.logged_by} onChange={set('logged_by')} /></label>
      <label className="wide">Note<input value={f.note} onChange={set('note')} placeholder="e.g. Cleared old backups" /></label>
      {err && <p className="error wide">{err}</p>}
      <div className="actions wide">
        <button className="primary" disabled={busy}>{f.id ? 'Save changes' : 'Add entry'}</button>
        {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

export default function App() {
  const [summary, setSummary] = useState([])
  const [servers, setServers] = useState([])
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [list, setList] = useState({ data: [], last_page: 1 })
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [s, sv, l] = await Promise.all([api.summary(), api.servers(), api.list(page, filter)])
      setSummary(s); setServers(sv); setList(l); setError('')
    } catch { setError('Cannot reach the server. Is Laravel running on port 8000?') }
  }, [page, filter])

  useEffect(() => { load() }, [load])

  const remove = async (id) => {
    if (!confirm('Delete this entry?')) return
    await api.remove(id); load()
  }

  return (
    <div className="shell">
      <header>
        <h1>Storage Logbook</h1>
        <p className="muted">How much disk space is left on each server, entry by entry.</p>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="cards">
        {summary.length === 0 && !error && <p className="muted">No entries yet. Add your first reading below.</p>}
        {summary.map((s) => (
          <ServerCard key={s.id} log={s} active={filter === s.server_name}
            onSelect={() => { setFilter(filter === s.server_name ? '' : s.server_name); setPage(1) }} />
        ))}
      </section>

      <Trend server={filter || servers[0]} />

      {editing
        ? <EntryForm key={editing.id} initial={editing} servers={servers} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
        : <EntryForm key="new" initial={emptyForm()} servers={servers} onSaved={load} />}

      <div className="panel">
        <div className="row-between">
          <h2>Log entries{filter && `: ${filter}`}</h2>
          {filter && <button onClick={() => { setFilter(''); setPage(1) }}>Show all servers</button>}
        </div>
        <div className="scroll">
          <table>
            <thead><tr><th>Date</th><th>Server</th><th>Free</th><th>Used</th><th>Total</th><th>Note</th><th>By</th><th /></tr></thead>
            <tbody>
              {list.data.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.logged_at).toLocaleString()}</td>
                  <td>{r.server_name} <span className="mount">{r.mount_point}</span></td>
                  <td><span className={`pill ${level(r.used_percent)}`}>{fmt(r.free_gb)} GB</span></td>
                  <td>{fmt(r.used_gb)} GB ({r.used_percent}%)</td>
                  <td>{fmt(r.total_gb)} GB</td>
                  <td>{r.note}</td>
                  <td>{r.logged_by}</td>
                  <td className="actions">
                    <button onClick={() => { setEditing({ ...r, logged_at: toLocalInput(r.logged_at) }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Edit</button>
                    <button className="danger" onClick={() => remove(r.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {list.data.length === 0 && <tr><td colSpan="8" className="muted">Nothing logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pager">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {list.last_page}</span>
          <button disabled={page >= list.last_page} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>
    </div>
  )
}
