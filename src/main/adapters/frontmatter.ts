import { parse } from 'yaml'

export type FrontmatterResult =
  | { ok: true; data: Record<string, unknown>; body: string }
  | { ok: false; error: 'no-frontmatter' | 'invalid-yaml'; body: string }

const FM = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function parseFrontmatter(text: string): FrontmatterResult {
  const m = FM.exec(text)
  if (!m) return { ok: false, error: 'no-frontmatter', body: text }
  const body = text.slice(m[0].length)
  try {
    const data: unknown = parse(m[1] ?? '')
    if (data === null || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'invalid-yaml', body }
    return { ok: true, data: data as Record<string, unknown>, body }
  } catch {
    return { ok: false, error: 'invalid-yaml', body }
  }
}
