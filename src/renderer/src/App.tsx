import { useEffect } from 'react'
import { useAppStore } from './store'

export function App() {
  const info = useAppStore((s) => s.info)
  const accounts = useAppStore((s) => s.accounts)
  const load = useAppStore((s) => s.load)
  useEffect(() => {
    void load()
  }, [load])

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>agent-emerge</h1>
      <p data-testid="app-info">{info ? `${info.name} ${info.version} (${info.platform})` : 'loading…'}</p>
      <h2>Accounts</h2>
      <ul data-testid="accounts">
        {accounts.map((a) => (
          <li key={a.id} data-testid="account" title={a.configDir} style={{ opacity: a.exists ? 1 : 0.4 }}>
            {a.displayName}
          </li>
        ))}
      </ul>
    </main>
  )
}
