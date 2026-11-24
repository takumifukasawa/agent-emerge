// IPC contract between main and renderer. Read-only by design (docs/architecture.md):
// the only channels that write are prefs:*, and they write only the app's own prefs file (docs/decisions/0002).
import type { Account } from './model'
import type { CatalogRoot, ManualRootKind, Prefs } from './prefs'

export interface AppInfo {
  name: string
  version: string
  platform: string
}

export const IpcChannels = {
  getAppInfo: 'app:getInfo',
  listAccounts: 'accounts:list',
  getPrefs: 'prefs:get',
  setDisplayName: 'prefs:setDisplayName',
  setManualRoot: 'prefs:setManualRoot',
  setCatalog: 'prefs:setCatalog'
} as const

export interface AgentEmergeApi {
  getAppInfo(): Promise<AppInfo>
  listAccounts(): Promise<Account[]>
  getPrefs(): Promise<Prefs>
  /** name null / empty resets to the default name */
  setDisplayName(id: string, name: string | null): Promise<Prefs>
  setManualRoot(kind: ManualRootKind, path: string, add: boolean): Promise<Prefs>
  setCatalog(catalog: CatalogRoot, add: boolean): Promise<Prefs>
}
