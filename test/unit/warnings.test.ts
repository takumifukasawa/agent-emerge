import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Account, Skill, SkillWarning } from '../../src/shared/model'
import { readClaudeCodeAccount, type AccountSnapshot } from '../../src/main/adapters/claude-code'
import { discoverAccounts } from '../../src/main/index/accounts'
import { buildSkillMatrix } from '../../src/main/index/matrix'
import { DESCRIPTION_LIMIT, referencedSkills, skillWarnings, withWarnings } from '../../src/main/index/warnings'
import { materializeFixture, type MaterializedFixture } from '../fixtures/materialize'

const fixtures: MaterializedFixture[] = []
const snapshotsOf = async (name: 'home' | 'clean-home'): Promise<AccountSnapshot[]> => {
  const fx = materializeFixture(name)
  fixtures.push(fx)
  const accounts = (await discoverAccounts({ home: fx.home })) as Account[]
  return (await Promise.all(accounts.map((a) => readClaudeCodeAccount(a, { home: fx.home })))).map(withWarnings)
}
let home: AccountSnapshot[]
let clean: AccountSnapshot[]
beforeAll(async () => {
  home = await snapshotsOf('home')
  clean = await snapshotsOf('clean-home')
})
afterAll(() => fixtures.forEach((f) => f.cleanup()))

const kinds = (snaps: AccountSnapshot[]): Record<string, string[]> => {
  const out: Record<string, string[]> = {}
  for (const snap of snaps) {
    for (const s of snap.skills) {
      if (s.warnings.length === 0) continue
      const key = `${snap.account.displayName}/${s.provenance.kind === 'plugin' ? s.provenance.pluginId + '/' : ''}${s.name}`
      out[key] = s.warnings.map((w) => w.kind)
    }
  }
  return out
}

describe('warnings on the fixture homes (test/fixtures/README.md)', () => {
  it('each case in home/ produces exactly its warning, and nothing else warns', () => {
    expect(kinds(home)).toEqual({
      'default/broken-link': ['broken-link'],
      'default/bad-frontmatter': ['invalid-frontmatter'],
      'default/long-description': ['description-too-long'],
      'default/needs-missing': ['missing-dependency'],
      'default/demo-skill': ['name-collision'],
      'default/demo@fixture-market/demo-skill': ['name-collision']
    })
  })

  it('carries the details the UI shows', () => {
    const def = home.find((s) => s.account.displayName === 'default')!
    const w = (name: string, scope = 'user'): SkillWarning[] => def.skills.find((s) => s.name === name && s.scope === scope)!.warnings
    expect(w('needs-missing')).toEqual([{ kind: 'missing-dependency', skill: 'absent-skill' }])
    expect(w('bad-frontmatter')).toEqual([{ kind: 'invalid-frontmatter', reason: 'missing-name' }])
    expect(w('demo-skill')).toEqual([{ kind: 'name-collision', others: ['plugin demo@fixture-market'] }])
    expect(w('demo-skill', 'plugin')).toEqual([{ kind: 'name-collision', others: ['user'] }])
    const long = w('long-description')[0]
    expect(long).toMatchObject({ kind: 'description-too-long', limit: 1024 })
    expect(long?.kind === 'description-too-long' && long.length).toBeGreaterThan(1024)
  })

  it('clean-home produces none', () => {
    expect(clean.flatMap((s) => s.skills).length).toBeGreaterThan(0)
    expect(kinds(clean)).toEqual({})
  })

  it('buildSkillMatrix fills warnings into the cells', async () => {
    const m = await buildSkillMatrix(home.map((s) => ({ ...s, skills: s.skills.map((k) => ({ ...k, warnings: [] })) })))
    const row = m.rows.find((r) => r.name === 'needs-missing')!
    const cell = Object.values(row.cells).find((c) => c.skills.length > 0)!
    expect(cell.skills[0]?.warnings.map((x) => x.kind)).toEqual(['missing-dependency'])
  })
})

const skill = (over: Partial<Skill>): Skill => ({
  name: 'x',
  scope: 'user',
  accountId: 'a',
  path: '/fixture-root/x',
  realPath: '/fixture-root/x',
  provenance: { kind: 'local' },
  frontmatter: { name: 'x', description: 'd' },
  frontmatterError: null,
  description: 'd',
  body: '',
  warnings: [],
  ...over
})

describe('skillWarnings rules', () => {
  it('description: exactly the limit is fine, one more warns', () => {
    const at = skill({ description: 'a'.repeat(DESCRIPTION_LIMIT) })
    const over = skill({ description: 'a'.repeat(DESCRIPTION_LIMIT + 1) })
    expect(skillWarnings(at, [at])).toEqual([])
    expect(skillWarnings(over, [over]).map((w) => w.kind)).toEqual(['description-too-long'])
  })

  it('frontmatter: missing SKILL.md, unparsable YAML, missing description', () => {
    const r = (s: Skill) => skillWarnings(s, [s])
    expect(r(skill({ frontmatterError: 'missing-file', frontmatter: null, description: null }))).toEqual([{ kind: 'invalid-frontmatter', reason: 'missing-file' }])
    expect(r(skill({ frontmatterError: 'invalid-yaml', frontmatter: null, description: null }))).toEqual([{ kind: 'invalid-frontmatter', reason: 'invalid-yaml' }])
    expect(r(skill({ frontmatter: { name: 'x' }, description: null }))).toEqual([{ kind: 'invalid-frontmatter', reason: 'missing-description' }])
  })

  it('a broken link reports only broken-link', () => {
    const s = skill({ provenance: { kind: 'broken-link', linkTarget: '../gone' }, realPath: null, frontmatterError: 'missing-file', frontmatter: null, description: null })
    expect(skillWarnings(s, [s])).toEqual([{ kind: 'broken-link', linkTarget: '../gone' }])
  })

  it('a disabled plugin skill neither collides nor satisfies a dependency', () => {
    const user = skill({ name: 'dup', body: 'Call the Skill tool with "other-skill".' })
    const off = (name: string) => skill({ name, scope: 'plugin', provenance: { kind: 'plugin', pluginId: 'p@m', enabled: false, upstream: {} } })
    const all = [user, off('dup'), off('other-skill')]
    expect(skillWarnings(user, all)).toEqual([{ kind: 'missing-dependency', skill: 'other-skill' }])
  })

  it('a plugin-qualified reference resolves to an enabled plugin skill', () => {
    const user = skill({ body: 'Use the `p:helper` skill.' })
    const helper = skill({ name: 'helper', scope: 'plugin', provenance: { kind: 'plugin', pluginId: 'p@m', enabled: true, upstream: {} } })
    expect(skillWarnings(user, [user, helper])).toEqual([])
  })
})

describe('referencedSkills', () => {
  it('finds explicit references only', () => {
    expect(referencedSkills('Call the Skill tool with "grilling". Then Skill(review). skill: "a-b"\nUse the `p:helper` skill.')).toEqual([
      'a-b', 'grilling', 'p:helper', 'review'
    ])
    expect(referencedSkills('This skill reads files. Use the "Edit" tool. See skills/foo.')).toEqual([])
  })
})
