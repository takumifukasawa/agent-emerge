// Comparing skill folders: content hash (identity) and per-file diff.
import { createHash } from 'node:crypto'
import { diffLines } from 'diff'
import type { DiffLine, FileDiff } from '@shared/model'
import { listFilesRecursive, readBytes } from '../fsread'

/** Stable hash of a folder: sorted relative paths + bytes. null when unreadable. */
export async function hashSkillDir(realPath: string | null): Promise<string | null> {
  if (!realPath) return null
  const files = await listFilesRecursive(realPath)
  if (files.length === 0) return null
  const h = createHash('sha256')
  for (const f of files) {
    const bytes = await readBytes(`${realPath}/${f}`)
    h.update(f).update('\0').update(String(bytes?.length ?? -1)).update('\0')
    if (bytes) h.update(bytes)
  }
  return h.digest('hex')
}

const isBinary = (b: Buffer): boolean => b.subarray(0, 8000).includes(0)

function toLines(a: string, b: string): DiffLine[] {
  const out: DiffLine[] = []
  for (const part of diffLines(a, b)) {
    const kind: DiffLine['kind'] = part.added ? 'add' : part.removed ? 'del' : 'context'
    const lines = part.value.replace(/\n$/, '').split('\n')
    for (const text of lines) out.push({ kind, text })
  }
  return out
}

export async function diffSkillDirs(left: string, right: string): Promise<FileDiff[]> {
  const [lf, rf] = await Promise.all([listFilesRecursive(left), listFilesRecursive(right)])
  const all = [...new Set([...lf, ...rf])].sort()
  const out: FileDiff[] = []
  for (const path of all) {
    const [a, b] = await Promise.all([lf.includes(path) ? readBytes(`${left}/${path}`) : null, rf.includes(path) ? readBytes(`${right}/${path}`) : null])
    if (a && !b) out.push({ path, status: 'removed' })
    else if (!a && b) out.push({ path, status: 'added' })
    else if (a && b) {
      if (a.equals(b)) out.push({ path, status: 'same' })
      else if (isBinary(a) || isBinary(b)) out.push({ path, status: 'binary-modified' })
      else out.push({ path, status: 'modified', lines: toLines(a.toString('utf8'), b.toString('utf8')) })
    }
  }
  return out
}
