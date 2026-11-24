import type { Across, Skill } from '@shared/model'

export type Tone = 'plain' | 'ok' | 'diff' | 'bad' | 'off'

const base = (p: string): string => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? p

export function provenanceLabel(s: Skill): { text: string; tone: Tone } {
  const p = s.provenance
  switch (p.kind) {
    case 'local':
      return { text: 'local dir', tone: 'plain' }
    case 'symlink':
      return { text: `link → ${base(p.sourceRoot ?? p.linkTarget)}`, tone: 'plain' }
    case 'skills-cli':
      return { text: 'skills CLI', tone: 'plain' }
    case 'plugin': {
      const name = p.pluginId.split('@')[0] ?? p.pluginId
      return p.enabled === false ? { text: `plugin ${name} (disabled)`, tone: 'off' } : { text: `plugin ${name}`, tone: 'plain' }
    }
    case 'broken-link':
      return { text: 'broken link', tone: 'bad' }
  }
}

export function acrossLabel(a: Across, presentIn: string[]): { text: string; tone: Tone } {
  switch (a) {
    case 'same':
      return { text: 'same', tone: 'ok' }
    case 'differs':
      return { text: 'differs', tone: 'diff' }
    case 'unreadable':
      return { text: 'unreadable', tone: 'bad' }
    case 'single':
      return { text: presentIn.length === 1 ? `${presentIn[0]} only` : '—', tone: 'plain' }
  }
}
