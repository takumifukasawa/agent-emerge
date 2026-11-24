// The ONLY module that spawns processes. Runs git with an allowlist of read-only subcommands
// and rejects arguments that could write (docs/architecture.md).
import { execFile } from 'node:child_process'

export const ALLOWED_SUBCOMMANDS = ['status', 'log', 'rev-parse', 'rev-list', 'for-each-ref'] as const
export type GitSubcommand = (typeof ALLOWED_SUBCOMMANDS)[number]

// --output (log), --output-directory, -o: write files. Hooks/config overrides can run arbitrary code.
const FORBIDDEN_ARG = /^(--output(-directory)?(=|$)|-o$|--exec(=|$)|-c$|--config-env(=|$)|--upload-pack(=|$)|--git-dir(=|$)|--work-tree(=|$))/

// Plain Error tagged by name, no class (tree-shaking; AGENTS.md "No classes").
const GIT_ARGS_ERROR = 'GitArgsError'
const gitArgsError = (message: string): Error => Object.assign(new Error(message), { name: GIT_ARGS_ERROR })
export const isGitArgsError = (e: unknown): e is Error => e instanceof Error && e.name === GIT_ARGS_ERROR

export function validateGitArgs(subcommand: string, args: readonly string[]): asserts subcommand is GitSubcommand {
  if (!(ALLOWED_SUBCOMMANDS as readonly string[]).includes(subcommand)) {
    throw gitArgsError(`git subcommand not allowed: ${subcommand}`)
  }
  const bad = args.find((a) => FORBIDDEN_ARG.test(a))
  if (bad !== undefined) throw gitArgsError(`git argument not allowed: ${bad}`)
}

export type GitResult = { ok: true; stdout: string } | { ok: false; error: string }

export function runGit(cwd: string, subcommand: string, args: readonly string[] = []): Promise<GitResult> {
  validateGitArgs(subcommand, args)
  return new Promise((resolve) => {
    execFile(
      'git',
      // no-optional-locks: `git status` must not even refresh the index
      ['--no-optional-locks', '-c', 'core.fsmonitor=false', subcommand, ...args],
      {
        cwd,
        encoding: 'utf8',
        timeout: 10_000,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' }
      },
      (err, stdout) => {
        if (err) resolve({ ok: false, error: err.message.split('\n')[0] ?? 'git failed' })
        else resolve({ ok: true, stdout })
      }
    )
  })
}
