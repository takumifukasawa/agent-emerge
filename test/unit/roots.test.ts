import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Account } from '../../src/shared/model'
import { readClaudeCodeAccount, type AccountSnapshot } from '../../src/main/adapters/claude-code'
import { discoverAccounts } from '../../src/main/index/accounts'
import { discoverHarnessProjects, gitBlobHash, managedBlocks, readDrift } from '../../src/main/index/harness'
import { discoverSources, remoteUrlFromConfig } from '../../src/main/index/sources'
import { materializeFixture, type MaterializedFixture } from '../fixtures/materialize'

let fx: MaterializedFixture
let accounts: Account[]
let snaps: AccountSnapshot[]
beforeAll(async () => {
  fx = materializeFixture('home')
  accounts = await discoverAccounts({ home: fx.home })
  snaps = await Promise.all(accounts.map((a) => readClaudeCodeAccount(a, { home: fx.home })))
})
afterAll(() => fx.cleanup())

describe('discoverSources', () => {
  it('finds the skills repo (via symlinks) and ~/.agents (via the skills CLI)', async () => {
    const sources = await discoverSources({ home: fx.home, snapshots: snaps })
    expect(sources.map((s) => s.path.slice(fx.home.length))).toEqual(['/.agents', '/dev/skills-repo'])
    const repo = sources.find((s) => s.path.endsWith('skills-repo'))!
    expect(repo.git).toMatchObject({ branch: 'main', unpushed: 1, uncommitted: 1 })
    expect(repo.git?.remoteUrl).toBe(join(fx.home, 'dev/skills-repo-remote.git'))
    expect(repo.linkedSkills.map((l) => l.name).sort()).toEqual(['needs-missing', 'shared-skill', 'shared-skill'])
    const agents = sources.find((s) => s.path.endsWith('.agents'))!
    expect(agents.git).toBeNull()
    expect(agents.linkedSkills.map((l) => l.name)).toEqual(['locked-skill'])
  })

  it('adds manual sources, including ones that no longer exist', async () => {
    const sources = await discoverSources({ home: fx.home, snapshots: [], manual: [join(fx.home, 'dev/plain-project'), join(fx.home, 'gone')] })
    expect(sources.map((s) => [s.path.slice(fx.home.length), s.origin, s.exists, s.git])).toEqual([
      ['/dev/plain-project', 'manual', true, null],
      ['/gone', 'manual', false, null]
    ])
  })

  it('reads the origin url from a git config, else the first remote', () => {
    expect(remoteUrlFromConfig('[core]\n\tbare = false\n[remote "up"]\n\turl = a\n[remote "origin"]\n\turl = b\n')).toBe('b')
    expect(remoteUrlFromConfig('[remote "up"]\n\turl = a\n[branch "main"]\n\tremote = up\n')).toBe('a')
    expect(remoteUrlFromConfig('[core]\n')).toBeNull()
  })
})

describe('harness projects', () => {
  it('only harness-project is a harness project (plain-project has no manifest, missing-project does not exist)', async () => {
    const projects = await discoverHarnessProjects({ accounts })
    expect(projects.map((p) => p.path.slice(fx.home.length))).toEqual(['/dev/harness-project'])
    const def = accounts.find((a) => a.displayName === 'default')!
    expect(projects[0]).toMatchObject({ accountIds: [def.id], harnessVersion: '9.9.9', trackedFiles: 5, exists: true })
  })

  it('drift is exactly drifted.sh modified and missing.sh missing (seed checks.sh and merge AGENTS.md are fine)', async () => {
    const d = await readDrift(join(fx.home, 'dev/harness-project'))
    expect(d?.drift).toEqual([
      { path: '.harness/drifted.sh', ownership: 'managed', status: 'modified' },
      { path: '.harness/missing.sh', ownership: 'managed', status: 'missing' }
    ])
  })

  it('a merge file drifts when its managed block changes, not when the project part changes', async () => {
    const dir = join(fx.home, 'dev/harness-project')
    const agents = join(dir, 'AGENTS.md')
    writeFileSync(agents, '<!-- harness:begin v=9.9.9 -->\n# Fixture managed rules\n\nmanaged rules\n<!-- harness:end -->\n# Project-specific rules\n\nedited by the project\n')
    expect((await readDrift(dir))?.drift.map((x) => x.path)).not.toContain('AGENTS.md')
    writeFileSync(agents, '<!-- harness:begin v=9.9.9 -->\n# Fixture managed rules\n\nhand-edited\n<!-- harness:end -->\n')
    expect((await readDrift(dir))?.drift).toContainEqual({ path: 'AGENTS.md', ownership: 'merge', status: 'modified' })
  })

  it('ignores manifest paths that point outside the project', async () => {
    const dir = join(fx.home, 'dev/plain-project')
    const { mkdirSync } = await import('node:fs')
    mkdirSync(join(dir, '.harness'), { recursive: true })
    writeFileSync(join(dir, '.harness/manifest.json'), JSON.stringify({ files: [{ path: '../harness-project/AGENTS.md', ownership: 'managed', sha256: 'x' }] }))
    expect((await readDrift(dir))?.drift).toEqual([])
  })

  it('hashes like git hash-object', () => {
    expect(gitBlobHash(Buffer.from(''))).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391')
    expect(gitBlobHash(Buffer.from('hello\n'))).toBe('ce013625030ba8dba906f756967f9e9ca394464a')
    expect(managedBlocks('a\n<!-- harness:begin -->\nx\n<!-- harness:end -->\nb\n')).toBe('<!-- harness:begin -->\nx\n<!-- harness:end -->\n')
  })
})
