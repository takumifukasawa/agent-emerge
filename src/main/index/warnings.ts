// Read-only warnings for skills (spec: Warnings). Pure functions over one account's skills.
import type { Skill, SkillWarning } from '@shared/model'
import type { AccountSnapshot } from '../adapters/claude-code'

/** Skill spec limit for `description` (decided in #8, 2026-11-24). */
export const DESCRIPTION_LIMIT = 1024

const SKILL_NAME = String.raw`[a-z0-9][a-z0-9_-]*(?::[a-z0-9][a-z0-9_-]*)?`
// Explicit references only, to keep false positives low:
//   Skill tool with "x" / Skill("x") / skill: "x" / use the `x` skill
const DEP_PATTERNS: RegExp[] = [
  new RegExp(String.raw`Skill tool[^\n]*?["'\`](${SKILL_NAME})["'\`]`, 'gi'),
  new RegExp(String.raw`\bSkill\(\s*["'\`]?(${SKILL_NAME})["'\`]?\s*\)`, 'g'),
  new RegExp(String.raw`\bskill:\s*["'\`](${SKILL_NAME})["'\`]`, 'gi'),
  new RegExp(String.raw`\b(?:use|invoke|call|run)s?\s+(?:the\s+)?["'\`](${SKILL_NAME})["'\`]\s+skill\b`, 'gi')
]

/** Skill names referenced explicitly in a SKILL.md body. */
export function referencedSkills(body: string): string[] {
  const out = new Set<string>()
  for (const re of DEP_PATTERNS) for (const m of body.matchAll(re)) if (m[1]) out.add(m[1].toLowerCase())
  return [...out].sort()
}

const pluginName = (s: Skill): string | null => (s.provenance.kind === 'plugin' ? (s.provenance.pluginId.split('@')[0] ?? null) : null)
const usable = (s: Skill): boolean => !(s.provenance.kind === 'plugin' && s.provenance.enabled === false)
const copyLabel = (s: Skill): string => (s.provenance.kind === 'plugin' ? `plugin ${s.provenance.pluginId}` : s.scope)

/** Names a reference can resolve to: `name`, and `plugin:name` for plugin skills. */
function availableNames(skills: Skill[]): Set<string> {
  const names = new Set<string>()
  for (const s of skills.filter(usable)) {
    names.add(s.name.toLowerCase())
    const p = pluginName(s)
    if (p) names.add(`${p}:${s.name}`.toLowerCase())
  }
  return names
}

export function skillWarnings(skill: Skill, accountSkills: Skill[]): SkillWarning[] {
  const out: SkillWarning[] = []
  if (skill.provenance.kind === 'broken-link') return [{ kind: 'broken-link', linkTarget: skill.provenance.linkTarget }]
  if (skill.frontmatterError) out.push({ kind: 'invalid-frontmatter', reason: skill.frontmatterError })
  else if (typeof skill.frontmatter?.['name'] !== 'string' || skill.frontmatter['name'] === '') out.push({ kind: 'invalid-frontmatter', reason: 'missing-name' })
  else if (skill.description === null) out.push({ kind: 'invalid-frontmatter', reason: 'missing-description' })
  if (skill.description !== null && skill.description.length > DESCRIPTION_LIMIT) {
    out.push({ kind: 'description-too-long', length: skill.description.length, limit: DESCRIPTION_LIMIT })
  }
  if (usable(skill)) {
    const others = accountSkills.filter((o) => o !== skill && usable(o) && o.name === skill.name)
    if (others.length > 0) out.push({ kind: 'name-collision', others: others.map(copyLabel) })
  }
  if (skill.body) {
    const have = availableNames(accountSkills)
    for (const ref of referencedSkills(skill.body)) {
      if (ref !== skill.name.toLowerCase() && !have.has(ref)) out.push({ kind: 'missing-dependency', skill: ref })
    }
  }
  return out
}

/** The snapshot with every skill's `warnings` filled in. */
export function withWarnings(snap: AccountSnapshot): AccountSnapshot {
  return { ...snap, skills: snap.skills.map((s) => ({ ...s, warnings: skillWarnings(s, snap.skills) })) }
}
