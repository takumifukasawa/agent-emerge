import type { Across, MatrixRow, Skill, SkillDiff, SkillMatrix } from '@shared/model'
import type { AccountSnapshot } from '../adapters/claude-code'
import { diffSkillDirs, hashSkillDir } from './skillCompare'

/** Compare the user-scope copies of a skill name across accounts (plugin copies are shown, not compared). */
async function across(copies: Skill[]): Promise<Across> {
  if (copies.length <= 1) return 'single'
  const reals = copies.map((s) => s.realPath)
  if (reals.some((r) => r === null)) return 'unreadable'
  if (new Set(reals).size === 1) return 'same'
  const hashes = await Promise.all(reals.map((r) => hashSkillDir(r)))
  if (hashes.some((h) => h === null)) return 'unreadable'
  return new Set(hashes).size === 1 ? 'same' : 'differs'
}

export async function buildSkillMatrix(snapshots: AccountSnapshot[]): Promise<SkillMatrix> {
  const names = new Set(snapshots.flatMap((s) => s.skills.map((k) => k.name)))
  const rows: MatrixRow[] = []
  for (const name of [...names].sort()) {
    const cells: MatrixRow['cells'] = {}
    const userCopies: Skill[] = []
    for (const snap of snapshots) {
      const skills = snap.skills.filter((k) => k.name === name)
      cells[snap.account.id] = { skills }
      const user = skills.find((k) => k.scope === 'user')
      if (user) userCopies.push(user)
    }
    rows.push({ name, cells, across: await across(userCopies) })
  }
  return { accounts: snapshots.map((s) => s.account), rows }
}

/** Diff the user-scope copies of `name` in two accounts. null when either side has no readable copy. */
export async function diffSkillAcross(snapshots: AccountSnapshot[], name: string, leftId: string, rightId: string): Promise<SkillDiff | null> {
  const find = (id: string): Skill | undefined =>
    snapshots.find((s) => s.account.id === id)?.skills.find((k) => k.name === name && k.scope === 'user')
  const l = find(leftId)
  const r = find(rightId)
  if (!l?.realPath || !r?.realPath) return null
  return {
    name,
    left: { accountId: leftId, path: l.path },
    right: { accountId: rightId, path: r.path },
    files: await diffSkillDirs(l.realPath, r.realPath)
  }
}
