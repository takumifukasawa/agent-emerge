import { _electron as electron, expect, test } from '@playwright/test'
import { materializeFixture } from '../fixtures/materialize'

test('app launches and the renderer reaches main through the preload bridge', async () => {
  const fx = materializeFixture('home')
  const env = { ...process.env, HOME: fx.home } as Record<string, string>
  delete env['CLAUDE_CONFIG_DIR']
  const app = await electron.launch({ args: ['.'], env })
  try {
    const win = await app.firstWindow()
    await expect(win).toHaveTitle('agent-emerge')
    await expect(win.getByTestId('app-info')).toContainText('0.0.0')
    await expect(win.getByTestId('account')).toHaveText(['default', 'work'])
    // renderer must not see Node
    expect(await win.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe('undefined')
  } finally {
    await app.close()
    fx.cleanup()
  }
})
