// Shared archive/date-specific editorial rules. Legacy findings remain visible.
export function checkContent(data, { date = null, candidates = null } = {}) {
  const fails = [], warns = [];
  const add = (code, msg, ids = [], legacy = false) => (legacy ? warns : fails).push({ code, msg, ids });
  const nonempty = v => typeof v === 'string' && v.trim().length > 0;
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const fields = ['mechanism', 'whyNow', 'directorPoint', 'critique'];
  const regions = new Set(['동아시아', '동남·남아시아', '중동', '아프리카', '유럽', '북미', '중남미', '오세아니아']);
  const issues = (data.issues || []).filter(i => !date || i.date === date);
  const policy = data.editorialPolicy || {};
  const legacyBefore = policy.strictFrom || '2026-10-20';
  const provenanceFrom = policy.imageProvenanceFrom || '2026-10-31';
  function item(it, legacy = false, provenance = false) {
    for (const key of ['title', 'originalTitle', 'creator', 'description', 'url']) if (!nonempty(it[key])) add('content-field', `${it.id}: missing ${key}`, [it.id]);
    if (!/^https?:\/\//.test(it.url || '') || !host(it.url)) add('source-url', `${it.id}: invalid source URL`, [it.id]);
    for (const key of fields) if (!nonempty(it.insight?.[key])) add('insight-missing', `${it.id}: missing insight.${key}`, [it.id]);
    for (const key of ['sense', 'tech', 'theme']) if (!Array.isArray(it.tags?.[key]) || !it.tags[key].length || it.tags[key].some(v => !nonempty(v))) add('tags-missing', `${it.id}: missing tags.${key}`, [it.id]);
    if (!nonempty(it.tags?.scale)) add('tags-missing', `${it.id}: missing tags.scale`, [it.id]);
    if (!it.origin || !['artistBase', 'region', 'venue'].every(k => k in it.origin)) add('origin-shape', `${it.id}: origin fields required (unknown values may be null)`, [it.id]);
    if (it.origin?.region && !regions.has(it.origin.region)) add('origin-region', `${it.id}: unknown region`, [it.id]);
    if (!it.image) add('image-null', `${it.id}: no verified artwork image`, [it.id], legacy);
    else if (!/^images\/[\w.-]+\.(jpe?g|png|webp|avif)$/i.test(it.image)) add('image-path', `${it.id}: image must be self-hosted`, [it.id]);
    if (it.grounded === false) add('source-unverified', `${it.id}: source verification pending`, [it.id], legacy);
    if (provenance && (!it.imageMeta || !['sourcePage', 'sourceUrl', 'credit', 'caption', 'checkedAt', 'usageBasis', 'alt'].every(k => nonempty(it.imageMeta[k])) || !host(it.imageMeta.sourcePage) || !host(it.imageMeta.sourceUrl) || !['artwork', 'installation', 'performance', 'film-still', 'gameplay', 'documentation'].includes(it.imageMeta.kind))) add('image-provenance', `${it.id}: verified artwork provenance required`, [it.id]);
  }
  if (candidates) { candidates.forEach(it => item(it, false, true)); return { fails, warns }; }
  for (const issue of issues) {
    const legacy = issue.date < legacyBefore, mine = issue.items || [];
    if (mine.length < 6 || mine.length > 8) add('count', `${issue.date}: ${mine.length} items (required 6–8)`, mine.map(x => x.id), legacy);
    const hosts = new Map(), rr = new Set();
    for (const it of mine) {
      item(it, legacy, issue.date >= provenanceFrom);
      const h = host(it.url); hosts.set(h, [...(hosts.get(h) || []), it.id]);
      if (it.origin?.region) rr.add(it.origin.region);
    }
    for (const [h, ids] of hosts) if (ids.length > 2) add('host-cap', `${issue.date}: ${ids.length} items from ${h} (max 2)`, ids, legacy);
    if (rr.size < 3) add('regions', `${issue.date}: ${rr.size} regions (required 3+)`, mine.map(x => x.id), legacy);
    for (let a = 0; a < mine.length; a++) for (let b = a + 1; b < mine.length; b++) {
      const titleHead = it => String(it.originalTitle || '').split(/\s[—–]\s|\s-\s/).pop().toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).slice(0, 2).join(' ');
      const h = titleHead(mine[a]);
      const sameGroup = mine[a].projectGroup && mine[a].projectGroup === mine[b].projectGroup;
      if (sameGroup || (h.length > 4 && h === titleHead(mine[b]) && mine[a].creator === mine[b].creator && mine[a].url !== mine[b].url)) add('same-project-split', `${issue.date}: related project entries need editorial review`, [mine[a].id, mine[b].id], legacy);
    }
    const focus = issue.focus;
    if (!focus || !Number.isInteger(focus.itemIndex) || !mine[focus.itemIndex]) add('focus-required', `${issue.date}: valid Focus required`, []);
    else {
      if (!nonempty(focus.headline) || !Array.isArray(focus.sections) || focus.sections.length < 4 || focus.sections.some(s => !nonempty(s.heading) || !nonempty(s.body))) add('focus-sections', `${issue.date}: Focus needs 4+ complete sections`, []);
      const src = focus.sources || [];
      if (new Set(src.map(s => s.url)).size < 2 || src.some(s => !nonempty(s.label) || !host(s.url))) add('focus-sources', `${issue.date}: Focus needs 2+ verified source URLs`, [], legacy);
    }
    const cc = issue.crosscurrent;
    if (issue.date >= '2026-09-27' && (!nonempty(cc?.note) || !Array.isArray(cc?.itemIds) || cc.itemIds.length < 2)) add('crosscurrent-required', `${issue.date}: Crosscurrent requires note and 2+ item references`, []);
    for (const id of cc?.itemIds || []) if (!mine.some(x => x.id === id)) add('crosscurrent-ref', `${issue.date}: invalid Crosscurrent ${id}`, [id]);
  }
  const all = (data.issues || []).flatMap(i => (i.items || []).filter(x => !x.revisitOf).map(x => ({ ...x, date: i.date })));
  const latest = date || data.issues?.[0]?.date;
  const recent = all.filter(x => { const d = (Date.parse(latest) - Date.parse(x.date)) / 86400000; return d >= 0 && d < 30 && x.origin?.region; });
  const counts = new Map(); recent.forEach(x => counts.set(x.origin.region, (counts.get(x.origin.region) || 0) + 1));
  for (const [r, n] of counts) if (n / recent.length > .5) add('region-share', `${latest}: ${r} exceeds 50% of known regions in 30 days`, [], latest < legacyBefore);
  return { fails, warns };
}
