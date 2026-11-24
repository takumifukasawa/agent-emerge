import { useEffect } from 'react'
import { useAppStore } from './store'

export function App() {
  const info = useAppStore((s) => s.info)
  const load = useAppStore((s) => s.load)
  useEffect(() => {
    void load()
  }, [load])

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>agent-emerge</h1>
      <p data-testid="app-info">{info ? `${info.name} ${info.version} (${info.platform})` : 'loading…'}</p>
    </main>
  )
}
