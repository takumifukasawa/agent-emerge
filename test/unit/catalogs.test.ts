import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Account, Catalog } from '../../src/shared/model'
import { readClaudeCodeAccount, type AccountSnapshot } from '../../src/main/adapters/claude-code'
import { discoverAccounts } from '../../src/main/index/accounts'
import { readCatalog } from '../../src/main/index/catalogs'
import { buildSkillMatrix } from '../../src/main/index/matrix'
import { materializeFixture, type MaterializedFixture } from '../fixtures/materialize'

let fx: MaterializedFixture
let def: Account
let work: Account
let snaps: AccountSnapshot[]
let skillsRepo: Catalog
let market: Catalog
beforeAll(async () => {
  fx = materializeFixture('home')
  ;[def, work] = (await discoverAccounts({ home: fx.home })) as [Account, Account]
  snaps = await Promise.all([def, work].map((a) => readClaudeCodeAccount(a, { home: fx.home })))
  skillsRepo = await readCatalog({ accountId: def.id, path: join(fx.home, 'dev/catalog-skills') })
  market = await readCatalog({ accountId: def.id, path: join(fx.home, 'dev/catalog-market') })
})
afterAll(() => fx.cleanup())

describe('readCatalog', () => {
  it('reads the skills-repo layout', () => {
    expect(skillsRepo).toMatchObject({ layout: 'skills-repo', name: 'catalog-skills', exists: true })
    expect(skillsRepo.skills.map((s) => [s.name, s.plugin])).toEqual([['catalog-only', null], ['copied-skill', null], ['demo-skill', null]])
  })

  it('reads the marketplace layout with plugin and version', () => {
    expect(market).toMatchObject({ layout: 'marketplace', name: 'fixture-team-market' })
    expect(market.skills.map((s) => [s.name, s.plugin, s.version])).toEqual([
      ['locked-skill', 'team-tools', '1.2.0'],
      ['team-helper', 'team-tools', '1.2.0']
    ])
  })

  it('a missing clone is reported, not thrown', async () => {
    expect(await readCatalog({ accountId: def.id, path: join(fx.home, 'nope') })).toMatchObject({ exists: false, layout: 'unknown', skills: [] })
  })
})

describe('catalog skills in the matrix', () => {
  it('marks not installed / installed / version differs per account', async () => {
    const m = await buildSkillMatrix(snaps, [skillsRepo, market])
    const state = (name: string, a: Account) => m.rows.find((r) => r.name === name)?.cells[a.id]?.catalog.map((c) => c.state)
    expect(state('copied-skill', def)).toEqual(['installed'])
    expect(state('locked-skill', def)).toEqual(['installed'])
    expect(state('demo-skill', def)).toEqual(['differs'])
    expect(state('catalog-only', def)).toEqual(['not-installed'])
    expect(state('team-helper', def)).toEqual(['not-installed'])
    // catalogs are per account: the work account has none attached
    expect(state('copied-skill', work)).toEqual([])
    expect(m.rows.map((r) => r.name)).toContain('catalog-only')
  })

  it('the same catalog attached to the work account compares against its own copies', async () => {
    const forWork = await readCatalog({ accountId: work.id, path: join(fx.home, 'dev/catalog-skills') })
    const m = await buildSkillMatrix(snaps, [forWork])
    expect(m.rows.find((r) => r.name === 'copied-skill')?.cells[work.id]?.catalog.map((c) => c.state)).toEqual(['differs'])
  })
})
