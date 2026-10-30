import { readFileSync } from 'node:fs';
const [dp = 'data.json', sp = 'signals.json', tp = 'toolkit.json'] = process.argv.slice(2);
const data = JSON.parse(readFileSync(dp, 'utf8'));
const signals = JSON.parse(readFileSync(sp, 'utf8'));
const toolkit = JSON.parse(readFileSync(tp, 'utf8'));
const items = new Map(data.issues.flatMap(i => i.items).map(x => [x.id, x]));
const fails = [], add = (code, id, detail) => fails.push({ code, id, detail });
const nonempty = x => typeof x === 'string' && x.trim();
const seen = new Set();
for (const s of signals.signals || []) {
  if (seen.has(s.id)) add('signal-id', s.id, 'duplicate ID'); seen.add(s.id);
  for (const key of ['title', 'thesis', 'directorTakeaway', 'watchNext']) if (!nonempty(s[key])) add('signal-content', s.id, key);
  if (!Array.isArray(s.body) || !s.body.length || s.body.some(x => !nonempty(x))) add('signal-body', s.id, 'missing body');
  const ids = (s.evidence || []).map(e => e.itemId), creators = new Set(ids.filter(id => items.has(id)).map(id => items.get(id).creator));
  if (new Set(ids).size < 5 || creators.size < 3) add('signal-evidence', s.id, 'requires 5 works and 3 creators');
  if (new Set(ids).size !== ids.length) add('signal-evidence', s.id, 'duplicate evidence');
  for (const e of s.evidence || []) if (!items.has(e.itemId) || !nonempty(e.note)) add('signal-ref', s.id, e.itemId);
  for (const k of ['a', 'b']) if (!items.has(s.contrastPair?.[k])) add('signal-contrast', s.id, k);
}
seen.clear();
for (const c of toolkit.cards || []) {
  if (seen.has(c.id)) add('toolkit-id', c.id, 'duplicate ID'); seen.add(c.id);
  for (const key of ['name', 'category', 'how', 'useWhen', 'risk']) if (!nonempty(c[key])) add('toolkit-content', c.id, key);
  if (!items.has(c.fromItem)) add('toolkit-ref', c.id, c.fromItem);
  if (!Array.isArray(c.tags) || !c.tags.length) add('toolkit-tags', c.id, 'missing tags');
}
console.log(JSON.stringify({ ok: !fails.length, signals: signals.signals?.length, toolkit: toolkit.cards?.length, fails }, null, 2));
process.exitCode = fails.length ? 1 : 0;
