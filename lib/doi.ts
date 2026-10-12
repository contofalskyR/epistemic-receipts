// A DOI as a link: stored values are "https://doi.org/10.…" (626 of 658 canon
// papers; the rest have none). A bare "10.…" is accepted too; anything else is
// not linked.

export function doiLink(doi: string | null | undefined): { href: string; label: string } | null {
  if (!doi) return null;
  const bare = doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  if (!/^10\.\d{4,9}\/\S+$/.test(bare)) return null;
  return { href: `https://doi.org/${bare}`, label: `doi:${bare}` };
}
