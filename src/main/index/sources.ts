// Sources: git repos that skills link into, ~/.agents (skills CLI), and dirs the user added.
// git state comes only from gitread (allowlisted read-only subcommands); the remote URL is read from .git/config.
import { join } from 'node:path'
import type { Source, SourceGit } from '@shared/model'
import type { AccountSnapshot } from '../adapters/claude-code'
import { inspect, isDir, readText, resolveReal } from '../fsread'
import { runGit } from '../gitread'

/** url of [remote "origin"], else of the first remote, in a git config file. */
export function remoteUrlFromConfig(config: string): string | null {
  const urls: { name: string; url: string }[] = []
  let remote: string | null = null
  for (const raw of config.split(/\r?\n/)) {
    const line = raw.trim()
    const section = /^\[\s*([^\s\]"]+)(?:\s+"([^"]*)")?\s*\]$/.exec(line)
    if (section) {
      remote = section[1]?.toLowerCase() === 'remote' ? (section[2] ?? null) : null
      continue
    }
    const kv = /^url\s*=\s*(.+)$/i.exec(line)
    if (remote !== null && kv?.[1]) urls.push({ name: remote, url: kv[1].trim() })
  }
  return (urls.find((u) => u.name === 'origin') ?? urls[0])?.url ?? null
}

export async function readSourceGit(dir: string): Promise<SourceGit | null> {
  const gitDir = join(dir, '.git')
  if (!(await inspect(gitDir)).exists) return null
  const status = await runGit(dir, 'status', ['--porcelain=v1', '--untracked-files=normal'])
  if (!status.ok) return null
  const unpushed = await runGit(dir, 'rev-list', ['--count', 'HEAD', '--not', '--remotes'])
  const branch = await runGit(dir, 'rev-parse', ['--abbrev-ref', 'HEAD'])
  const config = (await isDir(gitDir)) ? await readText(join(gitDir, 'config')) : null
  const b = branch.ok ? branch.stdout.trim() : ''
  return {
    branch: b && b !== 'HEAD' ? b : null,
    uncommitted: status.stdout.split('\n').filter((l) => l.trim() !== '').length,
    unpushed: unpushed.ok ? Number.parseInt(unpushed.stdout.trim(), 10) || 0 : 0,
    remoteUrl: config ? remoteUrlFromConfig(config) : null
  }
}

export interface DiscoverSourcesInput {
  home: string
  snapshots: AccountSnapshot[]
  manual?: readonly string[]
}

export async function discoverSources(input: DiscoverSourcesInput): Promise<Source[]> {
  const { home, snapshots, manual = [] } = input
  const found = new Map<string, { path: string; origin: Source['origin']; linked: Source['linkedSkills'] }>()
  const add = async (path: string, origin: Source['origin'], skill?: { accountId: string; name: string }) => {
    const id = (await resolveReal(path)) ?? path
    const e = found.get(id) ?? { path, origin, linked: [] }
    if (origin === 'manual') e.origin = 'manual'
    if (skill && !e.linked.some((l) => l.accountId === skill.accountId && l.name === skill.name)) e.linked.push(skill)
    found.set(id, e)
  }
  for (const snap of snapshots) {
    for (const s of snap.skills) {
      const p = s.provenance
      const ref = { accountId: snap.account.id, name: s.name }
      if (p.kind === 'symlink' && p.sourceRoot) await add(p.sourceRoot, 'auto', ref)
      else if (p.kind === 'skills-cli') await add(join(home, '.agents'), 'auto', ref)
    }
  }
  for (const m of manual) await add(m, 'manual')

  const out: Source[] = []
  for (const [id, e] of found) {
    const exists = await isDir(id)
    out.push({ id, path: e.path, origin: e.origin, exists, git: exists ? await readSourceGit(id) : null, linkedSkills: e.linked })
  }
  return out.sort((a, b) => a.path.localeCompare(b.path))
}
