// IPC contract between main and renderer. Read-only by design (docs/architecture.md):
// the only channels that write are prefs:*, and they write only the app's own prefs file (docs/decisions/0002).
import type { Account, AgentOrCommand, Catalog, HarnessProject, InstructionsDoc, McpServer, MemoryGroup, SettingsView, SkillDiff, SkillMatrix, Source } from './model'
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
  listInstructions: 'instructions:list',
  listMemory: 'memory:list',
  listSettings: 'config:layers',
  listMcpServers: 'mcp:list',
  listAgentsAndCommands: 'agents:list',
  listCatalogs: 'catalogs:list',
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
  /** CLAUDE.md / AGENTS.md of every account and harness project, imports expanded */
  listInstructions(): Promise<InstructionsDoc[]>
  listMemory(): Promise<MemoryGroup[]>
  /** one view per account, plus one per (account, harness project the account uses) */
  listSettings(): Promise<SettingsView[]>
  listMcpServers(): Promise<McpServer[]>
  listAgentsAndCommands(): Promise<AgentOrCommand[]>
  /** catalogs attached in prefs, read from their local clones */
  listCatalogs(): Promise<Catalog[]>
  getPrefs(): Promise<Prefs>
  /** name null / empty resets to the default name */
  setDisplayName(id: string, name: string | null): Promise<Prefs>
  setManualRoot(kind: ManualRootKind, path: string, add: boolean): Promise<Prefs>
  setCatalog(catalog: CatalogRoot, add: boolean): Promise<Prefs>
}
