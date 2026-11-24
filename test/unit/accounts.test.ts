import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { defaultDisplayName, discoverAccounts } from '../../src/main/index/accounts'
import { materializeFixture, type MaterializedFixture } from '../fixtures/materialize'

let fx: MaterializedFixture
beforeAll(() => {
  fx = materializeFixture('home')
})
afterAll(() => fx.cleanup())

describe('discoverAccounts', () => {
  it('finds ~/.claude and ~/.claude-* with default display names', async () => {
    const accounts = await discoverAccounts({ home: fx.home })
    expect(accounts.map((a) => [a.displayName, a.origin, a.exists])).toEqual([
      ['default', 'auto', true],
      ['work', 'auto', true]
    ])
    expect(accounts.every((a) => a.kind === 'claude-code')).toBe(true)
  })

  it('puts .claude.json in the home dir for the default account only', async () => {
    const [def, work] = await discoverAccounts({ home: fx.home })
    expect(def!.claudeJsonPath).toBe(join(fx.home, '.claude.json'))
    expect(work!.claudeJsonPath).toBe(join(fx.home, '.claude-work/.claude.json'))
  })

  it('ignores ~/.claude.json (a file) and dirs without any account marker', async () => {
    const accounts = await discoverAccounts({ home: fx.home })
    expect(accounts.some((a) => a.configDir.endsWith('.claude.json'))).toBe(false)
  })

  it('applies user display names by account id', async () => {
    const [def] = await discoverAccounts({ home: fx.home })
    const renamed = await discoverAccounts({ home: fx.home, displayNames: { [def!.id]: 'Company' } })
    expect(renamed[0]!.displayName).toBe('Company')
  })

  it('adds manual and env dirs, dedupes by real path, keeps missing manual dirs as not existing', async () => {
    const accounts = await discoverAccounts({
      home: fx.home,
      envConfigDir: join(fx.home, '.claude-work'),
      manual: [join(fx.home, 'dev/harness-project/.claude'), join(fx.home, 'nowhere/.claude'), join(fx.home, '.claude')]
    })
    expect(accounts.map((a) => [a.displayName, a.origin, a.exists])).toEqual([
      ['default', 'auto', true],
      ['work', 'auto', true],
      ['.claude', 'manual', true],
      ['.claude', 'manual', false]
    ])
  })

  it('a clean home has exactly one account', async () => {
    const clean = materializeFixture('clean-home')
    try {
      expect((await discoverAccounts({ home: clean.home })).map((a) => a.displayName)).toEqual(['default'])
    } finally {
      clean.cleanup()
    }
  })
})

describe('defaultDisplayName', () => {
  it('names ~/.claude "default" and ~/.claude-x "x"', () => {
    expect(defaultDisplayName('/fixture-root/.claude', '/fixture-root')).toBe('default')
    expect(defaultDisplayName('/fixture-root/.claude-personal', '/fixture-root')).toBe('personal')
  })
})
