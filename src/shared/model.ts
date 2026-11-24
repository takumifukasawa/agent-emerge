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
  /** filled by src/main/index/warnings.ts (empty as read by an adapter) */
  warnings: SkillWarning[]
}

/** Problems detected read-only (spec: Warnings). */
export type SkillWarning =
  | { kind: 'broken-link'; linkTarget: string }
  | { kind: 'invalid-frontmatter'; reason: 'missing-file' | 'no-frontmatter' | 'invalid-yaml' | 'missing-name' | 'missing-description' }
  | { kind: 'missing-dependency'; skill: string }
  /** `others` are labels of the other copies with the same name in this account ("user", "plugin demo@market") */
  | { kind: 'name-collision'; others: string[] }
  | { kind: 'description-too-long'; length: number; limit: number }

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

/** How the copies of one skill name compare across the accounts that have it. */
export type Across = 'same' | 'differs' | 'single' | 'unreadable'

export interface MatrixCell {
  /** every copy this account has under this name (user + plugin can coexist) */
  skills: Skill[]
}

export interface MatrixRow {
  name: string
  /** keyed by account id */
  cells: Record<string, MatrixCell>
  across: Across
}

export interface SkillMatrix {
  accounts: Account[]
  rows: MatrixRow[]
}

export type FileDiffStatus = 'same' | 'modified' | 'added' | 'removed' | 'binary-modified'

export interface DiffLine {
  kind: 'context' | 'add' | 'del'
  text: string
}

export interface FileDiff {
  path: string
  status: FileDiffStatus
  /** only for 'modified' text files */
  lines?: DiffLine[]
}

export interface SkillDiff {
  name: string
  left: { accountId: string; path: string }
  right: { accountId: string; path: string }
  files: FileDiff[]
}

/** git state of a source, read with allowlisted read-only git subcommands only. */
export interface SourceGit {
  /** current branch; null when detached or unknown */
  branch: string | null
  /** entries in `git status --porcelain` (modified, staged, untracked) */
  uncommitted: number
  /** commits reachable from HEAD that are on no remote-tracking branch */
  unpushed: number
  /** url of the `origin` remote (or the first remote); upstream for Phase 2 */
  remoteUrl: string | null
}

/** Where skills / harness are authored: a git repo a skill links into, `~/.agents`, or a dir the user added. */
export interface Source {
  /** real path */
  id: string
  path: string
  origin: 'auto' | 'manual'
  exists: boolean
  /** null when the dir is not a git repo (or git could not read it) */
  git: SourceGit | null
  /** skills that resolve into this source */
  linkedSkills: { accountId: string; name: string }[]
}

export type HarnessOwnership = 'managed' | 'seed' | 'merge' | 'generated'

export interface DriftEntry {
  /** path relative to the project, as in the manifest */
  path: string
  ownership: HarnessOwnership
  status: 'modified' | 'missing'
}

/** A project with `.harness/manifest.json`. */
export interface HarnessProject {
  /** real path */
  id: string
  path: string
  origin: 'auto' | 'manual'
  exists: boolean
  /** accounts whose `.claude.json` lists this project */
  accountIds: string[]
  harnessVersion: string | null
  harnessSource: string | null
  /** files the manifest tracks (all ownerships) */
  trackedFiles: number
  /** null when the manifest is missing or unreadable */
  drift: DriftEntry[] | null
}

/** One `@path` import inside an instructions file, resolved recursively. */
export interface ImportNode {
  /** the token as written, without the "@" */
  spec: string
  /** resolved absolute path */
  path: string
  status: 'ok' | 'missing' | 'cycle' | 'too-deep'
  children: ImportNode[]
}

export type InstructionsKind = 'CLAUDE.md' | 'CLAUDE.local.md' | '.claude/CLAUDE.md' | 'AGENTS.md'

/** A CLAUDE.md / AGENTS.md of an account or a harness project. */
export interface InstructionsDoc {
  /** stable id: the file's path */
  id: string
  owner: { kind: 'account'; accountId: string } | { kind: 'project'; projectId: string; projectPath: string }
  kind: InstructionsKind
  path: string
  raw: string
  /** raw with every import replaced by the imported file's (expanded) content */
  expanded: string
  imports: ImportNode[]
}

export type MemoryType = 'user' | 'feedback' | 'project' | 'reference'

export interface MemoryFile {
  /** file name inside memory/ */
  file: string
  path: string
  name: string | null
  description: string | null
  /** null when absent or not one of the four types */
  type: MemoryType | null
  body: string
}

/** One project's memory dir in one account (`projects/<encoded path>/memory/`). */
export interface MemoryGroup {
  accountId: string
  /** the dir name under projects/ */
  encoded: string
  /** the project path when a known project encodes to `encoded`; else null (the encoding is lossy) */
  projectPath: string | null
  /** MEMORY.md (the index) as-is; null when absent */
  index: string | null
  files: MemoryFile[]
}
