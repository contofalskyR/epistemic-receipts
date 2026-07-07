import { describe, it, expect } from 'vitest'
import { pipeline } from '../../pipelines/congress_v1'

const MOCK_BILL = {
  number: '3684',
  type: 'HR',
  congress: 117,
  title: 'Infrastructure Investment and Jobs Act',
  originChamber: 'House',
  originChamberCode: 'H',
  latestAction: { actionDate: '2021-11-15', text: 'Became Public Law No: 117-58.' },
  url: 'https://api.congress.gov/v3/bill/117/hr/3684',
}

describe('congress_v1 pipeline', () => {
  describe('transform', () => {
    it('produces the correct externalId', () => {
      const result = pipeline.transform({ bill: MOCK_BILL, congressIndex: 20 })
      expect(result.externalId).toBe('congress_law_117_hr_3684')
    })

    it('formats claim text correctly', () => {
      const result = pipeline.transform({ bill: MOCK_BILL, congressIndex: 20 })
      expect(result.claim.text).toContain('H.R. 3684')
      expect(result.claim.text).toContain('117th Congress')
      expect(result.claim.text).toContain('Infrastructure Investment and Jobs Act')
    })

    it('parses the enacted date', () => {
      const result = pipeline.transform({ bill: MOCK_BILL, congressIndex: 20 })
      expect(result.claim.claimEmergedAt).toBeInstanceOf(Date)
      expect(result.claim.claimEmergedPrecision).toBe('DAY')
      expect((result.claim.claimEmergedAt as Date).toISOString()).toContain('2021-11-15')
    })

    it('produces a source with the congress.gov url', () => {
      const result = pipeline.transform({ bill: MOCK_BILL, congressIndex: 20 })
      expect(result.sources).toHaveLength(1)
      expect(result.sources[0]!.url).toContain('congress.gov/bill/117th-congress/house-bill/3684')
    })

    it('produces a FOR edge with score 95', () => {
      const result = pipeline.transform({ bill: MOCK_BILL, congressIndex: 20 })
      expect(result.edges).toHaveLength(1)
      expect(result.edges[0]!.type).toBe('FOR')
      expect(result.edges[0]!.score).toBe(95)
    })

    it('includes topicSlugs for era and congress', () => {
      const result = pipeline.transform({ bill: MOCK_BILL, congressIndex: 20 })
      expect(result.topicSlugs).toContain('era-biden')
      expect(result.topicSlugs).toContain('congress-117th-enacted')
    })

    it('handles a bill with no latestAction date gracefully', () => {
      const bill = { ...MOCK_BILL, latestAction: { actionDate: '', text: '' } }
      const result = pipeline.transform({ bill, congressIndex: 20 })
      expect(result.claim.claimEmergedAt).toBeNull()
      expect(result.claim.claimEmergedPrecision).toBeNull()
    })
  })

  describe('validate', () => {
    it('accepts a valid transformed row', () => {
      const t = pipeline.transform({ bill: MOCK_BILL, congressIndex: 20 })
      expect(pipeline.validate(t).ok).toBe(true)
    })

    it('rejects a row with empty externalId', () => {
      const t = pipeline.transform({ bill: MOCK_BILL, congressIndex: 20 })
      const v = pipeline.validate({ ...t, externalId: '' })
      expect(v.ok).toBe(false)
      if (!v.ok) expect(v.reason).toContain('externalId')
    })

    it('rejects a row with empty claim text', () => {
      const t = pipeline.transform({ bill: MOCK_BILL, congressIndex: 20 })
      const v = pipeline.validate({ ...t, claim: { ...t.claim, text: '' } })
      expect(v.ok).toBe(false)
    })
  })
})
