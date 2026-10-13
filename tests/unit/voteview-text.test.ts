import { describe, expect, it } from 'vitest'
import { BATCH_ID, fullDescription, planFullText, textCorrection } from '../../scripts/lib/voteview-text'

const full = 'TO INVOKE CLOTURE, THEREBY LIMITING DEBATE ON HR 3385, NICARAGUAN ELECTION ASSISTANCE.'
const stored = `The U.S. Senate voted 52-42 on "${full.slice(0, 77)}..." (Congress 101, Roll Call 244, 1989-10-13) — failed.`

describe('fullDescription', () => {
  it('uses dtl_desc, then vote_desc, then vote_question, whitespace collapsed', () => {
    expect(fullDescription({ dtl_desc: '  A  B\nC ', vote_desc: 'x' })).toBe('A B C')
    expect(fullDescription({ dtl_desc: '', vote_desc: 'Vote desc', vote_question: 'q' })).toBe('Vote desc')
    expect(fullDescription({ vote_question: 'On Passage' })).toBe('On Passage')
    expect(fullDescription({})).toBe('')
  })
})

describe('planFullText', () => {
  it('restores the description and keeps everything else, including a corrected result', () => {
    const p = planFullText(stored, full)
    expect(p).toEqual({
      ok: true,
      before: stored,
      text: `The U.S. Senate voted 52-42 on "${full}" (Congress 101, Roll Call 244, 1989-10-13) — failed.`,
    })
  })

  it('matches a prefix that was cut inside a whitespace run', () => {
    const raw = 'TO TABLE  THE   AMENDMENT TO S 1, WHICH WOULD STRIKE THE PROVISION REQUIRING THAT THE REPORT BE FILED BY JUNE'
    const s = `The U.S. House of Representatives voted 210-200 on "${raw.slice(0, 77)}..." (Congress 99, Roll Call 12, 1985-02-01) — passed.`
    const p = planFullText(s, fullDescription({ dtl_desc: raw }))
    expect(p.ok && p.text.includes('TO TABLE THE AMENDMENT TO S 1, WHICH WOULD STRIKE THE PROVISION REQUIRING THAT THE REPORT BE FILED BY JUNE')).toBe(true)
  })

  it('skips instead of forcing', () => {
    const why = (s: string, f: string) => { const p = planFullText(s, f); return p.ok ? 'planned' : p.skip }
    expect(why('Something else', full)).toMatch(/shape/)
    expect(why(stored.replace('...', ''), full)).toMatch(/not truncated/)
    expect(why(stored, '')).toMatch(/no description/)
    expect(why(stored, 'A DIFFERENT DESCRIPTION ALTOGETHER THAT IS LONG ENOUGH TO PASS THE LENGTH CHECK, AND MORE TEXT')).toMatch(/does not match/)
    expect(why(stored, full.slice(0, 77))).toMatch(/no longer/)
  })

  it('records the old text with Voteview evidence', () => {
    expect(textCorrection(stored, 'https://voteview.com/rollcall/RS1010244', '2026-10-13', '2026-10-13')).toMatchObject({
      batch: BATCH_ID, field: 'text', before: { text: stored }, evidence: { url: 'https://voteview.com/rollcall/RS1010244' },
    })
  })
})
