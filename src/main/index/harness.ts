// Harness projects: projects listed in an account's .claude.json (or added by hand) that have .harness/manifest.json.
// Drift is computed from the manifest directly (the harness CLI is not required).
// Format: docs/references/claude-code-and-harness-files.md
import { createHash } from 'node:crypto'
import { join, relative, resolve, sep } from 'node:path'
import type { Account, DriftEntry, HarnessOwnership, HarnessProject } from '@shared/model'
import { isDir, isFile, readBytes, readJson, resolveReal } from '../fsread'

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
const OWNERSHIPS: readonly HarnessOwnership[] = ['managed', 'seed', 'merge', 'generated']

/** `git hash-object --no-filters`: SHA-1 of "blob <size>\0" + bytes. */
export function gitBlobHash(bytes: Uint8Array): string {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
}

/** The managed block(s) of a merge file: every line from `<!-- harness:begin` through `<!-- harness:end -->`, each with "\n". */
export function managedBlocks(text: string): string {
  let out = ''
  let inside = false
  for (const line of text.split('\n')) {
    if (!inside && line.startsWith('<!-- harness:begin')) inside = true
    if (inside) out += `${line}\n` // bytes as-is (a CRLF file keeps its \r), like `sed -n '/begin/,/end/p' | git hash-object --stdin`
    if (inside && line.trimEnd() === '<!-- harness:end -->') inside = false
  }
  return out
}

const isInside = (child: string, parent: string): boolean => {
  const rel = relative(parent, child)
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith(sep)
}

/** Drift of one project. null when the manifest is missing or unreadable. */
export async function readDrift(projectDir: string): Promise<{ drift: DriftEntry[]; trackedFiles: number; version: string | null; source: string | null } | null> {
  const m = await readJson<Json>(join(projectDir, '.harness/manifest.json'))
  if (!m.ok) return null
  const files = Array.isArray(m.value['files']) ? (m.value['files'] as unknown[]).map(obj) : []
  const drift: DriftEntry[] = []
  for (const f of files) {
    const path = str(f['path'])
    const ownership = f['ownership'] as HarnessOwnership
    if (!path || !OWNERSHIPS.includes(ownership) || ownership === 'seed') continue
    const full = resolve(projectDir, path)
    if (!isInside(full, projectDir)) continue // a manifest must not make us read outside the project
    const expected = str(f['sha256'])
    const bytes = (await isFile(full)) ? await readBytes(full) : null
    if (!bytes) {
      drift.push({ path, ownership, status: 'missing' })
      continue
    }
    if (!expected || expected === '-') continue
    const actual = ownership === 'merge' ? gitBlobHash(Buffer.from(managedBlocks(bytes.toString('utf8')), 'utf8')) : gitBlobHash(bytes)
    if (actual !== expected) drift.push({ path, ownership, status: 'modified' })
  }
  return { drift, trackedFiles: files.length, version: str(m.value['harness_version']), source: str(m.value['source']) }
}

export interface DiscoverHarnessInput {
  accounts: Account[]
  manual?: readonly string[]
}

export async function discoverHarnessProjects(input: DiscoverHarnessInput): Promise<HarnessProject[]> {
  const { accounts, manual = [] } = input
  const found = new Map<string, { path: string; origin: HarnessProject['origin']; accountIds: string[] }>()
  const add = async (path: string, origin: HarnessProject['origin'], accountId?: string) => {
    const id = (await resolveReal(path)) ?? path
    const e = found.get(id) ?? { path, origin, accountIds: [] }
    if (origin === 'manual') e.origin = 'manual'
    if (accountId && !e.accountIds.includes(accountId)) e.accountIds.push(accountId)
    found.set(id, e)
  }
  for (const a of accounts) {
    const cj = await readJson<Json>(a.claudeJsonPath)
    for (const p of Object.keys(cj.ok ? obj(cj.value['projects']) : {})) {
      if (await isFile(join(p, '.harness/manifest.json'))) await add(p, 'auto', a.id)
    }
  }
  for (const m of manual) await add(m, 'manual')

  const out: HarnessProject[] = []
  for (const [id, e] of found) {
    const exists = await isDir(id)
    const d = exists ? await readDrift(id) : null
    out.push({
      id,
      path: e.path,
      origin: e.origin,
      exists,
      accountIds: e.accountIds,
      harnessVersion: d?.version ?? null,
      harnessSource: d?.source ?? null,
      trackedFiles: d?.trackedFiles ?? 0,
      drift: d?.drift ?? null
    })
  }
  return out.sort((a, b) => a.path.localeCompare(b.path))
}
