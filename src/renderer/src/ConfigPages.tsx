import { useState } from 'react'
import type { Account, EffectiveSetting } from '@shared/model'
import { isSecretKey, MASK, maskDeep } from '@shared/mask'
import { ALL, useAppStore } from './store'

const nameOf = (accounts: Account[], id: string): string => accounts.find((a) => a.id === id)?.displayName ?? id
const baseName = (p: string): string => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? p
const show = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v))

/** A value that is masked when its key looks secret; click to reveal / hide. */
function Value({ path, value }: { path: string; value: unknown }) {
  const [revealed, setRevealed] = useState(false)
  if (!isSecretKey(path)) return <code data-testid="value">{show(value)}</code>
  return (
    <button type="button" className="reveal" data-testid="value" data-masked={!revealed} onClick={() => setRevealed(!revealed)} title={revealed ? 'Hide' : 'Click to reveal'}>
      <code>{revealed ? show(value) : MASK}</code>
    </button>
  )
}

/** Raw JSON with secret-looking values masked until revealed. */
function RawJson({ value }: { value: unknown }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div>
      <label className="toggle">
        <input type="checkbox" checked={revealed} onChange={(e) => setRevealed(e.target.checked)} />
        Reveal secret-looking values
      </label>
      <pre className="doc" data-testid="raw">{JSON.stringify(revealed ? value : maskDeep(value), null, 2)}</pre>
    </div>
  )
}

function Empty({ what, list, error }: { what: string; list: unknown[] | null; error: string | null }) {
  if (list === null) return <p className="empty">{error ? `Could not read ${what}: ${error}` : 'Loading…'}</p>
  return <p className="empty">No {what} found.</p>
}

export function SettingsPage() {
  const { settings, accounts, scope, configError } = useAppStore()
  const views = (settings ?? []).filter((v) => scope === ALL || v.accountId === scope)
  const [selected, setSelected] = useState<string | null>(null)
  const [layer, setLayer] = useState<string>('effective')
  const view = views.find((v) => v.id === selected) ?? views[0] ?? null
  const label = (v: (typeof views)[number]) => `${nameOf(accounts, v.accountId)}${v.project ? ` · ${baseName(v.project.path)}` : ''}`
  return (
    <main className="main">
      <div className="head">
        <div>
          <h1>Settings</h1>
          <p>Each layer (user / project / local / managed) and the effective value with the layer it came from</p>
        </div>
      </div>
      {!view ? (
        <Empty what="settings" list={settings && views} error={configError} />
      ) : (
        <div className="body">
          <div className="table-wrap list">
            <ul className="doc-list">
              {views.map((v) => (
                <li key={v.id}>
                  <button type="button" className="nav-item" data-testid="settings-view" aria-current={v.id === view.id ? 'true' : undefined} onClick={() => setSelected(v.id)}>
                    <span>{label(v)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <section className="detail wide" aria-label="Settings" data-testid="settings-detail">
            <div className="chips" role="tablist">
              {['effective', ...view.layers.map((l) => l.name)].map((n) => {
                const l = view.layers.find((x) => x.name === n)
                return (
                  <button key={n} type="button" role="tab" aria-selected={layer === n} className={`chip tab ${l && l.status !== 'ok' ? 'off' : ''}`} onClick={() => setLayer(n)} title={l?.path}>
                    {n}
                    {l && l.status !== 'ok' ? ` (${l.status})` : ''}
                  </button>
                )
              })}
            </div>
            {layer === 'effective' ? (
              <table data-testid="effective">
                <thead>
                  <tr>
                    <th scope="col">Key</th>
                    <th scope="col">Value</th>
                    <th scope="col">From</th>
                  </tr>
                </thead>
                <tbody>
                  {view.effective.map((e: EffectiveSetting, i) => (
                    <tr key={`${e.path}#${i}`} data-testid="effective-row" data-path={e.path}>
                      <td className="name">{e.path}</td>
                      <td>
                        <Value path={e.path} value={e.value} />
                      </td>
                      <td data-testid="from">
                        <span className="chip">{e.from}</span>
                        {e.overrides.length > 0 && <span className="who"> overrides {e.overrides.map((o) => o.layer).join(', ')}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              (() => {
                const l = view.layers.find((x) => x.name === layer)
                if (!l) return null
                return (
                  <div>
                    <p className="desc">{l.path}</p>
                    {l.value ? <RawJson value={l.value} /> : <p className="empty">{l.status === 'missing' ? 'File does not exist.' : 'File is not valid JSON.'}</p>}
                  </div>
                )
              })()
            )}
          </section>
        </div>
      )}
    </main>
  )
}

export function McpPage() {
  const { mcpServers, accounts, scope, configError } = useAppStore()
  const servers = (mcpServers ?? []).filter((s) => scope === ALL || s.accountId === scope)
  const [open, setOpen] = useState<string | null>(null)
  return (
    <main className="main">
      <div className="head">
        <div>
          <h1>MCP</h1>
          <p>MCP servers by scope: user and local (.claude.json), project (.mcp.json)</p>
        </div>
      </div>
      <div className="table-wrap">
        {servers.length === 0 ? (
          <Empty what="MCP servers" list={mcpServers && servers} error={configError} />
        ) : (
          <table data-testid="mcp">
            <thead>
              <tr>
                <th scope="col">Server</th>
                <th scope="col">Scope</th>
                <th scope="col">Transport</th>
                <th scope="col">Account</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => {
                const key = `${s.accountId}|${s.scope}|${s.projectPath ?? ''}|${s.name}`
                return (
                  <tr key={key} className="row" data-testid="mcp-row" data-name={s.name} onClick={() => setOpen(open === key ? null : key)} tabIndex={0}>
                    <td className="name" title={s.file}>
                      {s.name}
                      {open === key && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <RawJson value={s.raw} />
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="chip">{s.scope}</span>
                      {s.projectPath && <span className="who"> {baseName(s.projectPath)}</span>}
                    </td>
                    <td>
                      {s.transport} <code>{s.target}</code>
                    </td>
                    <td>{nameOf(accounts, s.accountId)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}

export function AgentsPage() {
  const { agentsAndCommands, accounts, scope, configError } = useAppStore()
  const items = (agentsAndCommands ?? []).filter((i) => scope === ALL || i.accountId === scope)
  const [open, setOpen] = useState<string | null>(null)
  return (
    <main className="main">
      <div className="head">
        <div>
          <h1>Agents &amp; commands</h1>
          <p>Subagents (agents/*.md) and slash commands (commands/*.md) of each account and harness project</p>
        </div>
      </div>
      <div className="table-wrap">
        {items.length === 0 ? (
          <Empty what="agents or commands" list={agentsAndCommands && items} error={configError} />
        ) : (
          <table data-testid="agents">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Kind</th>
                <th scope="col">Where</th>
                <th scope="col">Description</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.path} className="row" data-testid="agent-row" data-kind={i.kind} onClick={() => setOpen(open === i.path ? null : i.path)} tabIndex={0}>
                  <td className="name" title={i.path}>{i.kind === 'command' ? `/${i.name}` : i.name}</td>
                  <td>
                    <span className="chip">{i.kind}</span>
                  </td>
                  <td>{i.projectPath ? `project ${baseName(i.projectPath)}` : nameOf(accounts, i.accountId)}</td>
                  <td>
                    {i.description ?? <span className="none">—</span>}
                    {open === i.path && <pre className="doc" data-testid="agent-raw">{i.raw}</pre>}
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
