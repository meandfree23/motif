(function () {
  document.getElementById('yearSpan').textContent = new Date().getFullYear();

  const main = document.getElementById('mainContent');
  const navLatest = document.getElementById('navLatest');
  const navFocus = document.getElementById('navFocus');
  const navArchive = document.getElementById('navArchive');
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const logoBtn = document.getElementById('logoBtn');

  let DATA = { issues: [] };
  function safePush(url) { try { history.pushState({}, '', url); } catch (e) { /* e.g. data:/file: origins */ } }
  let currentView = 'latest';
  let currentDate = null;

  function fmtDate(dateStr, long) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    return long ? `${y}. ${m}. ${d}.` : `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
  }

  function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Image strategy (2026-09-21 hardening):
  //  - item.image may be a repo-relative path (self-hosted, preferred: "images/YYYY-MM-DD/NN.jpg")
  //    or an absolute external URL (legacy). item.imageFallback may hold the original external URL.
  //  - On load error we retry: self-hosted -> external fallback -> cache-busted external -> host label.
  //  - referrerpolicy="no-referrer" avoids hotlink-protection blocks on external hosts.
  function imageOrFallback(item, eager) {
    const host = escapeHtml(item.host || '');
    const src = item.image ? escapeHtml(item.image) : '';
    const fb = item.imageFallback ? escapeHtml(item.imageFallback) : '';
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

  function renderStoryMeta(item) {
    return `<p class="story-meta"><span>${escapeHtml(item.creator || '')}</span>${item.publishedAt ? `<time>${escapeHtml(fmtDate(item.publishedAt))}</time>` : ''}</p>`;
  }

  function renderLeadStory(item) {
    return `
      <article class="lead-story">
        <a class="lead-image" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(item.title)} 원문 보기">
          ${imageOrFallback(item, true)}
        </a>
        <div class="lead-copy">
          <p class="source-name">${escapeHtml(item.host || '')}</p>
          <h2><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></h2>
          ${item.originalTitle ? `<p class="original-title">${escapeHtml(item.originalTitle)}</p>` : ''}
          ${renderStoryMeta(item)}
          ${item.description ? `<p class="story-description">${escapeHtml(item.description)}</p>` : ''}
          <a class="read-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">View original</a>
        </div>
      </article>`;
  }

  function renderStoryCard(item) {
    return `
      <article class="story-card">
        <a class="story-image" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(item.title)} 원문 보기">
          ${imageOrFallback(item)}
        </a>
        <div class="story-copy">
          <p class="source-name">${escapeHtml(item.host || '')}</p>
          <h2><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></h2>
          ${item.originalTitle ? `<p class="original-title">${escapeHtml(item.originalTitle)}</p>` : ''}
          ${renderStoryMeta(item)}
          ${item.description ? `<p class="story-description">${escapeHtml(item.description)}</p>` : ''}
        </div>
      </article>`;
  }

  function findIssue(date) {
    if (date) return DATA.issues.find(i => i.date === date);
    return DATA.issues[0];
  }

  function renderIssueView(date, labelOverride) {
    const issue = findIssue(date);
    if (!issue) {
      main.innerHTML = `<section class="issue-view"><header class="page-title"><p>Latest</p><h1>Media Art</h1></header><div class="empty-state"><p>표시할 항목이 없습니다.</p></div></section>`;
      return;
    }
    const items = issue.items || [];
    const label = labelOverride || fmtDate(issue.date, true);
    main.innerHTML = `
      <section class="issue-view">
        <header class="page-title">
          <p>${escapeHtml(label)}</p>
          <h1 title="${escapeHtml(issue.title)}">${escapeHtml(issue.title)}</h1>
        </header>
        ${issue.focus && focusItem(issue) ? `
          <a href="#" class="focus-banner" data-open-focus="${escapeHtml(issue.date)}">
            <span>Focus</span>
            <strong>${escapeHtml(issue.focus.headline || focusItem(issue).title)}</strong>
            <em>${escapeHtml(focusItem(issue).title)} · 심층 읽기 →</em>
          </a>` : ''}
        ${items.length ? `
          ${renderLeadStory(items[0])}
          <div class="story-grid">
            ${items.slice(1).map(renderStoryCard).join('')}
          </div>
        ` : '<div class="empty-state"><p>표시할 항목이 없습니다.</p></div>'}
      </section>`;
    const fb = main.querySelector('[data-open-focus]');
    if (fb) fb.addEventListener('click', (e) => {
      e.preventDefault();
      currentView = 'focus'; currentDate = issue.date;
      safePush(location.pathname + '?view=focus&date=' + issue.date);
      render(); window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function renderArchiveView() {
    const issues = DATA.issues;
    main.innerHTML = `
      <section class="archive-view">
        <header class="page-title"><p>MOTIF</p><h1>Archive</h1></header>
        <div class="archive-list">
          ${issues.map((issue, i) => `
            <button type="button" data-date="${escapeHtml(issue.date)}">
              <span>${String(i + 1).padStart(2, '0')}</span>
              <strong>${escapeHtml(fmtDate(issue.date, true))}</strong>
              <em>${escapeHtml(issue.title || 'Media Art')}</em>
            </button>`).join('')}
        </div>
      </section>`;
    main.querySelectorAll('.archive-list button').forEach(btn => {
      btn.addEventListener('click', () => {
        currentView = 'latest';
        currentDate = btn.getAttribute('data-date');
        setActiveNav();
        renderIssueView(currentDate);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  // ---- Focus: one in-depth reading per issue (issue.focus = { itemIndex, headline, sections[], keywords[], sources[] })
  function focusItem(issue) {
    if (!issue || !issue.focus) return null;
    const it = (issue.items || [])[issue.focus.itemIndex];
    return it || null;
  }

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
            <button type="button" data-date="${escapeHtml(issue.date)}">
              <span>${String(i + 1).padStart(2, '0')}</span>
              <time>${escapeHtml(fmtDate(issue.date, true))}</time>
              <div class="focus-archive-image">${it.image ? `<img src="${escapeHtml(it.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML='<i>${escapeHtml(it.host || '')}</i>'"/>` : `<i>${escapeHtml(it.host || '')}</i>`}</div>
              <div class="focus-archive-copy">
                <strong>${escapeHtml(it.title)}</strong>
                <em>${escapeHtml(issue.focus.headline || '')}</em>
              </div>
              <small>${escapeHtml(it.creator || '')}</small>
              <b>→</b>
            </button>`; }).join('')}
        </div>` : '<div class="empty-state"><p>아직 작성된 Focus가 없습니다.</p></div>'}
      </section>`;
    main.querySelectorAll('.focus-archive-list button').forEach(btn => {
      btn.addEventListener('click', () => {
        currentView = 'focus';
        currentDate = btn.getAttribute('data-date');
        safePush(location.pathname + '?view=focus&date=' + currentDate);
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  function renderFocusArticle(date) {
    const issue = findIssue(date);
    const it = focusItem(issue);
    if (!it) { renderFocusView(); return; }
    const f = issue.focus;
    main.innerHTML = `
      <section class="issue-view focus-article">
        <header class="page-title">
          <p>Focus · ${escapeHtml(fmtDate(issue.date, true))}</p>
          <h1 title="${escapeHtml(f.headline || it.title)}">${escapeHtml(f.headline || it.title)}</h1>
        </header>
        <article class="lead-story">
          <a class="lead-image" href="${escapeHtml(it.url)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(it.title)} 원문 보기">
            ${imageOrFallback(it, true)}
          </a>
          <div class="lead-copy">
            <p class="source-name">${escapeHtml(it.host || '')}</p>
            <h2><a href="${escapeHtml(it.url)}" target="_blank" rel="noreferrer">${escapeHtml(it.title)}</a></h2>
            ${it.originalTitle ? `<p class="original-title">${escapeHtml(it.originalTitle)}</p>` : ''}
            ${renderStoryMeta(it)}
            ${it.description ? `<p class="story-description">${escapeHtml(it.description)}</p>` : ''}
            ${(f.keywords && f.keywords.length) ? `<p class="focus-keywords">${f.keywords.map(k => `<span>${escapeHtml(k)}</span>`).join('')}</p>` : ''}
            <a class="read-link" href="${escapeHtml(it.url)}" target="_blank" rel="noreferrer">View original</a>
          </div>
        </article>
        <div class="focus-sections">
          ${(f.sections || []).map((s, i) => `
            <section class="focus-section">
              <p class="focus-section-index">${String(i + 1).padStart(2, '0')}</p>
              <h3>${escapeHtml(s.heading)}</h3>
              <p>${escapeHtml(s.body)}</p>
            </section>`).join('')}
        </div>
        <footer class="feature-source">
          <div>
            <p>Sources</p>
            ${(f.sources || []).map(s => `<p><a href="${escapeHtml(s.url)}" target="_blank" rel="noreferrer">${escapeHtml(s.label || s.url)}</a></p>`).join('')}
          </div>
          <p><a href="#" data-open-issue="${escapeHtml(issue.date)}">이 날의 전체 리서치 보기 →</a></p>
        </footer>
      </section>`;
    const back = main.querySelector('[data-open-issue]');
    if (back) back.addEventListener('click', (e) => {
      e.preventDefault();
      currentView = 'latest'; currentDate = issue.date;
      safePush(location.pathname + '?date=' + issue.date);
      render(); window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function setActiveNav() {
    navLatest.classList.toggle('active', currentView === 'latest');
    navFocus.classList.toggle('active', currentView === 'focus');
    navArchive.classList.toggle('active', currentView === 'archive');
  }

  function render() {
    setActiveNav();
    if (currentView === 'archive') renderArchiveView();
    else if (currentView === 'focus') { if (currentDate) renderFocusArticle(currentDate); else renderFocusView(); }
    else renderIssueView(currentDate, currentDate ? null : 'Latest');
  }

  navLatest.addEventListener('click', () => {
    currentView = 'latest';
    currentDate = null;
    safePush(location.pathname);
    render();
  });
  navFocus.addEventListener('click', () => {
    currentView = 'focus';
    currentDate = null;
    safePush(location.pathname + '?view=focus');
    render();
  });
  window.addEventListener('popstate', () => { initFromUrl(); render(); });
  navArchive.addEventListener('click', () => {
    currentView = 'archive';
    currentDate = null;
    safePush(location.pathname + '?view=archive');
    render();
  });
  logoBtn.addEventListener('click', () => {
    currentView = 'latest';
    currentDate = null;
    safePush(location.pathname);
    render();
  });

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = searchInput.value.trim().toLowerCase();
    if (!q) return;
    const matches = [];
    DATA.issues.forEach(issue => {
      (issue.items || []).forEach(item => {
        const hay = `${item.title} ${item.originalTitle} ${item.creator} ${item.description}`.toLowerCase();
        if (hay.includes(q)) matches.push(item);
      });
    });
    main.innerHTML = `
      <section class="issue-view">
        <header class="page-title"><p>Search</p><h1>${escapeHtml(searchInput.value)}</h1></header>
        ${matches.length ? `
          ${renderLeadStory(matches[0])}
          <div class="story-grid">${matches.slice(1).map(renderStoryCard).join('')}</div>
        ` : '<div class="empty-state"><p>검색 결과가 없습니다.</p></div>'}
      </section>`;
  });

  function initFromUrl() {
    const params = new URLSearchParams(location.search);
    const view = params.get('view');
    const date = params.get('date');
    if (view === 'archive') currentView = 'archive';
    else if (view === 'focus') currentView = 'focus';
    else currentView = 'latest';
    currentDate = date || null;
  }

  // Unique query string busts the GitHub Pages CDN cache (max-age=600), not just the browser cache.
  fetch('./data.json?v=' + Date.now(), { cache: 'no-store' })
    .then(r => r.json())
    .then(data => {
      DATA = data;
      initFromUrl();
      render();
    })
    .catch(err => {
      main.innerHTML = `<section class="issue-view"><header class="page-title"><p>Latest</p><h1>Media Art</h1></header><div class="empty-state"><p>데이터를 불러오지 못했습니다.</p></div></section>`;
      console.error(err);
    });
})();
