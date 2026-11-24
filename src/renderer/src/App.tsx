import { useEffect } from 'react'
import { ALL, useAppStore, type Page } from './store'
import { SkillsPage } from './SkillsPage'
import './styles.css'

const FEATURES: { page: Page; label: string; note?: string }[] = [
  { page: 'overview', label: 'Overview', note: 'phase 1.5' },
  { page: 'skills', label: 'Skills' },
  { page: 'claude-md', label: 'CLAUDE.md' },
  { page: 'settings', label: 'Settings' },
  { page: 'mcp', label: 'MCP' },
  { page: 'plugins', label: 'Plugins' },
  { page: 'agents', label: 'Agents & commands' },
  { page: 'memory', label: 'Memory' }
]
const ROOTS: { page: Page; label: string }[] = [
  { page: 'sources', label: 'Sources' },
  { page: 'catalogs', label: 'Catalogs' },
  { page: 'harness', label: 'Harness projects' }
]

function Sidebar() {
  const { accounts, scope, setScope, page, setPage, info, matrix } = useAppStore()
  const badge = (p: Page): string => (p === 'skills' && matrix ? String(matrix.rows.length) : '')
  return (
    <nav className="side" aria-label="Features">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        agent-emerge
      </div>
      <label className="picker">
        <span className="label" style={{ padding: 0 }}>ACCOUNT</span>
        <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Account">
          <option value={ALL}>All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id} data-testid="account" disabled={!a.exists} title={a.configDir}>
              {a.displayName}
            </option>
          ))}
        </select>
      </label>
      <div className="nav">
        {FEATURES.map((f) => (
          <button key={f.page} type="button" className="nav-item" aria-current={page === f.page ? 'page' : undefined} onClick={() => setPage(f.page)}>
            <span>{f.label}</span>
            <span className="badge">{f.note ?? badge(f.page)}</span>
          </button>
        ))}
      </div>
      <div className="nav">
        <div className="label">WHERE THEY COME FROM</div>
        {ROOTS.map((f) => (
          <button key={f.page} type="button" className="nav-item" aria-current={page === f.page ? 'page' : undefined} onClick={() => setPage(f.page)}>
            <span>{f.label}</span>
          </button>
        ))}
      </div>
      <div className="side-foot" data-testid="app-info">
        <span>{info?.name ?? 'agent-emerge'}</span>
        <span>{info ? `v${info.version}` : ''}</span>
      </div>
    </nav>
  )
}

function Placeholder({ page }: { page: Page }) {
  const label = [...FEATURES, ...ROOTS].find((f) => f.page === page)?.label ?? page
  return (
    <main className="main">
      <div className="head">
        <h1>{label}</h1>
      </div>
      <p className="empty">Not built yet. See docs/plans/active/mvp-readonly-viewer.md for when this page lands.</p>
    </main>
  )
}

export function App() {
  const load = useAppStore((s) => s.load)
  const page = useAppStore((s) => s.page)
  useEffect(() => {
    void load()
  }, [load])
  return (
    <div className="app">
      <Sidebar />
      {page === 'skills' ? <SkillsPage /> : <Placeholder page={page} />}
    </div>
  )
}
