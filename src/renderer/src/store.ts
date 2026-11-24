import { create } from 'zustand'
import type { AppInfo } from '@shared/ipc'

interface AppState {
  info: AppInfo | null
  load(): Promise<void>
}

export const useAppStore = create<AppState>((set) => ({
  info: null,
  async load() {
    set({ info: await window.agentEmerge.getAppInfo() })
  }
}))
