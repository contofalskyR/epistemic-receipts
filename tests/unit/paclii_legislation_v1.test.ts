import { describe, it, expect } from 'vitest'
import { pipeline } from '../../pipelines/paclii_legislation_v1'

const MOCK_ACT = {
  countryCode: 'fj',
  countryName: 'Fiji',
  slug: 'employment-relations-act',
  timestamp: '20230615120000',
  originalUrl: 'https://www.paclii.org/fj/legis/consol_act/employment-relations-act/',
  title: 'Employment Relations Act',
  year: 2007,
}

describe('paclii_legislation_v1 pipeline', () => {
  describe('transform', () => {
    it('produces the correct externalId', () => {
      expect(pipeline.transform(MOCK_ACT).externalId).toBe('paclii_fj_employment-relations-act')
    })

    it('builds a grammatical claim text', () => {
      expect(pipeline.transform(MOCK_ACT).claim.text).toBe('Fiji enacted the Employment Relations Act.')
    })

    it('sets claimEmergedAt to Jan 1 of the enactment year', () => {
      const result = pipeline.transform(MOCK_ACT)
      expect(result.claim.claimEmergedAt).toBeInstanceOf(Date)
      expect(result.claim.claimEmergedPrecision).toBe('YEAR')
      const d = result.claim.claimEmergedAt as Date
      expect(d.getUTCFullYear()).toBe(2007)
      expect(d.getUTCMonth()).toBe(0)
      expect(d.getUTCDate()).toBe(1)
    })

    it('builds a Wayback URL for the source', () => {
      const result = pipeline.transform(MOCK_ACT)
      expect(result.sources[0]!.url).toContain('web.archive.org/web/20230615120000')
      expect(result.sources[0]!.url).toContain('paclii.org')
    })

    it('uses CITES edge type', () => {
      expect(pipeline.transform(MOCK_ACT).edges[0]!.type).toBe('CITES')
    })

    it('assigns the country parliament topic slug', () => {
      expect(pipeline.transform(MOCK_ACT).topicSlugs).toContain('fj-parliament')
    })

    it('handles null year gracefully', () => {
      const result = pipeline.transform({ ...MOCK_ACT, year: null })
      expect(result.claim.claimEmergedAt).toBeNull()
      expect(result.claim.claimEmergedPrecision).toBeNull()
    })
  })

  describe('validate', () => {
    it('accepts a complete valid act', () => {
      expect(pipeline.validate(pipeline.transform(MOCK_ACT)).ok).toBe(true)
    })

    it('rejects an act with empty title (Wayback fetch failed)', () => {
      const v = pipeline.validate(pipeline.transform({ ...MOCK_ACT, title: '' }))
      expect(v.ok).toBe(false)
    })

    it('rejects missing externalId', () => {
      const t = pipeline.transform(MOCK_ACT)
      expect(pipeline.validate({ ...t, externalId: '' }).ok).toBe(false)
    })
  })
})
