import { describe, expect, it } from 'vitest'
import {
  applyExplorerFilters,
  DEFAULT_FILTERS,
  ERA_SLUGS,
  hasActiveFilters,
  itemShape,
  parseExplorerFilters,
  serializeExplorerFilters,
  sortExplorerList,
  type FilterableItem,
} from '@/lib/explorer-filters'
import { classifyCurveShape } from '@/lib/curve-shapes'
import { classifyEra } from '@/lib/trajectory-list'

const parse = (qs: string) => parseExplorerFilters(new URLSearchParams(qs))

const item = (over: Partial<FilterableItem> & { id: string }): FilterableItem & { id: string } => ({
  claim: 'A claim',
  hasReversal: false,
  currentAxis: 'SETTLED',
  era: 'Modern',
  domain: 'medicine',
  isCurated: true,
  emergedYear: 1990,
  transitionCount: 2,
  firstYear: 1990,
  lastYear: 2000,
  milestones: [{ axis: 'RECORDED' }, { axis: 'SETTLED' }],
  ...over,
})

describe('parse / serialize', () => {
  it('defaults to no filters and an empty query string', () => {
    expect(parse('')).toEqual(DEFAULT_FILTERS)
    expect(serializeExplorerFilters(DEFAULT_FILTERS)).toBe('')
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false)
  })

  it('round-trips every filter', () => {
    const qs = 'q=hiv&status=REVERSED&era=cold-war&domain=law&shape=flip-flop&from=1950&to=1959&curated=1&sort=span'
    const f = parse(qs)
    expect(f).toEqual({
      q: 'hiv', status: 'REVERSED', era: 'Cold War & Postwar', domain: 'law', shape: 'flip-flop',
      from: 1950, to: 1959, curated: true, sort: 'span',
    })
    expect(parse(serializeExplorerFilters(f))).toEqual(f)
  })

  it('ignores junk values', () => {
    expect(parse('status=nope&era=jurassic&domain=astrology&shape=zigzag&from=abc&to=12345&sort=random&curated=yes'))
      .toEqual(DEFAULT_FILTERS)
  })

  it('caps q at 200 characters', () => {
    expect(parse(`q=${'x'.repeat(500)}`).q).toHaveLength(200)
  })

  it('keeps non-filter params such as t', () => {
    const qs = serializeExplorerFilters({ ...DEFAULT_FILTERS, status: 'SETTLED' }, new URLSearchParams('t=continental-drift&status=REVERSED'))
    expect(new URLSearchParams(qs).get('t')).toBe('continental-drift')
    expect(new URLSearchParams(qs).get('status')).toBe('SETTLED')
  })

  it('maps every era slug to a label classifyEra produces', () => {
    // setUTCFullYear, not Date.UTC: Date.UTC maps years 0–99 to 1900–1999.
    const at = (y: number) => { const d = new Date(Date.UTC(2000, 6, 1)); d.setUTCFullYear(y); return d }
    const produced = new Set([1, 600, 1500, 1800, 1920, 1960, 2000].map((y) => classifyEra(at(y))))
    expect(new Set(Object.values(ERA_SLUGS))).toEqual(produced)
  })
})

describe('apply', () => {
  const list = [
    item({ id: 'a' }),
    item({ id: 'b', hasReversal: true, currentAxis: 'REVERSED', milestones: [{ axis: 'SETTLED' }, { axis: 'REVERSED' }], emergedYear: 1955 }),
    item({ id: 'c', isCurated: false, domain: 'politics', emergedYear: 1959, claim: 'Senate vote' }),
    item({ id: 'd', emergedYear: null, milestones: [{ axis: 'RECORDED' }] }),
  ]
  const ids = (qs: string) => applyExplorerFilters(list, parse(qs)).map((i) => i.id)

  it('from/to are inclusive and drop undated items', () => {
    expect(ids('from=1955&to=1959')).toEqual(['b', 'c'])
    expect(ids('from=1990')).toEqual(['a'])
  })

  it('curated=1 drops auto-generated items', () => {
    expect(ids('curated=1')).toEqual(['a', 'b', 'd'])
  })

  it('status, domain and q', () => {
    expect(ids('status=REVERSED')).toEqual(['b'])
    expect(ids('status=SETTLED')).toEqual(['a', 'c', 'd'])
    expect(ids('domain=politics')).toEqual(['c'])
    expect(ids('q=senate')).toEqual(['c'])
  })

  it('shape matches the /patterns classifier and skips single-point curves', () => {
    expect(itemShape(list[1])).toBe(classifyCurveShape(['SETTLED', 'REVERSED']))
    expect(itemShape(list[3])).toBeNull()
    expect(ids(`shape=${classifyCurveShape(['SETTLED', 'REVERSED'])}`)).toEqual(['b'])
  })
})

describe('sort', () => {
  const list = [
    item({ id: 'a', transitionCount: 2, firstYear: 1900, lastYear: 1950 }),
    item({ id: 'b', transitionCount: 5, firstYear: 1990, lastYear: 2000 }),
    item({ id: 'c', transitionCount: 5, firstYear: 1800, lastYear: 2010 }),
  ]
  const order = (s: Parameters<typeof sortExplorerList>[1]) => sortExplorerList(list, s).map((i) => i.id)

  it('default keeps the input order', () => {
    expect(order('default')).toEqual(['a', 'b', 'c'])
  })
  it('transitions is stable for ties', () => {
    expect(order('transitions')).toEqual(['b', 'c', 'a'])
  })
  it('span and recent', () => {
    expect(order('span')).toEqual(['c', 'a', 'b'])
    expect(order('recent')).toEqual(['c', 'b', 'a'])
  })
})
