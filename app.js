(function () {
  document.getElementById('yearSpan').textContent = new Date().getFullYear();
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const main = document.getElementById('mainContent');
  const navButtons = Array.from(document.querySelectorAll('[data-view-nav]'));
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const logoBtn = document.getElementById('logoBtn');
  const boardBtn = document.getElementById('boardBtn');
  const progress = document.getElementById('readProgress');

  let DATA = { issues: [] };
  let SIGNALS = { signals: [] };
  let TOOLKIT = { cards: [] };
  let SOURCES = { sources: [] };
  let ITEMS = [];
  let ITEM_BY_ID = {};

  const REGIONS = ['동아시아', '동남·남아시아', '중동', '아프리카', '유럽', '북미', '중남미', '오세아니아'];
  const FACETS = [
    { key: 'region', label: '권역' }, { key: 'sense', label: '감각' }, { key: 'tech', label: '기술' },
    { key: 'theme', label: '주제' }, { key: 'scale', label: '스케일' }
  ];
  const INSIGHT_FIELDS = [['mechanism', '작동 원리'], ['whyNow', '왜 지금'], ['directorPoint', '연출 포인트'], ['critique', '한계와 질문']];
  const VIEWS = ['archive', 'focus', 'signals', 'explore', 'world', 'toolkit', 'brief', 'item', 'board'];
  const BRIEF_EXAMPLES = ['촉각 몰입 공간', 'AI 거울', '도시 파사드 프로젝션', '사운드 먼저 가는 영상', '비인간 감각', '기억 아카이브 인터랙션'];

  let state = { view: 'latest', date: null, params: new URLSearchParams() };

  // ---------- local memory (visit, read, board) ----------
  const LS = {
    get(k, fb) { try { const v = localStorage.getItem('motif.' + k); return v === null ? fb : JSON.parse(v); } catch (e) { return fb; } },
    set(k, v) { try { localStorage.setItem('motif.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };
  const prevVisit = LS.get('lastSeenIssue', null);   // latest issue date seen on previous visit
  const firstVisit = prevVisit === null;
  let readSet = new Set(LS.get('read', []));
  let board = LS.get('board', []);
  function markRead(id) { if (!readSet.has(id)) { readSet.add(id); LS.set('read', [...readSet].slice(-800)); } }
  function inBoard(id) { return board.includes(id); }
  function toggleBoard(id) {
    board = inBoard(id) ? board.filter(x => x !== id) : [id, ...board];
    LS.set('board', board); updateBoardBtn();
  }
  function updateBoardBtn() { if (boardBtn) { boardBtn.querySelector('i').textContent = board.length; boardBtn.classList.toggle('has', board.length > 0); } }

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
    const t = item.tags || {}, o = item.origin || {};
    return { region: o.region ? [o.region] : [], sense: t.sense || [], tech: t.tech || [], theme: t.theme || [], scale: t.scale ? [t.scale] : [] };
  }
  function indexData() {
    ITEMS = []; ITEM_BY_ID = {};
    DATA.issues.forEach(issue => {
      (issue.items || []).forEach((it, i) => {
        it._id = it.id || `${issue.date}-${String(i + 1).padStart(2, '0')}`;
        it._issue = issue; it._index = i;
        ITEMS.push(it); ITEM_BY_ID[it._id] = it;
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
  function isNew(it) { return !firstVisit && prevVisit && it._issue.date > prevVisit; }
  function issueIndex(date) { return DATA.issues.findIndex(i => i.date === date); }
  function signalsFor(item) { return (SIGNALS.signals || []).filter(s => (s.evidence || []).some(e => e.itemId === item._id)); }

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
  function thumb(item) {
    return item && item.image ? `<img src="${esc(item.image)}" data-fb="${esc(item.imageFallback || '')}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="if(this.dataset.fb&&this.src!==this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb='';}else{this.remove();}"/>` : '';
  }

  // ---------- shared fragments ----------
  function itemHref(it) { return `?view=item&id=${encodeURIComponent(it._id)}`; }
  function renderStoryMeta(item) {
    const o = item.origin || {};
    return `<p class="story-meta"><span>${esc(item.creator || '')}</span>${item.publishedAt ? `<time>${esc(fmtDate(item.publishedAt))}</time>` : ''}${o.artistBase ? `<span class="meta-origin">${esc(o.artistBase)}</span>` : ''}</p>`;
  }
  function tagChip(facet, value, extra) {
    return `<button type="button" class="tag-chip${extra ? ' ' + extra : ''}" data-go-explore="${esc(facet)}:${esc(value)}">${esc(value)}</button>`;
  }
  function renderTags(item, limit) {
    const t = itemTags(item);
    const chips = [];
    if (t.region[0]) chips.push(tagChip('region', t.region[0], 'region-chip'));
    ['theme', 'tech', 'sense', 'scale'].forEach(k => t[k].forEach(v => chips.push(tagChip(k, v))));
    const shown = limit ? chips.slice(0, limit) : chips;
    return chips.length ? `<div class="tag-row">${shown.join('')}${limit && chips.length > limit ? `<span class="tag-more">+${chips.length - limit}</span>` : ''}</div>` : '';
  }
  function renderInsightList(item) {
    const ins = item.insight; if (!ins) return '';
    return `<dl class="insight-list">${INSIGHT_FIELDS.filter(([k]) => ins[k]).map(([k, label]) => `
      <div class="insight-row insight-${k}"><dt>${label}</dt><dd>${esc(ins[k])}</dd></div>`).join('')}</dl>`;
  }
  function stateBadges(item) {
    const b = [];
    if (isNew(item)) b.push('<span class="badge new">New</span>');
    if (readSet.has(item._id)) b.push('<span class="badge read">읽음</span>');
    if (inBoard(item._id)) b.push('<span class="badge saved">담음</span>');
    return b.length ? `<span class="badges">${b.join('')}</span>` : '';
  }
  function boardButton(item, big) {
    const on = inBoard(item._id);
    return `<button type="button" class="board-toggle${on ? ' on' : ''}${big ? ' big' : ''}" data-board="${esc(item._id)}" aria-pressed="${on}">${on ? '담음 ✓' : '담기 +'}</button>`;
  }

  function renderLeadStory(item) {
    const href = itemHref(item);
    return `
      <article class="lead-story" id="item-${esc(item._id)}">
        <a class="lead-image" href="${href}" data-go-item="${esc(item._id)}" aria-label="${esc(item.title)} 읽기">
          ${imageOrFallback(item, true)}
        </a>
        <div class="lead-copy">
          <p class="source-name">${esc(item.host || '')} ${stateBadges(item)}</p>
          <h2><a href="${href}" data-go-item="${esc(item._id)}">${esc(item.title)}</a></h2>
          ${item.originalTitle ? `<p class="original-title">${esc(item.originalTitle)}</p>` : ''}
          ${renderStoryMeta(item)}
          ${item.description ? `<p class="story-description">${esc(item.description)}</p>` : ''}
          ${renderTags(item)}
          <div class="card-actions">
            <a class="read-link" href="${href}" data-go-item="${esc(item._id)}">인사이트 읽기 →</a>
            <a class="ext-link" href="${esc(item.url)}" target="_blank" rel="noreferrer">원문 ↗</a>
            ${boardButton(item)}
          </div>
        </div>
      </article>
      ${item.insight ? `<section class="lead-insight">${renderInsightList(item)}</section>` : ''}`;
  }

  function renderStoryCard(item, opts) {
    const o = opts || {};
    const href = itemHref(item);
    const ins = item.insight || {};
    return `
      <article class="story-card" id="item-${esc(item._id)}">
        <a class="story-image" href="${href}" data-go-item="${esc(item._id)}" aria-label="${esc(item.title)} 읽기">
          ${imageOrFallback(item)}
        </a>
        <div class="story-copy">
          <p class="source-name">${esc(item.host || '')}${o.showDate && item._issue ? ` · ${esc(fmtDate(item._issue.date))}` : ''} ${stateBadges(item)}</p>
          <h2><a href="${href}" data-go-item="${esc(item._id)}">${esc(item.title)}</a></h2>
          ${item.originalTitle ? `<p class="original-title">${esc(item.originalTitle)}</p>` : ''}
          ${renderStoryMeta(item)}
          ${item.description ? `<p class="story-description">${esc(item.description)}</p>` : ''}
          ${ins.directorPoint ? `<p class="card-point"><b>연출 포인트</b>${esc(ins.directorPoint)}</p>` : ''}
          ${o.why ? `<p class="match-why">${esc(o.why)}</p>` : ''}
          ${renderTags(item, 5)}
          <div class="card-actions">
            <a class="read-link" href="${href}" data-go-item="${esc(item._id)}">인사이트 읽기 →</a>
            <a class="ext-link" href="${esc(item.url)}" target="_blank" rel="noreferrer">원문 ↗</a>
            ${boardButton(item)}
          </div>
        </div>
      </article>`;
  }

  function compactItem(item, note) {
    if (!item) return '';
    const o = item.origin || {};
    return `
      <a href="${itemHref(item)}" class="compact-item" data-go-item="${esc(item._id)}">
        <div class="compact-thumb">${thumb(item)}</div>
        <div class="compact-copy">
          <strong>${esc(item.title)}</strong>
          <small>${esc(item.creator || '')}${o.artistBase ? ` · ${esc(o.artistBase)}` : ''}${item._issue ? ` · ${esc(fmtDate(item._issue.date))}` : ''}</small>
          ${note ? `<em>${esc(note)}</em>` : ''}
        </div>
      </a>`;
  }
  function sectionHead(kicker, title, lede) {
    return `<header class="page-title"><p>${esc(kicker)}</p><h1${title.length > 26 ? ' class="long"' : ''}>${esc(title)}</h1></header>${lede ? `<p class="view-lede">${esc(lede)}</p>` : ''}`;
  }
  function regionCounts(items) {
    const c = {}; REGIONS.forEach(r => c[r] = 0);
    items.forEach(it => { const r = it.origin && it.origin.region; if (r && c[r] !== undefined) c[r]++; });
    return c;
  }
  function issueTerrain(items) {
    const regions = Object.entries(regionCounts(items)).filter(([, n]) => n > 0);
    if (!regions.length) return '';
    const hosts = new Set(items.map(i => i.host));
    return `<div class="issue-terrain"><span>오늘의 지형</span><p>${regions.map(([r, n]) => `<button type="button" data-go-explore="region:${esc(r)}">${esc(r)} ${n}</button>`).join('')}<i>작업 ${items.length} · 권역 ${regions.length} · 출처 ${hosts.size}</i></p></div>`;
  }

  // ---------- onboarding + since-last-visit ----------
  function introStrip() {
    if (!firstVisit || LS.get('introClosed', false)) return '';
    return `
      <aside class="intro-strip">
        <div>
          <p class="intro-kicker">처음 오셨다면</p>
          <p class="intro-lead">MOTIF는 매일 아침 세계 곳곳의 미디어아트 5~8편을 고르고, 그중 1편을 깊게 읽는 저널이다.</p>
        </div>
        <ol>
          <li><b>Latest</b>오늘의 작업. 제목을 누르면 작동 원리부터 한계까지 네 갈래 인사이트가 열린다.</li>
          <li><b>Focus</b>하루 한 편의 심층 읽기와 계보.</li>
          <li><b>Signals</b>여러 작업이 함께 가리키는 흐름.</li>
          <li><b>Toolkit · Brief</b>연출 도구 카드, 그리고 검색창에 브리프를 넣으면 레퍼런스를 모아준다.</li>
        </ol>
        <button type="button" class="intro-close" data-close-intro="1">알겠어요 ×</button>
      </aside>`;
  }
  function sinceStrip() {
    if (firstVisit || !prevVisit) return '';
    const newIssues = DATA.issues.filter(i => i.date > prevVisit);
    if (!newIssues.length) return '';
    const n = newIssues.reduce((a, i) => a + (i.items || []).length, 0);
    return `
      <aside class="since-strip">
        <span>지난 방문 이후</span>
        <p>새 호 ${newIssues.length}개 · 작업 ${n}편</p>
        <div>${newIssues.map(i => `<button type="button" data-go-issue="${esc(i.date)}">${esc(fmtDate(i.date))} ${esc((i.title || '').slice(0, 22))}${(i.title || '').length > 22 ? '…' : ''}</button>`).join('')}</div>
      </aside>`;
  }

  // ---------- Latest / issue ----------
  function findIssue(date) { return date ? DATA.issues.find(i => i.date === date) : DATA.issues[0]; }
  function focusItem(issue) { return (issue && issue.focus) ? ((issue.items || [])[issue.focus.itemIndex] || null) : null; }

  function continueBlock(issue) {
    const idx = issueIndex(issue.date);
    const older = DATA.issues[idx + 1], newer = DATA.issues[idx - 1];
    const fi = focusItem(issue);
    const todayIds = new Set((issue.items || []).map(i => i._id));
    let sigs = (SIGNALS.signals || []).filter(s => (s.evidence || []).some(e => todayIds.has(e.itemId)));
    if (!sigs.length) {
      const tags = new Set((issue.items || []).flatMap(i => { const t = itemTags(i); return [...t.theme, ...t.tech, ...t.sense]; }));
      sigs = (SIGNALS.signals || []).filter(s => (s.tags || []).some(t => tags.has(t))).slice(0, 2);
    }
    const tools = fi ? (TOOLKIT.cards || []).filter(c => c.fromItem === fi._id) : [];
    return `
      <section class="continue">
        <header><p>Continue</p><h2>이어서 읽기</h2></header>
        <div class="continue-grid">
          ${fi ? `<button type="button" data-open-focus="${esc(issue.date)}"><span>이 호의 Focus</span><strong>${esc(issue.focus.headline || fi.title)}</strong><em>${esc(fi.title)}</em></button>` : ''}
          ${sigs.slice(0, 2).map(s => `<button type="button" data-go-signal="${esc(s.id)}"><span>이어지는 신호</span><strong>${esc(s.title)}</strong><em>${esc(s.thesis)}</em></button>`).join('')}
          ${tools.slice(0, 1).map(c => `<button type="button" data-go-view="toolkit"><span>꺼내 쓸 도구</span><strong>${esc(c.name)}</strong><em>${esc(c.how)}</em></button>`).join('')}
        </div>
        <nav class="pager">
          ${newer ? `<button type="button" data-go-issue="${esc(newer.date)}"><span>← 다음 호 · ${esc(fmtDate(newer.date))}</span><strong>${esc(newer.title)}</strong></button>` : '<span></span>'}
          ${older ? `<button type="button" class="older" data-go-issue="${esc(older.date)}"><span>이전 호 · ${esc(fmtDate(older.date))} →</span><strong>${esc(older.title)}</strong></button>` : '<span></span>'}
        </nav>
      </section>`;
  }

  function renderIssueView(date, labelOverride) {
    const issue = findIssue(date);
    if (!issue) { main.innerHTML = `<section class="issue-view">${sectionHead('Latest', 'Media Art')}<div class="empty-state"><p>표시할 항목이 없습니다.</p></div></section>`; return; }
    const items = issue.items || [];
    const isLatest = issue === DATA.issues[0];
    const label = labelOverride || fmtDate(issue.date, true);
    const fi = focusItem(issue);
    const cc = issue.crosscurrent;
    setTitle(isLatest && !date ? '' : fmtDate(issue.date) + ' ' + issue.title);
    main.innerHTML = `
      <section class="issue-view">
        ${isLatest && !date ? introStrip() + sinceStrip() : ''}
        <header class="page-title">
          <p>${esc(label)}${isLatest && !date ? ` · ${esc(fmtDate(issue.date, true))}` : ''}</p>
          <h1${(issue.title || '').length > 26 ? ' class="long"' : ''}>${esc(issue.title)}</h1>
        </header>
        ${issue.summary ? `<p class="view-lede">${esc(issue.summary)}</p>` : ''}
        ${issueTerrain(items)}
        ${issue.focus && fi ? `
          <a href="?view=focus&date=${esc(issue.date)}" class="focus-banner" data-open-focus="${esc(issue.date)}">
            <span>Focus</span>
            <strong>${esc(issue.focus.headline || fi.title)}</strong>
            <em>${esc(fi.title)} · 심층 읽기 →</em>
          </a>` : ''}
        ${cc && cc.note ? `
          <div class="crosscurrent"><span>Crosscurrent</span><p>${esc(cc.note)}</p>
            <div class="compact-list">${(cc.itemIds || []).map(id => compactItem(ITEM_BY_ID[id])).join('')}</div></div>` : ''}
        ${items.length ? `${renderLeadStory(items[0])}<div class="story-grid">${items.slice(1).map(it => renderStoryCard(it)).join('')}</div>` : '<div class="empty-state"><p>표시할 항목이 없습니다.</p></div>'}
        ${continueBlock(issue)}
      </section>`;
  }

  // ---------- Item reading page ----------
  function renderItemView(id) {
    const it = ITEM_BY_ID[id];
    if (!it) { renderIssueView(null, 'Latest'); return; }
    markRead(it._id);
    const issue = it._issue;
    const siblings = issue.items || [];
    const prev = siblings[it._index - 1], next = siblings[it._index + 1];
    const isFocus = issue.focus && issue.focus.itemIndex === it._index;
    const sigs = signalsFor(it);
    const tools = (TOOLKIT.cards || []).filter(c => c.fromItem === it._id);
    const related = relatedItems(it, 4);
    const o = it.origin || {};
    setTitle(it.title);
    main.innerHTML = `
      <section class="item-view">
        <nav class="crumbs">
          <button type="button" data-back="?date=${esc(issue.date)}">← 돌아가기</button>
          <span>/</span>
          <button type="button" data-go-issue="${esc(issue.date)}">${esc(fmtDate(issue.date, true))} 호</button>
          <span>/</span><em>${it._index + 1} of ${siblings.length}</em>
        </nav>
        <article class="item-article">
          <div class="item-media">${imageOrFallback(it, true)}</div>
          <div class="item-head">
            <p class="source-name">${esc(it.host || '')} ${stateBadges(it)}</p>
            <h1>${esc(it.title)}</h1>
            ${it.originalTitle ? `<p class="original-title">${esc(it.originalTitle)}</p>` : ''}
            ${renderStoryMeta(it)}
            ${o.venue ? `<p class="item-venue">공개 · ${esc(o.venue)}</p>` : ''}
            ${it.description ? `<p class="item-desc">${esc(it.description)}</p>` : ''}
            ${renderTags(it)}
            <div class="card-actions">
              <a class="ext-link big" href="${esc(it.url)}" target="_blank" rel="noreferrer">원문 보기 ↗</a>
              ${boardButton(it, true)}
            </div>
          </div>
        </article>
        ${it.insight ? `<section class="item-insight">${INSIGHT_FIELDS.filter(([k]) => it.insight[k]).map(([k, label], i) => `
          <div class="item-insight-row insight-${k}"><span>${String(i + 1).padStart(2, '0')}</span><h3>${label}</h3><p>${esc(it.insight[k])}</p></div>`).join('')}
          ${it.grounded === false ? '<p class="grounded-note">원문에서 확인 가능한 정보가 적어 설명을 근거로 보수적으로 작성했다.</p>' : ''}
        </section>` : ''}
        ${isFocus ? `<a href="?view=focus&date=${esc(issue.date)}" class="focus-banner" data-open-focus="${esc(issue.date)}"><span>Focus</span><strong>${esc(issue.focus.headline)}</strong><em>이 작업의 심층 읽기 →</em></a>` : ''}
        ${sigs.length ? `<section class="related"><header><p>Signals</p><h2>이 작업이 근거가 된 흐름</h2></header><div class="signal-list">${sigs.map((s, i) => {
          const note = (s.evidence.find(e => e.itemId === it._id) || {}).note || '';
          return `<button type="button" class="signal-row" data-go-signal="${esc(s.id)}"><span>${String(i + 1).padStart(2, '0')}</span><div><strong>${esc(s.title)}</strong><em>${esc(note)}</em></div><small>${(s.evidence || []).length} works</small><b>→</b></button>`;
        }).join('')}</div></section>` : ''}
        ${tools.length ? `<section class="focus-tools"><header><p>Toolkit</p><h2>이 작업에서 꺼낸 연출 도구</h2></header><div class="tool-grid">${tools.map(toolkitCard).join('')}</div></section>` : ''}
        ${related.length ? `<section class="related"><header><p>Connections</p><h2>함께 볼 작업</h2></header><div class="compact-list">${related.map(r => compactItem(r, sharedTagsNote(it, r))).join('')}</div></section>` : ''}
        <nav class="pager item-pager">
          ${prev ? `<button type="button" data-go-item="${esc(prev._id)}"><span>← 이전 작업</span><strong>${esc(prev.title)}</strong></button>` : `<button type="button" data-go-issue="${esc(issue.date)}"><span>← 이 호 처음으로</span><strong>${esc(issue.title)}</strong></button>`}
          ${next ? `<button type="button" class="older" data-go-item="${esc(next._id)}"><span>다음 작업 →</span><strong>${esc(next.title)}</strong></button>` : `<button type="button" class="older" data-go-issue="${esc(issue.date)}"><span>이 호로 돌아가기 →</span><strong>${esc(fmtDate(issue.date, true))}</strong></button>`}
        </nav>
      </section>`;
  }

  // ---------- Archive ----------
  function renderArchiveView() {
    setTitle('Archive');
    const issues = DATA.issues;
    main.innerHTML = `
      <section class="archive-view">
        <header class="page-title"><p>MOTIF · ${issues.length} issues · ${ITEMS.length} works</p><h1>Archive</h1></header>
        <div class="archive-list rich">
          ${issues.map((issue, i) => {
            const items = issue.items || [];
            const regs = Object.entries(regionCounts(items)).filter(([, n]) => n).map(([r]) => r);
            const fi = focusItem(issue);
            const unread = items.filter(it => !readSet.has(it._id)).length;
            return `
            <button type="button" data-go-issue="${esc(issue.date)}">
              <span>${String(i + 1).padStart(2, '0')}</span>
              <div class="archive-thumb">${thumb(items[0])}</div>
              <div class="archive-copy">
                <strong>${esc(fmtDate(issue.date, true))}${!firstVisit && prevVisit && issue.date > prevVisit ? ' <i class="badge new">New</i>' : ''}</strong>
                <em>${esc(issue.title || 'Media Art')}</em>
                <small>작업 ${items.length}${regs.length ? ' · ' + esc(regs.join(' · ')) : ''}${fi ? ' · Focus ' + esc(fi.title) : ''}</small>
              </div>
              <small class="archive-read">${unread === items.length ? '' : unread === 0 ? '모두 읽음' : `${items.length - unread}/${items.length} 읽음`}</small>
            </button>`; }).join('')}
        </div>
      </section>`;
  }

  // ---------- Focus ----------
  function focusIssues() { return DATA.issues.filter(i => focusItem(i)); }
  function renderFocusView() {
    setTitle('Focus');
    const issues = focusIssues();
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
              <div class="focus-archive-image">${thumb(it) || `<i>${esc(it.host || '')}</i>`}</div>
              <div class="focus-archive-copy"><strong>${esc(it.title)}</strong><em>${esc(issue.focus.headline || '')}</em></div>
              <small>${esc(it.creator || '')}${readSet.has('focus:' + issue.date) ? '<br/><i class="badge read">읽음</i>' : ''}</small>
              <b>→</b>
            </button>`; }).join('')}
        </div>` : '<div class="empty-state"><p>아직 작성된 Focus가 없습니다.</p></div>'}
      </section>`;
  }

  function similarity(a, b) {
    const ta = itemTags(a), tb = itemTags(b); let s = 0;
    ['theme', 'tech', 'sense', 'scale'].forEach(k => { const w = k === 'theme' ? 3 : k === 'tech' ? 2 : 1; ta[k].forEach(v => { if (tb[k].includes(v)) s += w; }); });
    return s;
  }
  function relatedItems(item, n) {
    const myRegion = item.origin && item.origin.region;
    return ITEMS.filter(o => o !== item && o.tags)
      .map(o => ({ o, s: similarity(item, o) + ((o.origin && o.origin.region && o.origin.region !== myRegion) ? 1.5 : 0) }))
      .filter(x => x.s >= 4).sort((a, b) => b.s - a.s).slice(0, n || 4).map(x => x.o);
  }
  function sharedTagsNote(a, b) {
    const ta = itemTags(a), tb = itemTags(b); const shared = [];
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
        ${src ? `<button type="button" class="tool-from" data-go-item="${esc(src._id)}">출처 · ${esc(src.title)} →</button>` : ''}
      </article>`;
  }

  function renderFocusArticle(date) {
    const issue = findIssue(date);
    const it = focusItem(issue);
    if (!it) { renderFocusView(); return; }
    markRead('focus:' + issue.date);
    const f = issue.focus;
    const lineage = f.lineage || [];
    const related = relatedItems(it, 4);
    const tools = (TOOLKIT.cards || []).filter(c => c.fromItem === it._id);
    const list = focusIssues(); const fi = list.indexOf(issue);
    const newerF = list[fi - 1], olderF = list[fi + 1];
    setTitle('Focus · ' + (f.headline || it.title));
    main.innerHTML = `
      <section class="issue-view focus-article">
        <nav class="crumbs">
          <button type="button" data-back="?view=focus">← 돌아가기</button><span>/</span>
          <button type="button" data-go-view="focus">Focus 목록</button><span>/</span>
          <em>${esc(fmtDate(issue.date, true))}</em>
        </nav>
        <header class="page-title">
          <p>Focus · ${esc(fmtDate(issue.date, true))} · 약 ${Math.max(3, Math.round((f.sections || []).reduce((a, s) => a + s.body.length, 0) / 500))}분</p>
          <h1${(f.headline || '').length > 26 ? ' class="long"' : ''}>${esc(f.headline || it.title)}</h1>
        </header>
        <article class="lead-story">
          <a class="lead-image" href="${esc(it.url)}" target="_blank" rel="noreferrer" aria-label="${esc(it.title)} 원문 보기">${imageOrFallback(it, true)}</a>
          <div class="lead-copy">
            <p class="source-name">${esc(it.host || '')}</p>
            <h2><a href="${itemHref(it)}" data-go-item="${esc(it._id)}">${esc(it.title)}</a></h2>
            ${it.originalTitle ? `<p class="original-title">${esc(it.originalTitle)}</p>` : ''}
            ${renderStoryMeta(it)}
            ${it.description ? `<p class="story-description">${esc(it.description)}</p>` : ''}
            ${(f.keywords && f.keywords.length) ? `<p class="focus-keywords">${f.keywords.map(k => `<span>${esc(k)}</span>`).join('')}</p>` : ''}
            ${renderTags(it)}
            <div class="card-actions">
              <a class="ext-link" href="${esc(it.url)}" target="_blank" rel="noreferrer">원문 ↗</a>
              ${boardButton(it)}
            </div>
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
        ${it.insight && it.insight.critique ? `<div class="focus-critique"><span>한계와 질문</span><p>${esc(it.insight.critique)}</p></div>` : ''}
        ${lineage.length ? `
        <section class="lineage">
          <header><p>Lineage</p><h2>이 작업이 놓인 계보</h2></header>
          <ol>${lineage.map(l => `<li><time>${esc(l.year || '이전')}</time><strong>${esc(l.name)}</strong><p>${esc(l.relation || '')}</p></li>`).join('')}
            <li class="lineage-now"><time>${esc(issue.date.slice(0, 4))}</time><strong>${esc(it.title)}</strong><p>${esc(it.creator || '')}</p></li>
          </ol>
        </section>` : ''}
        ${tools.length ? `<section class="focus-tools"><header><p>Toolkit</p><h2>이 글에서 꺼낸 연출 도구</h2></header><div class="tool-grid">${tools.map(toolkitCard).join('')}</div></section>` : ''}
        ${related.length ? `<section class="related"><header><p>Connections</p><h2>아카이브 속 연결</h2></header><div class="compact-list">${related.map(r => compactItem(r, sharedTagsNote(it, r))).join('')}</div></section>` : ''}
        <footer class="feature-source">
          <div><p>Sources</p>${(f.sources || []).map(s => `<p><a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.label || s.url)}</a></p>`).join('')}</div>
          <p><a href="?date=${esc(issue.date)}" data-go-issue="${esc(issue.date)}">이 날의 전체 리서치 보기 →</a></p>
        </footer>
        <nav class="pager">
          ${newerF ? `<button type="button" data-open-focus="${esc(newerF.date)}"><span>← 다음 Focus · ${esc(fmtDate(newerF.date))}</span><strong>${esc(newerF.focus.headline)}</strong></button>` : '<span></span>'}
          ${olderF ? `<button type="button" class="older" data-open-focus="${esc(olderF.date)}"><span>이전 Focus · ${esc(fmtDate(olderF.date))} →</span><strong>${esc(olderF.focus.headline)}</strong></button>` : '<span></span>'}
        </nav>
      </section>`;
  }

  // ---------- Signals ----------
  function tagRadar() {
    const recent = itemsWithin(14, 0), prev = itemsWithin(14, 14);
    const count = (items) => { const c = {}; items.forEach(it => { const t = itemTags(it); ['theme', 'tech', 'sense'].forEach(k => t[k].forEach(v => { const key = k + ':' + v; c[key] = (c[key] || 0) + 1; })); }); return c; };
    const cr = count(recent), cp = count(prev);
    const rn = Math.max(recent.length, 1), pn = Math.max(prev.length, 1);
    return Object.keys(cr).map(k => ({ k, n: cr[k], share: cr[k] / rn, delta: cr[k] / rn - (cp[k] || 0) / pn }))
      .filter(x => x.n >= 3 && x.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 8);
  }
  function renderSignalsView(id) {
    const list = SIGNALS.signals || [];
    if (id) { const s = list.find(x => x.id === id); if (s) { renderSignalArticle(s); return; } }
    setTitle('Signals');
    const radar = tagRadar();
    main.innerHTML = `
      <section class="signals-view">
        ${sectionHead('Signals', '작업들 사이에서 움직이는 것', '하나의 작업이 아니라 여러 권역의 작업이 같은 방향을 가리킬 때 그것을 신호로 기록한다. 각 신호는 아카이브 속 실제 작업을 근거로 삼는다.')}
        ${list.length ? `<div class="signal-list">${list.map((s, i) => `
          <button type="button" class="signal-row" data-go-signal="${esc(s.id)}">
            <span>${String(i + 1).padStart(2, '0')}</span>
            <div><strong>${esc(s.title)}</strong><em>${esc(s.thesis)}</em></div>
            <small>${(s.evidence || []).length} works<br/>${esc((s.regions || []).join(' · '))}${readSet.has('signal:' + s.id) ? '<br/><i class="badge read">읽음</i>' : ''}</small>
            <b>→</b>
          </button>`).join('')}</div>` : '<div class="empty-state"><p>아직 기록된 신호가 없습니다.</p></div>'}
        ${SIGNALS.method ? `<p class="radar-note method">방법 · ${esc(SIGNALS.method)}</p>` : ''}
        ${radar.length ? `
        <section class="radar">
          <header><p>Tag radar · 최근 14일</p><h2>직전 14일보다 비중이 커진 태그</h2></header>
          <div class="radar-bars">${radar.map(r => { const [facet, v] = r.k.split(':'); return `
            <button type="button" data-go-explore="${esc(facet)}:${esc(v)}"><span>${esc(v)}</span><i style="--w:${Math.round(r.share * 100)}%"></i><em>${r.n}건 · +${Math.round(r.delta * 100)}%p</em></button>`; }).join('')}</div>
          <p class="radar-note">자동 집계. 최근 14일 작업 중 해당 태그가 붙은 비율과 직전 14일 대비 변화다. 막대를 누르면 해당 작업들이 열린다.</p>
        </section>` : ''}
      </section>`;
  }
  function renderSignalArticle(s) {
    markRead('signal:' + s.id);
    setTitle('Signal · ' + s.title);
    const ev = (s.evidence || []).map(e => ({ it: ITEM_BY_ID[e.itemId], note: e.note })).filter(x => x.it);
    const pair = s.contrastPair;
    const list = SIGNALS.signals || []; const i = list.indexOf(s);
    const nextS = list[i + 1] || list[0];
    main.innerHTML = `
      <section class="signal-article">
        <nav class="crumbs"><button type="button" data-back="?view=signals">← 돌아가기</button><span>/</span><button type="button" data-go-view="signals">Signals 목록</button></nav>
        <header class="page-title"><p>Signal · ${esc(s.period || '')} · 근거 ${ev.length}편</p><h1${s.title.length > 26 ? ' class="long"' : ''}>${esc(s.title)}</h1></header>
        <p class="signal-thesis">${esc(s.thesis)}</p>
        <div class="signal-body">${(s.body || []).map(p => `<p>${esc(p)}</p>`).join('')}</div>
        ${pair && pair.a && ITEM_BY_ID[pair.a] && ITEM_BY_ID[pair.b] ? `
        <section class="contrast-pair">
          <header><p>Contrast pair</p><h2>다른 권역, 같은 질문</h2></header>
          <div class="pair-grid">${compactItem(ITEM_BY_ID[pair.a])}<span class="pair-vs">↔</span>${compactItem(ITEM_BY_ID[pair.b])}</div>
          <p class="pair-note">${esc(pair.note || '')}</p>
        </section>` : ''}
        <section class="related"><header><p>Evidence</p><h2>근거가 된 작업 ${ev.length}편</h2></header><div class="compact-list">${ev.map(x => compactItem(x.it, x.note)).join('')}</div></section>
        ${s.directorTakeaway ? `<div class="focus-critique takeaway"><span>디렉터에게</span><p>${esc(s.directorTakeaway)}</p></div>` : ''}
        ${s.watchNext ? `<div class="focus-critique"><span>다음에 볼 것</span><p>${esc(s.watchNext)}</p></div>` : ''}
        ${nextS && nextS !== s ? `<nav class="pager"><span></span><button type="button" class="older" data-go-signal="${esc(nextS.id)}"><span>다음 신호 →</span><strong>${esc(nextS.title)}</strong></button></nav>` : ''}
      </section>`;
  }

  // ---------- Explore ----------
  function parseFilters() {
    const f = {};
    state.params.getAll('f').forEach(x => { const i = x.indexOf(':'); if (i > 0) { const k = x.slice(0, i), v = x.slice(i + 1); (f[k] = f[k] || []).push(v); } });
    return f;
  }
  function matchesFilters(it, f) { const t = itemTags(it); return Object.keys(f).every(k => f[k].every(v => (t[k] || []).includes(v))); }
  function filterHref(f) {
    const p = new URLSearchParams(); p.set('view', 'explore');
    Object.keys(f).forEach(k => f[k].forEach(v => p.append('f', k + ':' + v)));
    return '?' + p.toString();
  }
  function renderExploreView() {
    const f = parseFilters();
    const limit = Number(state.params.get('n') || 24);
    const pool = ITEMS.filter(it => it.tags || it.origin);
    const results = pool.filter(it => matchesFilters(it, f));
    const active = Object.keys(f).flatMap(k => f[k].map(v => ({ k, v })));
    setTitle('Explore' + (active.length ? ' · ' + active.map(a => a.v).join(' + ') : ''));
    const facetHtml = FACETS.map(({ key, label }) => {
      const c = {}; results.forEach(it => itemTags(it)[key].forEach(v => c[v] = (c[v] || 0) + 1));
      const entries = Object.entries(c).sort((a, b) => b[1] - a[1]);
      if (!entries.length) return '';
      return `<div class="facet"><p>${label}</p><div>${entries.map(([v, n]) => {
        const on = (f[key] || []).includes(v);
        return `<button type="button" class="facet-chip${on ? ' on' : ''}" data-toggle-filter="${esc(key)}:${esc(v)}">${esc(v)} <i>${n}</i></button>`;
      }).join('')}</div></div>`;
    }).join('');
    main.innerHTML = `
      <section class="explore-view">
        ${sectionHead('Explore', active.length ? active.map(a => a.v).join(' + ') : '축으로 읽는 아카이브', '권역, 감각, 기술, 주제, 스케일을 겹쳐서 작업을 찾는다. 여러 개를 고르면 모두 만족하는 작업만 남는다. 숫자는 지금 조건에서 함께 걸리는 작업 수다.')}
        <div class="explore-layout">
          <aside class="facets">
            ${active.length ? `<div class="active-filters">${active.map(a => `<button type="button" class="facet-chip on" data-toggle-filter="${esc(a.k)}:${esc(a.v)}">${esc(a.v)} ×</button>`).join('')}<button type="button" class="facet-clear" data-clear-filters="1">모두 해제</button></div>` : ''}
            <details class="facet-wrap" ${active.length ? '' : 'open'}><summary>필터 ${active.length ? `(${active.length})` : ''}</summary>${facetHtml}</details>
          </aside>
          <div class="explore-results">
            <p class="result-count">${results.length}개 작업 · 최신순</p>
            <div class="story-grid compact-grid">${results.slice(0, limit).map(it => renderStoryCard(it, { showDate: true })).join('')}</div>
            ${results.length > limit ? `<button type="button" class="more-btn" data-more="${limit + 24}">${Math.min(24, results.length - limit)}개 더 보기 (${results.length - limit}개 남음)</button>` : ''}
          </div>
        </div>
      </section>`;
  }

  // ---------- World ----------
  function renderWorldView() {
    setTitle('World');
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
        ${sectionHead('World', '어디에서 온 작업을 읽고 있는가', 'MOTIF는 한 페스티벌의 목록이 아니라 세계의 미디어아트를 읽으려 한다. 아래 수치는 작가의 주 활동 권역 기준이며, 편향을 스스로 점검하기 위해 공개한다. 권역을 누르면 그 권역의 작업이 열린다.')}
        <div class="world-stats">
          <div><span>권역 태그가 붙은 작업</span><strong>${all.length}</strong><em>전체 ${ITEMS.length}</em></div>
          <div><span>최근 14일 최대 권역 비중</span><strong>${Math.round(topShare * 100)}%</strong><em>목표 50% 이하</em></div>
          <div><span>최근 14일 최다 출처</span><strong>${topHost ? topHost[1] : 0}</strong><em>${esc(topHost ? topHost[0] : '')}</em></div>
          <div><span>최근 14일 공백 권역</span><strong>${gaps.length}</strong><em>${esc(gaps.join(', ') || '없음')}</em></div>
        </div>
        <div class="region-bars">
          ${REGIONS.map(r => `<button type="button" data-go-explore="region:${esc(r)}"><span>${esc(r)}</span><i style="--w:${Math.round(ca[r] / maxA * 100)}%"></i><em>${ca[r]} <small>최근 14일 ${cr[r]}</small></em></button>`).join('')}
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
    setTitle('Toolkit');
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

  // ---------- Board (saved works) ----------
  function boardText(items) {
    return items.map((it, i) => {
      const ins = it.insight || {};
      return `${i + 1}. ${it.title}${it.originalTitle ? ' (' + it.originalTitle + ')' : ''}\n   ${it.creator || ''}${it.origin && it.origin.artistBase ? ' · ' + it.origin.artistBase : ''}\n   ${it.url}\n   연출 포인트: ${ins.directorPoint || '-'}`;
    }).join('\n\n');
  }
  function renderBoardView() {
    setTitle('Board');
    const items = board.map(id => ITEM_BY_ID[id]).filter(Boolean);
    main.innerHTML = `
      <section class="board-view">
        ${sectionHead('Board', '담아 둔 작업', '프로젝트 레퍼런스로 쓸 작업을 모아두는 곳이다. 이 브라우저에만 저장되며, 텍스트로 복사해 기획서나 메신저에 붙일 수 있다.')}
        ${items.length ? `
          <div class="board-actions">
            <button type="button" class="more-btn" data-copy-board="1">목록 텍스트로 복사</button>
            <button type="button" class="facet-clear" data-clear-board="1">모두 비우기</button>
            <span class="copy-status" aria-live="polite"></span>
          </div>
          <div class="story-grid compact-grid">${items.map(it => renderStoryCard(it, { showDate: true })).join('')}</div>`
          : `<div class="empty-state"><p>아직 담은 작업이 없다. 작업 카드의 "담기 +"를 누르면 여기에 모인다.</p></div>`}
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
    '자연': ['비인간·생태', '기후·환경'], '생태': ['비인간·생태'], '동물': ['비인간·생태'], '비인간': ['비인간·생태'], '식물': ['비인간·생태', '바이오·생물'], '기후': ['기후·환경'], '환경': ['기후·환경'],
    '기억': ['기억·아카이브'], '로봇': ['로보틱스', '인간-기계 관계'], '기계': ['키네틱·기계장치', '인간-기계 관계'],
    '게임': ['놀이·게임', '실시간그래픽·게임엔진'], '놀이': ['놀이·게임'], '인터랙션': ['센서·인터랙션'], '인터랙티브': ['센서·인터랙션'], '참여': ['센서·인터랙션', '도시·공동체'],
    'vr': ['XR·AR·VR'], 'ar': ['XR·AR·VR'], 'xr': ['XR·AR·VR'], '데이터': ['데이터·시각화'], '감시': ['권력·감시'], '치유': ['돌봄·치유'], '돌봄': ['돌봄·치유'],
    '광고': ['스크린·영상', '건축·파사드', '도시·공공공간'], '영상': ['영상·필름', '스크린·영상'], '필름': ['영상·필름'], '웨어러블': ['웨어러블', '손·웨어러블'], '패션': ['웨어러블', '신체·정체성'],
    '거울': ['신체·정체성'], '한국': ['동아시아'], '일본': ['동아시아'], '중국': ['동아시아'], '아시아': ['동아시아', '동남·남아시아'], '아프리카': ['아프리카'], '남미': ['중남미'], '중동': ['중동'], '유럽': ['유럽'], '미국': ['북미'], '캐나다': ['북미'], '호주': ['오세아니아']
  };
  function briefSearch(q) {
    const tokens = [...new Set(q.toLowerCase().split(/[\s,.;·/]+/).filter(t => t.length >= 2 || /^[a-z]{2,}$/.test(t)))];
    const tokenTags = tokens.map(t => { const s = new Set(); Object.keys(SYN).forEach(k => { if (t === k || (k.length >= 2 && t.includes(k))) SYN[k].forEach(v => s.add(v)); }); return s; });
    const score = (it) => {
      const t = itemTags(it);
      const allTags = [...t.region, ...t.sense, ...t.tech, ...t.theme, ...t.scale];
      const ins = it.insight || {};
      const deep = [ins.directorPoint, ins.mechanism].join(' ').toLowerCase();
      const base = [it.title, it.originalTitle, it.creator, it.description, ins.whyNow, (it.origin || {}).artistBase].join(' ').toLowerCase();
      let s = 0, hit = 0; const why = new Set();
      tokens.forEach((tok, i) => {
        let ts = 0;
        allTags.forEach(v => { if (tokenTags[i].has(v) || v.toLowerCase().includes(tok)) { ts = Math.max(ts, 3); why.add(v); } });
        if (deep.includes(tok)) { ts = Math.max(ts, 2.5); why.add('"' + tok + '"'); }
        else if (base.includes(tok)) { ts = Math.max(ts, 1.5); why.add('"' + tok + '"'); }
        if (ts) { hit++; s += ts; }
      });
      return { s: s + hit * 4, hit, why: [...why].slice(0, 4) };
    };
    const works = ITEMS.map(it => Object.assign({ it }, score(it))).filter(x => x.hit > 0).sort((a, b) => b.hit - a.hit || b.s - a.s);
    const allTagSet = new Set(tokenTags.flatMap(s => [...s]));
    const tools = (TOOLKIT.cards || []).map(c => {
      const hay = [c.name, c.how, c.useWhen, c.category, (c.tags || []).join(' ')].join(' ').toLowerCase();
      let s = 0; tokens.forEach(tok => { if (hay.includes(tok)) s += 2; }); (c.tags || []).forEach(v => { if (allTagSet.has(v)) s += 1; });
      return { c, s };
    }).filter(x => x.s >= 2).sort((a, b) => b.s - a.s).slice(0, 3);
    const sigs = (SIGNALS.signals || []).filter(sg => {
      const hay = [sg.title, sg.thesis, (sg.tags || []).join(' ')].join(' ').toLowerCase();
      return tokens.some(tok => hay.includes(tok)) || (sg.tags || []).some(v => allTagSet.has(v));
    }).slice(0, 3);
    return { works, tools, sigs, tokens };
  }
  function exampleChips() {
    return `<div class="brief-examples"><span>예시 브리프</span>${BRIEF_EXAMPLES.map(b => `<button type="button" class="facet-chip" data-brief="${esc(b)}">${esc(b)}</button>`).join('')}</div>`;
  }
  function renderBriefView(q) {
    setTitle('Brief · ' + q);
    if (!q) { main.innerHTML = `<section class="brief-view">${sectionHead('Brief', '브리프로 레퍼런스 찾기', '만들려는 장면이나 캠페인을 짧게 적으면 태그, 연출 포인트, 작동 원리를 함께 읽어 관련 작업과 도구를 모은다.')}${exampleChips()}</section>`; return; }
    const { works, tools, sigs, tokens } = briefSearch(q);
    const full = works.filter(w => w.hit === tokens.length), part = works.filter(w => w.hit < tokens.length);
    const top = full.length >= 6 ? full : full.concat(part).slice(0, Math.max(full.length, 12));
    const regionSpread = new Set(top.slice(0, 12).map(w => w.it.origin && w.it.origin.region).filter(Boolean));
    main.innerHTML = `
      <section class="brief-view">
        ${sectionHead('Brief', q, `모든 단어에 맞는 작업 ${full.length}편${tokens.length > 1 ? `, 일부만 맞는 작업 ${part.length}편` : ''}. 상위 결과의 권역 ${regionSpread.size}곳.`)}
        ${exampleChips()}
        ${top.length ? `<div class="story-grid compact-grid">${top.slice(0, 24).map(w => renderStoryCard(w.it, { showDate: true, why: (w.hit === tokens.length ? '모두 일치 · ' : '일부 일치 · ') + w.why.join(', ') })).join('')}</div>` : '<div class="empty-state"><p>맞는 작업이 없습니다. 감각(촉각, 청각), 기술(AI, 프로젝션), 주제(기후, 기억) 같은 단어로 다시 찾아보세요.</p></div>'}
        ${tools.length ? `<section class="focus-tools"><header><p>Toolkit</p><h2>꺼내 쓸 연출 도구</h2></header><div class="tool-grid">${tools.map(x => toolkitCard(x.c)).join('')}</div></section>` : ''}
        ${sigs.length ? `<section class="related"><header><p>Signals</p><h2>관련 신호</h2></header><div class="signal-list">${sigs.map((s, i) => `
          <button type="button" class="signal-row" data-go-signal="${esc(s.id)}"><span>${String(i + 1).padStart(2, '0')}</span><div><strong>${esc(s.title)}</strong><em>${esc(s.thesis)}</em></div><small></small><b>→</b></button>`).join('')}</div></section>` : ''}
      </section>`;
  }

  // ---------- routing ----------
  function setTitle(t) { document.title = t ? `${t} · MOTIF` : 'MOTIF — Media Art Journal'; }
  function setActiveNav() {
    const v = state.view === 'item' ? '' : state.view;
    navButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-view-nav') === v));
    if (boardBtn) boardBtn.classList.toggle('active', state.view === 'board');
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
      case 'item': renderItemView(p.get('id')); break;
      case 'board': renderBoardView(); break;
      default: renderIssueView(state.date, state.date ? null : 'Latest');
    }
    updateProgress();
  }
  function initFromUrl() {
    const params = new URLSearchParams(location.search);
    const view = params.get('view');
    state.params = params;
    state.date = params.get('date') || null;
    state.view = VIEWS.includes(view) ? view : 'latest';
    searchInput.value = state.view === 'brief' ? (params.get('q') || '') : '';
  }
  function saveScroll() { try { history.replaceState(Object.assign({}, history.state, { y: window.scrollY }), ''); } catch (e) { /* ignore */ } }
  function go(search, scrollTarget) {
    saveScroll();
    try { history.pushState({ y: 0, inApp: true }, '', location.pathname + search); } catch (e) { /* data:/file: */ }
    initFromUrl();
    render();
    if (scrollTarget) {
      const el = document.getElementById(scrollTarget);
      if (el) { el.scrollIntoView({ block: 'start' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800); return; }
    }
    window.scrollTo(0, 0);
  }
  window.addEventListener('popstate', (e) => {
    initFromUrl(); render();
    const y = (e.state && e.state.y) || 0;
    requestAnimationFrame(() => window.scrollTo(0, y));
    setTimeout(() => window.scrollTo(0, y), 250);   // after lazy images settle
  });
  let scrollTimer = null;
  window.addEventListener('scroll', () => {
    updateProgress();
    clearTimeout(scrollTimer); scrollTimer = setTimeout(saveScroll, 200);
  }, { passive: true });
  function updateProgress() {
    if (!progress) return;
    const reading = ['item', 'focus', 'signals'].includes(state.view) && (state.view !== 'focus' || state.date) && (state.view !== 'signals' || state.params.get('id'));
    progress.classList.toggle('on', !!reading);
    if (!reading) return;
    const h = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
  }

  navButtons.forEach(b => b.addEventListener('click', () => { const v = b.getAttribute('data-view-nav'); go(v === 'latest' ? '' : '?view=' + v); }));
  logoBtn.addEventListener('click', () => go(''));
  if (boardBtn) boardBtn.addEventListener('click', () => go('?view=board'));
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    go('?view=brief' + (q ? '&q=' + encodeURIComponent(q) : ''));
  });

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;   // allow open-in-new-tab
    const el = e.target.closest('[data-board],[data-copy-board],[data-clear-board],[data-close-intro],[data-back],[data-brief],[data-more],[data-go-explore],[data-toggle-filter],[data-clear-filters],[data-go-item],[data-go-issue],[data-open-focus],[data-go-signal],[data-go-view],[data-go-toolcat]');
    if (!el || !main.contains(el)) return;
    e.preventDefault();
    const splitKV = (raw) => { const i = raw.indexOf(':'); return [raw.slice(0, i), raw.slice(i + 1)]; };
    if (el.hasAttribute('data-board')) {
      const id = el.getAttribute('data-board'); toggleBoard(id);
      document.querySelectorAll(`[data-board="${CSS.escape(id)}"]`).forEach(b => { const on = inBoard(id); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.textContent = on ? '담음 ✓' : '담기 +'; });
      if (state.view === 'board') { const y = scrollY; render(); window.scrollTo(0, y); }
      return;
    }
    if (el.hasAttribute('data-copy-board')) {
      const txt = boardText(board.map(id => ITEM_BY_ID[id]).filter(Boolean));
      const st = main.querySelector('.copy-status');
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { if (st) st.textContent = '복사했다'; }).catch(() => { if (st) st.textContent = '복사 실패. 브라우저 권한을 확인하세요.'; });
      return;
    }
    if (el.hasAttribute('data-clear-board')) { board = []; LS.set('board', board); updateBoardBtn(); render(); return; }
    if (el.hasAttribute('data-close-intro')) { LS.set('introClosed', true); const s = main.querySelector('.intro-strip'); if (s) s.remove(); return; }
    if (el.hasAttribute('data-back')) { if (history.state && history.state.inApp) history.back(); else go(el.getAttribute('data-back') || ''); return; }
    if (el.hasAttribute('data-brief')) { go('?view=brief&q=' + encodeURIComponent(el.getAttribute('data-brief'))); return; }
    if (el.hasAttribute('data-more')) {
      const y = scrollY; const p = new URLSearchParams(location.search); p.set('n', el.getAttribute('data-more'));
      try { history.replaceState({ y }, '', location.pathname + '?' + p.toString()); } catch (err) { /* ignore */ }
      initFromUrl(); render(); window.scrollTo(0, y); return;
    }
    if (el.hasAttribute('data-go-explore')) { const [k, v] = splitKV(el.getAttribute('data-go-explore')); go(filterHref({ [k]: [v] })); return; }
    if (el.hasAttribute('data-toggle-filter')) {
      const [k, v] = splitKV(el.getAttribute('data-toggle-filter'));
      const f = parseFilters(); f[k] = f[k] || [];
      if (f[k].includes(v)) f[k] = f[k].filter(x => x !== v); else f[k].push(v);
      if (!f[k].length) delete f[k];
      go(filterHref(f)); return;
    }
    if (el.hasAttribute('data-clear-filters')) { go('?view=explore'); return; }
    if (el.hasAttribute('data-go-item')) { go('?view=item&id=' + encodeURIComponent(el.getAttribute('data-go-item'))); return; }
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
    updateBoardBtn();
    initFromUrl();
    render();
    const y = history.state && history.state.y; if (y) setTimeout(() => window.scrollTo(0, y), 60);
    if (DATA.issues[0]) LS.set('lastSeenIssue', DATA.issues[0].date);   // next visit compares against this
  }).catch(err => {
    main.innerHTML = `<section class="issue-view">${sectionHead('Latest', 'Media Art')}<div class="empty-state"><p>데이터를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p></div></section>`;
    console.error(err);
  });
})();
