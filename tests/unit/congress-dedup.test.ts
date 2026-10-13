import { describe, expect, it } from 'vitest'
import {
  BATCH_ID,
  clerkKey,
  cvChamber,
  enactedAsContext,
  planRetire,
  trackerToLawExternalId,
  type CvClaim,
  type VoteviewCandidate,
} from '../../scripts/lib/congress-dedup'

const rollUrl = 'https://www.senate.gov/legislative/LIS/roll_call_votes/vote1131/vote_113_1_00203.xml'
const cv: CvClaim = {
  id: 'cv1', externalId: 'congress_vote_senate_113_hr_527_roll203', deleted: false,
  meta: { congress: 113, chamber: 'Senate', voteDate: '2013-09-19', rollNumber: 203, yea: 97, nay: 2, billType: 'hr', billNumber: '527', rollUrl },
  edges: [{ sourceId: 'roll', url: rollUrl }],
}
const twin: VoteviewCandidate = { claimId: 'vv1', deleted: false, yea: 97, nay: 2, billNumber: 'HR527', sourceIds: ['voteview-src'] }
const why = (c: Partial<CvClaim> = {}, cands: VoteviewCandidate[] = [twin], meta: Partial<CvClaim['meta']> = {}) => {
  const p = planRetire({ ...cv, ...c, meta: { ...cv.meta, ...meta } }, cands, '2026-10-13')
  return p.ok ? 'planned' : p.skip
}

describe('keys', () => {
  it('builds the Voteview lookup key and chamber', () => {
    expect(clerkKey(113, 'Senate', '2013-09-19', 203)).toBe('113|Senate|2013-09-19|203')
    expect(cvChamber('Senate')).toBe('Senate')
    expect(cvChamber('House')).toBe('House')
  })
  it('maps tracker bills to laws, never resolutions', () => {
    expect(trackerToLawExternalId('congress_bill_tracker_119_hr_5371')).toBe('congress_law_119_hr_5371')
    expect(trackerToLawExternalId('congress_bill_tracker_119_sjres_7')).toBe('congress_law_119_sjres_7')
    expect(trackerToLawExternalId('congress_bill_tracker_119_hres_7')).toBeNull()
  })
  it('ENACTED_AS carries the same machine provenance as VOTE_ON', () => {
    expect(enactedAsContext('t', 'l')).toMatchObject({ batch: BATCH_ID, autoApproved: true, humanReviewed: false })
  })
})

describe('planRetire', () => {
  it('retires onto the twin and carries the official roll source over', () => {
    const p = planRetire(cv, [twin], '2026-10-13')
    expect(p).toMatchObject({
      ok: true, cvClaimId: 'cv1', survivorId: 'vv1', rollSourceId: 'roll', addEdge: true,
      retired: { batch: BATCH_ID, date: '2026-10-13', survivor: 'vv1' },
    })
  })

  it('does not add the edge twice', () => {
    const p = planRetire(cv, [{ ...twin, sourceIds: ['roll'] }], '2026-10-13')
    expect(p.ok && p.addEdge).toBe(false)
  })

  it('accepts Voteview spellings of the same bill', () => {
    expect(why({}, [{ ...twin, billNumber: 'HJR7' }], { billType: 'hjres', billNumber: '7' })).toBe('planned')
  })

  it('skips instead of forcing', () => {
    expect(why({ deleted: true })).toMatch(/already deleted/)
    expect(why({}, [])).toMatch(/no Voteview row/)
    expect(why({}, [twin, twin])).toMatch(/several/)
    expect(why({}, [{ ...twin, yea: 50, nay: 50 }], { yea: 51, nay: 50 })).toMatch(/tally differs/)
    expect(why({}, [{ ...twin, billNumber: 'HR528' }])).toMatch(/bill number differs/)
    expect(why({}, [{ ...twin, deleted: true }])).toMatch(/twin is deleted/)
    expect(why({}, [twin], { rollUrl: undefined })).toMatch(/no official roll URL/)
    expect(why({ edges: [] })).toMatch(/found 0/)
  })
})
