import { _electron as electron, expect, test } from '@playwright/test'

test('app launches and the renderer reaches main through the preload bridge', async () => {
  const app = await electron.launch({ args: ['.'] })
  try {
    const win = await app.firstWindow()
    await expect(win).toHaveTitle('agent-emerge')
    await expect(win.getByTestId('app-info')).toContainText('0.0.0')
    // renderer must not see Node
    expect(await win.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe('undefined')
  } finally {
    await app.close()
  }
})
