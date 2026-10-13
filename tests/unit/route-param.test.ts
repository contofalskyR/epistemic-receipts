import { describe, expect, it } from 'vitest'
import { getDynamicParam } from 'next/dist/shared/lib/router/utils/get-dynamic-param'
import { pageParam } from '@/lib/route-param'
import { receiptHref } from '@/lib/receipts'

const IDS = [
  'csh:trajectory:hiv-causes-aids:1',
  'd1f92e42-d06f-4a12-a05f-be95cac5a88b:retraction:1',
  'cmpiv2xip4w3iplo7djyd7ba1-SETTLED-2025-07-02',
  'csh:trajectory:cdc-blood-lead-reference-value-3.5-2021:0',
]

describe('route params', () => {
  it('Next still hands the page component an encoded param (the reason pageParam exists)', () => {
    const p = getDynamicParam({ id: 'csh:trajectory:x:1' }, 'id', 'd', null, null)
    expect(p.value).toBe('csh%3Atrajectory%3Ax%3A1')
  })

  it.each(IDS)('%s round-trips through receiptHref and pageParam', (id) => {
    const href = receiptHref(id)
    expect(href.startsWith('/receipts/')).toBe(true)
    expect(href).not.toMatch(/%3A/i)
    const segment = href.slice('/receipts/'.length)
    expect(pageParam(segment)).toBe(id)
    expect(pageParam(encodeURIComponent(id))).toBe(id)
  })

  it('pageParam leaves a malformed escape alone', () => {
    expect(pageParam('a%ZZb')).toBe('a%ZZb')
  })
})
