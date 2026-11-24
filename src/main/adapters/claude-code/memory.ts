// Auto memory: <configDir>/projects/<encoded project path>/memory/ — MEMORY.md (index) + one file per memory.
import { join } from 'node:path'
import type { MemoryFile, MemoryGroup, MemoryType } from '@shared/model'
import { isDir, listDir, readText } from '../../fsread'
import { parseFrontmatter } from '../frontmatter'

const TYPES: readonly MemoryType[] = ['user', 'feedback', 'project', 'reference']

/** Claude Code names a project dir by replacing every non-alphanumeric char of its absolute path with "-". */
export const encodeProjectPath = (absPath: string): string => absPath.replace(/[^A-Za-z0-9]/g, '-')

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

export function parseMemoryFile(file: string, path: string, text: string): MemoryFile {
  const fm = parseFrontmatter(text)
  const data = fm.ok ? fm.data : {}
  const meta = data['metadata'] && typeof data['metadata'] === 'object' ? (data['metadata'] as Record<string, unknown>) : {}
  const t = str(meta['type']) ?? str(data['type'])
  return {
    file,
    path,
    name: str(data['name']),
    description: str(data['description']),
    type: TYPES.includes(t as MemoryType) ? (t as MemoryType) : null,
    body: fm.body
  }
}

/** Memory groups of one account. `knownProjects` (e.g. from .claude.json) are used to name the encoded dirs. */
export async function readMemory(accountId: string, configDir: string, knownProjects: readonly string[]): Promise<MemoryGroup[]> {
  const byEncoded = new Map(knownProjects.map((p) => [encodeProjectPath(p), p]))
  const out: MemoryGroup[] = []
  for (const e of await listDir(join(configDir, 'projects'))) {
    const dir = join(configDir, 'projects', e.name, 'memory')
    if (!(await isDir(dir))) continue
    const files: MemoryFile[] = []
    let index: string | null = null
    for (const f of (await listDir(dir)).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!f.name.endsWith('.md')) continue
      const text = await readText(join(dir, f.name))
      if (text === null) continue
      if (f.name === 'MEMORY.md') index = text
      else files.push(parseMemoryFile(f.name, join(dir, f.name), text))
    }
    out.push({ accountId, encoded: e.name, projectPath: byEncoded.get(e.name) ?? null, index, files })
  }
  return out.sort((a, b) => a.encoded.localeCompare(b.encoded))
}
