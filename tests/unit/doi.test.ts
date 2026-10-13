import { describe, expect, it } from 'vitest'
import { doiLink } from '@/lib/doi'

describe('doiLink', () => {
  it('links a doi.org URL and labels it with the bare DOI', () => {
    expect(doiLink('https://doi.org/10.1038/171737a0')).toEqual({ href: 'https://doi.org/10.1038/171737a0', label: 'doi:10.1038/171737a0' })
  })
  it('accepts a bare DOI and the dx. host', () => {
    expect(doiLink('10.1126/science.1069123')?.href).toBe('https://doi.org/10.1126/science.1069123')
    expect(doiLink('http://dx.doi.org/10.1000/xyz')?.href).toBe('https://doi.org/10.1000/xyz')
  })
  it('refuses anything that is not a DOI', () => {
    expect(doiLink(null)).toBeNull()
    expect(doiLink('javascript:alert(1)')).toBeNull()
    expect(doiLink('https://evil.example/10.1/x')).toBeNull()
  })
})
