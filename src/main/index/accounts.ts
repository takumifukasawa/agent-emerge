import { basename, join, resolve } from 'node:path'
import type { Account, RootOrigin } from '@shared/model'
import { isDir, listDir, resolveReal, inspect } from '../fsread'

export interface DiscoverAccountsInput {
  home: string
  /** value of CLAUDE_CONFIG_DIR, if set */
  envConfigDir?: string
  /** dirs the user added by hand */
  manual?: readonly string[]
  /** user-edited display names, keyed by account id (real path) */
  displayNames?: Readonly<Record<string, string>>
}

const ACCOUNT_DIR = /^\.claude(-[^/\\]+)?$/
// a dir counts as an auto-detected account only if it has at least one of these
const MARKERS = ['settings.json', '.claude.json', 'skills', 'projects', 'plugins', 'CLAUDE.md']

async function looksLikeAccount(dir: string): Promise<boolean> {
  for (const m of MARKERS) if ((await inspect(join(dir, m))).exists) return true
  return false
}

export function defaultDisplayName(configDir: string, home: string): string {
  const name = basename(configDir)
  if (resolve(configDir) === resolve(home, '.claude')) return 'default'
  const m = /^\.claude-(.+)$/.exec(name)
  return m?.[1] ?? name
}

function claudeJsonPathFor(configDir: string, home: string): string {
  // The default account keeps .claude.json in the home dir; CLAUDE_CONFIG_DIR accounts keep it inside.
  return resolve(configDir) === resolve(home, '.claude') ? join(home, '.claude.json') : join(configDir, '.claude.json')
}

export async function discoverAccounts(input: DiscoverAccountsInput): Promise<Account[]> {
  const { home, envConfigDir, manual = [], displayNames = {} } = input
  const candidates: { dir: string; origin: RootOrigin }[] = []

  for (const e of await listDir(home)) {
    if (!ACCOUNT_DIR.test(e.name)) continue
    const dir = join(home, e.name)
    if ((await isDir(dir)) && (await looksLikeAccount(dir))) candidates.push({ dir, origin: 'auto' })
  }
  if (envConfigDir) candidates.push({ dir: resolve(envConfigDir), origin: 'env' })
  for (const m of manual) candidates.push({ dir: resolve(m), origin: 'manual' })

  const seen = new Map<string, Account>()
  for (const { dir, origin } of candidates) {
    const real = await resolveReal(dir)
    const exists = real !== null && (await isDir(real))
    if (!exists && origin !== 'manual') continue
    const id = real ?? dir
    if (seen.has(id)) continue
    seen.set(id, {
      id,
      kind: 'claude-code',
      configDir: dir,
      claudeJsonPath: claudeJsonPathFor(dir, home),
      displayName: displayNames[id] ?? defaultDisplayName(dir, home),
      origin,
      exists
    })
  }
  return [...seen.values()]
}
