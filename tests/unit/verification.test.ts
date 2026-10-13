import { describe, expect, it } from 'vitest'
import { isMachineVerified, isMachineVerifiedSource, MACHINE_SOURCED_TAG, MACHINE_VERIFIED_TITLE } from '@/lib/verification'

describe('isMachineVerified', () => {
  it('labels links only automated checks approved', () => {
    expect(isMachineVerified({ autoApproved: true, humanReviewed: false })).toBe(true)
  })
  it("a person's review outranks the machine label", () => {
    expect(isMachineVerified({ autoApproved: true, humanReviewed: true })).toBe(false)
  })
  it('an unapproved link is not called verified', () => {
    expect(isMachineVerified({ autoApproved: false, humanReviewed: false })).toBe(false)
  })
  it('the hover text is one line', () => {
    expect(MACHINE_VERIFIED_TITLE).not.toMatch(/\n/)
  })
})

describe('isMachineVerifiedSource', () => {
  it('labels only links the transition-sourcing pass added', () => {
    expect(MACHINE_SOURCED_TAG).toBe('claude_sourcing_v1')
    expect(isMachineVerifiedSource({ ingestedBy: 'claude_sourcing_v1', autoApproved: true, humanReviewed: false })).toBe(true)
    expect(isMachineVerifiedSource({ ingestedBy: 'voteview_v1', autoApproved: true, humanReviewed: false })).toBe(false)
    expect(isMachineVerifiedSource({ ingestedBy: 'claude_sourcing_v1', autoApproved: true, humanReviewed: true })).toBe(false)
  })
})
