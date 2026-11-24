// settings.json layers, the effective merge, MCP servers, agents and commands.
// Merge (Claude Code): higher layers override scalars and objects key by key; arrays are concatenated across layers.
import { join } from 'node:path'
import type { Account, AgentOrCommand, EffectiveSetting, McpScope, McpServer, SettingsLayer, SettingsLayerName } from '@shared/model'
import { SETTINGS_LAYERS } from '@shared/model'
import { isDir, isFile, listDir, readJson, readText } from '../../fsread'
import { parseFrontmatter } from '../frontmatter'

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v)
const obj = (v: unknown): Json => (isObj(v) ? v : {})
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

/** managed-settings.json per platform; tests inject their own path. */
export function defaultManagedSettingsPath(platform: string): string {
  if (platform === 'darwin') return '/Library/Application Support/ClaudeCode/managed-settings.json'
  if (platform === 'win32') return 'C:\\Program Files\\ClaudeCode\\managed-settings.json'
  return '/etc/claude-code/managed-settings.json'
}

export async function readLayer(name: SettingsLayerName, path: string): Promise<SettingsLayer> {
  if (!(await isFile(path))) return { name, path, status: 'missing', value: null }
  const r = await readJson<unknown>(path)
  return r.ok && isObj(r.value) ? { name, path, status: 'ok', value: r.value } : { name, path, status: 'invalid', value: null }
}

/** Effective leaves, sorted by path. `layers` may come in any order; precedence follows SETTINGS_LAYERS. */
export function mergeSettings(layers: SettingsLayer[]): EffectiveSetting[] {
  const ordered = [...layers].sort((a, b) => SETTINGS_LAYERS.indexOf(a.name) - SETTINGS_LAYERS.indexOf(b.name))
  const scalars = new Map<string, EffectiveSetting>()
  const arrays = new Map<string, EffectiveSetting[]>()
  const walk = (v: unknown, path: string, layer: SettingsLayerName) => {
    if (Array.isArray(v)) {
      const items = arrays.get(path) ?? []
      for (const item of v) if (!items.some((i) => JSON.stringify(i.value) === JSON.stringify(item))) items.push({ path, value: item, from: layer, overrides: [] })
      arrays.set(path, items)
    } else if (isObj(v) && Object.keys(v).length > 0) {
      for (const [k, child] of Object.entries(v)) walk(child, path ? `${path}.${k}` : k, layer)
    } else {
      const prev = scalars.get(path)
      scalars.set(path, { path, value: v, from: layer, overrides: prev ? [...prev.overrides, { layer: prev.from, value: prev.value }] : [] })
    }
  }
  for (const l of ordered) if (l.value) walk(l.value, '', l.name)
  return [...scalars.values(), ...[...arrays.values()].flat()].sort((a, b) => a.path.localeCompare(b.path))
}

export interface SettingsPaths {
  managedPath: string
}

export async function readAccountLayers(account: Account, paths: SettingsPaths, project: string | null): Promise<SettingsLayer[]> {
  const layers = [await readLayer('user', join(account.configDir, 'settings.json'))]
  if (project) {
    layers.push(await readLayer('project', join(project, '.claude/settings.json')))
    layers.push(await readLayer('local', join(project, '.claude/settings.local.json')))
  }
  layers.push(await readLayer('managed', paths.managedPath))
  return layers
}

function toServer(name: string, raw: unknown, scope: McpScope, accountId: string, projectPath: string | null, file: string): McpServer {
  const r = obj(raw)
  const url = str(r['url'])
  const command = [str(r['command']), ...(Array.isArray(r['args']) ? r['args'].filter((a): a is string => typeof a === 'string') : [])].filter(Boolean).join(' ')
  return { name, scope, accountId, projectPath, file, transport: str(r['type']) ?? (url ? 'http' : 'stdio'), target: url ?? command, raw }
}

/** MCP servers: user (`.claude.json` top level), local (`.claude.json` projects[p]), project (`<p>/.mcp.json`). */
export async function readMcpServers(account: Account, projects: readonly string[]): Promise<McpServer[]> {
  const cj = await readJson<Json>(account.claudeJsonPath)
  const root = cj.ok ? obj(cj.value) : {}
  const out: McpServer[] = []
  for (const [n, raw] of Object.entries(obj(root['mcpServers']))) out.push(toServer(n, raw, 'user', account.id, null, account.claudeJsonPath))
  for (const [p, entry] of Object.entries(obj(root['projects']))) {
    for (const [n, raw] of Object.entries(obj(obj(entry)['mcpServers']))) out.push(toServer(n, raw, 'local', account.id, p, account.claudeJsonPath))
  }
  for (const p of projects) {
    const file = join(p, '.mcp.json')
    const m = await readJson<Json>(file)
    if (m.ok) for (const [n, raw] of Object.entries(obj(m.value['mcpServers']))) out.push(toServer(n, raw, 'project', account.id, p, file))
  }
  return out
}

async function mdFiles(dir: string, prefix = ''): Promise<{ rel: string; path: string }[]> {
  const out: { rel: string; path: string }[] = []
  if (!(await isDir(dir))) return out
  for (const e of (await listDir(dir)).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (await isDir(p)) out.push(...(await mdFiles(p, `${prefix}${e.name}/`)))
    else if (e.name.endsWith('.md')) out.push({ rel: `${prefix}${e.name}`, path: p })
  }
  return out
}

async function readKind(kind: AgentOrCommand['kind'], base: string, accountId: string, projectPath: string | null): Promise<AgentOrCommand[]> {
  const out: AgentOrCommand[] = []
  for (const f of await mdFiles(join(base, kind === 'agent' ? 'agents' : 'commands'))) {
    const raw = (await readText(f.path)) ?? ''
    const fm = parseFrontmatter(raw)
    const data = fm.ok ? fm.data : {}
    const stem = f.rel.replace(/\.md$/, '')
    const name = kind === 'agent' ? (str(data['name']) ?? stem.split('/').pop() ?? stem) : stem.split('/').join(':')
    out.push({ kind, name, accountId, projectPath, path: f.path, description: str(data['description']), raw })
  }
  return out
}

/** Agents and commands of an account (`<configDir>/agents|commands`) and of projects (`<p>/.claude/agents|commands`). */
export async function readAgentsAndCommands(account: Account, projects: readonly string[]): Promise<AgentOrCommand[]> {
  const out: AgentOrCommand[] = []
  for (const kind of ['agent', 'command'] as const) {
    out.push(...(await readKind(kind, account.configDir, account.id, null)))
    for (const p of projects) out.push(...(await readKind(kind, join(p, '.claude'), account.id, p)))
  }
  return out
}
