// IPC contract between main and renderer. Read-only by design (docs/architecture.md):
// the only channels that write are prefs:*, and they write only the app's own prefs file (docs/decisions/0002).
import type { Account, HarnessProject, SkillDiff, SkillMatrix, Source } from './model'
import type { CatalogRoot, ManualRootKind, Prefs } from './prefs'

export interface AppInfo {
  name: string
  version: string
  platform: string
}

export const IpcChannels = {
  getAppInfo: 'app:getInfo',
  listAccounts: 'accounts:list',
  getSkillMatrix: 'skills:matrix',
  getSkillDiff: 'skills:diff',
  listSources: 'sources:list',
  listHarnessProjects: 'harness:list',
  getPrefs: 'prefs:get',
  setDisplayName: 'prefs:setDisplayName',
  setManualRoot: 'prefs:setManualRoot',
  setCatalog: 'prefs:setCatalog'
} as const

export interface AgentEmergeApi {
  getAppInfo(): Promise<AppInfo>
  listAccounts(): Promise<Account[]>
  getSkillMatrix(): Promise<SkillMatrix>
  /** diff of the user-scope copies of a skill in two accounts; null if either is missing */
  getSkillDiff(name: string, leftAccountId: string, rightAccountId: string): Promise<SkillDiff | null>
  listSources(): Promise<Source[]>
  listHarnessProjects(): Promise<HarnessProject[]>
  getPrefs(): Promise<Prefs>
  /** name null / empty resets to the default name */
  setDisplayName(id: string, name: string | null): Promise<Prefs>
  setManualRoot(kind: ManualRootKind, path: string, add: boolean): Promise<Prefs>
  setCatalog(catalog: CatalogRoot, add: boolean): Promise<Prefs>
}
