// claude-code adapter: reads one Claude Code account (config dir) into the normalized model.
// Formats: docs/references/claude-code-and-harness-files.md
import { dirname, join, relative, resolve, sep } from 'node:path'
import type { Account, Plugin, PluginEnabled, Provenance, Skill, SkillScope, Upstream } from '@shared/model'
import { inspect, isDir, isFile, listDir, readJson, readText, resolveReal } from '../../fsread'
import { parseFrontmatter } from '../frontmatter'

export interface ReadContext {
  home: string
}

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})
const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined)

const isInside = (child: string, parent: string): boolean => {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(sep) && rel !== '..')
}

/** nearest ancestor (inclusive) that contains .git, stopping at the filesystem root */
async function gitRootOf(path: string): Promise<string | null> {
  let dir = path
  for (;;) {
    if ((await inspect(join(dir, '.git'))).exists) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

interface SkillsCliLock {
  skills: Record<string, { source?: string; sourceUrl?: string; ref?: string }>
}

async function readSkillsCliLock(home: string): Promise<SkillsCliLock> {
  const r = await readJson<Json>(join(home, '.agents/.skill-lock.json'))
  const skills = r.ok ? obj(r.value['skills']) : {}
  return { skills: skills as SkillsCliLock['skills'] }
}

async function readSkillDir(
  dir: string,
  name: string,
  scope: SkillScope,
  accountId: string,
  provenance: Provenance,
  realPath: string | null
): Promise<Skill> {
  const base: Omit<Skill, 'frontmatter' | 'frontmatterError' | 'description' | 'body'> = {
    name,
    scope,
    accountId,
    path: dir,
    realPath,
    provenance
  }
  const text = realPath ? await readText(join(realPath, 'SKILL.md')) : null
  if (text === null) return { ...base, frontmatter: null, frontmatterError: 'missing-file', description: null, body: null }
  const fm = parseFrontmatter(text)
  if (!fm.ok) return { ...base, frontmatter: null, frontmatterError: fm.error, description: null, body: fm.body }
  return { ...base, frontmatter: fm.data, frontmatterError: null, description: str(fm.data['description']) ?? null, body: fm.body }
}

/** Skills in a `skills/` directory: user skills of an account, or project skills of a harness project. */
export async function readSkillsDir(skillsDir: string, scope: SkillScope, accountId: string, ctx: ReadContext): Promise<Skill[]> {
  const lock = await readSkillsCliLock(ctx.home)
  const agentsSkills = join(ctx.home, '.agents/skills')
  const out: Skill[] = []
  for (const e of await listDir(skillsDir)) {
    if (e.name.startsWith('.')) continue
    const path = join(skillsDir, e.name)
    const info = await inspect(path)
    if (info.kind === 'symlink') {
      const linkTarget = info.linkTarget ?? ''
      if (!info.targetExists) {
        out.push(await readSkillDir(path, e.name, scope, accountId, { kind: 'broken-link', linkTarget }, null))
        continue
      }
      const real = await resolveReal(path)
      if (!real || !(await isDir(real))) continue
      const realAgents = (await resolveReal(agentsSkills)) ?? agentsSkills
      const lockEntry = lock.skills[e.name]
      const provenance: Provenance =
        isInside(real, realAgents) && lockEntry
          ? { kind: 'skills-cli', linkTarget, lockSource: lockEntry.source ?? '', upstream: upstreamOf(lockEntry.sourceUrl, lockEntry.ref) }
          : { kind: 'symlink', linkTarget, sourceRoot: await gitRootOf(real) }
      out.push(await readSkillDir(path, e.name, scope, accountId, provenance, real))
    } else if (info.kind === 'dir') {
      out.push(await readSkillDir(path, e.name, scope, accountId, { kind: 'local' }, await resolveReal(path)))
    }
  }
  return out
}

const upstreamOf = (url?: string, ref?: string): Upstream => ({ ...(url ? { url } : {}), ...(ref ? { ref } : {}) })

export async function readSettingsJson(account: Account): Promise<Json> {
  const r = await readJson<Json>(join(account.configDir, 'settings.json'))
  return r.ok ? obj(r.value) : {}
}

function enabledState(settings: Json, id: string): PluginEnabled {
  const v = obj(settings['enabledPlugins'])[id]
  return typeof v === 'boolean' ? v : 'unset'
}

interface MarketplaceInfo {
  upstream: Upstream
  /** plugin name → skill paths declared in marketplace.json (relative to the plugin dir) */
  declaredSkills: Record<string, string[]>
}

async function readMarketplaces(account: Account): Promise<Record<string, MarketplaceInfo>> {
  const known = await readJson<Json>(join(account.configDir, 'plugins/known_marketplaces.json'))
  const out: Record<string, MarketplaceInfo> = {}
  for (const [name, raw] of Object.entries(known.ok ? obj(known.value) : {})) {
    const entry = obj(raw)
    const source = obj(entry['source'])
    const repo = str(source['repo'])
    const url = str(source['url']) ?? (str(source['source']) === 'github' && repo ? `https://github.com/${repo}.git` : undefined)
    const declaredSkills: Record<string, string[]> = {}
    const loc = str(entry['installLocation'])
    if (loc) {
      const m = await readJson<Json>(join(loc, '.claude-plugin/marketplace.json'))
      const plugins = m.ok && Array.isArray(m.value['plugins']) ? (m.value['plugins'] as unknown[]) : []
      for (const p of plugins.map(obj)) {
        const pname = str(p['name'])
        const skills = p['skills']
        if (pname && Array.isArray(skills)) declaredSkills[pname] = skills.filter((s): s is string => typeof s === 'string')
      }
    }
    out[name] = { upstream: upstreamOf(url), declaredSkills }
  }
  return out
}

export async function readPlugins(account: Account): Promise<Plugin[]> {
  const settings = await readSettingsJson(account)
  const markets = await readMarketplaces(account)
  const installed = await readJson<Json>(join(account.configDir, 'plugins/installed_plugins.json'))
  const plugins = installed.ok ? obj(installed.value['plugins']) : {}
  const out: Plugin[] = []
  for (const [id, raw] of Object.entries(plugins)) {
    const at = id.lastIndexOf('@')
    const name = at > 0 ? id.slice(0, at) : id
    const marketplace = at > 0 ? id.slice(at + 1) : ''
    const entries = Array.isArray(raw) ? raw.map(obj) : []
    const entry = entries.find((e) => e['scope'] === 'user') ?? entries[0] ?? {}
    const installPath = str(entry['installPath']) ?? null
    const version = str(entry['version']) ?? null
    const market = markets[marketplace]
    const ref = str(entry['gitCommitSha']) ?? version ?? undefined
    out.push({
      id,
      name,
      marketplace,
      version,
      installPath,
      installPathExists: installPath ? await isDir(installPath) : false,
      enabled: enabledState(settings, id),
      upstream: upstreamOf(market?.upstream.url, ref)
    })
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

/** Skill dirs of an installed plugin: declared paths (plugin.json / marketplace.json), skills/*, and dirs at the plugin root. */
async function pluginSkillDirs(installPath: string, declared: string[]): Promise<string[]> {
  const found = new Set<string>()
  const pj = await readJson<Json>(join(installPath, '.claude-plugin/plugin.json'))
  const fromPluginJson = pj.ok ? pj.value['skills'] : undefined
  const declaredAll = [...declared, ...(typeof fromPluginJson === 'string' ? [fromPluginJson] : Array.isArray(fromPluginJson) ? fromPluginJson : [])]
  for (const d of declaredAll) {
    if (typeof d !== 'string') continue
    const p = resolve(installPath, d)
    if (!isInside(p, installPath)) continue
    if (await isFile(join(p, 'SKILL.md'))) found.add(p)
    else for (const e of await listDir(p)) if (await isFile(join(p, e.name, 'SKILL.md'))) found.add(join(p, e.name))
  }
  for (const parent of [join(installPath, 'skills'), installPath]) {
    for (const e of await listDir(parent)) {
      if (e.name.startsWith('.')) continue
      const p = join(parent, e.name)
      if (await isFile(join(p, 'SKILL.md'))) found.add(p)
    }
  }
  return [...found].sort()
}

export async function readPluginSkills(account: Account, plugins: Plugin[]): Promise<Skill[]> {
  const markets = await readMarketplaces(account)
  const out: Skill[] = []
  for (const p of plugins) {
    if (!p.installPath || !p.installPathExists) continue
    const declared = markets[p.marketplace]?.declaredSkills[p.name] ?? []
    for (const dir of await pluginSkillDirs(p.installPath, declared)) {
      const provenance: Provenance = { kind: 'plugin', pluginId: p.id, enabled: p.enabled, upstream: p.upstream }
      const name = dir.slice(dir.lastIndexOf(sep) + 1)
      out.push(await readSkillDir(dir, name, 'plugin', account.id, provenance, await resolveReal(dir)))
    }
  }
  return out
}

export interface AccountSnapshot {
  account: Account
  skills: Skill[]
  plugins: Plugin[]
}

export async function readClaudeCodeAccount(account: Account, ctx: ReadContext): Promise<AccountSnapshot> {
  const plugins = await readPlugins(account)
  const skills = [
    ...(await readSkillsDir(join(account.configDir, 'skills'), 'user', account.id, ctx)),
    ...(await readPluginSkills(account, plugins))
  ]
  return { account, skills, plugins }
}
