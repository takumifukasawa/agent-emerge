// Sanity checks for the fixtures themselves, so later tests fail for the right reason.
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { encodeProjectPath, materializeFixture, type MaterializedFixture } from '../fixtures/materialize'

let fx: MaterializedFixture
beforeAll(() => {
  fx = materializeFixture('home')
})
afterAll(() => fx.cleanup())

const p = (rel: string): string => join(fx.home, rel)
const gitOut = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

describe('fixture: home', () => {
  it('has two accounts', () => {
    expect(existsSync(p('.claude/settings.json'))).toBe(true)
    expect(existsSync(p('.claude-work/.claude.json'))).toBe(true)
    expect(existsSync(p('.claude.json'))).toBe(true)
  })

  it('keeps relative symlinks, shared ones resolving to the same real dir', () => {
    expect(lstatSync(p('.claude/skills/shared-skill')).isSymbolicLink()).toBe(true)
    expect(realpathSync(p('.claude/skills/shared-skill'))).toBe(realpathSync(p('.claude-work/skills/shared-skill')))
    expect(realpathSync(p('.claude/skills/locked-skill'))).toBe(realpathSync(p('.agents/skills/locked-skill')))
  })

  it('has a broken symlink', () => {
    expect(lstatSync(p('.claude/skills/broken-link')).isSymbolicLink()).toBe(true)
    expect(existsSync(p('.claude/skills/broken-link'))).toBe(false)
  })

  it('fills __HOME__ and __HOME_ENC__', () => {
    const cfg = JSON.parse(readFileSync(p('.claude.json'), 'utf8')) as { projects: Record<string, unknown> }
    expect(Object.keys(cfg.projects)).toContain(join(fx.home, 'dev/harness-project'))
    const plugins = readFileSync(p('.claude/plugins/installed_plugins.json'), 'utf8')
    expect(plugins).not.toContain('__HOME__')
    expect(readdirSync(p('.claude/projects'))).toEqual([`${encodeProjectPath(fx.home)}-dev-harness-project`])
  })

  it('copied-skill differs between accounts', () => {
    expect(readFileSync(p('.claude/skills/copied-skill/SKILL.md'), 'utf8')).not.toBe(
      readFileSync(p('.claude-work/skills/copied-skill/SKILL.md'), 'utf8')
    )
  })

  it('source repo has one unpushed commit and an uncommitted change', () => {
    const repo = p('dev/skills-repo')
    expect(gitOut(repo, 'rev-list', '--count', '@{u}..HEAD')).toBe('1')
    expect(gitOut(repo, 'status', '--porcelain')).toContain('shared-skill/notes.md')
  })

  it('harness manifest hashes: clean.sh and AGENTS.md block match, drifted.sh does not', () => {
    const proj = p('dev/harness-project')
    const m = JSON.parse(readFileSync(join(proj, '.harness/manifest.json'), 'utf8')) as {
      files: { path: string; ownership: string; sha256: string }[]
    }
    const want = (path: string): string => m.files.find((f) => f.path === path)!.sha256
    const hash = (file: string): string => gitOut(proj, 'hash-object', '--no-filters', file)
    expect(hash('.harness/clean.sh')).toBe(want('.harness/clean.sh'))
    expect(hash('.harness/drifted.sh')).not.toBe(want('.harness/drifted.sh'))
    expect(existsSync(join(proj, '.harness/missing.sh'))).toBe(false)
    const text = readFileSync(join(proj, 'AGENTS.md'), 'utf8')
    const block = text.slice(text.indexOf('<!-- harness:begin'), text.indexOf('<!-- harness:end -->') + '<!-- harness:end -->'.length) + '\n'
    const blockHash = execFileSync('git', ['hash-object', '--stdin'], { input: block, encoding: 'utf8' }).trim()
    expect(blockHash).toBe(want('AGENTS.md'))
  })
})

describe('fixture: clean-home', () => {
  it('materializes with one valid skill', () => {
    const clean = materializeFixture('clean-home')
    try {
      expect(readdirSync(join(clean.home, '.claude/skills'))).toEqual(['good-skill'])
    } finally {
      clean.cleanup()
    }
  })
})
