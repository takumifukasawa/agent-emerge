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

export interface Upstream {
  /** e.g. a git URL; absent when unknown */
  url?: string
  /** commit / tag / version when known */
  ref?: string
}

export type SkillScope = 'user' | 'plugin' | 'project'

export type Provenance =
  /** a plain directory inside the account / project */
  | { kind: 'local' }
  /** a symlink into some other directory (a "source"); sourceRoot = nearest enclosing git repo, if any */
  | { kind: 'symlink'; linkTarget: string; sourceRoot: string | null }
  /** installed by the skills CLI (~/.agents + .skill-lock.json) */
  | { kind: 'skills-cli'; linkTarget: string | null; lockSource: string; upstream: Upstream }
  /** provided by a Claude Code plugin */
  | { kind: 'plugin'; pluginId: string; enabled: PluginEnabled; upstream: Upstream }
  /** a symlink whose target does not exist */
  | { kind: 'broken-link'; linkTarget: string }

export interface Skill {
  /** directory name; what Claude Code shows */
  name: string
  scope: SkillScope
  accountId: string
  /** path as listed (may be a symlink) */
  path: string
  /** resolved real path, null when broken */
  realPath: string | null
  provenance: Provenance
  /** parsed frontmatter, null when absent / unparsable / unreadable */
  frontmatter: Record<string, unknown> | null
  frontmatterError: 'missing-file' | 'no-frontmatter' | 'invalid-yaml' | null
  description: string | null
  body: string | null
}

/** true / false from settings.enabledPlugins; 'unset' when the key is absent */
export type PluginEnabled = boolean | 'unset'

export interface Plugin {
  /** "<name>@<marketplace>" */
  id: string
  name: string
  marketplace: string
  version: string | null
  installPath: string | null
  installPathExists: boolean
  enabled: PluginEnabled
  upstream: Upstream
}
