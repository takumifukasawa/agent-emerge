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
