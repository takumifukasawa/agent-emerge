import { homedir } from 'node:os'
import { app, ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import { withCatalog, withDisplayName, withManualRoot, type ManualRootKind, type Prefs } from '@shared/prefs'
import { buildAppInfo } from '../appInfo'
import { readClaudeCodeAccount, type AccountSnapshot } from '../adapters/claude-code'
import { discoverAccounts } from '../index/accounts'
import { buildSkillMatrix, diffSkillAcross } from '../index/matrix'
import { PrefsStore } from '../prefs'

// Handlers are read-only, except prefs:* which write only the app's own prefs file (docs/decisions/0002).
// test/unit/architecture.test.ts checks channel names. Renderer input is untrusted: validate every argument.

const ROOT_KINDS: readonly ManualRootKind[] = ['accounts', 'sources', 'harnessProjects']
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 4096

export function registerIpcHandlers(): void {
  const store = new PrefsStore(app.getPath('userData'))
  let prefs: Promise<Prefs> = store.load().then((l) => l.prefs)
  const update = (f: (p: Prefs) => Prefs): Promise<Prefs> => {
    prefs = prefs.then(async (p) => {
      const next = f(p)
      await store.save(next)
      return next
    })
    return prefs
  }

  ipcMain.handle(IpcChannels.getAppInfo, () => buildAppInfo(app.getName(), app.getVersion(), process.platform))

  const listAccounts = async () => {
    const p = await prefs
    return discoverAccounts({
      home: homedir(),
      envConfigDir: process.env['CLAUDE_CONFIG_DIR'],
      manual: p.manualRoots.accounts,
      displayNames: p.displayNames
    })
  }
  const snapshots = async (): Promise<AccountSnapshot[]> => {
    const accounts = (await listAccounts()).filter((a) => a.exists)
    return Promise.all(accounts.map((a) => readClaudeCodeAccount(a, { home: homedir() })))
  }

  ipcMain.handle(IpcChannels.listAccounts, listAccounts)

  ipcMain.handle(IpcChannels.getSkillMatrix, async () => buildSkillMatrix(await snapshots()))

  // Arguments name a skill and two account ids, never a path: main resolves them, so the renderer cannot ask for arbitrary files.
  ipcMain.handle(IpcChannels.getSkillDiff, async (_e, name: unknown, left: unknown, right: unknown) => {
    if (!isStr(name) || !isStr(left) || !isStr(right)) throw new Error('invalid arguments')
    return diffSkillAcross(await snapshots(), name, left, right)
  })

  ipcMain.handle(IpcChannels.getPrefs, () => prefs)

  ipcMain.handle(IpcChannels.setDisplayName, (_e, id: unknown, name: unknown) => {
    if (!isStr(id) || !(name === null || typeof name === 'string')) throw new Error('invalid arguments')
    return update((p) => withDisplayName(p, id, name))
  })

  ipcMain.handle(IpcChannels.setManualRoot, (_e, kind: unknown, path: unknown, add: unknown) => {
    if (!ROOT_KINDS.includes(kind as ManualRootKind) || !isStr(path) || typeof add !== 'boolean') throw new Error('invalid arguments')
    return update((p) => withManualRoot(p, kind as ManualRootKind, path, add))
  })

  ipcMain.handle(IpcChannels.setCatalog, (_e, catalog: unknown, add: unknown) => {
    const c = catalog as { accountId?: unknown; path?: unknown } | null
    if (!c || !isStr(c.accountId) || !isStr(c.path) || typeof add !== 'boolean') throw new Error('invalid arguments')
    return update((p) => withCatalog(p, { accountId: c.accountId as string, path: c.path as string }, add))
  })
}
