import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Account } from '../../src/shared/model'
import { readKnownProjects } from '../../src/main/adapters/claude-code'
import { importSpecs, MAX_DEPTH, readAccountInstructions, readInstructions, readProjectInstructions } from '../../src/main/adapters/claude-code/instructions'
import { encodeProjectPath, parseMemoryFile, readMemory } from '../../src/main/adapters/claude-code/memory'
import { discoverAccounts } from '../../src/main/index/accounts'
import { encodeProjectPath as fixtureEncode, materializeFixture, type MaterializedFixture } from '../fixtures/materialize'

let fx: MaterializedFixture
let def: Account
let work: Account
beforeAll(async () => {
  fx = materializeFixture('home')
  ;[def, work] = (await discoverAccounts({ home: fx.home })) as [Account, Account]
})
afterAll(() => fx.cleanup())

describe('CLAUDE.md imports', () => {
  it('expands the fixture @shared/style.md import and shows the chain', async () => {
    const [doc] = await readAccountInstructions(def.id, def.configDir, fx.home)
    expect(doc?.raw).toContain('@shared/style.md')
    expect(doc?.expanded).toContain('## Style (imported)')
    expect(doc?.expanded).not.toContain('@shared/style.md')
    expect(doc?.imports).toEqual([{ spec: 'shared/style.md', path: join(def.configDir, 'shared/style.md'), status: 'ok', children: [] }])
    const [w] = await readAccountInstructions(work.id, work.configDir, fx.home)
    expect(w?.imports).toEqual([])
  })

  it('reads a harness project: CLAUDE.md imports AGENTS.md, and AGENTS.md is listed too', async () => {
    const dir = join(fx.home, 'dev/harness-project')
    const docs = await readProjectInstructions(dir, dir, fx.home)
    expect(docs.map((d) => d.kind)).toEqual(['CLAUDE.md', 'AGENTS.md'])
    expect(docs[0]?.imports[0]).toMatchObject({ spec: 'AGENTS.md', status: 'ok' })
    expect(docs[0]?.expanded).toContain('fixture project rules')
  })

  it('marks missing files, cycles and the depth limit; resolves ~/', async () => {
    const d = join(fx.home, 'imports')
    mkdirSync(d, { recursive: true })
    writeFileSync(join(d, 'a.md'), '@b.md and @missing.md and @~/imports/c.md\n')
    writeFileSync(join(d, 'b.md'), 'B @a.md\n')
    writeFileSync(join(d, 'c.md'), 'C\n')
    const doc = await readInstructions(join(d, 'a.md'), 'CLAUDE.md', { kind: 'account', accountId: 'x' }, fx.home)
    expect(doc?.imports.map((n) => [n.spec, n.status, n.children.map((c) => c.status)])).toEqual([
      ['b.md', 'ok', ['cycle']],
      ['missing.md', 'missing', []],
      ['~/imports/c.md', 'ok', []]
    ])
    expect(doc?.expanded).toBe('B @a.md and @missing.md and C\n')

    for (let i = 0; i <= MAX_DEPTH + 1; i++) writeFileSync(join(d, `n${i}.md`), `n${i} @n${i + 1}.md\n`)
    const chain = await readInstructions(join(d, 'n0.md'), 'CLAUDE.md', { kind: 'account', accountId: 'x' }, fx.home)
    let node = chain?.imports[0]
    const statuses: string[] = []
    while (node) {
      statuses.push(node.status)
      node = node.children[0]
    }
    expect(statuses).toEqual([...Array(MAX_DEPTH).fill('ok'), 'too-deep'])
  })

  it('ignores code, mentions and e-mail-like text', () => {
    const text = 'see @docs/a.md\n`@not/this.md`\n```\n@nor/this.md\n```\nping @someone, mail x@y.z\n'
    expect(importSpecs(text).map((s) => s.spec)).toEqual(['docs/a.md'])
  })
})

describe('memory', () => {
  it('lists the fixture memory under its project, with its type', async () => {
    const groups = await readMemory(def.id, def.configDir, await readKnownProjects(def))
    expect(groups).toHaveLength(1)
    const g = groups[0]!
    expect(g.projectPath).toBe(join(fx.home, 'dev/harness-project'))
    expect(g.index).toContain('[Fixture preference](fixture-preference.md)')
    expect(g.files.map((f) => [f.file, f.name, f.type, f.description])).toEqual([
      ['fixture-preference.md', 'fixture-preference', 'feedback', 'The fixture user prefers short answers.']
    ])
    expect(await readMemory(work.id, work.configDir, [])).toEqual([])
  })

  it('accepts a top-level type and rejects unknown types', () => {
    expect(parseMemoryFile('a.md', '/fixture-root/a.md', '---\nname: a\ntype: user\n---\nx').type).toBe('user')
    expect(parseMemoryFile('a.md', '/fixture-root/a.md', '---\nname: a\nmetadata:\n  type: secret\n---\nx').type).toBeNull()
    expect(parseMemoryFile('a.md', '/fixture-root/a.md', 'no frontmatter').body).toBe('no frontmatter')
  })

  it('encodes project paths the same way as the fixture materializer', () => {
    expect(encodeProjectPath('/fixture-root/dev/my_proj.x')).toBe(fixtureEncode('/fixture-root/dev/my_proj.x'))
  })
})
