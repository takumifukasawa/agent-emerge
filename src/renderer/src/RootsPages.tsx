import { useState } from 'react'
import type { Account } from '@shared/model'
import { useAppStore } from './store'

const nameOf = (accounts: Account[], id: string): string => accounts.find((a) => a.id === id)?.displayName ?? id

function Chip({ text, tone, testId }: { text: string; tone: string; testId?: string }) {
  return (
    <span className={`chip ${tone === 'plain' ? '' : tone}`} data-testid={testId}>
      {text}
    </span>
  )
}

export function SourcesPage() {
  const { sources, accounts, rootsError } = useAppStore()
  return (
    <main className="main">
      <div className="head">
        <div>
          <h1>Sources</h1>
          <p>Where skills are authored: repos that skills link into, the skills CLI store, and dirs you added</p>
        </div>
      </div>
      <div className="table-wrap">
        {!sources ? (
          <p className="empty">{rootsError ? `Could not read sources: ${rootsError}` : 'Loading…'}</p>
        ) : sources.length === 0 ? (
          <p className="empty">No sources found.</p>
        ) : (
          <table data-testid="sources">
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">git</th>
                <th scope="col">Remote</th>
                <th scope="col">Skills</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} data-testid="source-row" data-path={s.path}>
                  <td className="name" title={s.id}>
                    {s.path}
                    {s.origin === 'manual' && <Chip text="added" tone="plain" />}
                    {!s.exists && <Chip text="missing" tone="bad" />}
                  </td>
                  <td>
                    {s.git ? (
                      <div className="chips">
                        <Chip text={s.git.branch ?? 'detached'} tone="plain" />
                        {s.git.unpushed > 0 && <Chip text={`${s.git.unpushed} unpushed`} tone="diff" testId="unpushed" />}
                        {s.git.uncommitted > 0 && <Chip text={`${s.git.uncommitted} uncommitted`} tone="diff" testId="uncommitted" />}
                        {s.git.unpushed === 0 && s.git.uncommitted === 0 && <Chip text="clean" tone="ok" />}
                      </div>
                    ) : (
                      <span className="none">not a git repo</span>
                    )}
                  </td>
                  <td data-testid="remote">{s.git?.remoteUrl ?? '—'}</td>
                  <td>{s.linkedSkills.map((l) => `${l.name} (${nameOf(accounts, l.accountId)})`).join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}

export function HarnessPage() {
  const { harnessProjects, accounts, rootsError } = useAppStore()
  return (
    <main className="main">
      <div className="head">
        <div>
          <h1>Harness projects</h1>
          <p>Projects with .harness/manifest.json, and managed files that drifted from it (seed files are the project's own)</p>
        </div>
      </div>
      <div className="table-wrap">
        {!harnessProjects ? (
          <p className="empty">{rootsError ? `Could not read harness projects: ${rootsError}` : 'Loading…'}</p>
        ) : harnessProjects.length === 0 ? (
          <p className="empty">No harness projects found.</p>
        ) : (
          <table data-testid="harness-projects">
            <thead>
              <tr>
                <th scope="col">Project</th>
                <th scope="col">Harness</th>
                <th scope="col">Accounts</th>
                <th scope="col">Drift</th>
              </tr>
            </thead>
            <tbody>
              {harnessProjects.map((p) => (
                <tr key={p.id} data-testid="harness-row" data-path={p.path}>
                  <td className="name" title={p.id}>
                    {p.path}
                    {!p.exists && <Chip text="missing" tone="bad" />}
                  </td>
                  <td>{p.harnessVersion ? `v${p.harnessVersion}` : '—'} · {p.trackedFiles} files</td>
                  <td>{p.accountIds.map((id) => nameOf(accounts, id)).join(', ') || '—'}</td>
                  <td>
                    {p.drift === null ? (
                      <Chip text="manifest unreadable" tone="bad" />
                    ) : p.drift.length === 0 ? (
                      <Chip text="no drift" tone="ok" />
                    ) : (
                      <ul className="warnings">
                        {p.drift.map((d) => (
                          <li key={d.path} data-testid="drift" data-status={d.status}>
                            <Chip text={d.status} tone={d.status === 'missing' ? 'bad' : 'diff'} /> {d.path} <span className="who">({d.ownership})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}

export function CatalogsPage() {
  const { catalogs, accounts, scope, catalogError, setCatalog } = useAppStore()
  const [path, setPath] = useState('')
  const [accountId, setAccountId] = useState('')
  const target = accountId || (scope !== 'all' ? scope : accounts[0]?.id) || ''
  const list = (catalogs ?? []).filter((c) => scope === 'all' || c.accountId === scope)
  return (
    <main className="main">
      <div className="head">
        <div>
          <h1>Catalogs</h1>
          <p>Local clones of catalog repos (a plugin marketplace or a skills repo), attached per account. Clone them yourself; nothing is fetched or installed.</p>
        </div>
      </div>
      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault()
          const p = path.trim()
          if (!p || !target) return
          setPath('') // clear now: clearing after the IPC returns would wipe whatever was typed meanwhile
          void setCatalog(target, p, true)
        }}
      >
        <select aria-label="Catalog account" value={target} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.displayName}
            </option>
          ))}
        </select>
        <input type="text" placeholder="Path of a local catalog clone" aria-label="Catalog path" value={path} onChange={(e) => setPath(e.target.value)} style={{ flex: 1 }} />
        <button type="submit" className="chip tab">
          Attach
        </button>
      </form>
      {catalogError && <p className="empty">Catalog error: {catalogError}</p>}
      <div className="table-wrap">
        {!catalogs ? (
          <p className="empty">Loading…</p>
        ) : list.length === 0 ? (
          <p className="empty">No catalogs attached.</p>
        ) : (
          <table data-testid="catalogs">
            <thead>
              <tr>
                <th scope="col">Catalog</th>
                <th scope="col">Layout</th>
                <th scope="col">Account</th>
                <th scope="col">Skills</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={`${c.accountId}|${c.path}`} data-testid="catalog-row" data-layout={c.layout}>
                  <td className="name" title={c.path}>
                    {c.name}
                    {!c.exists && <Chip text="missing" tone="bad" />}
                    <div className="who">{c.path}</div>
                  </td>
                  <td>{c.layout}</td>
                  <td>{nameOf(accounts, c.accountId)}</td>
                  <td data-testid="catalog-skills">{c.skills.map((s) => s.name).join(', ') || '—'}</td>
                  <td>
                    <button type="button" className="chip tab" onClick={() => void setCatalog(c.accountId, c.path, false)}>
                      Detach
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}
