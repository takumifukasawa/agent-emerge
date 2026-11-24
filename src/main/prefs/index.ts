// The ONLY place the app writes (docs/decisions/0002): <userData>/prefs.json, atomically.
// Structural tests reject any other write target or any delete / copy / link API here.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { defaultPrefs, sanitizePrefs, type Prefs } from '@shared/prefs'

const PREFS_FILE_NAME = 'prefs.json'

export interface LoadedPrefs {
  prefs: Prefs
  /** the file existed but could not be parsed; it is left untouched until the next save */
  invalid: boolean
}

export class PrefsStore {
  private readonly PREFS_FILE: string

  constructor(private readonly userDataDir: string) {
    this.PREFS_FILE = join(userDataDir, PREFS_FILE_NAME)
  }

  async load(): Promise<LoadedPrefs> {
    let text: string
    try {
      text = await readFile(this.PREFS_FILE, 'utf8')
    } catch {
      return { prefs: defaultPrefs(), invalid: false }
    }
    try {
      return { prefs: sanitizePrefs(JSON.parse(text)), invalid: false }
    } catch {
      return { prefs: defaultPrefs(), invalid: true }
    }
  }

  async save(prefs: Prefs): Promise<void> {
    await mkdir(this.userDataDir, { recursive: true })
    const tmpPath = `${this.PREFS_FILE}.tmp-${process.pid}`
    await writeFile(tmpPath, JSON.stringify(sanitizePrefs(prefs), null, 2) + '\n', 'utf8')
    await rename(tmpPath, this.PREFS_FILE)
  }
}
