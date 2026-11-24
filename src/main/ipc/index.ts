import { homedir } from 'node:os'
import { app, ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import { buildAppInfo } from '../appInfo'
import { discoverAccounts } from '../index/accounts'

// Every handler here must be read-only (docs/architecture.md). test/unit/architecture.test.ts checks channel names.
export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.getAppInfo, () =>
    buildAppInfo(app.getName(), app.getVersion(), process.platform)
  )
  ipcMain.handle(IpcChannels.listAccounts, () =>
    discoverAccounts({ home: homedir(), envConfigDir: process.env['CLAUDE_CONFIG_DIR'] })
  )
}
