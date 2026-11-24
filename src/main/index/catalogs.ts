// Catalogs (decisions/0003): a local clone in an existing layout — a plugin marketplace
// (.claude-plugin/marketplace.json) or a skills repo (skills/<name>/SKILL.md). Read-only; no fetch, no install.
import { basename, join, relative, resolve, sep } from 'node:path'
import type { Catalog, CatalogEntry, CatalogSkill, CatalogState, Skill } from '@shared/model'
import type { CatalogRoot } from '@shared/prefs'
import { parseFrontmatter } from '../adapters/frontmatter'
import { isDir, isFile, listDir, readJson, readText } from '../fsread'
import { hashSkillDir } from './skillCompare'

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
const inside = (child: string, parent: string): boolean => {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(sep))
}

async function skillAt(dir: string, plugin: string | null, version: string | null): Promise<CatalogSkill | null> {
  const text = await readText(join(dir, 'SKILL.md'))
  if (text === null) return null
  const fm = parseFrontmatter(text)
  return { name: basename(dir), path: dir, plugin, version, description: fm.ok ? str(fm.data['description']) : null }
}

async function skillsUnder(dir: string, plugin: string | null, version: string | null): Promise<CatalogSkill[]> {
  const out: CatalogSkill[] = []
  for (const e of (await listDir(dir)).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith('.')) continue
    const s = await skillAt(join(dir, e.name), plugin, version)
    if (s) out.push(s)
  }
  return out
}

export async function readCatalog(root: CatalogRoot): Promise<Catalog> {
  const base: Omit<Catalog, 'layout' | 'name' | 'skills' | 'exists'> = { accountId: root.accountId, path: root.path }
  if (!(await isDir(root.path))) return { ...base, exists: false, layout: 'unknown', name: basename(root.path), skills: [] }
  const market = await readJson<Json>(join(root.path, '.claude-plugin/marketplace.json'))
  if (market.ok) {
    const skills: CatalogSkill[] = []
    const plugins = Array.isArray(market.value['plugins']) ? (market.value['plugins'] as unknown[]).map(obj) : []
    for (const p of plugins) {
      const name = str(p['name'])
      const source = str(p['source']) // remote sources (objects) need a fetch: out of the MVP
      if (!name || !source) continue
      const dir = resolve(root.path, source)
      if (!inside(dir, root.path)) continue
      const pj = await readJson<Json>(join(dir, '.claude-plugin/plugin.json'))
      const version = str(p['version']) ?? (pj.ok ? str(pj.value['version']) : null)
      const declared = Array.isArray(p['skills']) ? (p['skills'] as unknown[]).filter((s): s is string => typeof s === 'string') : []
      const found = new Map<string, CatalogSkill>()
      for (const d of declared) {
        const sd = resolve(dir, d)
        if (!inside(sd, root.path)) continue
        const s = (await isFile(join(sd, 'SKILL.md'))) ? await skillAt(sd, name, version) : null
        for (const k of s ? [s] : await skillsUnder(sd, name, version)) found.set(k.path, k)
      }
      for (const k of await skillsUnder(join(dir, 'skills'), name, version)) found.set(k.path, k)
      skills.push(...found.values())
    }
    return { ...base, exists: true, layout: 'marketplace', name: str(market.value['name']) ?? basename(root.path), skills }
  }
  const skills = await skillsUnder(join(root.path, 'skills'), null, null)
  return { ...base, exists: true, layout: skills.length > 0 ? 'skills-repo' : 'unknown', name: basename(root.path), skills }
}

/** Compare a catalog skill with the account's copies of the same name: same folder hash → installed. */
export async function catalogState(skill: CatalogSkill, installed: Skill[]): Promise<CatalogState> {
  if (installed.length === 0) return 'not-installed'
  const want = await hashSkillDir(skill.path)
  for (const s of installed) {
    if (s.realPath && want !== null && (await hashSkillDir(s.realPath)) === want) return 'installed'
  }
  return 'differs'
}

export async function catalogEntries(catalogs: Catalog[], accountSkills: Skill[]): Promise<Map<string, CatalogEntry[]>> {
  const out = new Map<string, CatalogEntry[]>()
  for (const c of catalogs) {
    for (const skill of c.skills) {
      const state = await catalogState(skill, accountSkills.filter((s) => s.name === skill.name))
      out.set(skill.name, [...(out.get(skill.name) ?? []), { catalogPath: c.path, catalogName: c.name, skill, state }])
    }
  }
  return out
}
