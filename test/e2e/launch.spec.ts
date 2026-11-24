import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import type { AgentEmergeApi } from '../../src/shared/ipc'
import { materializeFixture, type MaterializedFixture } from '../fixtures/materialize'

let fx: MaterializedFixture
test.beforeEach(() => {
  fx = materializeFixture('home')
})
test.afterEach(() => fx.cleanup())

function launch(): Promise<ElectronApplication> {
  const env = { ...process.env, HOME: fx.home } as Record<string, string>
  delete env['CLAUDE_CONFIG_DIR']
  // userData (prefs + Chromium caches) inside the temp home so tests never touch the real profile
  env['AGENT_EMERGE_USER_DATA'] = join(fx.home, 'userData')
  return electron.launch({ args: ['.'], env })
}

test('app launches and the renderer reaches main through the preload bridge', async () => {
  const app = await launch()
  try {
    const win = await app.firstWindow()
    await expect(win).toHaveTitle('agent-emerge')
    await expect(win.getByTestId('app-info')).toContainText('0.0.0')
    await expect(win.getByTestId('account')).toHaveText(['default', 'work'])
    // renderer must not see Node
    expect(await win.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe('undefined')
  } finally {
    await app.close()
  }
})

test('a renamed account keeps its name after restart (prefs.json)', async () => {
  let app = await launch()
  try {
    const win = await app.firstWindow()
    await expect(win.getByTestId('account')).toHaveText(['default', 'work'])
    await win.evaluate(async () => {
      // runs in the renderer; typed here because the test's tsconfig has no DOM lib
      const api = (globalThis as unknown as { agentEmerge: AgentEmergeApi }).agentEmerge
      const [def] = await api.listAccounts()
      await api.setDisplayName(def!.id, 'Company')
    })
  } finally {
    await app.close()
  }
  app = await launch()
  try {
    const win = await app.firstWindow()
    await expect(win.getByTestId('account')).toHaveText(['Company', 'work'])
    expect(existsSync(join(fx.home, 'userData/prefs.json'))).toBe(true)
  } finally {
    await app.close()
  }
})

test('skills matrix compares copies across accounts and shows the diff', async () => {
  const app = await launch()
  try {
    const win = await app.firstWindow()
    const row = (name: string) => win.locator(`[data-testid="matrix-row"][data-skill="${name}"]`)
    await expect(row('shared-skill').getByTestId('across')).toHaveText('same')
    await expect(row('copied-skill').getByTestId('across')).toHaveText('differs')
    await expect(row('only-here').getByTestId('across')).toHaveText('work only')
    await expect(row('other-skill')).toContainText('plugin other (disabled)')
    await expect(row('broken-link')).toContainText('broken link')

    await row('copied-skill').click()
    const detail = win.getByTestId('detail')
    await expect(detail.getByTestId('diff-file')).toContainText('SKILL.md')
    await expect(detail.getByTestId('diff-del')).toHaveText('- Version A of copied-skill.')
    await expect(detail.getByTestId('diff-add')).toHaveText('+ Version B of copied-skill.')

    // warnings: one chip per case (broken-link is already the provenance chip)
    const chips = (name: string) => row(name).locator('[data-testid="warning"]')
    await expect(chips('bad-frontmatter')).toHaveAttribute('data-warning', 'invalid-frontmatter')
    await expect(chips('long-description')).toHaveText('long description')
    await expect(chips('needs-missing')).toHaveText('needs absent-skill')
    await expect(chips('demo-skill')).toHaveText(['name collision', 'name collision'])
    await expect(chips('shared-skill')).toHaveCount(0)
    await expect(chips('broken-link')).toHaveCount(0)

    await row('needs-missing').click()
    await expect(detail.getByTestId('detail-warning')).toHaveCount(1)
    await expect(detail.getByTestId('detail-warning')).toContainText('Calls skill "absent-skill", which is not installed in this account')
    await row('broken-link').click()
    await expect(detail.getByTestId('detail-warning')).toHaveAttribute('data-warning', 'broken-link')
    await row('shared-skill').click()
    await expect(detail.getByTestId('detail-warnings')).toHaveText('none')

    await win.getByLabel('Hide plugin skills').check()
    await expect(row('rooted-skill')).toHaveCount(0)
    await win.getByLabel('Account').selectOption({ label: 'work' })
    await expect(win.getByTestId('matrix-row')).toHaveCount(3)
  } finally {
    await app.close()
  }
})

test('sources and harness projects show git state, drift and sidebar badges', async () => {
  const app = await launch()
  try {
    const win = await app.firstWindow()
    await expect(win.getByTestId('badge-sources')).toHaveText('1 unpushed')
    await expect(win.getByTestId('badge-harness')).toHaveText('2 drifted')

    await win.getByRole('button', { name: /Sources/ }).click()
    const repo = win.locator('[data-testid="source-row"][data-path$="skills-repo"]')
    await expect(repo.getByTestId('unpushed')).toHaveText('1 unpushed')
    await expect(repo.getByTestId('uncommitted')).toHaveText('1 uncommitted')
    await expect(repo).toContainText('shared-skill')
    await expect(win.locator('[data-testid="source-row"][data-path$=".agents"]')).toContainText('not a git repo')

    await win.getByRole('button', { name: /Harness projects/ }).click()
    const rows = win.getByTestId('harness-row')
    await expect(rows).toHaveCount(1)
    await expect(rows).toHaveAttribute('data-path', /harness-project$/)
    await expect(rows.getByTestId('drift')).toHaveText([/modified.*\.harness\/drifted\.sh/, /missing.*\.harness\/missing\.sh/])
  } finally {
    await app.close()
  }
})

test('CLAUDE.md expands imports and memory lists files with their type', async () => {
  const app = await launch()
  try {
    const win = await app.firstWindow()
    await win.getByRole('button', { name: 'CLAUDE.md' }).click()
    const items = win.getByTestId('instructions-item')
    await expect(items).toHaveText([/default · CLAUDE\.md/, /work · CLAUDE\.md/, /project harness-project · CLAUDE\.md/, /project harness-project · AGENTS\.md/])
    const detail = win.getByTestId('instructions-detail')
    await expect(detail.getByTestId('import')).toHaveText('@shared/style.md')
    await expect(detail.getByTestId('instructions-text')).toContainText('## Style (imported)')
    await detail.getByLabel('Show as written (imports not expanded)').check()
    await expect(detail.getByTestId('instructions-text')).toContainText('@shared/style.md')
    await expect(detail.getByTestId('instructions-text')).not.toContainText('Style (imported)')

    await win.getByRole('button', { name: 'Memory' }).click()
    const group = win.getByTestId('memory-group')
    await expect(group).toHaveCount(1)
    await expect(group).toContainText('harness-project')
    await expect(group.getByTestId('memory-type')).toHaveText('feedback')
    await group.getByTestId('memory-item').click()
    await expect(group.getByTestId('memory-body')).toContainText('Keep answers short.')
  } finally {
    await app.close()
  }
})
