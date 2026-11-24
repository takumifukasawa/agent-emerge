import { create } from 'zustand'
import type { AppInfo } from '@shared/ipc'
import type { Account } from '@shared/model'

interface AppState {
  info: AppInfo | null
  accounts: Account[]
  load(): Promise<void>
}

export const useAppStore = create<AppState>((set) => ({
  info: null,
  accounts: [],
  async load() {
    const [info, accounts] = await Promise.all([window.agentEmerge.getAppInfo(), window.agentEmerge.listAccounts()])
    set({ info, accounts })
  }
}))
