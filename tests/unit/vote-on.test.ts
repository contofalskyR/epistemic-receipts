import { describe, expect, it } from 'vitest'
import { BATCH_ID, lawExternalId, planLink, voteviewUrl, type LawSide, type VoteSide } from '../../scripts/lib/vote-on'

describe('lawExternalId', () => {
  it('maps every Voteview spelling of a law-capable bill', () => {
    expect(lawExternalId(105, 'HR2266')).toBe('congress_law_105_hr_2266')
    expect(lawExternalId(100, 'S2527')).toBe('congress_law_100_s_2527')
    for (const b of ['HJR7', 'HJRE7', 'HJRES7']) expect(lawExternalId(97, b)).toBe('congress_law_97_hjres_7')
    for (const b of ['SJR12', 'SJRE12', 'SJRES12']) expect(lawExternalId(97, b)).toBe('congress_law_97_sjres_12')
    expect(lawExternalId(110, ' hr04040 ')).toBe('congress_law_110_hr_4040')
  })

  it('refuses bills that can never become law', () => {
    for (const b of ['HRES1', 'HRE1', 'SRES102', 'SRE4', 'SR11', 'HCONRES115', 'SCONRES6', 'HCR111', 'PN128', 'TREATYDOC98', 'H102', '', 'HR'])
      expect(lawExternalId(110, b)).toBeNull()
  })
})

describe('planLink', () => {
  const vote: VoteSide = { claimId: 'v1', deleted: false, congress: 105, chamber: 'h', roll: 431, date: '1997-09-25', billNumber: 'HR2266' }
  const law: LawSide = { claimId: 'l1', externalId: 'congress_law_105_hr_2266', deleted: false, enactedDate: '1997-10-08' }
  const why = (v: Partial<VoteSide> = {}, l: Partial<LawSide> | null = {}, existing?: string) => {
    const p = planLink({ ...vote, ...v }, l === null ? undefined : { ...law, ...l }, existing, '2026-10-13')
    return p.ok ? 'planned' : p.skip
  }

  it('plans a VOTE_ON link marked autoApproved with Voteview evidence', () => {
    const p = planLink(vote, law, undefined, '2026-10-13')
    expect(p).toMatchObject({
      ok: true, fromClaimId: 'v1', toClaimId: 'l1', year: 1997,
      context: {
        batch: BATCH_ID, autoApproved: true, humanReviewed: false,
        evidence: { url: 'https://voteview.com/rollcall/RH1050431', bill_number: 'HR2266', retrieved: '2026-10-13' },
      },
    })
    expect(voteviewUrl(101, 's', 244)).toBe('https://voteview.com/rollcall/RS1010244')
  })

  it('a vote on the enactment day itself is fine', () => {
    expect(why({ date: '1997-10-08' })).toBe('planned')
  })

  it('skips instead of forcing', () => {
    expect(why({ billNumber: '' })).toMatch(/no bill_number/)
    expect(why({ billNumber: 'HRES5' })).toMatch(/cannot become law/)
    expect(why({}, null)).toMatch(/no congress_v1 law with this number/)
    expect(why({ congress: 90, billNumber: 'HR1' }, null)).toMatch(/before the 97th/)
    expect(why({}, { externalId: 'congress_law_105_hr_1' })).toMatch(/mismatch/)
    expect(why({ deleted: true })).toMatch(/vote claim deleted/)
    expect(why({}, { deleted: true })).toMatch(/law claim deleted/)
    expect(why({}, {}, 'VOTE_ON')).toMatch(/already linked/)
    expect(why({}, {}, 'OUTCOME')).toMatch(/already related \(OUTCOME\)/)
    expect(why({ date: '' })).toMatch(/date missing/)
    expect(why({ date: '1997-10-09' })).toMatch(/after the law's enactment/)
  })
})
