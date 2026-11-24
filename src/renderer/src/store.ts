import { create } from 'zustand'
import type { AppInfo } from '@shared/ipc'
import type { Account, SkillDiff, SkillMatrix } from '@shared/model'

export type Page = 'overview' | 'skills' | 'claude-md' | 'settings' | 'mcp' | 'plugins' | 'agents' | 'memory' | 'sources' | 'catalogs' | 'harness'
export const ALL = 'all'

interface AppState {
  info: AppInfo | null
  accounts: Account[]
  matrix: SkillMatrix | null
  page: Page
  /** ALL or an account id */
  scope: string
  selectedSkill: string | null
  diff: SkillDiff | null
  query: string
  hidePlugins: boolean
  load(): Promise<void>
  setPage(p: Page): void
  setScope(s: string): void
  setQuery(q: string): void
  setHidePlugins(v: boolean): void
  selectSkill(name: string | null): Promise<void>
}

const api = () => window.agentEmerge

export const useAppStore = create<AppState>((set, get) => ({
  info: null,
  accounts: [],
  matrix: null,
  page: 'skills',
  scope: ALL,
  selectedSkill: null,
  diff: null,
  query: '',
  hidePlugins: false,
  async load() {
    const [info, accounts, matrix] = await Promise.all([api().getAppInfo(), api().listAccounts(), api().getSkillMatrix()])
    set({ info, accounts, matrix })
  },
  setPage: (page) => set({ page }),
  setScope: (scope) => set({ scope }),
  setQuery: (query) => set({ query }),
  setHidePlugins: (hidePlugins) => set({ hidePlugins }),
  async selectSkill(name) {
    set({ selectedSkill: name, diff: null })
    const m = get().matrix
    const row = name ? m?.rows.find((r) => r.name === name) : undefined
    if (!m || !row || row.across !== 'differs') return
    const withUser = m.accounts.filter((a) => row.cells[a.id]?.skills.some((s) => s.scope === 'user'))
    const [l, r] = withUser
    if (!l || !r) return
    const diff = await api().getSkillDiff(row.name, l.id, r.id)
    if (get().selectedSkill === name) set({ diff })
  }
}))
