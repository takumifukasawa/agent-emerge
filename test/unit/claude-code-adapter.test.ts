import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Account, Skill } from '../../src/shared/model'
import { readClaudeCodeAccount, readSkillsDir } from '../../src/main/adapters/claude-code'
import { parseFrontmatter } from '../../src/main/adapters/frontmatter'
import { discoverAccounts } from '../../src/main/index/accounts'
import { materializeFixture, type MaterializedFixture } from '../fixtures/materialize'

let fx: MaterializedFixture
let def: Account
let work: Account
beforeAll(async () => {
  fx = materializeFixture('home')
  ;[def, work] = (await discoverAccounts({ home: fx.home })) as [Account, Account]
})
afterAll(() => fx.cleanup())

const byName = (skills: Skill[], name: string, scope = 'user'): Skill => {
  const s = skills.find((x) => x.name === name && x.scope === scope)
  if (!s) throw new Error(`no ${scope} skill ${name}`)
  return s
}

describe('claude-code adapter: user skills', () => {
  it('lists every skill dir / link of the default account', async () => {
    const { skills } = await readClaudeCodeAccount(def, { home: fx.home })
    expect(skills.filter((s) => s.scope === 'user').map((s) => s.name)).toEqual([
      'bad-frontmatter',
      'broken-link',
      'copied-skill',
      'demo-skill',
      'locked-skill',
      'long-description',
      'needs-missing',
      'shared-skill'
    ])
  })

  it('classifies provenance', async () => {
    const { skills } = await readClaudeCodeAccount(def, { home: fx.home })
    expect(byName(skills, 'copied-skill').provenance).toEqual({ kind: 'local' })
    expect(byName(skills, 'shared-skill').provenance).toEqual({
      kind: 'symlink',
      linkTarget: '../../dev/skills-repo/shared-skill',
      sourceRoot: join(fx.home, 'dev/skills-repo')
    })
    expect(byName(skills, 'locked-skill').provenance).toEqual({
      kind: 'skills-cli',
      linkTarget: '../../.agents/skills/locked-skill',
      lockSource: 'fixture-owner/fixture-skills',
      upstream: { url: 'https://github.com/fixture-owner/fixture-skills.git' }
    })
    expect(byName(skills, 'broken-link')).toMatchObject({
      realPath: null,
      provenance: { kind: 'broken-link', linkTarget: '../../dev/skills-repo/does-not-exist' },
      frontmatterError: 'missing-file'
    })
  })

  it('parses frontmatter and reports what is wrong with it', async () => {
    const { skills } = await readClaudeCodeAccount(def, { home: fx.home })
    expect(byName(skills, 'shared-skill')).toMatchObject({
      frontmatterError: null,
      description: 'Fixture skill shared by both accounts through a symlink.'
    })
    expect(byName(skills, 'bad-frontmatter')).toMatchObject({ frontmatterError: null, description: null })
    expect(byName(skills, 'bad-frontmatter').frontmatter).toEqual({ title: 'no name or description here' })
  })

  it('second account sees its own skills, sharing the same real dir for shared-skill', async () => {
    const a = await readClaudeCodeAccount(def, { home: fx.home })
    const b = await readClaudeCodeAccount(work, { home: fx.home })
    expect(b.skills.map((s) => s.name)).toEqual(['copied-skill', 'only-here', 'shared-skill'])
    expect(byName(a.skills, 'shared-skill').realPath).toBe(byName(b.skills, 'shared-skill').realPath)
    expect(byName(a.skills, 'copied-skill').realPath).not.toBe(byName(b.skills, 'copied-skill').realPath)
    expect(b.plugins).toEqual([])
  })
})

describe('claude-code adapter: plugins', () => {
  it('reads installed plugins with enabled state and upstream', async () => {
    const { plugins } = await readClaudeCodeAccount(def, { home: fx.home })
    expect(plugins.map((p) => [p.id, p.enabled, p.version, p.installPathExists, p.upstream])).toEqual([
      ['demo@fixture-market', true, '1.0.0', true, { url: 'https://github.com/fixture-owner/fixture-market.git', ref: '1.0.0' }],
      ['other@fixture-market', false, '2.0.0', true, { url: 'https://github.com/fixture-owner/fixture-market.git', ref: '2.0.0' }],
      ['rooted@fixture-market', true, 'abc123', true, { url: 'https://github.com/fixture-owner/fixture-market.git', ref: 'abc123' }]
    ])
  })

  it('finds plugin skills in skills/ and at paths declared by marketplace.json', async () => {
    const { skills } = await readClaudeCodeAccount(def, { home: fx.home })
    const plugin = skills.filter((s) => s.scope === 'plugin')
    expect(plugin.map((s) => [s.name, s.provenance.kind === 'plugin' && s.provenance.pluginId, s.provenance.kind === 'plugin' && s.provenance.enabled])).toEqual([
      ['demo-skill', 'demo@fixture-market', true],
      ['other-skill', 'other@fixture-market', false],
      ['rooted-skill', 'rooted@fixture-market', true]
    ])
  })
})

describe('claude-code adapter: project skills', () => {
  it('reads a harness project skills dir with project scope', async () => {
    const skills = await readSkillsDir(join(fx.home, 'dev/harness-project/.claude/skills'), 'project', def.id, { home: fx.home })
    expect(skills.map((s) => [s.name, s.scope, s.provenance.kind])).toEqual([['project-skill', 'project', 'local']])
  })

  it('returns nothing for a missing dir', async () => {
    expect(await readSkillsDir(join(fx.home, 'nowhere'), 'project', def.id, { home: fx.home })).toEqual([])
  })
})

describe('parseFrontmatter', () => {
  it('handles missing, invalid and non-object frontmatter', () => {
    expect(parseFrontmatter('no fm')).toMatchObject({ ok: false, error: 'no-frontmatter' })
    expect(parseFrontmatter('---\nname: [unclosed\n---\nbody')).toMatchObject({ ok: false, error: 'invalid-yaml', body: 'body' })
    expect(parseFrontmatter('---\n- a list\n---\n')).toMatchObject({ ok: false, error: 'invalid-yaml' })
    expect(parseFrontmatter('---\nname: x\ndescription: >\n  folded\n  text\n---\nB')).toEqual({
      ok: true,
      data: { name: 'x', description: 'folded text\n' },
      body: 'B'
    })
  })
})
