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
