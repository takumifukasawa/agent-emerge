import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Account } from '../../src/shared/model'
import { readClaudeCodeAccount, type AccountSnapshot } from '../../src/main/adapters/claude-code'
import { discoverAccounts } from '../../src/main/index/accounts'
import { buildSkillMatrix, diffSkillAcross } from '../../src/main/index/matrix'
import { diffSkillDirs, hashSkillDir } from '../../src/main/index/skillCompare'
import { materializeFixture, type MaterializedFixture } from '../fixtures/materialize'

let fx: MaterializedFixture
let snaps: AccountSnapshot[]
let def: Account
let work: Account
beforeAll(async () => {
  fx = materializeFixture('home')
  ;[def, work] = (await discoverAccounts({ home: fx.home })) as [Account, Account]
  snaps = await Promise.all([def, work].map((a) => readClaudeCodeAccount(a, { home: fx.home })))
})
afterAll(() => fx.cleanup())

describe('buildSkillMatrix', () => {
  it('has one row per skill name across both accounts, sorted', async () => {
    const m = await buildSkillMatrix(snaps)
    expect(m.accounts.map((a) => a.displayName)).toEqual(['default', 'work'])
    expect(m.rows.map((r) => r.name)).toEqual([
      'bad-frontmatter', 'broken-link', 'copied-skill', 'demo-skill', 'locked-skill', 'long-description',
      'needs-missing', 'only-here', 'other-skill', 'rooted-skill', 'shared-skill'
    ])
  })

  it('compares copies: same real path → same; different content → differs; one copy → single', async () => {
    const m = await buildSkillMatrix(snaps)
    const across = Object.fromEntries(m.rows.map((r) => [r.name, r.across]))
    expect(across['shared-skill']).toBe('same')
    expect(across['copied-skill']).toBe('differs')
    expect(across['only-here']).toBe('single')
    expect(across['demo-skill']).toBe('single') // user + plugin in one account: shown, not compared
  })

  it('keeps user and plugin copies together in a cell', async () => {
    const m = await buildSkillMatrix(snaps)
    const demo = m.rows.find((r) => r.name === 'demo-skill')!
    expect(demo.cells[def.id]!.skills.map((s) => s.scope)).toEqual(['user', 'plugin'])
    expect(demo.cells[work.id]!.skills).toEqual([])
  })
})

describe('diffSkillAcross', () => {
  it('shows the SKILL.md line change of copied-skill', async () => {
    const d = await diffSkillAcross(snaps, 'copied-skill', def.id, work.id)
    expect(d!.files.map((f) => [f.path, f.status])).toEqual([['SKILL.md', 'modified']])
    const changed = d!.files[0]!.lines!.filter((l) => l.kind !== 'context')
    expect(changed).toEqual([
      { kind: 'del', text: 'Version A of copied-skill.' },
      { kind: 'add', text: 'Version B of copied-skill.' }
    ])
  })

  it('returns null when one side does not have the skill', async () => {
    expect(await diffSkillAcross(snaps, 'only-here', def.id, work.id)).toBeNull()
  })
})

describe('hash and diff on folders', () => {
  let dir: string
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'agent-emerge-cmp-'))
    const mk = (name: string, files: Record<string, string | Buffer>): void => {
      for (const [p, c] of Object.entries(files)) {
        mkdirSync(join(dir, name, p, '..'), { recursive: true })
        writeFileSync(join(dir, name, p), c)
      }
    }
    mk('a', { 'SKILL.md': 'x\n', 'refs/one.md': '1\n', 'img.bin': Buffer.from([0, 1, 2]) })
    mk('b', { 'SKILL.md': 'x\n', 'refs/one.md': '1\n', 'img.bin': Buffer.from([0, 1, 2]) })
    mk('c', { 'SKILL.md': 'x\n', 'refs/two.md': '2\n', 'img.bin': Buffer.from([0, 9, 9]) })
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('hash is equal for equal trees and differs otherwise', async () => {
    expect(await hashSkillDir(join(dir, 'a'))).toBe(await hashSkillDir(join(dir, 'b')))
    expect(await hashSkillDir(join(dir, 'a'))).not.toBe(await hashSkillDir(join(dir, 'c')))
    expect(await hashSkillDir(join(dir, 'missing'))).toBeNull()
  })

  it('reports added / removed / binary-modified / same files', async () => {
    const files = await diffSkillDirs(join(dir, 'a'), join(dir, 'c'))
    expect(files.map((f) => [f.path, f.status])).toEqual([
      ['SKILL.md', 'same'],
      ['img.bin', 'binary-modified'],
      ['refs/one.md', 'removed'],
      ['refs/two.md', 'added']
    ])
  })
})
