// IPC contract between main and renderer. Read-only by design (docs/architecture.md):
// never add a channel that writes to disk.
import type { Account } from './model'

export interface AppInfo {
  name: string
  version: string
  platform: string
}

export const IpcChannels = {
  getAppInfo: 'app:getInfo',
  listAccounts: 'accounts:list'
} as const

export interface AgentEmergeApi {
  getAppInfo(): Promise<AppInfo>
  listAccounts(): Promise<Account[]>
}
