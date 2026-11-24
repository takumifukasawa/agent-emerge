import type { Across, CatalogState, HarnessProject, Skill, SkillWarning, Source } from '@shared/model'

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

/** Short text for a matrix chip, and a longer one for the detail pane. */
export function warningLabel(w: SkillWarning): { chip: string; detail: string; tone: Tone } {
  switch (w.kind) {
    case 'broken-link':
      return { chip: 'broken link', detail: `Symlink target does not exist: ${w.linkTarget}`, tone: 'bad' }
    case 'invalid-frontmatter': {
      const why = {
        'missing-file': 'SKILL.md is missing',
        'no-frontmatter': 'SKILL.md has no frontmatter',
        'invalid-yaml': 'frontmatter is not valid YAML',
        'missing-name': 'frontmatter has no name',
        'missing-description': 'frontmatter has no description'
      }[w.reason]
      return { chip: 'bad frontmatter', detail: `Invalid frontmatter: ${why}`, tone: 'bad' }
    }
    case 'missing-dependency':
      return { chip: `needs ${w.skill}`, detail: `Calls skill "${w.skill}", which is not installed in this account`, tone: 'bad' }
    case 'name-collision':
      return { chip: 'name collision', detail: `Same name as: ${w.others.join(', ')}`, tone: 'diff' }
    case 'description-too-long':
      return { chip: 'long description', detail: `Description is ${w.length} characters (limit ${w.limit})`, tone: 'diff' }
  }
}

/** Sidebar badge for Sources: unpushed commits first, else sources with uncommitted changes. */
export function sourcesBadge(sources: Source[] | null): { text: string; tone: Tone } {
  if (!sources) return { text: '', tone: 'plain' }
  const unpushed = sources.reduce((n, s) => n + (s.git?.unpushed ?? 0), 0)
  if (unpushed > 0) return { text: `${unpushed} unpushed`, tone: 'diff' }
  const dirty = sources.filter((s) => (s.git?.uncommitted ?? 0) > 0).length
  if (dirty > 0) return { text: `${dirty} uncommitted`, tone: 'diff' }
  return { text: String(sources.length), tone: 'plain' }
}

/** Sidebar badge for Harness projects: drifted files across all projects. */
export function harnessBadge(projects: HarnessProject[] | null): { text: string; tone: Tone } {
  if (!projects) return { text: '', tone: 'plain' }
  const drifted = projects.reduce((n, p) => n + (p.drift?.length ?? 0), 0)
  return drifted > 0 ? { text: `${drifted} drifted`, tone: 'bad' } : { text: String(projects.length), tone: 'plain' }
}

export function catalogStateLabel(s: CatalogState): { text: string; tone: Tone } {
  switch (s) {
    case 'not-installed':
      return { text: 'in catalog, not installed', tone: 'plain' }
    case 'installed':
      return { text: 'in catalog, installed', tone: 'ok' }
    case 'differs':
      return { text: 'catalog version differs', tone: 'diff' }
  }
}
