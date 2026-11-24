// The ONLY module that touches the filesystem, and it only reads (docs/architecture.md).
// Structural tests reject any write API in this directory.
import { lstat, readFile, readdir, readlink, realpath, stat } from 'node:fs/promises'

export type EntryKind = 'file' | 'dir' | 'symlink' | 'other'

export interface DirEntry {
  name: string
  kind: EntryKind
}

export interface PathInfo {
  exists: boolean
  /** kind of the path itself (a symlink is reported as 'symlink', not followed) */
  kind: EntryKind | null
  /** for symlinks: whether the target exists */
  targetExists?: boolean
  /** for symlinks: the raw link text */
  linkTarget?: string
}

function kindOf(st: { isFile(): boolean; isDirectory(): boolean; isSymbolicLink(): boolean }): EntryKind {
  if (st.isSymbolicLink()) return 'symlink'
  if (st.isDirectory()) return 'dir'
  if (st.isFile()) return 'file'
  return 'other'
}

export async function inspect(path: string): Promise<PathInfo> {
  try {
    const st = await lstat(path)
    const kind = kindOf(st)
    if (kind !== 'symlink') return { exists: true, kind }
    const linkTarget = await readlink(path)
    const targetExists = await stat(path).then(
      () => true,
      () => false
    )
    return { exists: true, kind, linkTarget, targetExists }
  } catch {
    return { exists: false, kind: null }
  }
}

/** Is `path` a directory, following symlinks? */
export async function isDir(path: string): Promise<boolean> {
  return stat(path).then(
    (s) => s.isDirectory(),
    () => false
  )
}

export async function isFile(path: string): Promise<boolean> {
  return stat(path).then(
    (s) => s.isFile(),
    () => false
  )
}

export async function listDir(path: string): Promise<DirEntry[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true })
    return entries.map((e) => ({ name: e.name, kind: kindOf(e) })).sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

export async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

export type JsonResult<T> = { ok: true; value: T } | { ok: false; error: 'missing' | 'invalid' }

export async function readJson<T = unknown>(path: string): Promise<JsonResult<T>> {
  const text = await readText(path)
  if (text === null) return { ok: false, error: 'missing' }
  try {
    return { ok: true, value: JSON.parse(text) as T }
  } catch {
    return { ok: false, error: 'invalid' }
  }
}

/** Real path with symlinks resolved, or null if it does not resolve. */
export async function resolveReal(path: string): Promise<string | null> {
  return realpath(path).catch(() => null)
}

export async function readBytes(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path)
  } catch {
    return null
  }
}

/**
 * Files under `dir`, as sorted forward-slash relative paths. Does not descend into symlinked dirs (no loops);
 * symlinked files are included. Skips `.git` and `.DS_Store`.
 */
export async function listFilesRecursive(dir: string, limit = 2000): Promise<string[]> {
  const out: string[] = []
  const walk = async (rel: string): Promise<void> => {
    for (const e of await listDir(rel ? `${dir}/${rel}` : dir)) {
      if (out.length >= limit) return
      if (e.name === '.git' || e.name === '.DS_Store') continue
      const childRel = rel ? `${rel}/${e.name}` : e.name
      if (e.kind === 'dir') await walk(childRel)
      else if (e.kind === 'file') out.push(childRel)
      else if (e.kind === 'symlink' && (await isFile(`${dir}/${childRel}`))) out.push(childRel)
    }
  }
  await walk('')
  return out.sort()
}
