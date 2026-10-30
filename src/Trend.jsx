import { useEffect, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from './api'

const fmt = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 })
const day = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

const METRICS = {
  free: { label: 'Free space', key: 'free_gb', unit: ' GB' },
  used: { label: 'Used %', key: 'used_percent', unit: '%' },
}

function ChartTip({ active, payload, metric }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="tip">
      <strong>{new Date(p.t).toLocaleString()}</strong>
      <span>{fmt(p.free_gb)} GB free of {fmt(p.total_gb)} GB</span>
      <span>{fmt(p.used_percent)}% used</span>
      {p.note && <em>{p.note}</em>}
    </div>
  )
}

export default function Trend({ server }) {
  const [rows, setRows] = useState([])
  const [metric, setMetric] = useState('free')

  useEffect(() => {
    if (server) api.history(server).then(setRows).catch(() => setRows([]))
  }, [server])

  if (!server) return null
  if (rows.length < 2) return <p className="muted">Add at least two entries for {server} to see its trend.</p>

  const m = METRICS[metric]
  const data = rows.map((r) => ({
    ...r,
    t: new Date(r.logged_at).getTime(),
    free_gb: Number(r.free_gb),
    total_gb: Number(r.total_gb),
    used_percent: Number(r.used_percent),
  }))

  return (
    <div className="panel">
      <div className="row-between">
        <h2>{server} over time</h2>
        <div className="seg" role="group" aria-label="Chart metric">
          {Object.entries(METRICS).map(([k, v]) => (
            <button key={k} className={metric === k ? 'active' : ''} aria-pressed={metric === k} onClick={() => setMetric(k)}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={day}
              stroke="var(--muted)" tickLine={false} axisLine={false} fontSize={12} minTickGap={40} />
            <YAxis stroke="var(--muted)" tickLine={false} axisLine={false} fontSize={12} width={56}
              domain={metric === 'used' ? [0, 100] : [0, 'auto']}
              tickFormatter={(v) => `${fmt(v)}${m.unit}`} />
            <Tooltip content={<ChartTip metric={metric} />} cursor={{ stroke: 'var(--muted)', strokeDasharray: 4 }} />
            <Area type="monotone" dataKey={m.key} stroke="var(--accent)" strokeWidth={2.5} fill="url(#fill)"
              dot={{ r: 3, fill: 'var(--surface)', stroke: 'var(--accent)', strokeWidth: 2 }}
              activeDot={{ r: 5 }} animationDuration={500} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
