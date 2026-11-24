import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels, type AgentEmergeApi } from '@shared/ipc'

const api: AgentEmergeApi = {
  getAppInfo: () => ipcRenderer.invoke(IpcChannels.getAppInfo),
  listAccounts: () => ipcRenderer.invoke(IpcChannels.listAccounts),
  getSkillMatrix: () => ipcRenderer.invoke(IpcChannels.getSkillMatrix),
  getSkillDiff: (name, l, r) => ipcRenderer.invoke(IpcChannels.getSkillDiff, name, l, r),
  getPrefs: () => ipcRenderer.invoke(IpcChannels.getPrefs),
  setDisplayName: (id, name) => ipcRenderer.invoke(IpcChannels.setDisplayName, id, name),
  setManualRoot: (kind, path, add) => ipcRenderer.invoke(IpcChannels.setManualRoot, kind, path, add),
  setCatalog: (catalog, add) => ipcRenderer.invoke(IpcChannels.setCatalog, catalog, add)
}

contextBridge.exposeInMainWorld('agentEmerge', api)
