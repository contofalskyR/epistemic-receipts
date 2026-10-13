import { describe, expect, it } from 'vitest'
import { topicFallbackSql } from '@/lib/topic-fallback'

const base = { name: 'Neuroscience', showDeprecated: false, party: '', leader: '', q: '', sort: 'emerged_desc', page: 1, pageSize: 20 }

describe('topicFallbackSql', () => {
  it('matches on the indexed search vector, never ILIKE on the topic name', () => {
    const { count, ids } = topicFallbackSql(base)
    for (const s of [count.text, ids.text]) {
      expect(s).toContain(`c."searchVector" @@ plainto_tsquery('english', $1)`)
      expect(s).toContain(`IS DISTINCT FROM 'DEPRECATED'`)
    }
    expect(count.values[0]).toBe('Neuroscience')
    expect(ids.text).toMatch(/ORDER BY c\."claimEmergedAt" DESC, c\.id LIMIT \$2 OFFSET \$3$/)
    expect(ids.values.slice(-2)).toEqual([20, 0])
  })

  it('binds every user value and escapes LIKE wildcards in q', () => {
    const { count, ids } = topicFallbackSql({ ...base, q: '50%_off', party: 'Labour', leader: "O'Neil", page: 3, sort: 'most_sources' })
    expect(count.sql).not.toContain('50%')
    expect(count.values).toEqual(['Neuroscience', '%50\\%\\_off%', 'Labour', "O'Neil"])
    expect(ids.values.slice(-2)).toEqual([20, 40])
    expect(ids.sql).toContain('(SELECT count(*) FROM "Edge" e WHERE e."claimId" = c.id) DESC')
  })

  it('deprecated=1 keeps only the deleted filter', () => {
    expect(topicFallbackSql({ ...base, showDeprecated: true }).count.sql).toContain('c.deleted = false')
    expect(topicFallbackSql({ ...base, showDeprecated: true }).count.sql).not.toContain('DEPRECATED')
  })
})
