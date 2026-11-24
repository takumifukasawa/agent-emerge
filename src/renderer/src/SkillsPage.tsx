import type { Account, MatrixRow, Skill } from '@shared/model'
import { acrossLabel, provenanceLabel, warningLabel } from './labels'
import { ALL, useAppStore } from './store'

function Chip({ text, tone, ...data }: { text: string; tone: string; 'data-testid'?: string; 'data-warning'?: string; title?: string }) {
  return (
    <span className={`chip ${tone === 'plain' ? '' : tone}`} {...data}>
      {text}
    </span>
  )
}

function Cell({ skills }: { skills: Skill[] }) {
  if (skills.length === 0) return <span className="none">—</span>
  return (
    <div className="chips">
      {skills.flatMap((s) => {
        const l = provenanceLabel(s)
        return [
          <Chip key={s.path} text={l.text} tone={l.tone} />,
          // a broken link already says so in its provenance chip
          ...s.warnings
            .filter((w) => w.kind !== 'broken-link')
            .map((w, i) => {
              const wl = warningLabel(w)
              return <Chip key={`${s.path}#w${i}`} text={wl.chip} tone={wl.tone} title={wl.detail} data-testid="warning" data-warning={w.kind} />
            })
        ]
      })}
    </div>
  )
}

function presentIn(row: MatrixRow, accounts: Account[]): string[] {
  return accounts.filter((a) => (row.cells[a.id]?.skills.length ?? 0) > 0).map((a) => a.displayName)
}

function Detail({ row, accounts }: { row: MatrixRow; accounts: Account[] }) {
  const diff = useAppStore((s) => s.diff)
  const first = accounts.flatMap((a) => row.cells[a.id]?.skills ?? [])[0]
  const across = acrossLabel(row.across, presentIn(row, accounts))
  return (
    <aside className="detail" aria-label="Detail" data-testid="detail">
      <div>
        <h2>{row.name}</h2>
        {first?.description && <p className="desc">{first.description}</p>}
      </div>
      <dl className="kv">
        {accounts.map((a) => (
          <div key={a.id} style={{ display: 'contents' }}>
            <dt>{a.displayName}</dt>
            <dd>{(row.cells[a.id]?.skills ?? []).map((s) => provenanceLabel(s).text).join(', ') || '—'}</dd>
          </div>
        ))}
        <dt>Warnings</dt>
        <dd data-testid="detail-warnings">
          {(() => {
            const items = accounts.flatMap((a) =>
              (row.cells[a.id]?.skills ?? []).flatMap((s) =>
                s.warnings.map((w, i) => ({ key: `${a.id}|${s.path}|${i}`, who: `${a.displayName} · ${provenanceLabel(s).text}`, w }))
              )
            )
            if (items.length === 0) return 'none'
            return (
              <ul className="warnings">
                {items.map(({ key, who, w }) => {
                  const wl = warningLabel(w)
                  return (
                    <li key={key} data-testid="detail-warning" data-warning={w.kind}>
                      <Chip text={wl.chip} tone={wl.tone} /> {wl.detail} <span className="who">({who})</span>
                    </li>
                  )
                })}
              </ul>
            )
          })()}
        </dd>
        <dt>Compared</dt>
        <dd>
          <Chip text={across.text} tone={across.tone} />
        </dd>
      </dl>
      {diff && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {diff.files
            .filter((f) => f.status !== 'same')
            .map((f) => (
              <section key={f.path} className="diff-file" data-testid="diff-file">
                <header>
                  <span>{f.path}</span>
                  <span>
                    {accounts.find((a) => a.id === diff.left.accountId)?.displayName} → {accounts.find((a) => a.id === diff.right.accountId)?.displayName} · {f.status}
                  </span>
                </header>
                {f.lines && (
                  <pre>
                    {f.lines.map((l, i) => (
                      <span key={i} className={`l ${l.kind === 'add' ? 'add' : l.kind === 'del' ? 'del' : 'ctx'}`} data-testid={`diff-${l.kind}`}>
                        {l.kind === 'add' ? '+ ' : l.kind === 'del' ? '- ' : '  '}
                        {l.text}
                      </span>
                    ))}
                  </pre>
                )}
              </section>
            ))}
        </div>
      )}
    </aside>
  )
}

export function SkillsPage() {
  const { matrix, scope, query, setQuery, hidePlugins, setHidePlugins, selectedSkill, selectSkill } = useAppStore()
  if (!matrix) return <main className="main"><p className="empty">Loading…</p></main>
  const accounts = scope === ALL ? matrix.accounts : matrix.accounts.filter((a) => a.id === scope)
  const visible = (s: Skill): boolean => !(hidePlugins && s.scope === 'plugin')
  const rows = matrix.rows.filter((r) => {
    if (query && !r.name.toLowerCase().includes(query.toLowerCase())) return false
    return accounts.some((a) => (r.cells[a.id]?.skills ?? []).some(visible))
  })
  const selected = rows.find((r) => r.name === selectedSkill) ?? null
  return (
    <main className="main">
      <div className="head">
        <div>
          <h1>Skills</h1>
          <p>Installed skills, where each comes from, and how copies compare</p>
        </div>
      </div>
      <div className="filters">
        <input type="search" placeholder="Filter skills" aria-label="Filter skills" value={query} onChange={(e) => setQuery(e.target.value)} />
        <label>
          <input type="checkbox" checked={hidePlugins} onChange={(e) => setHidePlugins(e.target.checked)} />
          Hide plugin skills
        </label>
      </div>
      <div className="body">
        <div className="table-wrap">
          {rows.length === 0 ? (
            <p className="empty">No skills match.</p>
          ) : (
            <table data-testid="matrix">
              <thead>
                <tr>
                  <th scope="col">Skill</th>
                  {accounts.map((a) => (
                    <th key={a.id} scope="col">{a.displayName}</th>
                  ))}
                  {scope === ALL && <th scope="col">Across</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const a = acrossLabel(r.across, presentIn(r, matrix.accounts))
                  return (
                    <tr
                      key={r.name}
                      className="row"
                      data-testid="matrix-row"
                      data-skill={r.name}
                      aria-selected={r.name === selectedSkill}
                      tabIndex={0}
                      onClick={() => void selectSkill(r.name)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') void selectSkill(r.name)
                      }}
                    >
                      <td className="name">{r.name}</td>
                      {accounts.map((acc) => (
                        <td key={acc.id}>
                          <Cell skills={(r.cells[acc.id]?.skills ?? []).filter(visible)} />
                        </td>
                      ))}
                      {scope === ALL && (
                        <td data-testid="across">
                          <Chip text={a.text} tone={a.tone} />
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {selected && <Detail row={selected} accounts={matrix.accounts} />}
      </div>
    </main>
  )
}
