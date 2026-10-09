import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  ANSWER_JSON_SCHEMA,
  MODEL_TIERS,
  PRICES,
  TARGET_SOURCE_SQL,
  buildUserPrompt,
  costOf,
  cuid,
  domainFromTag,
  extractJson,
  formatTransitionDate,
  fromFlat,
  isDisallowedHost,
  needsEscalation,
  parseAnswer,
  parsePublishedAt,
  pickBetter,
  reserveFor,
  sourceName,
  urlInResults,
  type Attempt,
  type TransitionInput,
} from '../../scripts/lib/transition-sourcing'

const root = path.resolve(__dirname, '../..')

describe('costOf', () => {
  it('prices Haiku 5.5 tokens plus $0.01 per search', () => {
    const usd = costOf('claude-haiku-5-5', {
      input_tokens: 20_000,
      output_tokens: 1_000,
      server_tool_use: { web_search_requests: 3 },
    })
    // 20k × $0.10/M + 1k × $0.50/M + 3 × $0.01
    expect(usd).toBeCloseTo(0.002 + 0.0005 + 0.03, 10)
  })

  it('switches Haiku 5.5 to its long-prompt rates past 100k prompt tokens', () => {
    const usd = costOf('claude-haiku-5-5', { input_tokens: 90_000, output_tokens: 0, cache_read_input_tokens: 20_000 })
    expect(usd).toBeCloseTo((90_000 * 0.5 + 20_000 * 0.05) / 1e6, 10)
  })

  it('prices Sonnet 5.5 and cache tokens', () => {
    const usd = costOf('claude-sonnet-5-5', {
      input_tokens: 1_000_000,
      output_tokens: 100_000,
      cache_creation_input_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
    })
    expect(usd).toBeCloseTo(2 + 1 + 2.5 + 0.1, 10)
  })

  it('has a price for every model on the ladder, and reserves more than a typical call', () => {
    for (const m of MODEL_TIERS) {
      expect(PRICES[m]).toBeDefined()
      expect(reserveFor(m, 3)).toBeGreaterThan(costOf(m, { input_tokens: 30_000, output_tokens: 3_000, server_tool_use: { web_search_requests: 3 } }))
    }
  })
})

describe('answers', () => {
  const good = {
    url: 'https://pubmed.ncbi.nlm.nih.gov/8458085/',
    title: 'A novel gene containing a trinucleotide repeat…',
    publisher: 'Cell',
    publishedAt: '1993-03-26',
    excerpt: 'x'.repeat(800),
    confidence: 1.4,
    rationale: 'y'.repeat(400),
  }

  it('extracts JSON from bare, fenced and prose-wrapped replies', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
    expect(extractJson('Here it is:\n```json\n{"a":2}\n```')).toEqual({ a: 2 })
    expect(extractJson('Found it. {"a":3} Done.')).toEqual({ a: 3 })
    expect(extractJson('no json here')).toBeNull()
    expect(extractJson('{"a":')).toBeNull()
  })

  it('caps excerpt at 500, rationale at 300 and clamps confidence to 0–1', () => {
    const r = parseAnswer(good)
    expect(r.ok).toBe(true)
    if (!r.ok || r.answer.kind !== 'source') throw new Error('expected a source answer')
    expect(r.answer.excerpt.length).toBe(500)
    expect(r.answer.rationale.length).toBe(300)
    expect(r.answer.confidence).toBe(1)
  })

  it('accepts a no-source answer and rejects malformed ones', () => {
    const n = parseAnswer({ no_source_found: true, rationale: 'nothing primary online' })
    expect(n.ok && n.answer.kind).toBe('no_source')
    expect(parseAnswer({ ...good, url: 'not a url' }).ok).toBe(false)
    expect(parseAnswer({ ...good, url: 'ftp://example.org/x' }).ok).toBe(false)
    expect(parseAnswer({ ...good, title: '' }).ok).toBe(false)
    expect(parseAnswer(null).ok).toBe(false)
  })

  it('maps the flat reformat shape back to the two answer shapes', () => {
    expect(fromFlat({ no_source_found: true, url: null, rationale: 'r' })).toEqual({ no_source_found: true, rationale: 'r' })
    expect(fromFlat({ no_source_found: false, url: null, rationale: 'r' })).toEqual({ no_source_found: true, rationale: 'r' })
    const s = fromFlat({ no_source_found: false, ...good }) as Record<string, unknown>
    expect(s.no_source_found).toBeUndefined()
    expect(parseAnswer(s).ok).toBe(true)
  })

  it('keeps the reformat schema within structured-output limits', () => {
    expect(ANSWER_JSON_SCHEMA.additionalProperties).toBe(false)
    expect([...ANSWER_JSON_SCHEMA.required].sort()).toEqual(Object.keys(ANSWER_JSON_SCHEMA.properties).sort())
    const unions = Object.values(ANSWER_JSON_SCHEMA.properties).filter((p) => Array.isArray(p.type)).length
    expect(unions).toBeLessThanOrEqual(16)
  })
})

describe('urls', () => {
  it('rules out Wikipedia and other wikis, keeps primary hosts', () => {
    expect(isDisallowedHost('https://en.wikipedia.org/wiki/Mariner_4')).toBe(true)
    expect(isDisallowedHost('https://en.m.wikipedia.org/wiki/Mariner_4')).toBe(true)
    expect(isDisallowedHost('https://www.wikiwand.com/en/Mariner_4')).toBe(true)
    expect(isDisallowedHost('https://commons.wikimedia.org/x')).toBe(true)
    expect(isDisallowedHost('nonsense')).toBe(true)
    expect(isDisallowedHost('https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1964-077A')).toBe(false)
    expect(isDisallowedHost('https://notwikipedia.org.example.com/')).toBe(false)
    expect(isDisallowedHost('https://ja.wikisource.org/wiki/%E4%BF%A1%E9%95%B7%E5%85%AC%E8%A8%98')).toBe(false)
  })

  it('matches a URL against search results across www, scheme, trailing slash and fragment', () => {
    const results = ['https://www.nature.com/articles/171737a0', 'https://example.org/page?id=7']
    expect(urlInResults('http://nature.com/articles/171737a0/', results)).toBe(true)
    expect(urlInResults('https://www.nature.com/articles/171737a0#abstract', results)).toBe(true)
    expect(urlInResults('https://example.org/page?id=7', results)).toBe(true)
    expect(urlInResults('https://example.org/page', results)).toBe(true)
    expect(urlInResults('https://www.nature.com/articles/171740a0', results)).toBe(false)
  })

  it('parses year, month and day dates, BCE-free', () => {
    expect(parsePublishedAt('1993-03-26')?.toISOString()).toBe('1993-03-26T00:00:00.000Z')
    expect(parsePublishedAt('1953-04')?.toISOString()).toBe('1953-04-01T00:00:00.000Z')
    expect(parsePublishedAt('0850')?.getUTCFullYear()).toBe(850)
    expect(parsePublishedAt('1993-13-01')).toBeNull()
    expect(parsePublishedAt('c. 1255')).toBeNull()
    expect(parsePublishedAt(null)).toBeNull()
  })
})

describe('escalation', () => {
  const src = (url: string, confidence: number) => ({
    kind: 'source' as const, url, title: 't', publisher: null, publishedAt: null, excerpt: 'e', confidence, rationale: 'r',
  })
  const at = (answer: Attempt['answer'], urlInSearchResults = true, model: Attempt['model'] = 'claude-haiku-5-5'): Attempt =>
    ({ model, answer, urlInSearchResults })

  it('escalates on no source, malformed, Wikipedia or an unseen URL — not on a usable answer at any confidence', () => {
    expect(needsEscalation(at({ kind: 'no_source', no_source_found: true, rationale: 'r' }))).toBe(true)
    expect(needsEscalation(at(null))).toBe(true)
    expect(needsEscalation(at(src('https://en.wikipedia.org/wiki/X', 0.9)))).toBe(true)
    expect(needsEscalation(at(src('https://doi.org/10.1/x', 0.9), false))).toBe(true)
    expect(needsEscalation(at(src('https://doi.org/10.1/x', 0.1)))).toBe(false)
  })

  it('also escalates low confidence when given a threshold (the pilot setting)', () => {
    expect(needsEscalation(at(src('https://doi.org/10.1/x', 0.49)), 0.5)).toBe(true)
    expect(needsEscalation(at(src('https://doi.org/10.1/x', 0.5)), 0.5)).toBe(false)
  })

  it('prefers a usable answer, then higher confidence, ties to the first pass', () => {
    const a = at(src('https://doi.org/10.1/a', 0.4))
    const b = at(src('https://doi.org/10.1/b', 0.8), true, 'claude-sonnet-5-5')
    expect(pickBetter(a, b)).toBe(b)
    expect(pickBetter(b, a)).toBe(b)
    const wiki = at(src('https://en.wikipedia.org/wiki/X', 0.95), true, 'claude-sonnet-5-5')
    expect(pickBetter(a, wiki)).toBe(a)
    const same = at(src('https://doi.org/10.1/c', 0.4), true, 'claude-sonnet-5-5')
    expect(pickBetter(a, same)).toBe(a)
    expect(pickBetter(at(null), at({ kind: 'no_source', no_source_found: true, rationale: 'r' }, false, 'claude-sonnet-5-5')).answer?.kind).toBe('no_source')
  })
})

describe('prompt', () => {
  const t: TransitionInput = {
    transitionId: 'h1', claimId: 'c1', externalId: 'trajectory:mars-canals',
    claimText: 'Mars has artificial canals.', fromAxis: 'CONTESTED', toAxis: 'REVERSED', community: 'EXPERT_LITERATURE',
    reason: 'Mariner 4 images show no canals', occurredAt: new Date('1965-07-15T04:00:00Z'), datePrecision: 'DAY',
    priorSource: { id: 's1', name: 'Mariner 4 — Wikipedia', url: 'https://en.wikipedia.org/wiki/Mariner_4' },
    claimSources: [{ name: 'Lowell, Mars (1895)', url: null, methodologyType: 'primary' }],
    domain: 'astronomy', topics: ['Planetary science'],
  }

  it('carries the claim, transition, date, current source and claim sources', () => {
    const p = buildUserPrompt(t)
    expect(p).toContain('Claim: Mars has artificial canals.')
    expect(p).toContain('Transition: CONTESTED → REVERSED')
    expect(p).toContain('Date: 1965-07-15 (precision: DAY)')
    expect(p).toContain('<https://en.wikipedia.org/wiki/Mariner_4>')
    expect(p).toContain('- [primary] Lowell, Mars (1895)')
    expect(p).toContain('topics: Planetary science')
  })

  it('formats dates to their precision, BCE included', () => {
    const d = new Date('1919-05-04T04:00:00Z')
    expect(formatTransitionDate(d, 'DAY')).toBe('1919-05-04')
    expect(formatTransitionDate(d, 'MONTH')).toBe('1919-05')
    expect(formatTransitionDate(d, 'QUARTER')).toBe('1919 Q2')
    expect(formatTransitionDate(d, 'YEAR')).toBe('1919')
    const bce = new Date(Date.UTC(2000, 0, 1)); bce.setUTCFullYear(-499)
    expect(formatTransitionDate(bce, 'YEAR')).toBe('500 BCE')
  })
})

describe('misc', () => {
  it('makes distinct 25-char cuid-shaped ids', () => {
    const ids = new Set(Array.from({ length: 2000 }, cuid))
    expect(ids.size).toBe(2000)
    for (const id of ids) expect(id).toMatch(/^c[0-9a-z]{24}$/)
  })

  it('maps curated seed tags to a domain', () => {
    expect(domainFromTag('seed:human-history-trajectories')).toBe('history')
    expect(domainFromTag('seed:medicine-trajectories')).toBe('medicine')
    expect(domainFromTag('law-settler')).toBe('law')
    expect(domainFromTag('seed-court-reversals')).toBe('law')
    expect(domainFromTag('seed:astronomy-trajectories')).toBe('astronomy')
    expect(domainFromTag('seed-trajectories')).toBe('general')
  })

  it('names a promoted source "Title — Publisher (Year)"', () => {
    expect(sourceName({ title: 'Opinion', publisher: 'Supreme Court', publishedAt: new Date('1954-05-17'), url: 'https://x' }))
      .toBe('Opinion — Supreme Court (1954)')
    expect(sourceName({ title: null, publisher: null, publishedAt: null, url: 'https://x' })).toBe('https://x')
  })

  it('targets Wikipedia-sourced and unsourced transitions only', () => {
    expect(TARGET_SOURCE_SQL).toContain('h."sourceId" IS NULL')
    expect(TARGET_SOURCE_SQL).toContain("wikipedia\\.org/")
  })

  it('writes nothing outside TransitionSourceCandidate except the promote script', () => {
    const write = /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+"(\w+)"/gi
    const tables = (f: string) => [...readFileSync(path.join(root, f), 'utf8').matchAll(write)].map((m) => m[2])
    expect(new Set(tables('scripts/source-transitions.ts'))).toEqual(new Set(['TransitionSourceCandidate']))
    expect(new Set(tables('scripts/review-transition-sources.ts'))).toEqual(new Set(['TransitionSourceCandidate']))
    expect(new Set(tables('scripts/promote-transition-sources.ts'))).toEqual(new Set(['Source', 'Edge', 'TransitionSourceCandidate']))
    expect(readFileSync(path.join(root, 'scripts/promote-transition-sources.ts'), 'utf8')).toContain('process.argv.includes("--confirm")')
  })
})
