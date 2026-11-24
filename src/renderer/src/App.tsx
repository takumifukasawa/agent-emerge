import { useEffect } from 'react'
import { ALL, useAppStore, type Page } from './store'
import { AgentsPage, McpPage, SettingsPage } from './ConfigPages'
import { InstructionsPage, MemoryPage } from './DocsPages'
import { CatalogsPage, HarnessPage, SourcesPage } from './RootsPages'
import { SkillsPage } from './SkillsPage'
import { harnessBadge, sourcesBadge } from './labels'
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
  const { accounts, scope, setScope, page, setPage, info, matrix, sources, harnessProjects, catalogs } = useAppStore()
  const badge = (p: Page): string => (p === 'skills' && matrix ? String(matrix.rows.length) : '')
  const rootBadge = (p: Page) => (p === 'sources' ? sourcesBadge(sources) : p === 'harness' ? harnessBadge(harnessProjects) : p === 'catalogs' && catalogs?.length ? { text: String(catalogs.length), tone: 'plain' as const } : null)
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
            {(() => {
              const b = rootBadge(f.page)
              return b?.text ? (
                <span className={`badge ${b.tone === 'plain' ? '' : b.tone}`} data-testid={`badge-${f.page}`}>
                  {b.text}
                </span>
              ) : null
            })()}
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

function Page({ page }: { page: Page }) {
  switch (page) {
    case 'skills':
      return <SkillsPage />
    case 'claude-md':
      return <InstructionsPage />
    case 'memory':
      return <MemoryPage />
    case 'settings':
      return <SettingsPage />
    case 'mcp':
      return <McpPage />
    case 'agents':
      return <AgentsPage />
    case 'sources':
      return <SourcesPage />
    case 'harness':
      return <HarnessPage />
    case 'catalogs':
      return <CatalogsPage />
    default:
      return <Placeholder page={page} />
  }
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
      <Page page={page} />
    </div>
  )
}
