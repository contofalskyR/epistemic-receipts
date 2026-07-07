import { describe, it, expect } from 'vitest'
import { pipeline } from '../../pipelines/doj_fara_v1'

const MOCK_ROW = {
  termDate: '',
  fpName: 'Ukrinform',
  fpRegDate: '01/15/2020',
  country: 'Ukraine',
  regNumber: '6920',
  regDate: '11/01/2019',
  registrantName: 'CLS Strategies LLC',
  city: 'Washington',
  state: 'DC',
}

describe('doj_fara_v1 pipeline', () => {
  describe('transform', () => {
    it('builds the correct externalId', () => {
      expect(pipeline.transform(MOCK_ROW).externalId).toBe('doj_fara_6920_ukrinform')
    })

    it('builds a readable claim text with country', () => {
      const result = pipeline.transform(MOCK_ROW)
      expect(result.claim.text).toContain('CLS Strategies LLC')
      expect(result.claim.text).toContain('Ukrinform')
      expect(result.claim.text).toContain('Ukraine')
    })

    it('parses the fp registration date', () => {
      const result = pipeline.transform(MOCK_ROW)
      expect(result.claim.claimEmergedAt).toBeInstanceOf(Date)
      const d = result.claim.claimEmergedAt as Date
      expect(d.getUTCFullYear()).toBe(2020)
      expect(d.getUTCMonth()).toBe(0)
      expect(d.getUTCDate()).toBe(15)
    })

    it('falls back to registrant date when fp date is absent', () => {
      const result = pipeline.transform({ ...MOCK_ROW, fpRegDate: '' })
      const d = result.claim.claimEmergedAt as Date
      expect(d.getUTCFullYear()).toBe(2019)
    })

    it('sets claimEmergedAt to null when both dates are absent', () => {
      expect(pipeline.transform({ ...MOCK_ROW, fpRegDate: '', regDate: '' }).claim.claimEmergedAt).toBeNull()
    })

    it('uses efile.fara.gov as source URL', () => {
      const result = pipeline.transform(MOCK_ROW)
      expect(result.sources[0]!.url).toContain('efile.fara.gov')
      expect(result.sources[0]!.url).toContain('6920')
    })

    it('includes FARA metadata fields', () => {
      const result = pipeline.transform(MOCK_ROW)
      expect(result.claim.metadata?.registration_number).toBe('6920')
      expect(result.claim.metadata?.foreign_principal).toBe('Ukrinform')
      expect(result.claim.metadata?.active).toBe(true)
    })

    it('slugifies the fp name in externalId', () => {
      const result = pipeline.transform({ ...MOCK_ROW, fpName: 'Ministry of Foreign Affairs & Trade' })
      expect(result.externalId).toMatch(/^doj_fara_6920_ministry-of-foreign-affairs/)
    })
  })

  describe('validate', () => {
    it('accepts a valid row', () => {
      expect(pipeline.validate(pipeline.transform(MOCK_ROW)).ok).toBe(true)
    })

    it('rejects missing registration_number', () => {
      expect(pipeline.validate(pipeline.transform({ ...MOCK_ROW, regNumber: '' })).ok).toBe(false)
    })

    it('rejects empty claim text', () => {
      const t = pipeline.transform(MOCK_ROW)
      expect(pipeline.validate({ ...t, claim: { ...t.claim, text: '' } }).ok).toBe(false)
    })

    it('rejects missing externalId', () => {
      const t = pipeline.transform(MOCK_ROW)
      expect(pipeline.validate({ ...t, externalId: '' }).ok).toBe(false)
    })
  })
})
