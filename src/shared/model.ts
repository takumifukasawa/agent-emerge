// Normalized model shared by main and renderer. Plain data only (no Node, no DOM).

export type AccountKind = 'claude-code'

export type RootOrigin = 'auto' | 'env' | 'manual'

export interface Account {
  /** stable id: the account dir's real path */
  id: string
  kind: AccountKind
  configDir: string
  /** where this account's .claude.json lives (home dir for the default account) */
  claudeJsonPath: string
  displayName: string
  origin: RootOrigin
  /** false for a manually added dir that no longer exists */
  exists: boolean
}
