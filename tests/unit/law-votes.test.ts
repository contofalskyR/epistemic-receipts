import { describe, expect, it } from 'vitest'
import { serializeLawVote, sortLawVotes, voteDescription, type LawVoteRow } from '@/lib/law-votes-shared'

const row = (over: Partial<LawVoteRow['fromClaim']> = {}, ctx: unknown = { autoApproved: true, humanReviewed: false }): LawVoteRow => ({
  fromClaim: {
    id: 'v1',
    text: 'The U.S. Senate voted 59-41 on "TO INVOKE CLOTURE ON HR 3385" (Congress 105, Roll Call 560, 1998-09-09) — failed.',
    claimEmergedAt: new Date('1998-09-09T00:00:00Z'),
    metadata: { chamberCode: 's', rollNumber: 560, yesCount: 59, noCount: 41, result: 'failed' },
    ...over,
  },
  followUpContext: ctx,
})

describe('voteDescription', () => {
  it('takes the quoted description, or keeps the whole text', () => {
    expect(voteDescription(row().fromClaim.text)).toBe('TO INVOKE CLOTURE ON HR 3385')
    expect(voteDescription('The U.S. House of Representatives voted on "A "quoted" title" (Congress 110, Roll Call 1)')).toBe('A "quoted" title')
    expect(voteDescription('Something else entirely')).toBe('Something else entirely')
  })
})

describe('serializeLawVote', () => {
  it('reads the vote claim metadata and the relation provenance', () => {
    expect(serializeLawVote(row())).toEqual({
      claimId: 'v1', date: '1998-09-09', chamber: 'Senate', roll: 560, tally: '59–41', result: 'failed',
      description: 'TO INVOKE CLOTURE ON HR 3385', autoApproved: true, humanReviewed: false,
    })
  })

  it('missing or malformed fields become null / false, never throw', () => {
    const v = serializeLawVote(row({ claimEmergedAt: null, metadata: null }, null))
    expect(v).toMatchObject({ date: null, chamber: null, roll: null, tally: null, result: null, autoApproved: false, humanReviewed: false })
    expect(serializeLawVote(row({}, { autoApproved: 'yes' })).autoApproved).toBe(false)
  })
})

describe('sortLawVotes', () => {
  it('oldest first, then chamber, then roll number', () => {
    const v = (claimId: string, date: string, chamber: 'House' | 'Senate', roll: number) =>
      ({ ...serializeLawVote(row()), claimId, date, chamber, roll })
    const sorted = sortLawVotes([v('c', '2000-02-01', 'Senate', 9), v('b', '2000-01-01', 'Senate', 3), v('a', '2000-01-01', 'House', 7), v('d', '2000-01-01', 'Senate', 2)])
    expect(sorted.map(x => x.claimId)).toEqual(['a', 'd', 'b', 'c'])
  })
})
