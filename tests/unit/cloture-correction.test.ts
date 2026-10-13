import { describe, expect, it } from 'vitest'
import {
  BATCH_ID,
  correctedText,
  isRejectedCloture,
  planCorrection,
  sourceExternalId,
  thresholdFor,
  voteviewUrl,
  type StoredVote,
  type VoteviewRow,
} from '../../scripts/lib/cloture-correction'

// Senate roll call 560 of the 105th Congress (1998-09-09): 59–41, cloture rejected.
const vv: VoteviewRow = {
  congress: '105', chamber: 'Senate', rollnumber: '560', date: '1998-09-09',
  yea_count: '59', nay_count: '41', vote_result: 'Cloture Motion Rejected', majority_requirement: '3/5',
}
const text = 'The U.S. Senate voted 59-41 on "(THREE-FIFTHS …" (Congress 105, Roll Call 560, 1998-09-09) — passed.'
const stored: StoredVote = {
  claimId: 'cmq5l0zit5oyfsal83wd26glu', claimText: text, claimDeleted: false,
  metaResult: 'passed', metaVoteId: 'lv1', voteId: 'lv1', voteResult: 'passed', yesCount: 59, noCount: 41,
}
const plan = (v: Partial<VoteviewRow> = {}, s: Partial<StoredVote> = {}) =>
  planCorrection({ ...vv, ...v }, { ...stored, ...s }, '2026-10-12', '2026-10-12')

describe('rules', () => {
  it('recognises every rejected cloture form, Senate only', () => {
    expect(isRejectedCloture(vv)).toBe(true)
    expect(isRejectedCloture({ chamber: 'Senate', vote_result: 'Cloture on the Motion to Proceed Rejected' })).toBe(true)
    expect(isRejectedCloture({ chamber: 'Senate', vote_result: 'Cloture Motion Agreed to' })).toBe(false)
    expect(isRejectedCloture({ chamber: 'Senate', vote_result: 'Amendment Rejected' })).toBe(false)
    expect(isRejectedCloture({ chamber: 'House', vote_result: 'Cloture Motion Rejected' })).toBe(false)
  })

  it('maps majority_requirement and builds ids', () => {
    expect(thresholdFor('3/5')).toBe('three_fifths')
    expect(thresholdFor('2/3')).toBe('two_thirds')
    expect(thresholdFor('1/2')).toBe('simple_majority')
    expect(thresholdFor('')).toBeNull()
    expect(voteviewUrl(105, 560)).toBe('https://voteview.com/rollcall/RS1050560')
    expect(sourceExternalId(vv)).toBe('voteview_source_105_s_560')
  })

  it('rewrites only the trailing result', () => {
    expect(correctedText(text, 'passed')).toBe(text.replace(/ — passed\.$/, ' — failed.'))
    expect(correctedText('… 50-50 (…) — tied.', 'tied')).toBe('… 50-50 (…) — failed.')
    expect(correctedText('… — passed. Extra', 'passed')).toBeNull()
  })
})

describe('planCorrection', () => {
  it('plans the example with before, after and Voteview evidence', () => {
    const p = plan()
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.threshold).toBe('three_fifths')
    expect(p.text.endsWith(' — failed.')).toBe(true)
    expect(p.correction).toMatchObject({
      batch: BATCH_ID, date: '2026-10-12', field: 'result',
      before: { result: 'passed', text }, after: { result: 'failed' },
      evidence: { url: 'https://voteview.com/rollcall/RS1050560', vote_result: 'Cloture Motion Rejected', yea: 59, nay: 41 },
    })
  })

  it('skips instead of forcing when any guard fails', () => {
    const why = (v: Partial<VoteviewRow>, s: Partial<StoredVote> = {}) => {
      const p = plan(v, s)
      return p.ok ? 'planned' : p.skip
    }
    expect(why({ vote_result: 'Cloture Motion Agreed to' })).toMatch(/does not say/)
    expect(why({}, { claimDeleted: true })).toMatch(/deleted/)
    expect(why({}, { voteResult: 'failed', metaResult: 'failed' })).toMatch(/not passed\/tied/)
    expect(why({}, { metaResult: 'failed' })).toMatch(/metadata.result/)
    expect(why({}, { metaVoteId: 'other' })).toMatch(/legislativeVoteId/)
    expect(why({ yea_count: '58' })).toMatch(/tally/)
    expect(why({ yea_count: '60', nay_count: '40' }, { yesCount: 60, noCount: 40 })).toMatch(/60\+/)
    expect(why({ majority_requirement: '' })).toMatch(/majority_requirement/)
    expect(why({}, { claimText: 'no suffix' })).toMatch(/does not end/)
  })

  it('an already-corrected row is skipped (rerun safe)', () => {
    expect(plan({}, { voteResult: 'failed', metaResult: 'failed', claimText: text.replace('passed.', 'failed.') }).ok).toBe(false)
  })
})
