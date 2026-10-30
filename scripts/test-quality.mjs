import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { checkContent } from './content-rules.mjs';
const require = createRequire(import.meta.url);
const search = require('../search.js');
assert.deepEqual(search.tokenize('빛'), ['빛']);
assert.deepEqual(search.tokenize('AI AI 거울'), ['ai', '거울']);
assert.equal(search.matchesSynonym('art', 'ar'), false);
assert.equal(search.matchesSynonym('ar', 'ar'), true);
assert.equal(search.matchesSynonym('빛으로', '빛'), true);
const makeItem = n => ({ id: `2026-10-31-0${n}`, title: `작품 ${n}`, originalTitle: `Work ${n}`, creator: `Artist ${n}`, description: 'A verified work.', url: `https://artist${n}.example/work`, host: `artist${n}.example`, image: `images/work-${n}.jpg`, grounded: true,
  insight: { mechanism: 'Mechanism', whyNow: 'Context', directorPoint: 'Direction', critique: 'Limits' },
  tags: { sense: ['시각'], tech: ['영상·필름'], theme: ['기억·아카이브'], scale: '스크린·영상' },
  origin: { artistBase: null, region: ['유럽', '북미', '동아시아'][n % 3], venue: null },
  imageMeta: { sourcePage: `https://artist${n}.example/work`, sourceUrl: `https://artist${n}.example/work.jpg`, alt: `Work ${n} official artwork still`, credit: `Artist ${n}`, caption: 'Official artwork still', kind: 'artwork', checkedAt: '2026-10-31', usageBasis: 'Official editorial preview' } });
const valid = { issues: [{ date: '2026-10-31', items: Array.from({ length: 6 }, (_, i) => makeItem(i + 1)), focus: { itemIndex: 0, headline: 'Focus', sections: Array.from({ length: 4 }, () => ({ heading: 'Analysis', body: 'Evidence and analysis' })), sources: [{ label: 'Artist', url: 'https://artist1.example/work' }, { label: 'Institution', url: 'https://museum.example/work' }] }, crosscurrent: { note: 'Connections', itemIds: ['2026-10-31-01', '2026-10-31-02'] } }] };
assert.equal(checkContent(valid).fails.length, 0);
function rejects(code, mutate) { const d = structuredClone(valid); mutate(d.issues[0]); assert(checkContent(d).fails.some(x => x.code === code), `must reject ${code}`); }
rejects('count', i => i.items.pop());
rejects('count', i => i.items.push(makeItem(7), makeItem(8), makeItem(9)));
rejects('insight-missing', i => delete i.items[0].insight.critique);
rejects('focus-required', i => delete i.focus);
rejects('focus-sources', i => i.focus.sources.pop());
rejects('focus-sections', i => i.focus.sections.pop());
rejects('image-path', i => i.items[0].image = 'https://remote.example/image.jpg');
rejects('image-provenance', i => delete i.items[0].imageMeta);
rejects('image-provenance', i => i.items[0].imageMeta.kind = 'portrait');
for (const field of ['sourcePage', 'sourceUrl', 'credit', 'caption', 'checkedAt', 'usageBasis', 'alt']) rejects('image-provenance', i => delete i.items[0].imageMeta[field]);
rejects('image-provenance', i => i.items[0].imageMeta.sourceUrl = 'not-a-url');
rejects('crosscurrent-ref', i => i.crosscurrent.itemIds.push('missing'));
rejects('host-cap', i => i.items.slice(0, 3).forEach(x => x.url = 'https://same.example/' + x.id));
const legacy = structuredClone(valid); legacy.issues[0].date = '2026-10-19'; legacy.issues[0].items.pop();
assert(checkContent(legacy).warns.some(x => x.code === 'count'));
assert(!checkContent(legacy).fails.some(x => x.code === 'count'));
console.log('Search and publication regression checks passed.');
