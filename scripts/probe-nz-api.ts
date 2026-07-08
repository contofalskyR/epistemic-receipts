// probe-nz-api.ts — READ-ONLY probe of the PCO Legislation API v0.
// Zero DB access, zero writes. ~10 HTTP requests, throttled.
//
// Question it answers: does the API expose repeal dates anywhere —
// (a) as a field on the works list/detail endpoints, or
// (b) inside the version format documents (XML/HTML) served from the
//     API domain (which, unlike www.legislation.govt.nz, is not bot-walled)?
//
// Context: www.legislation.govt.nz returns 0 bytes to any scripted client,
// so nz-repealed-prepend.ts phase-1 page scraping can never work. This probe
// decides the replacement data path.
//
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/probe-nz-api.ts
import 'dotenv/config'

const API = 'https://api.legislation.govt.nz'
const KEY = process.env.NZ_LEGISLATION_API_KEY
if (!KEY) {
  console.error('NZ_LEGISLATION_API_KEY not set in .env.local')
  process.exit(1)
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const squash = (s: string) => s.replace(/\s+/g, ' ').trim()

async function hit(
  label: string,
  url: string,
  withKey: boolean,
  accept = 'application/json',
): Promise<{ status: number; ct: string; text: string }> {
  const headers: Record<string, string> = {
    Accept: accept,
    'User-Agent': 'EpistemicReceipts/1.0 (read-only research probe)',
  }
  if (withKey) headers['X-Api-Key'] = KEY!
  try {
    const res = await fetch(url, { headers })
    const text = await res.text()
    const ct = res.headers.get('content-type') ?? '?'
    console.log(`\n── ${label}`)
    console.log(`   GET ${url}`)
    console.log(`   key=${withKey} → HTTP ${res.status} | ${ct} | ${text.length} bytes`)
    return { status: res.status, ct, text }
  } catch (err) {
    console.log(`\n── ${label}`)
    console.log(`   GET ${url}`)
    console.log(`   key=${withKey} → FETCH ERROR: ${err instanceof Error ? err.message : String(err)}`)
    return { status: 0, ct: '', text: '' }
  }
}

function grepAround(text: string, re: RegExp, ctx = 150, max = 10): string[] {
  const out: string[] = []
  let m: RegExpExecArray | null
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  while ((m = g.exec(text)) && out.length < max) {
    const start = Math.max(0, m.index - ctx)
    out.push(squash(text.slice(start, m.index + m[0].length + ctx)))
    g.lastIndex = m.index + Math.max(1, m[0].length)
  }
  return out
}

const REPEAL_RE = /repeal|terminat|revok|expir/i

function reportRepealMentions(label: string, body: string) {
  // grep both raw (XML attributes live in tags) and tag-stripped (prose notes)
  const rawHits = grepAround(body, REPEAL_RE)
  console.log(`   [${label}] raw repeal/terminat/revok/expir mentions: ${rawHits.length === 0 ? 'NONE' : ''}`)
  rawHits.forEach((h, i) => console.log(`     ${i + 1}. …${h}…`))
  // date-shaped attributes anywhere near those words are the gold
  const dateAttrs = grepAround(body, /(date[.\w-]*terminat|terminat[^>]{0,80}?\d{4}|repeal[^>]{0,120}?\d{1,2}\s+[A-Z][a-z]+\s+\d{4}|repeal[^>]{0,120}?\d{4}-\d{2}-\d{2})/i, 80, 6)
  if (dateAttrs.length > 0) {
    console.log(`   [${label}] DATE-shaped repeal hits:`)
    dateAttrs.forEach((h, i) => console.log(`     ★ ${i + 1}. …${h}…`))
  }
}

async function main() {
  console.log('PCO Legislation API v0 — repeal-date probe (read-only)')

  // ── 1. LIST endpoint: dump one repealed work with EVERY field ────────────
  const listUrl = `${API}/v0/works/?legislation_type=act&act_type=public&act_status=repealed&act_classification=principal&per_page=2&page=1&sort_by=year_asc`
  const list = await hit('1. works LIST (repealed, oldest first)', listUrl, true)
  if (list.status !== 200) {
    console.log('\nList endpoint failed — nothing else to probe. Body head:')
    console.log('   ' + squash(list.text).slice(0, 400))
    return
  }
  let firstWork: Record<string, unknown> | undefined
  try {
    const parsed = JSON.parse(list.text) as { results?: Record<string, unknown>[]; total?: number }
    console.log(`   total repealed works: ${parsed.total}`)
    firstWork = parsed.results?.[0]
    console.log('   FULL first result (every field the API returns):')
    console.log(JSON.stringify(firstWork, null, 2))
  } catch {
    console.log('   (list body was not JSON) head: ' + squash(list.text).slice(0, 400))
    return
  }
  if (!firstWork) { console.log('   no results — abort'); return }

  const workId = String(firstWork.work_id ?? '')
  await sleep(400)

  // ── 2. DETAIL endpoints for that work ─────────────────────────────────────
  for (const variant of [
    `${API}/v0/works/${workId}`,
    `${API}/v0/works/${workId}/`,
    `${API}/v0/works/${workId}/versions/`,
    `${API}/v0/versions/?work_id=${encodeURIComponent(workId)}`,
  ]) {
    const r = await hit(`2. detail probe`, variant, true)
    if (r.status === 200) {
      const head = r.text.length <= 4000 ? r.text : r.text.slice(0, 4000) + ' …[truncated]'
      console.log('   body: ' + squash(head))
      reportRepealMentions('detail', r.text)
    } else {
      console.log('   body head: ' + squash(r.text).slice(0, 200))
    }
    await sleep(400)
  }

  // ── 3. Version FORMAT documents (the likely gold: official XML) ──────────
  const version = firstWork.latest_matching_version as
    | { title?: string; version_id?: string; formats?: Array<{ format: string; url: string }> }
    | undefined
  console.log(`\n── 3. version formats for "${version?.title ?? '?'}" (version_id=${version?.version_id ?? '?'})`)
  const formats = version?.formats ?? []
  if (formats.length === 0) console.log('   (no formats array on latest_matching_version)')
  for (const f of formats) {
    const url = f.url.startsWith('http') ? f.url : `${API}${f.url.startsWith('/') ? '' : '/'}${f.url}`
    let r = await hit(`3. format "${f.format}"`, url, true, 'application/xml, text/html, */*')
    if (r.status === 401 || r.status === 403) {
      await sleep(400)
      r = await hit(`3. format "${f.format}" (retry WITHOUT key)`, url, false, 'application/xml, text/html, */*')
    }
    if (r.status === 200 && r.text.length > 0) {
      console.log('   head: ' + squash(r.text).slice(0, 300))
      reportRepealMentions(f.format, r.text)
    }
    await sleep(400)
  }

  console.log('\nProbe complete. Read the ★ lines — those decide the build.')
}

main().catch((err) => { console.error(err); process.exit(1) })
