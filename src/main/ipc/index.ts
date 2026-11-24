import { app, ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import { buildAppInfo } from '../appInfo'

// Every handler here must be read-only (docs/architecture.md). test/unit/architecture.test.ts checks channel names.
export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.getAppInfo, () =>
    buildAppInfo(app.getName(), app.getVersion(), process.platform)
  )
}
