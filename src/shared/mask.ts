// Secret masking (spec: Safety). Values under a key that looks secret are hidden until the user reveals them.

const SECRET_KEY = /key|token|secret|password/i

export const MASK = '••••••••'

/** True when the last segment of a key or dotted path looks like it holds a secret. */
export function isSecretKey(keyOrPath: string): boolean {
  const last = keyOrPath.split('.').pop() ?? keyOrPath
  return SECRET_KEY.test(last)
}

/** A deep copy with every value under a secret-looking key replaced by MASK (objects and arrays under it too). */
export function maskDeep(value: unknown, parentSecret = false): unknown {
  if (Array.isArray(value)) return value.map((v) => maskDeep(v, parentSecret))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, maskDeep(v, parentSecret || isSecretKey(k))]))
  }
  return parentSecret ? MASK : value
}
