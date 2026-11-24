import type { AgentEmergeApi } from '../shared/ipc'

declare global {
  interface Window {
    agentEmerge: AgentEmergeApi
  }
}
