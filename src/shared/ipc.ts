// IPC contract between main and renderer. Read-only by design (docs/architecture.md):
// never add a channel that writes to disk.

export interface AppInfo {
  name: string
  version: string
  platform: string
}

export const IpcChannels = {
  getAppInfo: 'app:getInfo'
} as const

export interface AgentEmergeApi {
  getAppInfo(): Promise<AppInfo>
}
