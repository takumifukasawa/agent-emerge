import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels, type AgentEmergeApi } from '@shared/ipc'

const api: AgentEmergeApi = {
  getAppInfo: () => ipcRenderer.invoke(IpcChannels.getAppInfo)
}

contextBridge.exposeInMainWorld('agentEmerge', api)
