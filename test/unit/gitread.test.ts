import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ALLOWED_SUBCOMMANDS, isGitArgsError, runGit, validateGitArgs } from '../../src/main/gitread'
import { materializeFixture, type MaterializedFixture } from '../fixtures/materialize'

let fx: MaterializedFixture
beforeAll(() => {
  fx = materializeFixture('home')
})
afterAll(() => fx.cleanup())

const thrown = (fn: () => unknown): unknown => {
  try {
    fn()
  } catch (e) {
    return e
  }
  return undefined
}

describe('gitread allowlist', () => {
  it('allows exactly the read-only subcommands in docs/architecture.md', () => {
    expect([...ALLOWED_SUBCOMMANDS]).toEqual(['status', 'log', 'rev-parse', 'rev-list', 'for-each-ref'])
  })

  it.each(['push', 'commit', 'fetch', 'pull', 'checkout', 'reset', 'config', 'gc', 'stash', 'add', '-c', '--git-dir=x'])(
    'rejects subcommand %s',
    (sub) => {
      expect(isGitArgsError(thrown(() => validateGitArgs(sub, [])))).toBe(true)
    }
  )

  it.each([['log', ['--output=/fixture/out']], ['log', ['--output', 'x']], ['log', ['-o']], ['status', ['-c']], ['rev-parse', ['--git-dir=x']]] as const)(
    'rejects writing / escaping argument for %s %j',
    (sub, args) => {
      expect(isGitArgsError(thrown(() => validateGitArgs(sub, args)))).toBe(true)
    }
  )

  it('runGit throws before spawning on a disallowed subcommand', () => {
    expect(isGitArgsError(thrown(() => runGit(fx.home, 'push')))).toBe(true)
  })

  it('reads status and unpushed commits of the fixture source repo', async () => {
    const repo = join(fx.home, 'dev/skills-repo')
    const status = await runGit(repo, 'status', ['--porcelain'])
    expect(status).toMatchObject({ ok: true })
    expect(status.ok && status.stdout).toContain('shared-skill/notes.md')
    const ahead = await runGit(repo, 'rev-list', ['--count', '@{u}..HEAD'])
    expect(ahead.ok && ahead.stdout.trim()).toBe('1')
  })

  it('reports a non-repo as an error result, not a throw', async () => {
    expect(await runGit(join(fx.home, '.claude'), 'rev-parse', ['--show-toplevel'])).toMatchObject({ ok: false })
  })
})
