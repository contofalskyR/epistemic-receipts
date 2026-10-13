import { describe, expect, it } from 'vitest'
import list from '@/data/vote-results-under-review.json'
import {
  REVIEW_GROUP_LABEL,
  REVIEW_GROUP_REASON,
  reviewGroup,
  sourceLabel,
  voteviewOutcome,
  type ReviewGroup,
  type VoteviewRow,
} from '@/lib/vote-review'

const row = (over: Partial<VoteviewRow>): VoteviewRow => ({
  congress: '110', chamber: 'House', vote_result: 'Passed', majority_requirement: '1/2', ...over,
})

describe('voteviewOutcome', () => {
  it('reads what happened to the question', () => {
    expect(voteviewOutcome('Passed')).toBe('passed')
    expect(voteviewOutcome('Failed')).toBe('failed')
    expect(voteviewOutcome('Cloture Motion Rejected')).toBe('failed')
    expect(voteviewOutcome('Nomination Confirmed')).toBe('passed')
    expect(voteviewOutcome('Veto Sustained')).toBe('failed')
    expect(voteviewOutcome('Veto Overridden')).toBe('passed')
    expect(voteviewOutcome('Point of Order Not Sustained')).toBe('failed')
    expect(voteviewOutcome('Decision of Chair Sustained')).toBe('passed')
    expect(voteviewOutcome('Not Guilty')).toBe('failed')
    expect(voteviewOutcome('Pelosi')).toBe('election')
    expect(voteviewOutcome('Ryan (WI)')).toBe('election')
    expect(voteviewOutcome('')).toBeNull()
  })
})

describe('reviewGroup', () => {
  it('flags only results known to disagree', () => {
    expect(reviewGroup(row({}), 'passed')).toBeNull()
    expect(reviewGroup(row({ vote_result: 'Pelosi' }), 'passed')).toBeNull()
    expect(reviewGroup(row({ vote_result: 'Failed', majority_requirement: '2/3' }), 'passed')).toBe('house-suspension')
    expect(reviewGroup(row({ vote_result: 'Failed' }), 'passed')).toBe('contradiction')
    expect(reviewGroup(row({ vote_result: 'Agreed to' }), 'tied')).toBe('house-tie')
    expect(reviewGroup(row({ chamber: 'Senate', vote_result: 'Motion Rejected', majority_requirement: '3/5' }), 'passed')).toBe('senate-three-fifths')
    expect(reviewGroup(row({ chamber: 'Senate', vote_result: 'Veto Sustained', majority_requirement: '2/3' }), 'passed')).toBe('senate-two-thirds')
    expect(reviewGroup(row({ chamber: 'Senate', vote_result: 'Amendment Rejected' }), 'tied')).toBe('senate-tie')
    expect(reviewGroup(row({ chamber: 'Senate', vote_result: 'Decision of Chair Sustained', majority_requirement: '3/5' }), 'failed')).toBe('contradiction')
  })

  it('pre-1989 votes (no vote_result) are never flagged: finding them by text would be a guess', () => {
    const pre = row({ congress: '96', chamber: 'Senate', vote_result: '', majority_requirement: '', dtl_desc: 'TO INVOKE CLOTURE ON S. 1' })
    expect(reviewGroup(pre, 'passed')).toBeNull()
  })
})

describe('sourceLabel', () => {
  it('names the source by host', () => {
    expect(sourceLabel('https://voteview.com/rollcall/RS1050560')).toBe('Voteview')
    expect(sourceLabel('https://www.senate.gov/legislative/LIS/roll_call_votes/vote1131/vote_113_1_00203.xml')).toBe('Senate roll call')
    expect(sourceLabel('https://clerk.house.gov/evs/2013/roll023.xml')).toBe('House Clerk roll call')
    expect(sourceLabel('https://www.congress.gov/bill/113th-congress/house-bill/527')).toBe('Congress.gov')
    expect(sourceLabel('https://example.org/x')).toBe('example.org')
    expect(sourceLabel(null)).toBeNull()
    expect(sourceLabel('not a url')).toBeNull()
  })
})

describe('data/vote-results-under-review.json', () => {
  it('counts match the list, and every group has a label and a reason', () => {
    const votes = list.votes as [string, ReviewGroup][]
    const counts = list.counts as Record<ReviewGroup, number>
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(votes.length)
    expect(new Set(votes.map(([id]) => id)).size).toBe(votes.length)
    for (const [, g] of votes) {
      expect(REVIEW_GROUP_LABEL[g]).toBeTruthy()
      expect(REVIEW_GROUP_REASON[g]).toBeTruthy()
    }
  })
})
