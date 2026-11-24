// Structural tests for the invariants in docs/architecture.md.
// Each failure message says how to fix it. Do not add exceptions to make a test pass:
// change the code, or record a decision in docs/decisions/ and ask a human.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { IpcChannels } from '../../src/shared/ipc'

const ROOT = join(import.meta.dirname, '../..')
const SRC = join(ROOT, 'src')

interface SourceFile {
  path: string // repo-relative, forward slashes
  text: string
  imports: string[]
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const IMPORT_RE =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g

function loadSources(): SourceFile[] {
  return walk(SRC)
    .filter((f) => /\.(ts|tsx|mts|cts|js|mjs|cjs)$/.test(f))
    .map((f) => {
      const text = readFileSync(f, 'utf8')
      const imports = [...text.matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4] ?? '')
      return { path: relative(ROOT, f).split(sep).join('/'), text, imports }
    })
}

const sources = loadSources()
const bare = (spec: string): string => spec.replace(/^node:/, '')
const under = (file: SourceFile, prefix: string): boolean => file.path.startsWith(prefix)

function violations(pred: (f: SourceFile) => string[]): string[] {
  return sources.flatMap((f) => pred(f).map((v) => `${f.path}: ${v}`))
}

describe('architecture invariants (docs/architecture.md)', () => {
  it('scans a non-empty source tree', () => {
    expect(sources.length, 'no files found under src/; the scanner is broken').toBeGreaterThan(0)
  })

  it('only src/main/fsread/ and src/main/prefs/ import the filesystem module', () => {
    const v = violations((f) =>
      under(f, 'src/main/fsread/') || under(f, 'src/main/prefs/')
        ? []
        : f.imports.filter((i) => /^(fs|fs\/promises)$/.test(bare(i)))
    )
    expect(v, 'Move filesystem access into src/main/fsread/ (read-only helpers). Only src/main/prefs/ may write, and only its own prefs file (docs/decisions/0002).').toEqual([])
  })

  it('src/main/prefs/ writes only PREFS_FILE and never deletes, copies or links', () => {
    const v = violations((f) => {
      if (!under(f, 'src/main/prefs/')) return []
      const out: string[] = []
      if (/\b(rm|rmSync|unlink|unlinkSync|rmdir|rmdirSync|symlink|symlinkSync|link|linkSync|chmod|chmodSync|cp|cpSync|copyFile|copyFileSync|appendFile|appendFileSync|createWriteStream)\s*\(/.test(f.text))
        out.push('uses a delete / copy / link / append API')
      for (const m of f.text.matchAll(/\b(writeFile|writeFileSync|rename|renameSync)\s*\(([^,)]*)/g)) {
        if (!/PREFS_FILE|tmpPath/.test(m[2] ?? '')) out.push(`${m[1]} target is not PREFS_FILE / its tmpPath`)
      }
      return out
    })
    expect(v, 'src/main/prefs/ may only write <userData>/prefs.json atomically (docs/decisions/0002).').toEqual([])
  })

  it('src/main/fsread/ never calls a filesystem write API', () => {
    const WRITE =
      /\b(writeFile|writeFileSync|appendFile|appendFileSync|mkdir|mkdirSync|mkdtemp|rm|rmSync|rmdir|rmdirSync|unlink|unlinkSync|rename|renameSync|copyFile|copyFileSync|cp|cpSync|symlink|symlinkSync|link|linkSync|chmod|chmodSync|chown|chownSync|truncate|truncateSync|utimes|utimesSync|createWriteStream)\s*\(/
    const v = violations((f) => {
      if (!under(f, 'src/main/fsread/')) return []
      const m = f.text.match(WRITE)
      const openForWrite = /\bopen(Sync)?\s*\([^)]*['"](w|a|r\+)/.test(f.text)
      return [...(m ? [`uses write API "${m[1]}"`] : []), ...(openForWrite ? ['opens a file for writing'] : [])]
    })
    expect(v, 'The app is read-only. Remove the write call; there is no exception for this.').toEqual([])
  })

  it('only src/main/gitread/ spawns processes', () => {
    const v = violations((f) =>
      under(f, 'src/main/gitread/') ? [] : f.imports.filter((i) => bare(i) === 'child_process')
    )
    expect(v, 'Run git through src/main/gitread/ (allowlisted read-only subcommands).').toEqual([])
  })

  it('IPC channel names contain no write verb outside prefs:', () => {
    const WRITE_VERB = /(write|save|delete|remove|create|update|set|put|install|uninstall|apply|rename|move|copy|sync|edit|patch)/i
    const bad = Object.values(IpcChannels).filter((c) => !c.startsWith('prefs:') && WRITE_VERB.test(c))
    expect(bad, 'IPC is read-only. Only reads, "open in editor" / "reveal in Finder", and prefs:* (the app\'s own prefs, docs/decisions/0002) are allowed.').toEqual([])
  })

  it('ipcMain handlers are registered only in src/main/ipc/', () => {
    const v = violations((f) =>
      !under(f, 'src/main/ipc/') && /\bipcMain\s*\.\s*(handle|on|once)\b/.test(f.text) ? ['registers an ipcMain handler'] : []
    )
    expect(v, 'Register handlers in src/main/ipc/ so the read-only review covers them.').toEqual([])
  })

  it('no network access from the app', () => {
    const NET_MODULES = /^(http|https|http2|net|tls|dgram|undici|axios|node-fetch|ws|got|ky|superagent)$/
    const NET_CALLS = /\b(fetch\s*\(|new\s+WebSocket\b|XMLHttpRequest\b|EventSource\b|net\s*\.\s*request\b|navigator\s*\.\s*sendBeacon\b)/
    const v = violations((f) => [
      ...f.imports.filter((i) => NET_MODULES.test(bare(i))).map((i) => `imports "${i}"`),
      ...(f.text.match(NET_CALLS) ? [`calls "${f.text.match(NET_CALLS)![1]}"`] : [])
    ])
    expect(v, 'The app must not use the network (no telemetry). Remove the call / import.').toEqual([])
  })

  it('no network or telemetry packages in dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> }
    const BAD = /^(axios|node-fetch|undici|got|ky|superagent|ws|socket\.io-client|@sentry\/.*|posthog-.*|mixpanel.*|@segment\/.*|electron-updater|update-electron-app)$/
    const bad = Object.keys(pkg.dependencies ?? {}).filter((d) => BAD.test(d))
    expect(bad, 'Runtime network / telemetry / auto-update packages are not allowed (spec: Safety).').toEqual([])
  })

  it('renderer imports neither electron nor Node built-ins', () => {
    const v = violations((f) =>
      under(f, 'src/renderer/')
        ? f.imports.filter((i) => i === 'electron' || i.startsWith('node:') || /^(fs|path|os|child_process|crypto)$/.test(i))
        : []
    )
    expect(v, 'The renderer talks to main only through window.agentEmerge (preload). Move the logic to main.').toEqual([])
  })

  it('every BrowserWindow is isolated and sandboxed', () => {
    const wins = sources.filter((f) => /new\s+BrowserWindow\s*\(/.test(f.text))
    expect(wins.length, 'no BrowserWindow found; the scanner is broken').toBeGreaterThan(0)
    const v = wins.flatMap((f) => {
      const out: string[] = []
      for (const need of ['contextIsolation:\\s*true', 'nodeIntegration:\\s*false', 'sandbox:\\s*true']) {
        if (!new RegExp(need).test(f.text)) out.push(`missing ${need.replace('\\s*', ' ')}`)
      }
      for (const bad of ['contextIsolation:\\s*false', 'nodeIntegration:\\s*true', 'sandbox:\\s*false', 'webSecurity:\\s*false']) {
        if (new RegExp(bad).test(f.text)) out.push(`has ${bad.replace('\\s*', ' ')}`)
      }
      return out.map((o) => `${f.path}: ${o}`)
    })
    expect(v, 'Set contextIsolation: true, nodeIntegration: false, sandbox: true on every BrowserWindow.').toEqual([])
  })

  it('src/ declares no classes (tree-shaking)', () => {
    const CLASS_RE = /(^|[^\w.$'"`])class\s+[A-Za-z_$][\w$]*|=\s*class\b|\(\s*class\b/
    const v = violations((f) =>
      f.text
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .filter((line) => CLASS_RE.test(line))
        .map((line) => `class: ${line.trim()}`)
    )
    expect(
      v,
      'Do not declare classes (AGENTS.md "No classes"). Use plain functions taking their dependencies as arguments, ' +
        'plain objects / interfaces for data, and errors as `Object.assign(new Error(msg), { name })` with an `isXxxError` guard (see src/main/gitread).'
    ).toEqual([])
  })
})
