import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Account, SettingsLayer } from '../../src/shared/model'
import { isSecretKey, MASK, maskDeep } from '../../src/shared/mask'
import { mergeSettings, readAccountLayers, readAgentsAndCommands, readMcpServers } from '../../src/main/adapters/claude-code/settings'
import { discoverAccounts } from '../../src/main/index/accounts'
import { materializeFixture, type MaterializedFixture } from '../fixtures/materialize'

let fx: MaterializedFixture
let def: Account
let project: string
let managedPath: string
beforeAll(async () => {
  fx = materializeFixture('home')
  ;[def] = (await discoverAccounts({ home: fx.home })) as [Account]
  project = join(fx.home, 'dev/harness-project')
  managedPath = join(fx.home, 'managed-settings.json') // absent unless a test writes it
})
afterAll(() => fx.cleanup())

describe('masking', () => {
  it.each([
    ['FIXTURE_API_KEY', true], ['FIXTURE_TOKEN', true], ['DB_PASSWORD', true], ['client_secret', true], ['env.apiKey', true],
    ['FIXTURE_PLAIN', false], ['FIXTURE_REGION', false], ['model', false], ['env.FIXTURE_PLAIN', false]
  ])('isSecretKey(%s) = %s', (k, want) => {
    expect(isSecretKey(k)).toBe(want)
  })

  it('maskDeep hides values under secret keys, including nested ones, and keeps the rest', () => {
    const v = { env: { FIXTURE_TOKEN: 'x', FIXTURE_REGION: 'visible' }, headers: { Authorization: 'a' }, apiKeys: ['a', { b: 1 }] }
    expect(maskDeep(v)).toEqual({ env: { FIXTURE_TOKEN: MASK, FIXTURE_REGION: 'visible' }, headers: { Authorization: 'a' }, apiKeys: [MASK, { b: MASK }] })
    expect(v.env.FIXTURE_TOKEN).toBe('x') // not mutated
  })
})

describe('settings layers (fixture)', () => {
  it('effective model comes from project, env.FIXTURE_PLAIN from local; the rest from user', async () => {
    const eff = mergeSettings(await readAccountLayers(def, { managedPath }, project))
    const at = (p: string) => eff.filter((e) => e.path === p)
    expect(at('model')).toEqual([{ path: 'model', value: 'fixture-model-project', from: 'project', overrides: [{ layer: 'user', value: 'fixture-model' }] }])
    expect(at('env.FIXTURE_PLAIN')).toEqual([{ path: 'env.FIXTURE_PLAIN', value: 'from-local', from: 'local', overrides: [{ layer: 'user', value: 'visible' }] }])
    expect(at('env.FIXTURE_API_KEY')[0]?.from).toBe('user')
    expect(at('permissions.allow').map((e) => [e.value, e.from])).toEqual([['Bash(ls *)', 'user'], ['Bash(npm test)', 'project']])
  })

  it('without a project only user and managed apply; managed wins over everything', async () => {
    const alone = await readAccountLayers(def, { managedPath }, null)
    expect(alone.map((l) => [l.name, l.status])).toEqual([['user', 'ok'], ['managed', 'missing']])
    writeFileSync(managedPath, JSON.stringify({ model: 'managed-model' }))
    const eff = mergeSettings(await readAccountLayers(def, { managedPath }, project))
    expect(eff.find((e) => e.path === 'model')).toMatchObject({ value: 'managed-model', from: 'managed' })
    expect(eff.find((e) => e.path === 'model')?.overrides.map((o) => o.layer)).toEqual(['user', 'project'])
    writeFileSync(managedPath, '{ broken')
    expect((await readAccountLayers(def, { managedPath }, null))[1]?.status).toBe('invalid')
  })

  it('merges regardless of the order the layers are given in', () => {
    const l = (name: SettingsLayer['name'], value: Record<string, unknown>): SettingsLayer => ({ name, path: name, status: 'ok', value })
    expect(mergeSettings([l('local', { a: 2 }), l('user', { a: 1 })])).toEqual([{ path: 'a', value: 2, from: 'local', overrides: [{ layer: 'user', value: 1 }] }])
  })
})

describe('MCP, agents, commands (fixture)', () => {
  it('lists the user MCP server from ~/.claude.json', async () => {
    const servers = await readMcpServers(def, [project])
    expect(servers.map((s) => [s.name, s.scope, s.transport, s.target])).toEqual([['fixture-mcp', 'user', 'stdio', 'fixture-mcp-server --stdio']])
    expect(servers[0]?.file).toBe(join(fx.home, '.claude.json'))
  })

  it('reads project-scope .mcp.json and local-scope servers', async () => {
    writeFileSync(join(project, '.mcp.json'), JSON.stringify({ mcpServers: { web: { type: 'http', url: 'https://example.invalid/mcp' } } }))
    const servers = await readMcpServers(def, [project])
    expect(servers.find((s) => s.name === 'web')).toMatchObject({ scope: 'project', transport: 'http', target: 'https://example.invalid/mcp', projectPath: project })
  })

  it('lists the fixture agent and command', async () => {
    const items = await readAgentsAndCommands(def, [project])
    expect(items.map((i) => [i.kind, i.name, i.description])).toEqual([
      ['agent', 'fixture-reviewer', 'Fixture subagent.'],
      ['command', 'fixture-hello', 'Fixture slash command.']
    ])
  })
})
