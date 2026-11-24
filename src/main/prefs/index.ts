// The ONLY place the app writes (docs/decisions/0002): <userData>/prefs.json, atomically.
// Structural tests reject any other write target or any delete / copy / link API here.
// Plain functions, no class (tree-shaking; AGENTS.md "No classes").
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { defaultPrefs, sanitizePrefs, type Prefs } from '@shared/prefs'

const PREFS_FILE_NAME = 'prefs.json'

export interface LoadedPrefs {
  prefs: Prefs
  /** the file existed but could not be parsed; it is left untouched until the next save */
  invalid: boolean
}

export async function loadPrefs(userDataDir: string): Promise<LoadedPrefs> {
  const PREFS_FILE = join(userDataDir, PREFS_FILE_NAME)
  let text: string
  try {
    text = await readFile(PREFS_FILE, 'utf8')
  } catch {
    return { prefs: defaultPrefs(), invalid: false }
  }
  try {
    return { prefs: sanitizePrefs(JSON.parse(text)), invalid: false }
  } catch {
    return { prefs: defaultPrefs(), invalid: true }
  }
}

export async function savePrefs(userDataDir: string, prefs: Prefs): Promise<void> {
  const PREFS_FILE = join(userDataDir, PREFS_FILE_NAME)
  await mkdir(userDataDir, { recursive: true })
  const tmpPath = `${PREFS_FILE}.tmp-${process.pid}`
  await writeFile(tmpPath, JSON.stringify(sanitizePrefs(prefs), null, 2) + '\n', 'utf8')
  await rename(tmpPath, PREFS_FILE)
}
