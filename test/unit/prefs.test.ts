import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PrefsStore } from '../../src/main/prefs'
import { defaultPrefs, sanitizePrefs, withCatalog, withDisplayName, withManualRoot } from '../../src/shared/prefs'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'agent-emerge-prefs-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('PrefsStore', () => {
  it('returns defaults when there is no file, without writing anything', async () => {
    expect(await new PrefsStore(dir).load()).toEqual({ prefs: defaultPrefs(), invalid: false })
    expect(readdirSync(dir)).toEqual([])
  })

  it('round-trips and leaves only prefs.json behind (atomic write)', async () => {
    const store = new PrefsStore(dir)
    const p = withDisplayName(defaultPrefs(), '/fixture-root/.claude', 'Company')
    await store.save(p)
    expect(readdirSync(dir)).toEqual(['prefs.json'])
    expect((await store.load()).prefs).toEqual(p)
  })

  it('reports an unparsable file as invalid and does not touch it on load', async () => {
    writeFileSync(join(dir, 'prefs.json'), '{ not json')
    expect((await new PrefsStore(dir).load()).invalid).toBe(true)
    expect(readFileSync(join(dir, 'prefs.json'), 'utf8')).toBe('{ not json')
  })

  it('creates the userData dir if needed', async () => {
    const nested = join(dir, 'userData')
    await new PrefsStore(nested).save(defaultPrefs())
    expect(readdirSync(nested)).toEqual(['prefs.json'])
  })
})

describe('prefs updates', () => {
  it('sets and clears display names', () => {
    const a = withDisplayName(defaultPrefs(), 'id', '  Work  ')
    expect(a.displayNames).toEqual({ id: 'Work' })
    expect(withDisplayName(a, 'id', '').displayNames).toEqual({})
  })

  it('adds manual roots without duplicates and removes them', () => {
    let p = withManualRoot(defaultPrefs(), 'sources', '/fixture-root/src', true)
    p = withManualRoot(p, 'sources', '/fixture-root/src', true)
    expect(p.manualRoots.sources).toEqual(['/fixture-root/src'])
    expect(withManualRoot(p, 'sources', '/fixture-root/src', false).manualRoots.sources).toEqual([])
  })

  it('keeps catalogs per account', () => {
    let p = withCatalog(defaultPrefs(), { accountId: 'a', path: '/fixture-root/cat' }, true)
    p = withCatalog(p, { accountId: 'b', path: '/fixture-root/cat' }, true)
    expect(p.catalogs).toHaveLength(2)
    expect(withCatalog(p, { accountId: 'a', path: '/fixture-root/cat' }, false).catalogs).toEqual([{ accountId: 'b', path: '/fixture-root/cat' }])
  })

  it('sanitizes garbage', () => {
    expect(sanitizePrefs({ displayNames: { x: 1, y: 'ok' }, manualRoots: { accounts: ['a', 2, 'a'] }, catalogs: [{ accountId: 'a' }] })).toEqual({
      ...defaultPrefs(),
      displayNames: { y: 'ok' },
      manualRoots: { accounts: ['a'], sources: [], harnessProjects: [] }
    })
  })
})
