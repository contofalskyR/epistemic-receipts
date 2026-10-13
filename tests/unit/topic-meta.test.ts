import { describe, expect, it } from 'vitest'
import { buildTopicMetadata } from '@/lib/topic-meta'

describe('buildTopicMetadata', () => {
  it('titles the page after the topic, with canonical and og:url', () => {
    const m = buildTopicMetadata('medicine', { name: 'Medicine', description: null, domain: 'medicine' })
    expect(m.title).toBe('Medicine — Topics — Epistemic Receipts')
    expect(m.alternates?.canonical).toBe('/topics/medicine')
    expect((m.openGraph as { url?: string }).url).toBe('/topics/medicine')
    expect(m.description).toMatch(/Medicine/)
  })
  it("uses the topic's own description when it has one", () => {
    const m = buildTopicMetadata('x', { name: 'X', description: 'About X.', domain: 'public_health' })
    expect(m.description).toBe('About X.')
  })
  it('an unknown topic is noindex', () => {
    expect(buildTopicMetadata('nope', null).robots).toEqual({ index: false })
  })
})
