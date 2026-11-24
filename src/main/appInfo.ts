import type { AppInfo } from '@shared/ipc'

export function buildAppInfo(name: string, version: string, platform: string): AppInfo {
  return { name, version, platform }
}
