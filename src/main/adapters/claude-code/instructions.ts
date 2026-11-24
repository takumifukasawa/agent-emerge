// CLAUDE.md / AGENTS.md with `@path` imports expanded (Claude Code memory imports).
// Rules: a token "@path" at line start or after whitespace, outside code spans / fences; relative to the importing
// file, "~/" = home, absolute allowed; recursive up to MAX_DEPTH hops (Claude Code's limit).
import { dirname, isAbsolute, join, resolve } from 'node:path'
import type { ImportNode, InstructionsDoc, InstructionsKind } from '@shared/model'
import { isFile, readText, resolveReal } from '../../fsread'

export const MAX_DEPTH = 5
const MAX_BYTES = 512 * 1024

/** Import tokens in a markdown text, in order, skipping fenced blocks and inline code. */
export function importSpecs(text: string): { spec: string; index: number; length: number }[] {
  const out: { spec: string; index: number; length: number }[] = []
  let offset = 0
  let fence: string | null = null
  for (const line of text.split('\n')) {
    const f = /^\s*(`{3,}|~{3,})/.exec(line)
    if (fence) {
      if (f && f[1]?.[0] === fence[0] && (f[1]?.length ?? 0) >= fence.length) fence = null
    } else if (f?.[1]) {
      fence = f[1]
    } else {
      // blank out inline code so tokens inside it are not seen
      const masked = line.replace(/(`+)[^`]*?\1/g, (m) => ' '.repeat(m.length))
      for (const m of masked.matchAll(/(^|\s)@((?:~\/|\.{1,2}\/|\/)?[\w.-][\w./-]*)/g)) {
        const spec = (m[2] ?? '').replace(/[.,;:)]+$/, '')
        if (!spec || !/[/.]/.test(spec)) continue // "@someone" is a mention, not a path
        const at = (m.index ?? 0) + (m[1]?.length ?? 0)
        out.push({ spec, index: offset + at, length: spec.length + 1 })
      }
    }
    offset += line.length + 1
  }
  return out
}

function resolveSpec(spec: string, fromFile: string, home: string): string {
  if (spec.startsWith('~/')) return join(home, spec.slice(2))
  return isAbsolute(spec) ? spec : resolve(dirname(fromFile), spec)
}

interface Expanded {
  expanded: string
  imports: ImportNode[]
}

async function expand(text: string, file: string, home: string, chain: string[]): Promise<Expanded> {
  const specs = importSpecs(text)
  const imports: ImportNode[] = []
  let expanded = ''
  let last = 0
  for (const s of specs) {
    const path = resolveSpec(s.spec, file, home)
    const real = (await resolveReal(path)) ?? path
    let node: ImportNode
    let content: string | null = null
    if (chain.includes(real)) node = { spec: s.spec, path, status: 'cycle', children: [] }
    else if (chain.length > MAX_DEPTH) node = { spec: s.spec, path, status: 'too-deep', children: [] }
    else {
      const t = (await isFile(path)) ? await readText(path) : null
      if (t === null || t.length > MAX_BYTES) node = { spec: s.spec, path, status: 'missing', children: [] }
      else {
        const sub = await expand(t, path, home, [...chain, real])
        node = { spec: s.spec, path, status: 'ok', children: sub.imports }
        content = sub.expanded.replace(/\n$/, '')
      }
    }
    imports.push(node)
    expanded += text.slice(last, s.index) + (content ?? text.slice(s.index, s.index + s.length))
    last = s.index + s.length
  }
  return { expanded: expanded + text.slice(last), imports }
}

/** Read one instructions file; null when it does not exist. */
export async function readInstructions(path: string, kind: InstructionsKind, owner: InstructionsDoc['owner'], home: string): Promise<InstructionsDoc | null> {
  const raw = (await isFile(path)) ? await readText(path) : null
  if (raw === null) return null
  const real = (await resolveReal(path)) ?? path
  const { expanded, imports } = await expand(raw, path, home, [real])
  return { id: path, owner, kind, path, raw, expanded, imports }
}

const PROJECT_FILES: InstructionsKind[] = ['CLAUDE.md', 'CLAUDE.local.md', '.claude/CLAUDE.md', 'AGENTS.md']

export async function readAccountInstructions(accountId: string, configDir: string, home: string): Promise<InstructionsDoc[]> {
  const d = await readInstructions(join(configDir, 'CLAUDE.md'), 'CLAUDE.md', { kind: 'account', accountId }, home)
  return d ? [d] : []
}

export async function readProjectInstructions(projectId: string, projectPath: string, home: string): Promise<InstructionsDoc[]> {
  const out: InstructionsDoc[] = []
  for (const kind of PROJECT_FILES) {
    const d = await readInstructions(join(projectPath, kind), kind, { kind: 'project', projectId, projectPath }, home)
    if (d) out.push(d)
  }
  return out
}
