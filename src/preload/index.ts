import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels, type AgentEmergeApi } from '@shared/ipc'

const api: AgentEmergeApi = {
  getAppInfo: () => ipcRenderer.invoke(IpcChannels.getAppInfo),
  listAccounts: () => ipcRenderer.invoke(IpcChannels.listAccounts)
}

contextBridge.exposeInMainWorld('agentEmerge', api)
