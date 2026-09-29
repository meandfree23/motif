#!/usr/bin/env node
// MOTIF duplicate + editorial gate. No dependencies.
//
// Usage:
//   node scripts/check-dedup.mjs data.json                      # full-archive audit
//   node scripts/check-dedup.mjs data.json --new 2026-09-30     # gate for a new issue (run before commit)
//   node scripts/check-dedup.mjs data.json --candidates c.json  # pre-check research candidates
// Options:
//   --memory curator_memory.json   reads dedup_allowlist [{ "ids":[a,b], "reason":"..." }]
//   --json                         machine-readable output
// Exit code 1 when any FAIL is found. WARN never blocks.
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const dataPath = args.find((a, i) => !a.startsWith('--') && (i === 0 || !args[i - 1].startsWith('--'))) || 'data.json';
const newDate = opt('--new');
const candPath = opt('--candidates');
const memPath = opt('--memory');
const asJson = args.includes('--json');

const data = JSON.parse(readFileSync(dataPath, 'utf8'));
let allow = [];
if (memPath) { try { allow = JSON.parse(readFileSync(memPath, 'utf8')).dedup_allowlist || []; } catch { allow = []; } }
const allowed = (a, b) => allow.some(x => Array.isArray(x.ids) && x.ids.includes(a) && x.ids.includes(b));

// ---------- normalisers ----------
const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const urlKey = (u) => {
  if (!u) return '';
  try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + decodeURIComponent(x.pathname).replace(/\/+$/, '')).toLowerCase(); }
  catch { return String(u).toLowerCase(); }
};
// "Creator — Work (2024)" -> "work"; strips credit prefix, year suffix, festival prefix.
const workPart = (t) => String(t || '').split(/\s[—–]\s|\s-\s/).pop().replace(/\((19|20)\d{2}\)\s*$/, '').trim();
const workKey = (t) => { const k = norm(workPart(t)); return k.length >= 3 ? k : ''; };
const words = (t) => new Set(String(workPart(t)).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 3));
const jaccard = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; a.forEach(w => b.has(w) && n++); return n / (a.size + b.size - n); };
const creatorTokens = (c) => new Set(String(c || '').toLowerCase().normalize('NFKC').split(/[^\p{L}]+/u).filter(w => w.length >= 4 && !['studio', 'electronica', 'futurelab', 'festival', 'collective', 'corporation', 'company', 'motor', 'advanced', 'engineering'].includes(w)));
// same creator = identical normalised credit, or 2+ shared name tokens (avoids first-name-only matches)
const sameCreator = (a, b) => { if (norm(a.creator) && norm(a.creator) === norm(b.creator)) return true; const ca = creatorTokens(a.creator), cb = creatorTokens(b.creator); let n = 0; ca.forEach(w => cb.has(w) && n++); return n >= 2; };
const hostOf = (it) => (it.host || (() => { try { return new URL(it.url).hostname; } catch { return ''; } })()).replace(/^www\./, '');

// ---------- flatten ----------
const issues = data.issues || [];
const items = [];
issues.forEach(iss => (iss.items || []).forEach((it, idx) => items.push({ ...it, _date: iss.date, _idx: idx })));
const byId = new Map(items.map(i => [i.id, i]));

// Two records are the "same work" if any strong key matches, or titles are near-identical with shared creator/host.
function sameWork(a, b) {
  const why = [];
  if (a.url && urlKey(a.url) === urlKey(b.url)) why.push('url');
  const wa = workKey(a.originalTitle), wb = workKey(b.originalTitle);
  if (wa && wa === wb) why.push('originalTitle');
  const fa = norm(a.originalTitle), fb = norm(b.originalTitle);
  if (!why.includes('originalTitle') && fa.length >= 3 && fa === fb) why.push('originalTitleFull');
  const ka = workKey(a.title), kb = workKey(b.title);
  if (ka && ka === kb) why.push('koTitle');
  if (a.imageFallback && a.imageFallback === b.imageFallback) why.push('imageFallback');
  if (!why.length) {
    const j = jaccard(words(a.originalTitle), words(b.originalTitle));
    const ca = creatorTokens(a.creator), cb = creatorTokens(b.creator);
    const sharedCreator = [...ca].some(w => cb.has(w)); void sameCreator;
    if (j >= 0.6 && (sharedCreator || hostOf(a) === hostOf(b))) why.push(`fuzzyTitle(${j.toFixed(2)})`);
  }
  return why;
}
const isRevisitPair = (a, b) => a.revisitOf === b.id || b.revisitOf === a.id || (a.revisitOf && a.revisitOf === b.revisitOf);

const fails = [], warns = [];
const F = (code, msg, ids) => fails.push({ code, msg, ids });
const W = (code, msg, ids) => warns.push({ code, msg, ids });
const label = (i) => `${i.id} (${i.creator || '?'} / ${i.originalTitle || i.title})`;

// ---------- structural ----------
const seenIds = new Set();
items.forEach(i => {
  if (!i.id) F('id-missing', `item without id in ${i._date}`, []);
  else if (seenIds.has(i.id)) F('id-dup', `duplicate id ${i.id}`, [i.id]);
  else seenIds.add(i.id);
  if (i.id && !i.id.startsWith(i._date)) F('id-date', `${i.id} lives in issue ${i._date}`, [i.id]);
  if (i.revisitOf) {
    const o = byId.get(i.revisitOf);
    if (!o) F('revisit-missing', `${i.id}.revisitOf -> ${i.revisitOf} not found`, [i.id]);
    else if (o._date >= i._date) F('revisit-order', `${i.id}.revisitOf must point to an earlier item`, [i.id, o.id]);
  }
});
const dates = issues.map(i => i.date);
dates.forEach((d, k) => { if (dates.indexOf(d) !== k) F('date-dup', `issue date ${d} appears twice`, []); });
for (let k = 1; k < dates.length; k++) if (dates[k] >= dates[k - 1]) F('date-order', `issues not newest-first at ${dates[k]}`, []);

// ---------- duplicate scan ----------
function scan(targets, pool) {
  for (const a of targets) for (const b of pool) {
    if (a === b || (a.id && a.id === b.id)) continue;
    if (isRevisitPair(a, b) || allowed(a.id, b.id)) continue;
    const why = sameWork(a, b);
    if (why.length) F('dup-work', `${label(a)}  ==  ${label(b)}  [${why.join(', ')}]`, [a.id, b.id]);
  }
}

if (candPath) {
  const cands = JSON.parse(readFileSync(candPath, 'utf8'));
  const list = Array.isArray(cands) ? cands : (cands.items || []);
  list.forEach((c, n) => { c.id = c.id || `candidate-${n + 1}`; });
  scan(list, items);
  // candidates among themselves
  for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
    const why = sameWork(list[x], list[y]);
    if (why.length) F('dup-candidates', `${label(list[x])} == ${label(list[y])} [${why.join(', ')}]`, [list[x].id, list[y].id]);
  }
} else if (newDate) {
  const iss = issues.find(i => i.date === newDate);
  if (!iss) { F('issue-missing', `no issue for ${newDate}`, []); }
  else {
    const mine = items.filter(i => i._date === newDate);
    const older = items.filter(i => i._date < newDate);
    scan(mine.filter(i => !i.revisitOf), older);
    // within the same issue
    for (let x = 0; x < mine.length; x++) for (let y = x + 1; y < mine.length; y++) {
      const why = sameWork(mine[x], mine[y]);
      if (why.length) F('dup-in-issue', `${label(mine[x])} == ${label(mine[y])} [${why.join(', ')}]`, [mine[x].id, mine[y].id]);
      const head2 = (t) => String(t || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).slice(0, 2).join(' ');
      const hx = [head2(mine[x].originalTitle), head2(workPart(mine[x].originalTitle))], hy = [head2(mine[y].originalTitle), head2(workPart(mine[y].originalTitle))];
      if (!why.length && hx.some(h => h.length > 4 && hy.includes(h)) && sameCreator(mine[x], mine[y])) F('same-project-split', `${label(mine[x])} and ${label(mine[y])} look like parts of one project — publish as one item`, [mine[x].id, mine[y].id]);
    }
    // editorial rules
    const hosts = {}; mine.forEach(i => { const h = hostOf(i); hosts[h] = (hosts[h] || 0) + 1; });
    Object.entries(hosts).forEach(([h, n]) => { if (n > 2) F('host-cap', `${n} items from ${h} (max 2 per issue)`, mine.filter(i => hostOf(i) === h).map(i => i.id)); });
    const regions = new Set(mine.map(i => i.origin && i.origin.region).filter(Boolean));
    if (regions.size < 3) W('regions', `only ${regions.size} regions (target 3+)`, []);
    if (mine.length < 5) W('count', `${mine.length} items (target 5-8)`, []);
    mine.filter(i => !i.image).forEach(i => W('image-null', `${i.id} has no self-hosted image`, [i.id]));
    mine.filter(i => i.image && /^https?:/i.test(i.image)).forEach(i => F('image-hotlink', `${i.id}.image is an external URL`, [i.id]));
    const recentCreators = items.filter(i => i._date < newDate && daysBetween(newDate, i._date) <= 14);
    mine.forEach(i => { const hit = recentCreators.find(o => sameCreator(i, o)); if (hit && !i.revisitOf) W('creator-recent', `${label(i)} — same creator as ${hit.id} within 14 days`, [i.id, hit.id]); });
    // focus
    if (iss.focus) {
      const fi = (iss.items || [])[iss.focus.itemIndex];
      if (!fi) F('focus-index', `focus.itemIndex ${iss.focus.itemIndex} out of range`, []);
      else {
        const prevFocus = issues.filter(i => i.date < newDate && i.focus).map(i => ({ d: i.date, it: (i.items || [])[i.focus.itemIndex] })).filter(x => x.it);
        prevFocus.forEach(p => { const why = sameWork(fi, p.it); if (why.length) F('focus-dup', `focus ${label(fi)} already focused on ${p.d}`, [fi.id, p.it.id]); });
      }
    }
    const cc = iss.crosscurrent && iss.crosscurrent.itemIds || [];
    cc.forEach(id => { if (!mine.some(i => i.id === id)) F('crosscurrent-ref', `crosscurrent id ${id} not in issue`, [id]); });
  }
} else {
  // full audit: every pair, earlier vs later
  const sorted = [...items].sort((a, b) => (a._date + a.id).localeCompare(b._date + b.id));
  for (let x = 0; x < sorted.length; x++) scan([sorted[x]], sorted.slice(0, x));
  const focusList = issues.filter(i => i.focus).map(i => ({ d: i.date, it: (i.items || [])[i.focus.itemIndex] }));
  focusList.forEach((f, x) => { if (!f.it) F('focus-index', `focus index out of range on ${f.d}`, []); });
  for (let x = 0; x < focusList.length; x++) for (let y = x + 1; y < focusList.length; y++) {
    if (!focusList[x].it || !focusList[y].it) continue;
    if (sameWork(focusList[x].it, focusList[y].it).length) F('focus-dup', `focus on ${focusList[x].d} and ${focusList[y].d} cover the same work`, [focusList[x].it.id, focusList[y].it.id]);
  }
}
function daysBetween(a, b) { return Math.round((new Date(a) - new Date(b)) / 86400000); }

const mode = candPath ? 'candidates' : newDate ? `new:${newDate}` : 'audit';
if (asJson) console.log(JSON.stringify({ mode, ok: !fails.length, fails, warns }, null, 1));
else {
  console.log(`MOTIF check (${mode}) — ${issues.length} issues, ${items.length} items`);
  fails.forEach(f => console.log(`FAIL ${f.code}: ${f.msg}`));
  warns.forEach(w => console.log(`WARN ${w.code}: ${w.msg}`));
  console.log(fails.length ? `\n${fails.length} FAIL — do not commit.` : '\nOK — no blocking issues.');
}
process.exit(fails.length ? 1 : 0);
