(function () {
  document.getElementById('yearSpan').textContent = new Date().getFullYear();

  const main = document.getElementById('mainContent');
  const navButtons = Array.from(document.querySelectorAll('[data-view-nav]'));
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const logoBtn = document.getElementById('logoBtn');

  let DATA = { issues: [] };
  let SIGNALS = { signals: [] };
  let TOOLKIT = { cards: [] };
  let SOURCES = { sources: [] };
  let ITEMS = [];           // flat list of all items (with _issue, _id)
  let ITEM_BY_ID = {};

  const REGIONS = ['동아시아', '동남·남아시아', '중동', '아프리카', '유럽', '북미', '중남미', '오세아니아'];
  const FACETS = [
    { key: 'region', label: '권역' },
    { key: 'sense', label: '감각' },
    { key: 'tech', label: '기술' },
    { key: 'theme', label: '주제' },
    { key: 'scale', label: '스케일' }
  ];
  const INSIGHT_FIELDS = [
    ['mechanism', '작동 원리'],
    ['whyNow', '왜 지금'],
    ['directorPoint', '연출 포인트'],
    ['critique', '한계와 질문']
  ];

  let state = { view: 'latest', date: null, params: new URLSearchParams() };

  function safePush(url) { try { history.pushState({}, '', url); } catch (e) { /* data:/file: origins */ } }

  function fmtDate(dateStr, long) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    return long ? `${y}. ${m}. ${d}.` : `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
  }

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------- data helpers ----------
  function itemTags(item) {
    const t = item.tags || {};
    const o = item.origin || {};
    return {
      region: o.region ? [o.region] : [],
      sense: t.sense || [],
      tech: t.tech || [],
      theme: t.theme || [],
      scale: t.scale ? [t.scale] : []
    };
  }

  function indexData() {
    ITEMS = []; ITEM_BY_ID = {};
    DATA.issues.forEach(issue => {
      (issue.items || []).forEach((it, i) => {
        it._id = it.id || `${issue.date}-${String(i + 1).padStart(2, '0')}`;
        it._issue = issue;
        it._index = i;
        ITEMS.push(it);
        ITEM_BY_ID[it._id] = it;
      });
    });
  }

  function daysBetween(a, b) { return Math.round((new Date(a) - new Date(b)) / 86400000); }
  function latestDate() { return DATA.issues[0] ? DATA.issues[0].date : null; }
  function itemsWithin(days, offset) {
    const ref = latestDate(); if (!ref) return [];
    const o = offset || 0;
    return ITEMS.filter(it => { const d = daysBetween(ref, it._issue.date); return d >= o && d < o + days; });
  }

  // ---------- images ----------
  function imageOrFallback(item, eager) {
    const host = esc(item.host || '');
    const src = item.image ? esc(item.image) : '';
    const fb = item.imageFallback ? esc(item.imageFallback) : '';
    if (!src) return `<div class="image-fallback"><span>${host}</span></div>`;
    return `<img src="${src}" data-fallback="${fb}" data-host="${host}" data-step="0" alt="" referrerpolicy="no-referrer" decoding="async" loading="${eager ? 'eager' : 'lazy'}" onerror="window.__motifImgError && window.__motifImgError(this)"/>`;
  }

  window.__motifImgError = function (img) {
    const step = Number(img.getAttribute('data-step') || '0');
    const fb = img.getAttribute('data-fallback') || '';
    const cur = img.getAttribute('src') || '';
    const bust = (u) => u + (u.includes('?') ? '&' : '?') + 'r=' + Date.now();
    if (step === 0 && fb && fb !== cur) { img.setAttribute('data-step', '1'); img.src = fb; return; }
    if (step <= 1 && cur) { img.setAttribute('data-step', '2'); img.src = bust(cur.split('?')[0]); return; }
    const host = img.getAttribute('data-host') || '';
    img.parentElement.innerHTML = '<div class="image-fallback"><span>' + host + '</span></div>';
  };

  // ---------- shared fragments ----------
  function renderStoryMeta(item) {
    const o = item.origin || {};
    const place = o.artistBase || '';
    return `<p class="story-meta"><span>${esc(item.creator || '')}</span>${item.publishedAt ? `<time>${esc(fmtDate(item.publishedAt))}</time>` : ''}${place ? `<span class="meta-origin">${esc(place)}</span>` : ''}</p>`;
  }

  function tagChip(facet, value, extra) {
    return `<button type="button" class="tag-chip${extra ? ' ' + extra : ''}" data-go-explore="${esc(facet)}:${esc(value)}">${esc(value)}</button>`;
  }

  function renderTags(item) {
    const t = itemTags(item);
    const chips = [];
    if (t.region[0]) chips.push(tagChip('region', t.region[0], 'region-chip'));
    ['theme', 'tech', 'sense', 'scale'].forEach(k => t[k].forEach(v => chips.push(tagChip(k, v))));
    return chips.length ? `<div class="tag-row">${chips.join('')}</div>` : '';
  }

  function renderInsightList(item) {
    const ins = item.insight;
    if (!ins) return '';
    return `<dl class="insight-list">${INSIGHT_FIELDS.filter(([k]) => ins[k]).map(([k, label]) => `
      <div class="insight-row insight-${k}"><dt>${label}</dt><dd>${esc(ins[k])}</dd></div>`).join('')}</dl>`;
  }

  function renderInsight(item) {
    if (!item.insight) return '';
    return `<details class="insight-toggle"><summary><span>Insight</span><i>작동 원리 · 왜 지금 · 연출 포인트 · 한계</i></summary>${renderInsightList(item)}</details>`;
  }

  function renderLeadStory(item) {
    return `
      <article class="lead-story" id="item-${esc(item._id)}">
        <a class="lead-image" href="${esc(item.url)}" target="_blank" rel="noreferrer" aria-label="${esc(item.title)} 원문 보기">
          ${imageOrFallback(item, true)}
        </a>
        <div class="lead-copy">
          <p class="source-name">${esc(item.host || '')}</p>
          <h2><a href="${esc(item.url)}" target="_blank" rel="noreferrer">${esc(item.title)}</a></h2>
          ${item.originalTitle ? `<p class="original-title">${esc(item.originalTitle)}</p>` : ''}
          ${renderStoryMeta(item)}
          ${item.description ? `<p class="story-description">${esc(item.description)}</p>` : ''}
          ${renderTags(item)}
          <a class="read-link" href="${esc(item.url)}" target="_blank" rel="noreferrer">View original</a>
        </div>
      </article>
      ${item.insight ? `<section class="lead-insight">${renderInsightList(item)}</section>` : ''}`;
  }

  function renderStoryCard(item, opts) {
    const o = opts || {};
    return `
      <article class="story-card" id="item-${esc(item._id)}">
        <a class="story-image" href="${esc(item.url)}" target="_blank" rel="noreferrer" aria-label="${esc(item.title)} 원문 보기">
          ${imageOrFallback(item)}
        </a>
        <div class="story-copy">
          <p class="source-name">${esc(item.host || '')}${o.showDate && item._issue ? ` · ${esc(fmtDate(item._issue.date))}` : ''}</p>
          <h2><a href="${esc(item.url)}" target="_blank" rel="noreferrer">${esc(item.title)}</a></h2>
          ${item.originalTitle ? `<p class="original-title">${esc(item.originalTitle)}</p>` : ''}
          ${renderStoryMeta(item)}
          ${item.description ? `<p class="story-description">${esc(item.description)}</p>` : ''}
          ${o.why ? `<p class="match-why">${esc(o.why)}</p>` : ''}
          ${renderTags(item)}
          ${renderInsight(item)}
        </div>
      </article>`;
  }

  function compactItem(item, note) {
    if (!item) return '';
    const o = item.origin || {};
    return `
      <button type="button" class="compact-item" data-go-item="${esc(item._id)}">
        <div class="compact-thumb">${item.image ? `<img src="${esc(item.image)}" data-fb="${esc(item.imageFallback || '')}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="if(this.dataset.fb&&this.src!==this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb='';}else{this.remove();}"/>` : ''}</div>
        <div class="compact-copy">
          <strong>${esc(item.title)}</strong>
          <small>${esc(item.creator || '')}${o.artistBase ? ` · ${esc(o.artistBase)}` : ''}${item._issue ? ` · ${esc(fmtDate(item._issue.date))}` : ''}</small>
          ${note ? `<em>${esc(note)}</em>` : ''}
        </div>
      </button>`;
  }

  function sectionHead(kicker, title, lede) {
    return `<header class="page-title"><p>${esc(kicker)}</p><h1 title="${esc(title)}">${esc(title)}</h1></header>${lede ? `<p class="view-lede">${esc(lede)}</p>` : ''}`;
  }

  function regionCounts(items) {
    const c = {}; REGIONS.forEach(r => c[r] = 0);
    items.forEach(it => { const r = it.origin && it.origin.region; if (r && c[r] !== undefined) c[r]++; });
    return c;
  }

  function issueTerrain(items) {
    const rc = regionCounts(items);
    const regions = Object.entries(rc).filter(([, n]) => n > 0);
    if (!regions.length) return '';
    const hosts = new Set(items.map(i => i.host));
    return `<div class="issue-terrain"><span>오늘의 지형</span><p>${regions.map(([r, n]) => `<button type="button" data-go-explore="region:${esc(r)}">${esc(r)} ${n}</button>`).join('')}<i>권역 ${regions.length} · 출처 ${hosts.size}</i></p></div>`;
  }

  // ---------- Latest / issue ----------
  function findIssue(date) {
    if (date) return DATA.issues.find(i => i.date === date);
    return DATA.issues[0];
  }
  function focusItem(issue) {
    if (!issue || !issue.focus) return null;
    return (issue.items || [])[issue.focus.itemIndex] || null;
  }

  function renderIssueView(date, labelOverride) {
    const issue = findIssue(date);
    if (!issue) {
      main.innerHTML = `<section class="issue-view">${sectionHead('Latest', 'Media Art')}<div class="empty-state"><p>표시할 항목이 없습니다.</p></div></section>`;
      return;
    }
    const items = issue.items || [];
    const label = labelOverride || fmtDate(issue.date, true);
    const fi = focusItem(issue);
    const cc = issue.crosscurrent;
    main.innerHTML = `
      <section class="issue-view">
        <header class="page-title">
          <p>${esc(label)}</p>
          <h1 title="${esc(issue.title)}">${esc(issue.title)}</h1>
        </header>
        ${issue.summary ? `<p class="view-lede">${esc(issue.summary)}</p>` : ''}
        ${issueTerrain(items)}
        ${issue.focus && fi ? `
          <a href="#" class="focus-banner" data-open-focus="${esc(issue.date)}">
            <span>Focus</span>
            <strong>${esc(issue.focus.headline || fi.title)}</strong>
            <em>${esc(fi.title)} · 심층 읽기 →</em>
          </a>` : ''}
        ${cc && cc.note ? `
          <div class="crosscurrent">
            <span>Crosscurrent</span>
            <p>${esc(cc.note)}</p>
            <div class="compact-list">${(cc.itemIds || []).map(id => compactItem(ITEM_BY_ID[id])).join('')}</div>
          </div>` : ''}
        ${items.length ? `
          ${renderLeadStory(items[0])}
          <div class="story-grid">
            ${items.slice(1).map(it => renderStoryCard(it)).join('')}
          </div>
        ` : '<div class="empty-state"><p>표시할 항목이 없습니다.</p></div>'}
      </section>`;
  }

  // ---------- Archive ----------
  function renderArchiveView() {
    const issues = DATA.issues;
    main.innerHTML = `
      <section class="archive-view">
        <header class="page-title"><p>MOTIF · ${issues.length} issues · ${ITEMS.length} works</p><h1>Archive</h1></header>
        <div class="archive-list">
          ${issues.map((issue, i) => `
            <button type="button" data-go-issue="${esc(issue.date)}">
              <span>${String(i + 1).padStart(2, '0')}</span>
              <strong>${esc(fmtDate(issue.date, true))}</strong>
              <em>${esc(issue.title || 'Media Art')}</em>
            </button>`).join('')}
        </div>
      </section>`;
  }

  // ---------- Focus ----------
  function renderFocusView() {
    const issues = DATA.issues.filter(i => focusItem(i));
    main.innerHTML = `
      <section class="focus-archive focus-index">
        <header>
          <p>Focus</p>
          <h2>매일의 리서치 가운데 한 작업을 골라 깊게 읽는다. 왜 지금 이 작업인지, 매체가 어떻게 작동하는지, 어떤 계보 위에 있는지, 그리고 연출자가 가져갈 수 있는 것은 무엇인지.</h2>
        </header>
        ${issues.length ? `<div class="focus-archive-list">
          ${issues.map((issue, i) => { const it = focusItem(issue); return `
            <button type="button" data-open-focus="${esc(issue.date)}">
              <span>${String(i + 1).padStart(2, '0')}</span>
              <time>${esc(fmtDate(issue.date, true))}</time>
              <div class="focus-archive-image">${it.image ? `<img src="${esc(it.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML='<i>${esc(it.host || '')}</i>'"/>` : `<i>${esc(it.host || '')}</i>`}</div>
              <div class="focus-archive-copy">
                <strong>${esc(it.title)}</strong>
                <em>${esc(issue.focus.headline || '')}</em>
              </div>
              <small>${esc(it.creator || '')}</small>
              <b>→</b>
            </button>`; }).join('')}
        </div>` : '<div class="empty-state"><p>아직 작성된 Focus가 없습니다.</p></div>'}
      </section>`;
  }

  function similarity(a, b) {
    const ta = itemTags(a), tb = itemTags(b);
    let s = 0;
    ['theme', 'tech', 'sense', 'scale'].forEach(k => {
      const w = k === 'theme' ? 3 : k === 'tech' ? 2 : 1;
      ta[k].forEach(v => { if (tb[k].includes(v)) s += w; });
    });
    return s;
  }

  function relatedItems(item, n) {
    const myRegion = item.origin && item.origin.region;
    return ITEMS.filter(o => o !== item && o.tags)
      .map(o => ({ o, s: similarity(item, o) + ((o.origin && o.origin.region && o.origin.region !== myRegion) ? 1.5 : 0) }))
      .filter(x => x.s >= 4)
      .sort((a, b) => b.s - a.s)
      .slice(0, n || 4)
      .map(x => x.o);
  }

  function sharedTagsNote(a, b) {
    const ta = itemTags(a), tb = itemTags(b);
    const shared = [];
    ['theme', 'tech', 'sense'].forEach(k => ta[k].forEach(v => { if (tb[k].includes(v)) shared.push(v); }));
    const r = b.origin && b.origin.region;
    return (shared.length ? '공유 · ' + shared.slice(0, 3).join(', ') : '') + (r ? ` · ${r}` : '');
  }

  function toolkitCard(c) {
    const src = ITEM_BY_ID[c.fromItem];
    return `
      <article class="tool-card">
        <p class="tool-cat">${esc(c.category || '')}</p>
        <h3>${esc(c.name)}</h3>
        <p class="tool-how">${esc(c.how)}</p>
        ${c.useWhen ? `<p class="tool-when"><b>쓸 때</b>${esc(c.useWhen)}</p>` : ''}
        ${c.risk ? `<p class="tool-risk"><b>주의</b>${esc(c.risk)}</p>` : ''}
        ${src ? `<button type="button" class="tool-from" data-open-focus="${esc(src._issue.date)}">출처 · ${esc(src.title)} →</button>` : ''}
      </article>`;
  }

  function renderFocusArticle(date) {
    const issue = findIssue(date);
    const it = focusItem(issue);
    if (!it) { renderFocusView(); return; }
    const f = issue.focus;
    const lineage = f.lineage || [];
    const related = relatedItems(it, 4);
    const tools = (TOOLKIT.cards || []).filter(c => c.fromItem === it._id);
    main.innerHTML = `
      <section class="issue-view focus-article">
        <header class="page-title">
          <p>Focus · ${esc(fmtDate(issue.date, true))}</p>
          <h1 title="${esc(f.headline || it.title)}">${esc(f.headline || it.title)}</h1>
        </header>
        <article class="lead-story">
          <a class="lead-image" href="${esc(it.url)}" target="_blank" rel="noreferrer" aria-label="${esc(it.title)} 원문 보기">
            ${imageOrFallback(it, true)}
          </a>
          <div class="lead-copy">
            <p class="source-name">${esc(it.host || '')}</p>
            <h2><a href="${esc(it.url)}" target="_blank" rel="noreferrer">${esc(it.title)}</a></h2>
            ${it.originalTitle ? `<p class="original-title">${esc(it.originalTitle)}</p>` : ''}
            ${renderStoryMeta(it)}
            ${it.description ? `<p class="story-description">${esc(it.description)}</p>` : ''}
            ${(f.keywords && f.keywords.length) ? `<p class="focus-keywords">${f.keywords.map(k => `<span>${esc(k)}</span>`).join('')}</p>` : ''}
            ${renderTags(it)}
            <a class="read-link" href="${esc(it.url)}" target="_blank" rel="noreferrer">View original</a>
          </div>
        </article>
        <div class="focus-sections">
          ${(f.sections || []).map((s, i) => `
            <section class="focus-section">
              <p class="focus-section-index">${String(i + 1).padStart(2, '0')}</p>
              <h3>${esc(s.heading)}</h3>
              <p>${esc(s.body)}</p>
            </section>`).join('')}
        </div>
        ${it.insight && it.insight.critique ? `
        <div class="focus-critique"><span>한계와 질문</span><p>${esc(it.insight.critique)}</p></div>` : ''}
        ${lineage.length ? `
        <section class="lineage">
          <header><p>Lineage</p><h2>이 작업이 놓인 계보</h2></header>
          <ol>${lineage.map(l => `
            <li><time>${esc(l.year || '이전')}</time><strong>${esc(l.name)}</strong><p>${esc(l.relation || '')}</p></li>`).join('')}
            <li class="lineage-now"><time>${esc((issue.date).slice(0, 4))}</time><strong>${esc(it.title)}</strong><p>${esc(it.creator || '')}</p></li>
          </ol>
        </section>` : ''}
        ${tools.length ? `
        <section class="focus-tools">
          <header><p>Toolkit</p><h2>이 글에서 꺼낸 연출 도구</h2></header>
          <div class="tool-grid">${tools.map(toolkitCard).join('')}</div>
        </section>` : ''}
        ${related.length ? `
        <section class="related">
          <header><p>Connections</p><h2>아카이브 속 연결</h2></header>
          <div class="compact-list">${related.map(r => compactItem(r, sharedTagsNote(it, r))).join('')}</div>
        </section>` : ''}
        <footer class="feature-source">
          <div>
            <p>Sources</p>
            ${(f.sources || []).map(s => `<p><a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.label || s.url)}</a></p>`).join('')}
          </div>
          <p><a href="#" data-go-issue="${esc(issue.date)}">이 날의 전체 리서치 보기 →</a></p>
        </footer>
      </section>`;
  }

  // ---------- Signals ----------
  function tagRadar() {
    const recent = itemsWithin(14, 0), prev = itemsWithin(14, 14);
    const count = (items) => { const c = {}; items.forEach(it => { const t = itemTags(it); ['theme', 'tech', 'sense'].forEach(k => t[k].forEach(v => { const key = k + ':' + v; c[key] = (c[key] || 0) + 1; })); }); return c; };
    const cr = count(recent), cp = count(prev);
    const rn = Math.max(recent.length, 1), pn = Math.max(prev.length, 1);
    return Object.keys(cr).map(k => ({ k, n: cr[k], share: cr[k] / rn, delta: cr[k] / rn - (cp[k] || 0) / pn }))
      .filter(x => x.n >= 3 && x.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 8);
  }

  function renderSignalsView(id) {
    const list = SIGNALS.signals || [];
    if (id) {
      const s = list.find(x => x.id === id);
      if (s) { renderSignalArticle(s); return; }
    }
    const radar = tagRadar();
    main.innerHTML = `
      <section class="signals-view">
        ${sectionHead('Signals', '작업들 사이에서 움직이는 것', '하나의 작업이 아니라 여러 권역의 작업이 같은 방향을 가리킬 때 그것을 신호로 기록한다. 각 신호는 아카이브 속 실제 작업을 근거로 삼는다.')}
        ${list.length ? `<div class="signal-list">${list.map((s, i) => `
          <button type="button" class="signal-row" data-go-signal="${esc(s.id)}">
            <span>${String(i + 1).padStart(2, '0')}</span>
            <div><strong>${esc(s.title)}</strong><em>${esc(s.thesis)}</em></div>
            <small>${(s.evidence || []).length} works<br/>${esc((s.regions || []).join(' · '))}</small>
            <b>→</b>
          </button>`).join('')}</div>` : '<div class="empty-state"><p>아직 기록된 신호가 없습니다.</p></div>'}
        ${radar.length ? `
        <section class="radar">
          <header><p>Tag radar · 최근 14일</p><h2>직전 14일보다 비중이 커진 태그</h2></header>
          <div class="radar-bars">${radar.map(r => { const [facet, v] = r.k.split(':'); return `
            <button type="button" data-go-explore="${esc(facet)}:${esc(v)}">
              <span>${esc(v)}</span>
              <i style="--w:${Math.round(r.share * 100)}%"></i>
              <em>${r.n}건 · +${Math.round(r.delta * 100)}%p</em>
            </button>`; }).join('')}</div>
          <p class="radar-note">자동 집계. 최근 14일 작업 중 해당 태그가 붙은 비율과 직전 14일 대비 변화다. 해석은 위 신호 글에서 다룬다.</p>
        </section>` : ''}
      </section>`;
  }

  function renderSignalArticle(s) {
    const ev = (s.evidence || []).map(e => ({ it: ITEM_BY_ID[e.itemId], note: e.note })).filter(x => x.it);
    const pair = s.contrastPair;
    main.innerHTML = `
      <section class="signal-article">
        <header class="page-title"><p>Signal · ${esc(s.period || '')}</p><h1 title="${esc(s.title)}">${esc(s.title)}</h1></header>
        <p class="signal-thesis">${esc(s.thesis)}</p>
        <div class="signal-body">${(s.body || []).map(p => `<p>${esc(p)}</p>`).join('')}</div>
        ${pair && pair.a && ITEM_BY_ID[pair.a] && ITEM_BY_ID[pair.b] ? `
        <section class="contrast-pair">
          <header><p>Contrast pair</p><h2>다른 권역, 같은 질문</h2></header>
          <div class="pair-grid">
            ${compactItem(ITEM_BY_ID[pair.a])}
            <span class="pair-vs">↔</span>
            ${compactItem(ITEM_BY_ID[pair.b])}
          </div>
          <p class="pair-note">${esc(pair.note || '')}</p>
        </section>` : ''}
        <section class="related">
          <header><p>Evidence</p><h2>근거가 된 작업 ${ev.length}편</h2></header>
          <div class="compact-list">${ev.map(x => compactItem(x.it, x.note)).join('')}</div>
        </section>
        ${s.directorTakeaway ? `<div class="focus-critique takeaway"><span>디렉터에게</span><p>${esc(s.directorTakeaway)}</p></div>` : ''}
        ${s.watchNext ? `<div class="focus-critique"><span>다음에 볼 것</span><p>${esc(s.watchNext)}</p></div>` : ''}
        <footer class="feature-source"><p><a href="#" data-go-view="signals">모든 신호 보기 →</a></p></footer>
      </section>`;
  }

  // ---------- Explore ----------
  function parseFilters() {
    const f = {};
    state.params.getAll('f').forEach(x => { const i = x.indexOf(':'); if (i > 0) { const k = x.slice(0, i), v = x.slice(i + 1); (f[k] = f[k] || []).push(v); } });
    return f;
  }
  function matchesFilters(it, f) {
    const t = itemTags(it);
    return Object.keys(f).every(k => f[k].every(v => (t[k] || []).includes(v)));
  }
  function filterHref(f) {
    const p = new URLSearchParams(); p.set('view', 'explore');
    Object.keys(f).forEach(k => f[k].forEach(v => p.append('f', k + ':' + v)));
    return '?' + p.toString();
  }

  function renderExploreView() {
    const f = parseFilters();
    const pool = ITEMS.filter(it => it.tags || it.origin);
    const results = pool.filter(it => matchesFilters(it, f));
    const active = Object.keys(f).flatMap(k => f[k].map(v => ({ k, v })));
    const facetHtml = FACETS.map(({ key, label }) => {
      const c = {};
      results.forEach(it => itemTags(it)[key].forEach(v => c[v] = (c[v] || 0) + 1));
      const entries = Object.entries(c).sort((a, b) => b[1] - a[1]);
      if (!entries.length) return '';
      return `<div class="facet"><p>${label}</p><div>${entries.map(([v, n]) => {
        const on = (f[key] || []).includes(v);
        return `<button type="button" class="facet-chip${on ? ' on' : ''}" data-toggle-filter="${esc(key)}:${esc(v)}">${esc(v)} <i>${n}</i></button>`;
      }).join('')}</div></div>`;
    }).join('');
    main.innerHTML = `
      <section class="explore-view">
        ${sectionHead('Explore', active.length ? active.map(a => a.v).join(' + ') : '축으로 읽는 아카이브', '권역, 감각, 기술, 주제, 스케일을 겹쳐서 작업을 찾는다. 여러 개를 고르면 모두 만족하는 작업만 남는다.')}
        <div class="explore-layout">
          <aside class="facets">
            ${active.length ? `<button type="button" class="facet-clear" data-clear-filters="1">필터 모두 해제</button>` : ''}
            ${facetHtml}
          </aside>
          <div class="explore-results">
            <p class="result-count">${results.length}개 작업${pool.length < ITEMS.length ? ` · 태그 미부여 ${ITEMS.length - pool.length}개 제외` : ''}</p>
            <div class="story-grid compact-grid">${results.slice(0, 60).map(it => renderStoryCard(it, { showDate: true })).join('')}</div>
            ${results.length > 60 ? `<p class="result-count">상위 60개만 표시. 필터를 더 좁혀 보세요.</p>` : ''}
          </div>
        </div>
      </section>`;
  }

  // ---------- World ----------
  function renderWorldView() {
    const all = ITEMS.filter(it => it.origin && it.origin.region);
    const recent = itemsWithin(14, 0).filter(it => it.origin && it.origin.region);
    const ca = regionCounts(all), cr = regionCounts(recent);
    const maxA = Math.max(1, ...Object.values(ca));
    const topShare = recent.length ? Math.max(...Object.values(cr)) / recent.length : 0;
    const hostC = {}; itemsWithin(14, 0).forEach(it => hostC[it.host] = (hostC[it.host] || 0) + 1);
    const topHost = Object.entries(hostC).sort((a, b) => b[1] - a[1])[0];
    const gaps = REGIONS.filter(r => cr[r] === 0);
    const srcBy = {}; (SOURCES.sources || []).forEach(s => (srcBy[s.region] = srcBy[s.region] || []).push(s));
    main.innerHTML = `
      <section class="world-view">
        ${sectionHead('World', '어디에서 온 작업을 읽고 있는가', 'MOTIF는 한 페스티벌의 목록이 아니라 세계의 미디어아트를 읽으려 한다. 아래 수치는 작가의 주 활동 권역 기준이며, 편향을 스스로 점검하기 위해 공개한다.')}
        <div class="world-stats">
          <div><span>권역 태그가 붙은 작업</span><strong>${all.length}</strong><em>전체 ${ITEMS.length}</em></div>
          <div><span>최근 14일 최대 권역 비중</span><strong>${Math.round(topShare * 100)}%</strong><em>목표 50% 이하</em></div>
          <div><span>최근 14일 최다 출처</span><strong>${topHost ? topHost[1] : 0}</strong><em>${esc(topHost ? topHost[0] : '')}</em></div>
          <div><span>최근 14일 공백 권역</span><strong>${gaps.length}</strong><em>${esc(gaps.join(', ') || '없음')}</em></div>
        </div>
        <div class="region-bars">
          ${REGIONS.map(r => `
            <button type="button" data-go-explore="region:${esc(r)}">
              <span>${esc(r)}</span>
              <i style="--w:${Math.round(ca[r] / maxA * 100)}%"></i>
              <em>${ca[r]} <small>최근 14일 ${cr[r]}</small></em>
            </button>`).join('')}
        </div>
        <section class="source-radar">
          <header><p>Source radar</p><h2>권역별로 살피는 출처 ${(SOURCES.sources || []).length}곳</h2></header>
          ${SOURCES.rule ? `<p class="radar-note">편집 원칙 · ${esc(SOURCES.rule)}</p>` : ''}
          <div class="source-cols">
            ${[...REGIONS, '글로벌'].filter(r => srcBy[r]).map(r => `
              <div class="source-col${gaps.includes(r) ? ' gap' : ''}">
                <p>${esc(r)}${gaps.includes(r) ? ' <i>우선 탐색</i>' : ''}</p>
                ${srcBy[r].map(s => `<a href="${esc(s.url)}" target="_blank" rel="noreferrer"><strong>${esc(s.name)}</strong><small>${esc(s.place || '')} · ${esc(s.type || '')}</small></a>`).join('')}
              </div>`).join('')}
          </div>
        </section>
      </section>`;
  }

  // ---------- Toolkit ----------
  function renderToolkitView() {
    const cards = TOOLKIT.cards || [];
    const cat = state.params.get('cat');
    const cats = [...new Set(cards.map(c => c.category).filter(Boolean))];
    const shown = cat ? cards.filter(c => c.category === cat) : cards;
    main.innerHTML = `
      <section class="toolkit-view">
        ${sectionHead('Toolkit', '작업에서 꺼낸 연출 도구', 'Focus의 디렉터 노트에서 반복해 쓸 수 있는 수법만 뽑아 카드로 정리했다. 각 카드는 출처가 된 작업으로 돌아간다.')}
        <div class="tool-cats">
          <button type="button" class="facet-chip${!cat ? ' on' : ''}" data-go-toolcat="">전체 <i>${cards.length}</i></button>
          ${cats.map(c => `<button type="button" class="facet-chip${cat === c ? ' on' : ''}" data-go-toolcat="${esc(c)}">${esc(c)} <i>${cards.filter(x => x.category === c).length}</i></button>`).join('')}
        </div>
        ${shown.length ? `<div class="tool-grid">${shown.map(toolkitCard).join('')}</div>` : '<div class="empty-state"><p>아직 정리된 도구가 없습니다.</p></div>'}
      </section>`;
  }

  // ---------- Brief search ----------
  const SYN = {
    'ai': ['생성AI', '머신러닝·비전', 'AI·저자성'], '인공지능': ['생성AI', 'AI·저자성'],
    '소리': ['청각', '공간음향'], '사운드': ['청각', '공간음향'], '음악': ['청각', '공간음향', '라이브퍼포먼스'],
    '빛': ['라이트·LED', '프로젝션'], '조명': ['라이트·LED'], '맵핑': ['프로젝션'], '매핑': ['프로젝션'],
    '몸': ['신체·움직임', '신체·정체성'], '신체': ['신체·움직임', '신체·정체성'], '춤': ['신체·움직임', '라이브퍼포먼스'], '무용': ['신체·움직임', '라이브퍼포먼스'],
    '손': ['촉각', '손·웨어러블'], '냄새': ['후각·미각'], '향': ['후각·미각'], '맛': ['후각·미각'],
    '몰입': ['방·설치', '공간감', '공간음향'], '공간': ['공간감', '방·설치'], '도시': ['도시·공공공간', '도시·공동체'], '파사드': ['건축·파사드'], '건축': ['건축·파사드'],
    '자연': ['비인간·생태', '기후·환경'], '생태': ['비인간·생태'], '동물': ['비인간·생태'], '식물': ['비인간·생태', '바이오·생물'], '기후': ['기후·환경'], '환경': ['기후·환경'],
    '기억': ['기억·아카이브'], '로봇': ['로보틱스', '인간-기계 관계'], '기계': ['키네틱·기계장치', '인간-기계 관계'],
    '게임': ['놀이·게임', '실시간그래픽·게임엔진'], '놀이': ['놀이·게임'], '인터랙션': ['센서·인터랙션'], '인터랙티브': ['센서·인터랙션'], '참여': ['센서·인터랙션', '도시·공동체'],
    'vr': ['XR·AR·VR'], 'ar': ['XR·AR·VR'], 'xr': ['XR·AR·VR'], '데이터': ['데이터·시각화'], '감시': ['권력·감시'], '치유': ['돌봄·치유'], '돌봄': ['돌봄·치유'],
    '광고': ['스크린·영상', '건축·파사드', '도시·공공공간'], '영상': ['영상·필름', '스크린·영상'], '필름': ['영상·필름'], '웨어러블': ['웨어러블', '손·웨어러블'], '패션': ['웨어러블', '신체·정체성'],
    '한국': ['동아시아'], '일본': ['동아시아'], '중국': ['동아시아'], '아시아': ['동아시아', '동남·남아시아'], '아프리카': ['아프리카'], '남미': ['중남미'], '중동': ['중동'], '유럽': ['유럽'], '미국': ['북미'], '캐나다': ['북미'], '호주': ['오세아니아']
  };

  function briefSearch(q) {
    const tokens = q.toLowerCase().split(/[\s,.;·/]+/).filter(Boolean);
    const expanded = new Set();
    tokens.forEach(t => Object.keys(SYN).forEach(k => { if (t === k || (k.length >= 2 && t.includes(k))) SYN[k].forEach(v => expanded.add(v)); }));
    const score = (it) => {
      let s = 0; const why = new Set();
      const t = itemTags(it);
      const allTags = [...t.region, ...t.sense, ...t.tech, ...t.theme, ...t.scale];
      allTags.forEach(v => {
        const lv = v.toLowerCase();
        if (expanded.has(v) || tokens.some(tok => tok.length >= 2 && lv.includes(tok))) { s += 3; why.add(v); }
      });
      const ins = it.insight || {};
      const text = [ins.directorPoint, ins.mechanism].join(' ').toLowerCase();
      const base = [it.title, it.originalTitle, it.creator, it.description, ins.whyNow, (it.origin || {}).artistBase].join(' ').toLowerCase();
      tokens.forEach(tok => { if (tok.length < 2) return; if (text.includes(tok)) { s += 2; why.add('"' + tok + '"'); } else if (base.includes(tok)) { s += 1; why.add('"' + tok + '"'); } });
      return { s, why: [...why].slice(0, 4) };
    };
    const works = ITEMS.map(it => Object.assign({ it }, score(it))).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
    const tools = (TOOLKIT.cards || []).map(c => {
      const hay = [c.name, c.how, c.useWhen, c.category, (c.tags || []).join(' ')].join(' ').toLowerCase();
      let s = 0; tokens.forEach(tok => { if (tok.length >= 2 && hay.includes(tok)) s += 2; }); (c.tags || []).forEach(v => { if (expanded.has(v)) s += 2; });
      return { c, s };
    }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 6);
    const sigs = (SIGNALS.signals || []).filter(sg => {
      const hay = [sg.title, sg.thesis, (sg.tags || []).join(' ')].join(' ').toLowerCase();
      return tokens.some(tok => tok.length >= 2 && hay.includes(tok)) || (sg.tags || []).some(v => expanded.has(v));
    });
    return { works, tools, sigs };
  }

  function renderBriefView(q) {
    const { works, tools, sigs } = briefSearch(q);
    const regionSpread = new Set(works.slice(0, 12).map(w => w.it.origin && w.it.origin.region).filter(Boolean));
    main.innerHTML = `
      <section class="brief-view">
        ${sectionHead('Brief', q || 'Brief', `키워드나 짧은 브리프(예: "촉각 몰입 공간", "AI 도시 파사드", "사운드 먼저 가는 영상")로 아카이브를 찾는다. 태그, 연출 포인트, 작동 원리를 함께 읽어 순위를 매긴다.${works.length ? ` 상위 12개 결과의 권역 ${regionSpread.size}곳.` : ''}`)}
        ${sigs.length ? `<section class="related"><header><p>Signals</p><h2>관련 신호</h2></header><div class="signal-list">${sigs.map((s, i) => `
          <button type="button" class="signal-row" data-go-signal="${esc(s.id)}"><span>${String(i + 1).padStart(2, '0')}</span><div><strong>${esc(s.title)}</strong><em>${esc(s.thesis)}</em></div><small></small><b>→</b></button>`).join('')}</div></section>` : ''}
        ${tools.length ? `<section class="focus-tools"><header><p>Toolkit</p><h2>꺼내 쓸 연출 도구</h2></header><div class="tool-grid">${tools.map(x => toolkitCard(x.c)).join('')}</div></section>` : ''}
        ${works.length ? `
          <p class="result-count">${works.length}개 작업이 걸렸다. 상위 24개.</p>
          <div class="story-grid compact-grid">${works.slice(0, 24).map(w => renderStoryCard(w.it, { showDate: true, why: w.why.length ? '매칭 · ' + w.why.join(', ') : '' })).join('')}</div>`
          : '<div class="empty-state"><p>맞는 작업이 없습니다. 감각(촉각, 청각), 기술(AI, 프로젝션), 주제(기후, 기억) 같은 단어로 다시 찾아보세요.</p></div>'}
      </section>`;
  }

  // ---------- routing ----------
  function setActiveNav() {
    navButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-view-nav') === state.view));
  }

  function render() {
    setActiveNav();
    const p = state.params;
    switch (state.view) {
      case 'archive': renderArchiveView(); break;
      case 'focus': if (state.date) renderFocusArticle(state.date); else renderFocusView(); break;
      case 'signals': renderSignalsView(p.get('id')); break;
      case 'explore': renderExploreView(); break;
      case 'world': renderWorldView(); break;
      case 'toolkit': renderToolkitView(); break;
      case 'brief': renderBriefView(p.get('q') || ''); break;
      default: renderIssueView(state.date, state.date ? null : 'Latest');
    }
  }

  function initFromUrl() {
    const params = new URLSearchParams(location.search);
    const view = params.get('view');
    state.params = params;
    state.date = params.get('date') || null;
    state.view = ['archive', 'focus', 'signals', 'explore', 'world', 'toolkit', 'brief'].includes(view) ? view : 'latest';
    if (state.view === 'brief' && params.get('q')) searchInput.value = params.get('q');
  }

  function go(search, scrollTarget) {
    safePush(location.pathname + search);
    initFromUrl();
    render();
    if (scrollTarget) {
      const el = document.getElementById(scrollTarget);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800); return; }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navButtons.forEach(b => b.addEventListener('click', () => {
    const v = b.getAttribute('data-view-nav');
    go(v === 'latest' ? '' : '?view=' + v);
  }));
  logoBtn.addEventListener('click', () => go(''));
  window.addEventListener('popstate', () => { initFromUrl(); render(); });

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (!q) return;
    go('?view=brief&q=' + encodeURIComponent(q));
  });

  main.addEventListener('click', (e) => {
    const el = e.target.closest('[data-go-explore],[data-toggle-filter],[data-clear-filters],[data-go-item],[data-go-issue],[data-open-focus],[data-go-signal],[data-go-view],[data-go-toolcat]');
    if (!el || !main.contains(el)) return;
    e.preventDefault();
    const splitKV = (raw) => { const i = raw.indexOf(':'); return [raw.slice(0, i), raw.slice(i + 1)]; };
    if (el.hasAttribute('data-go-explore')) { const [k, v] = splitKV(el.getAttribute('data-go-explore')); go(filterHref({ [k]: [v] })); return; }
    if (el.hasAttribute('data-toggle-filter')) {
      const [k, v] = splitKV(el.getAttribute('data-toggle-filter'));
      const f = parseFilters(); f[k] = f[k] || [];
      if (f[k].includes(v)) f[k] = f[k].filter(x => x !== v); else f[k].push(v);
      if (!f[k].length) delete f[k];
      go(filterHref(f)); return;
    }
    if (el.hasAttribute('data-clear-filters')) { go('?view=explore'); return; }
    if (el.hasAttribute('data-go-item')) {
      const it = ITEM_BY_ID[el.getAttribute('data-go-item')]; if (!it) return;
      go('?date=' + it._issue.date, 'item-' + it._id); return;
    }
    if (el.hasAttribute('data-go-issue')) { go('?date=' + el.getAttribute('data-go-issue')); return; }
    if (el.hasAttribute('data-open-focus')) { go('?view=focus&date=' + el.getAttribute('data-open-focus')); return; }
    if (el.hasAttribute('data-go-signal')) { go('?view=signals&id=' + encodeURIComponent(el.getAttribute('data-go-signal'))); return; }
    if (el.hasAttribute('data-go-view')) { go('?view=' + el.getAttribute('data-go-view')); return; }
    if (el.hasAttribute('data-go-toolcat')) { const c = el.getAttribute('data-go-toolcat'); go('?view=toolkit' + (c ? '&cat=' + encodeURIComponent(c) : '')); return; }
  });

  // Unique query string busts the GitHub Pages CDN cache (max-age=600), not just the browser cache.
  const bust = '?v=' + Date.now();
  const getJson = (u, fb) => fetch(u + bust, { cache: 'no-store' }).then(r => r.ok ? r.json() : fb).catch(() => fb);
  Promise.all([
    fetch('./data.json' + bust, { cache: 'no-store' }).then(r => r.json()),
    getJson('./signals.json', { signals: [] }),
    getJson('./toolkit.json', { cards: [] }),
    getJson('./sources.json', { sources: [] })
  ]).then(([data, sig, tk, src]) => {
    DATA = data; SIGNALS = sig || { signals: [] }; TOOLKIT = tk || { cards: [] }; SOURCES = src || { sources: [] };
    indexData();
    initFromUrl();
    render();
  }).catch(err => {
    main.innerHTML = `<section class="issue-view">${sectionHead('Latest', 'Media Art')}<div class="empty-state"><p>데이터를 불러오지 못했습니다.</p></div></section>`;
    console.error(err);
  });
})();
