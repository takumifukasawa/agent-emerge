// The app's own preferences (docs/decisions/0002). Plain data; pure update functions.

export type ManualRootKind = 'accounts' | 'sources' | 'harnessProjects'

export interface CatalogRoot {
  /** account the catalog belongs to (catalogs are per account, decisions/0003) */
  accountId: string
  /** local clone of the catalog repo (MVP: the user clones it; no fetch) */
  path: string
}

export interface Prefs {
  version: 1
  /** keyed by root id (real path) */
  displayNames: Record<string, string>
  manualRoots: Record<ManualRootKind, string[]>
  catalogs: CatalogRoot[]
}

export function defaultPrefs(): Prefs {
  return { version: 1, displayNames: {}, manualRoots: { accounts: [], sources: [], harnessProjects: [] }, catalogs: [] }
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** Accept anything; keep only well-formed fields. */
export function sanitizePrefs(raw: unknown): Prefs {
  const p = defaultPrefs()
  if (typeof raw !== 'object' || raw === null) return p
  const r = raw as Record<string, unknown>
  if (typeof r['displayNames'] === 'object' && r['displayNames'] !== null) {
    for (const [k, v] of Object.entries(r['displayNames'] as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim() !== '') p.displayNames[k] = v
    }
  }
  const roots = (r['manualRoots'] ?? {}) as Record<string, unknown>
  for (const kind of Object.keys(p.manualRoots) as ManualRootKind[]) p.manualRoots[kind] = [...new Set(strings(roots[kind]))]
  if (Array.isArray(r['catalogs'])) {
    for (const c of r['catalogs'] as unknown[]) {
      const cc = c as Record<string, unknown>
      if (typeof cc?.['accountId'] === 'string' && typeof cc['path'] === 'string') {
        p.catalogs.push({ accountId: cc['accountId'], path: cc['path'] })
      }
    }
  }
  return p
}

export function withDisplayName(p: Prefs, id: string, name: string | null): Prefs {
  const displayNames = { ...p.displayNames }
  if (name === null || name.trim() === '') delete displayNames[id]
  else displayNames[id] = name.trim()
  return { ...p, displayNames }
}

export function withManualRoot(p: Prefs, kind: ManualRootKind, path: string, add: boolean): Prefs {
  const list = p.manualRoots[kind].filter((x) => x !== path)
  return { ...p, manualRoots: { ...p.manualRoots, [kind]: add ? [...list, path] : list } }
}

export function withCatalog(p: Prefs, catalog: CatalogRoot, add: boolean): Prefs {
  const rest = p.catalogs.filter((c) => !(c.accountId === catalog.accountId && c.path === catalog.path))
  return { ...p, catalogs: add ? [...rest, catalog] : rest }
}
