import { describe, expect, it } from 'vitest'
import { buildAppInfo } from '../../src/main/appInfo'

describe('buildAppInfo', () => {
  it('returns the given name, version and platform', () => {
    expect(buildAppInfo('agent-emerge', '0.0.0', 'darwin')).toEqual({
      name: 'agent-emerge',
      version: '0.0.0',
      platform: 'darwin'
    })
  })
})
