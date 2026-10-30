import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import Trend from "./Trend";

const fmt = (n) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 });
const level = (pct) => (pct >= 90 ? "crit" : pct >= 75 ? "warn" : "ok");
const toLocalInput = (d) =>
  new Date(new Date(d) - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
const emptyForm = () => ({
  server_name: "",
  mount_point: "/",
  total_gb: "",
  used_gb: "",
  note: "",
  logged_by: "",
  logged_at: toLocalInput(new Date()),
});

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseDay = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const fmtDay = (s) =>
  parseDay(s).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const fmtChange = (n) => (n === null ? "–" : `${n > 0 ? "+" : ""}${fmt(n)} GB`);
const shiftPeriod = (s, period, dir) => {
  const d = parseDay(s);
  if (period === "weekly") d.setDate(d.getDate() + 7 * dir);
  else {
    d.setDate(1);
    d.setMonth(d.getMonth() + dir);
  }
  return ymd(d);
};

function ServerCard({ log, active, onSelect }) {
  return (
    <button
      className={`card ${level(log.used_percent)} ${active ? "active" : ""}`}
      onClick={onSelect}
    >
      <div className="card-top">
        <strong>{log.server_name}</strong>
        <span className="mount">{log.mount_point}</span>
      </div>
      <div className="free">
        {fmt(log.free_gb)} <small>GB free</small>
      </div>
      <div className="bar">
        <div style={{ width: `${log.used_percent}%` }} />
      </div>
      <div className="card-bot">
        <span>
          {fmt(log.used_gb)} of {fmt(log.total_gb)} GB used ({log.used_percent}
          %)
        </span>
        <span>{new Date(log.logged_at).toLocaleDateString()}</span>
      </div>
    </button>
  );
}

function ReportPanel({ servers }) {
  const [period, setPeriod] = useState("weekly");
  const [date, setDate] = useState(() => ymd(new Date()));
  const [server, setServer] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let current = true;
    setLoading(true);
    setErr("");
    api
      .report({ period, date, server })
      .then((r) => current && setReport(r))
      .catch((x) => {
        if (current) {
          setReport(null);
          setErr(x.message);
        }
      })
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [period, date, server]);

  const download = async () => {
    setExporting(true);
    setErr("");
    try {
      const { blob, name } = await api.exportReport({ period, date, server });
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement("a"), {
        href: url,
        download: name,
      });
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (x) {
      setErr(x.message);
    } finally {
      setExporting(false);
    }
  };

  const rows = report?.rows ?? [];

  return (
    <div className="panel">
      <div className="row-between">
        <h2>Reports</h2>
        <button
          className="primary"
          disabled={exporting || loading || rows.length === 0}
          onClick={download}
        >
          {exporting ? "Preparing…" : "Download Excel"}
        </button>
      </div>

      <div className="report-controls">
        <div className="seg" role="group" aria-label="Report period">
          {["weekly", "monthly"].map((p) => (
            <button
              key={p}
              className={period === p ? "active" : ""}
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
            >
              {p === "weekly" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
        <button
          aria-label="Previous period"
          onClick={() => setDate(shiftPeriod(date, period, -1))}
        >
          ‹
        </button>
        {period === "weekly" ? (
          <input
            type="date"
            aria-label="Any day in the week"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        ) : (
          <input
            type="month"
            aria-label="Month"
            value={date.slice(0, 7)}
            onChange={(e) => e.target.value && setDate(`${e.target.value}-01`)}
          />
        )}
        <button
          aria-label="Next period"
          onClick={() => setDate(shiftPeriod(date, period, 1))}
        >
          ›
        </button>
        <select
          aria-label="Server"
          value={server}
          onChange={(e) => setServer(e.target.value)}
        >
          <option value="">All servers</option>
          {servers.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {report && (
        <p className="muted">
          {fmtDay(report.from)} – {fmtDay(report.to)} · {report.entry_count}{" "}
          {report.entry_count === 1 ? "entry" : "entries"}
        </p>
      )}
      {err && <p className="error">{err}</p>}

      <div className="scroll">
        <table className="report">
          <thead>
            <tr>
              <th>Server</th>
              <th>Entries</th>
              <th>Free now</th>
              <th>Used now</th>
              <th>Change</th>
              <th>Avg used</th>
              <th>Peak used</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.server_name}::${r.mount_point}`}>
                <td>
                  {r.server_name} <span className="mount">{r.mount_point}</span>
                </td>
                <td>{r.entries}</td>
                <td>{fmt(r.last_free_gb)} GB</td>
                <td>
                  <span className={`pill ${r.level}`}>
                    {r.last_used_percent}%
                  </span>
                </td>
                <td>{fmtChange(r.change_used_gb)}</td>
                <td>{r.avg_used_percent}%</td>
                <td>{r.peak_used_percent}%</td>
              </tr>
            ))}
            {!loading && !err && rows.length === 0 && (
              <tr>
                <td colSpan="7" className="muted">
                  No entries were logged in this period.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan="7" className="muted">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EntryForm({ initial, servers, onSaved, onCancel }) {
  const [f, setF] = useState(initial);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const body = { ...f, logged_at: new Date(f.logged_at).toISOString() };
      f.id ? await api.update(f.id, body) : await api.create(body);
      onSaved();
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel form" onSubmit={submit}>
      <h2>{f.id ? "Edit entry" : "Log storage"}</h2>
      <label>
        Server
        <input
          list="servers"
          required
          value={f.server_name}
          onChange={set("server_name")}
          placeholder="web-01"
        />
      </label>
      <datalist id="servers">
        {servers.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <label>
        Mount point
        <input value={f.mount_point} onChange={set("mount_point")} />
      </label>
      <label>
        Total (GB)
        <input
          type="number"
          step="0.01"
          min="0"
          required
          value={f.total_gb}
          onChange={set("total_gb")}
        />
      </label>
      <label>
        Used (GB)
        <input
          type="number"
          step="0.01"
          min="0"
          required
          value={f.used_gb}
          onChange={set("used_gb")}
        />
      </label>
      <label>
        Date and time
        <input
          type="datetime-local"
          required
          value={f.logged_at}
          onChange={set("logged_at")}
        />
      </label>
      <label>
        Logged by
        <input value={f.logged_by} onChange={set("logged_by")} />
      </label>
      <label className="wide">
        Note
        <input
          value={f.note}
          onChange={set("note")}
          placeholder="e.g. Cleared old backups"
        />
      </label>
      {err && <p className="error wide">{err}</p>}
      <div className="actions wide">
        <button className="primary" disabled={busy}>
          {f.id ? "Save changes" : "Add entry"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default function App() {
  const [summary, setSummary] = useState([]);
  const [servers, setServers] = useState([]);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ data: [], last_page: 1 });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, sv, l] = await Promise.all([
        api.summary(),
        api.servers(),
        api.list(page, filter),
      ]);
      setSummary(s);
      setServers(sv);
      setList(l);
      setError("");
    } catch {
      setError("Cannot reach the server. Is Laravel running on port 8000?");
    }
  }, [page, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id) => {
    if (!confirm("Delete this entry?")) return;
    await api.remove(id);
    load();
  };

  return (
    <div className="shell">
      <header>
        <h1>Storage Logbook</h1>
        <p className="muted">
          How much disk space is left on each server, entry by entry.
        </p>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="cards">
        {summary.length === 0 && !error && (
          <p className="muted">No entries yet. Add your first reading below.</p>
        )}
        {summary.map((s) => (
          <ServerCard
            key={s.id}
            log={s}
            active={filter === s.server_name}
            onSelect={() => {
              setFilter(filter === s.server_name ? "" : s.server_name);
              setPage(1);
            }}
          />
        ))}
      </section>

      <Trend server={filter || servers[0]} />

      <ReportPanel servers={servers} />

      {editing ? (
        <EntryForm
          key={editing.id}
          initial={editing}
          servers={servers}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : (
        <EntryForm
          key="new"
          initial={emptyForm()}
          servers={servers}
          onSaved={load}
        />
      )}

      <div className="panel">
        <div className="row-between">
          <h2>Log entries{filter && `: ${filter}`}</h2>
          {filter && (
            <button
              onClick={() => {
                setFilter("");
                setPage(1);
              }}
            >
              Show all servers
            </button>
          )}
        </div>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Server</th>
                <th>Free</th>
                <th>Used</th>
                <th>Total</th>
                <th>Note</th>
                <th>By</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.data.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.logged_at).toLocaleString()}</td>
                  <td>
                    {r.server_name}{" "}
                    <span className="mount">{r.mount_point}</span>
                  </td>
                  <td>
                    <span className={`pill ${level(r.used_percent)}`}>
                      {fmt(r.free_gb)} GB
                    </span>
                  </td>
                  <td>
                    {fmt(r.used_gb)} GB ({r.used_percent}%)
                  </td>
                  <td>{fmt(r.total_gb)} GB</td>
                  <td>{r.note}</td>
                  <td>{r.logged_by}</td>
                  <td className="actions">
                    <button
                      onClick={() => {
                        setEditing({
                          ...r,
                          logged_at: toLocalInput(r.logged_at),
                        });
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Edit
                    </button>
                    <button className="danger" onClick={() => remove(r.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {list.data.length === 0 && (
                <tr>
                  <td colSpan="8" className="muted">
                    Nothing logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="pager">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {list.last_page}
          </span>
          <button
            disabled={page >= list.last_page}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
