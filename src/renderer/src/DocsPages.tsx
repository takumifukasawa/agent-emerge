import { useState } from 'react'
import type { Account, ImportNode, InstructionsDoc, MemoryType } from '@shared/model'
import { ALL, useAppStore } from './store'

const nameOf = (accounts: Account[], id: string): string => accounts.find((a) => a.id === id)?.displayName ?? id
const baseName = (p: string): string => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? p

function ownerLabel(d: InstructionsDoc, accounts: Account[]): string {
  return d.owner.kind === 'account' ? nameOf(accounts, d.owner.accountId) : `project ${baseName(d.owner.projectPath)}`
}

function ImportTree({ nodes }: { nodes: ImportNode[] }) {
  if (nodes.length === 0) return null
  return (
    <ul className="tree">
      {nodes.map((n, i) => (
        <li key={`${n.path}#${i}`} data-testid="import" data-status={n.status} title={n.path}>
          <code>@{n.spec}</code>
          {n.status !== 'ok' && <span className={`chip ${n.status === 'missing' ? 'bad' : 'diff'}`}>{n.status}</span>}
          <ImportTree nodes={n.children} />
        </li>
      ))}
    </ul>
  )
}

export function InstructionsPage() {
  const { instructions, accounts, scope, docsError } = useAppStore()
  const [selected, setSelected] = useState<string | null>(null)
  const [raw, setRaw] = useState(false)
  if (!instructions) return <main className="main"><p className="empty">{docsError ? `Could not read CLAUDE.md: ${docsError}` : 'Loading…'}</p></main>
  const docs = instructions.filter((d) => scope === ALL || d.owner.kind === 'project' || d.owner.accountId === scope)
  const doc = docs.find((d) => d.id === selected) ?? docs[0] ?? null
  return (
    <main className="main">
      <div className="head">
        <div>
          <h1>CLAUDE.md</h1>
          <p>Instructions of each account and harness project, with @imports expanded</p>
        </div>
      </div>
      <div className="body">
        <div className="table-wrap list">
          {docs.length === 0 ? (
            <p className="empty">No CLAUDE.md / AGENTS.md found.</p>
          ) : (
            <ul className="doc-list" data-testid="instructions">
              {docs.map((d) => (
                <li key={d.id}>
                  <button type="button" className="nav-item" aria-current={d.id === doc?.id ? 'true' : undefined} data-testid="instructions-item" onClick={() => setSelected(d.id)} title={d.path}>
                    <span>{ownerLabel(d, accounts)} · {d.kind}</span>
                    {d.imports.length > 0 && <span className="badge">{d.imports.length} import{d.imports.length === 1 ? '' : 's'}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {doc && (
          <section className="detail wide" aria-label="Instructions" data-testid="instructions-detail">
            <div>
              <h2>{ownerLabel(doc, accounts)} · {doc.kind}</h2>
              <p className="desc" title={doc.path}>{doc.path}</p>
            </div>
            {doc.imports.length > 0 && (
              <div>
                <div className="label" style={{ padding: 0 }}>IMPORTS</div>
                <ImportTree nodes={doc.imports} />
              </div>
            )}
            <label className="toggle">
              <input type="checkbox" checked={raw} onChange={(e) => setRaw(e.target.checked)} />
              Show as written (imports not expanded)
            </label>
            <pre className="doc" data-testid="instructions-text">{raw ? doc.raw : doc.expanded}</pre>
          </section>
        )}
      </div>
    </main>
  )
}

const TYPE_TONE: Record<MemoryType, string> = { user: '', feedback: 'diff', project: 'ok', reference: '' }

export function MemoryPage() {
  const { memory, accounts, scope, docsError } = useAppStore()
  const [open, setOpen] = useState<string | null>(null)
  if (!memory) return <main className="main"><p className="empty">{docsError ? `Could not read memory: ${docsError}` : 'Loading…'}</p></main>
  const groups = memory.filter((g) => scope === ALL || g.accountId === scope)
  return (
    <main className="main">
      <div className="head">
        <div>
          <h1>Memory</h1>
          <p>Auto memory per project: MEMORY.md and one file per memory</p>
        </div>
      </div>
      <div className="table-wrap">
        {groups.length === 0 ? (
          <p className="empty">No memory found.</p>
        ) : (
          groups.map((g) => (
            <section key={`${g.accountId}|${g.encoded}`} className="memory-group" data-testid="memory-group" title={g.encoded}>
              <h2>
                {g.projectPath ? baseName(g.projectPath) : g.encoded} <span className="who">({nameOf(accounts, g.accountId)}{g.index === null ? ', no MEMORY.md' : ''})</span>
              </h2>
              <table>
                <tbody>
                  {g.files.map((f) => (
                    <tr key={f.path} className="row" data-testid="memory-item" tabIndex={0} onClick={() => setOpen(open === f.path ? null : f.path)}>
                      <td className="name">{f.name ?? f.file}</td>
                      <td>{f.type ? <span className={`chip ${TYPE_TONE[f.type]}`} data-testid="memory-type">{f.type}</span> : <span className="none">no type</span>}</td>
                      <td>
                        {f.description}
                        {open === f.path && <pre className="doc" data-testid="memory-body">{f.body}</pre>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))
        )}
      </div>
    </main>
  )
}
