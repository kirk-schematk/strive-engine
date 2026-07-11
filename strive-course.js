/* ============================================================
   STRIVE Course Engine — strive-course.js
   Renders any course from a JSON record into #strive-course.
   Parallel to the mini-lesson engine. Content is data; this is
   the renderer. Add a course = write one JSON record, no code.

   Usage (Webflow dynamic template):
     - Add a stylesheet link to strive-course.css
     - Add an empty mount element:  div#strive-course
     - Add a script tag for strive-course.js
     - Then call:
         STRIVECourse.load({
           mount: '#strive-course',
           url: XANO_BASE + '/course?slug=' + SLUG
           // OR: data: {...}  to render an inline object
           // paged: false  → force the classic one-page render
         });
     See webflow-course-embed.html for the exact markup.

   PAGED MODE (default when a course has 2+ modules):
     The course is split into hash-routed views —
       #overview  (hero, outcomes, setup, syllabus, creators)
       #module-N  (one module + stepper + prev/next nav)
       #finish    (the finish section)
     Deep-linkable and back-button friendly. Pass paged:false
     to load()/render() opts to get the original single page.

   Requires Lucide (unpkg) for icons; the engine calls
   lucide.createIcons() after render if present.
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- tiny html helpers ---------- */
  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };
  // Inline rich text allowed in authored strings: <strong> <b> <em> <kbd> <a> <br> and &-entities.
  // We DON'T escape these fields — authors control the JSON. If untrusted input is ever a concern,
  // sanitize upstream. (Same trust model as the lesson engine.)
  var rich = function (s) { return s == null ? '' : String(s); };
  var icon = function (name, cls) {
    if (!name) return '';
    return '<i data-lucide="' + esc(name) + '" class="sc-ico' + (cls ? ' ' + cls : '') + '"></i>';
  };
  var el = function (tag, cls, html) {
    return '<' + tag + (cls ? ' class="' + cls + '"' : '') + '>' + (html || '') + '</' + tag + '>';
  };

  /* Paged-mode flag — set by render() before building HTML so the
     section renderers can adapt links (hero CTA, path steps). */
  var PAGED = false;

  /* ---------- section renderers ---------- */

  function renderHero(c) {
    var h = c.hero || {};
    var badges = (h.badges || []).map(function (b) {
      return '<span class="sc-badge ' + esc(b.tone || 'ghost') + '">' + esc(b.label) + '</span>';
    }).join('');
    var stats = (h.stats || []).map(function (s) {
      var val = s.value ? '<b>' + rich(s.value) + '</b> ' : '';
      return '<span>' + icon(s.icon) + ' ' + val + esc(s.label) + '</span>';
    }).join('');
    var cta = h.cta || {};
    var href = cta.href || (c.modules && c.modules.length ? '#sc-course' : '#');
    // In paged mode the "start" CTA should open module 1, not scroll.
    if (PAGED && (href === '#sc-course' || !cta.href)) href = '#module-1';
    var earns = (cta.earns || []).map(function (e) {
      return '<div>' + icon(e.icon || 'check') + ' ' + rich(e.text) + '</div>';
    }).join('');
    var enrol =
      '<div class="sc-enrol">' +
        '<div class="sc-thumb"><span class="sc-pin">' + icon('play') + '</span></div>' +
        '<a class="sc-btn" href="' + esc(href) + '"><span>' + esc(cta.label || 'Start learning free') + '</span>' + icon('arrow-right') + '</a>' +
        (earns ? '<div class="sc-earns">' + earns + '</div>' : '') +
      '</div>';

    return '' +
      '<header class="sc-hero"><div class="sc-bloom"></div><div class="sc-bloom2"></div><div class="sc-wrap">' +
        '<div class="sc-hero-grid">' +
          '<div>' +
            (h.eyebrow ? '<span class="sc-eyebrow">' + esc(h.eyebrow) + '</span>' : '') +
            (badges ? '<div class="sc-badges">' + badges + '</div>' : '') +
            '<h1>' + rich(h.title) + '</h1>' +
            (h.lede ? '<p class="sc-lede">' + rich(h.lede) + '</p>' : '') +
            (stats ? '<div class="sc-stats">' + stats + '</div>' : '') +
          '</div>' +
          enrol +
        '</div>' +
      '</div></header>';
  }

  function renderOutcomes(c) {
    if (!c.outcomes || !c.outcomes.length) return '';
    var cards = c.outcomes.map(function (o) {
      return '<div class="sc-card">' +
        '<div class="sc-cic">' + icon(o.icon || 'circle-dot') + '</div>' +
        '<h4>' + rich(o.title) + '</h4>' +
        (o.body ? '<p>' + rich(o.body) + '</p>' : '') +
      '</div>';
    }).join('');
    var path = renderPath(c);
    return '<section class="sc-section"><div class="sc-wrap">' +
      '<div class="sc-head"><h2>What you’ll be able to do</h2>' +
      '<p>By the end you’ll have applied every step on a real project.</p></div>' +
      '<div class="sc-grid">' + cards + '</div>' +
      path +
    '</div></section>';
  }

  function renderPath(c) {
    if (!c.modules || !c.modules.length) return '';
    var steps = c.modules.map(function (m, i) {
      var n = ('0' + (i + 1)).slice(-2);
      var inner = '<div class="sc-n">' + n + '</div>' +
        '<div class="sc-nm">' + esc(shortTitle(m.title)) + '</div>' +
        '<div class="sc-t">' + esc(m.time || '') + '</div>';
      return PAGED
        ? '<a class="sc-step" href="#module-' + (i + 1) + '">' + inner + '</a>'
        : '<div class="sc-step">' + inner + '</div>';
    }).join('');
    return '<div style="height:34px"></div><div class="sc-path">' + steps + '</div>';
  }
  function shortTitle(t) {
    t = String(t || '');
    // Trim to the part before an em/en dash for the compact path row.
    var m = t.split(/\s[—–-]\s/);
    return m[0].length <= 26 ? m[0] : m[0].slice(0, 24) + '…';
  }

  function renderSetup(c) {
    if (!c.setup || !c.setup.length) return '';
    var cards = c.setup.map(function (s) {
      return '<div class="sc-card">' +
        '<h4 class="inline"><span class="sc-cic">' + icon(s.icon || 'check') + '</span>' + rich(s.title) + '</h4>' +
        '<p>' + rich(s.body) + '</p>' +
      '</div>';
    }).join('');
    return '<section class="sc-section sunken"><div class="sc-wrap">' +
      '<div class="sc-head"><h2>Before you start</h2>' +
      '<p>A minute of setup so you can work along instead of just watching.</p></div>' +
      '<div class="sc-grid">' + cards + '</div>' +
    '</div></section>';
  }

  /* One full module card (video + watch-for + practice + learn-more). */
  function buildModule(m, i, creators) {
    var n = ('0' + (i + 1)).slice(-2);
    var v = m.video || {};
    var cr = creators[v.creatorKey] || {};
    var accent = cr.accent || 'cool';
    var creatorLabel = v.creatorLabel || cr.name || 'STRIVE';
    var src = 'https://www.youtube-nocookie.com/embed/' + esc(v.youtubeId) + (v.start ? '?start=' + parseInt(v.start, 10) : '');

    var wf = (m.watchFor || []).map(function (li) {
      return '<li>' + icon('chevron-right') + '<span>' + rich(li) + '</span></li>';
    }).join('');
    var wfBlock = wf ? '<div class="sc-wf"><div class="sc-wf-title">' + icon('eye') + ' Watch for</div><ul>' + wf + '</ul></div>' : '';

    var pr = m.practice;
    var prBlock = pr ? '<div class="sc-practice"><span class="sc-lbl">' + esc(pr.label || 'Try it') + '</span><p>' + rich(pr.body) + '</p></div>' : '';

    var lm = m.learnMore;
    var lmBlock = lm ? '<div class="sc-learnmore">' +
      '<span class="sc-lm-ic">' + icon(lm.icon || 'graduation-cap') + '</span>' +
      '<div class="sc-lm-body"><p>' + rich(lm.body) + '</p></div>' +
      (lm.href ? '<a class="sc-lm-link" href="' + esc(lm.href) + '" target="_blank" rel="noopener">' + esc(lm.linkLabel || 'Learn more') + ' ' + icon('arrow-up-right') + '</a>' : '') +
    '</div>' : '';

    return '<article class="sc-module">' +
      '<div class="sc-mhead">' +
        '<div class="sc-mindex">' + n + '</div>' +
        '<div class="sc-grow"><h3>' + rich(m.title) + '</h3>' +
          (m.desc ? '<p class="sc-desc">' + rich(m.desc) + '</p>' : '') + '</div>' +
        (m.time ? '<span class="sc-mtime">' + icon('clock') + ' ' + esc(m.time) + '</span>' : '') +
      '</div>' +
      '<div class="sc-mbody">' +
        '<div class="sc-video"><iframe src="' + src + '" title="' + esc(v.title || m.title) + '" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>' +
        '<div class="sc-vmeta"><span class="sc-creator ' + esc(accent) + '">' + esc(creatorLabel) + '</span>' +
          (v.meta ? '<span class="sc-vlen">' + rich(v.meta) + '</span>' : '') + '</div>' +
        (v.title ? '<div class="sc-vtitle">' + rich(v.title) + '</div>' : '') +
        wfBlock + prBlock + lmBlock +
      '</div>' +
    '</article>';
  }

  function renderModules(c) {
    if (!c.modules || !c.modules.length) return '';
    var creators = c.creators || {};
    var mods = c.modules.map(function (m, i) { return buildModule(m, i, creators); }).join('');

    return '<section class="sc-section" id="sc-course"><div class="sc-wrap">' +
      '<div class="sc-head"><h2>The course</h2><p>Work through the modules in order. Each one builds on the last.</p></div>' +
      '<div class="sc-modules">' + mods + '</div>' +
    '</div></section>';
  }

  function renderCreators(c) {
    if (!c.creators) return '';
    var keys = Object.keys(c.creators);
    if (!keys.length) return '';
    var cards = keys.map(function (k) {
      var cr = c.creators[k];
      var accent = cr.accent || 'cool';
      var links = '';
      if (cr.free && cr.free.href) links += '<a class="free" href="' + esc(cr.free.href) + '" target="_blank" rel="noopener">' + icon('youtube') + ' ' + esc(cr.free.label || 'Free on YouTube') + '</a>';
      if (cr.paid && cr.paid.href) links += '<a class="paid" href="' + esc(cr.paid.href) + '" target="_blank" rel="noopener">' + icon('graduation-cap') + ' ' + esc(cr.paid.label || 'Courses') + '</a>';
      return '<div class="sc-cr">' +
        '<div class="sc-cr-top"><div class="sc-cr-avatar ' + esc(accent) + '">' + esc(cr.monogram || '') + '</div>' +
          '<div><div class="sc-cr-name">' + esc(cr.name) + '</div>' +
          (cr.role ? '<div class="sc-cr-role">' + esc(cr.role) + '</div>' : '') + '</div></div>' +
        (cr.bio ? '<p class="sc-bio">' + rich(cr.bio) + '</p>' : '') +
        (links ? '<div class="sc-cr-links">' + links + '</div>' : '') +
      '</div>';
    }).join('');
    return '<section class="sc-section sc-crsec"><div class="sc-wrap">' +
      '<div class="sc-head"><h2>Meet the creators</h2>' +
      '<p>This course curates free tutorials from respected educators. If they help you, support their work — their paid courses go deeper than any single video.</p></div>' +
      '<div class="sc-creators">' + cards + '</div>' +
    '</div></section>';
  }

  function renderFinish(c) {
    var f = c.finish;
    if (!f) return '';
    var next = (f.next || []).map(function (n) {
      return '<div class="sc-ncard"><div class="sc-nic">' + icon(n.icon || 'arrow-right') + '</div>' +
        '<h4>' + rich(n.title) + '</h4>' + (n.body ? '<p>' + rich(n.body) + '</p>' : '') + '</div>';
    }).join('');
    return '<section class="sc-finish"><div class="sc-bloom"></div><div class="sc-wrap">' +
      (f.eyebrow ? '<span class="sc-eyebrow">' + esc(f.eyebrow) + '</span>' : '') +
      (f.title ? '<h2>' + rich(f.title) + '</h2>' : '') +
      (f.lede ? '<p class="sc-lede">' + rich(f.lede) + '</p>' : '') +
      (next ? '<div class="sc-next">' + next + '</div>' : '') +
      (f.credit ? '<p class="sc-credit">' + rich(f.credit) + '</p>' : '') +
    '</div></section>';
  }

  /* ---------- paged mode: views + hash routing ---------- */

  // Overview syllabus: compact module cards that link into each module view.
  function renderSyllabus(c) {
    if (!c.modules || !c.modules.length) return '';
    var mods = c.modules.map(function (m, i) {
      var n = ('0' + (i + 1)).slice(-2);
      return '<a class="sc-module sc-mlink" href="#module-' + (i + 1) + '">' +
        '<div class="sc-mhead">' +
          '<div class="sc-mindex">' + n + '</div>' +
          '<div class="sc-grow"><h3>' + rich(m.title) + '</h3>' +
            (m.desc ? '<p class="sc-desc">' + rich(m.desc) + '</p>' : '') + '</div>' +
          (m.time ? '<span class="sc-mtime">' + icon('clock') + ' ' + esc(m.time) + '</span>' : '') +
          '<span class="sc-go">' + icon('arrow-right') + '</span>' +
        '</div>' +
      '</a>';
    }).join('');
    return '<section class="sc-section" id="sc-course"><div class="sc-wrap">' +
      '<div class="sc-head"><h2>The course</h2><p>' + c.modules.length + ' modules — work through them in order. Each one builds on the last.</p></div>' +
      '<div class="sc-modules sc-syllabus">' + mods + '</div>' +
    '</div></section>';
  }

  function renderStepper(c, current) {
    var steps = (c.modules || []).map(function (m, i) {
      var cls = 'sc-stepnum' + (i === current ? ' is-current' : '');
      return '<a class="' + cls + '" href="#module-' + (i + 1) + '" title="' + esc(shortTitle(m.title)) + '">' + (i + 1) + '</a>';
    }).join('');
    return '<nav class="sc-stepper" aria-label="Course modules">' + steps + '</nav>';
  }

  function renderPagebar(c, current) {
    return '<div class="sc-pagebar"><div class="sc-wrap sc-pagebar-in">' +
      '<a class="sc-backlink" href="#overview">' + icon('arrow-left') + '<span>Overview</span></a>' +
      renderStepper(c, current) +
    '</div></div>';
  }

  function renderModuleNav(c, i) {
    var total = c.modules.length;
    var prev, next;
    if (i === 0) {
      prev = { href: '#overview', kicker: 'Back to', title: 'Course overview' };
    } else {
      prev = { href: '#module-' + i, kicker: 'Previous', title: shortTitle(c.modules[i - 1].title) };
    }
    if (i === total - 1) {
      next = c.finish
        ? { href: '#finish', kicker: 'Wrap up', title: 'Finish the course' }
        : { href: '#overview', kicker: 'Back to', title: 'Course overview' };
    } else {
      next = { href: '#module-' + (i + 2), kicker: 'Next', title: shortTitle(c.modules[i + 1].title) };
    }
    return '<div class="sc-wrap"><div class="sc-mnav">' +
      '<a class="sc-mnav-a prev" href="' + esc(prev.href) + '">' +
        '<span class="sc-mnav-k">' + icon('arrow-left') + ' ' + esc(prev.kicker) + '</span>' +
        '<span class="sc-mnav-t">' + esc(prev.title) + '</span></a>' +
      '<a class="sc-mnav-a next" href="' + esc(next.href) + '">' +
        '<span class="sc-mnav-k">' + esc(next.kicker) + ' ' + icon('arrow-right') + '</span>' +
        '<span class="sc-mnav-t">' + esc(next.title) + '</span></a>' +
    '</div></div>';
  }

  function renderOverview(c) {
    return renderHero(c) +
      renderCreators(c) +
      renderOutcomes(c) +
      renderSetup(c) +
      renderSyllabus(c);
  }

  function renderModuleView(c, i) {
    var m = c.modules[i];
    return renderPagebar(c, i) +
      '<section class="sc-section sc-moduleview"><div class="sc-wrap">' +
        '<span class="sc-eyebrow sc-mcount">Module ' + (i + 1) + ' of ' + c.modules.length + '</span>' +
        '<div class="sc-modules">' + buildModule(m, i, c.creators || {}) + '</div>' +
      '</div></section>' +
      renderModuleNav(c, i);
  }

  function renderFinishView(c) {
    var last = c.modules ? c.modules.length : 0;
    return renderPagebar(c, -1) +
      renderFinish(c) +
      '<div class="sc-wrap"><div class="sc-mnav" style="margin-top:32px">' +
        '<a class="sc-mnav-a prev" href="#module-' + last + '">' +
          '<span class="sc-mnav-k">' + icon('arrow-left') + ' Previous</span>' +
          '<span class="sc-mnav-t">' + esc(last ? shortTitle(c.modules[last - 1].title) : 'Modules') + '</span></a>' +
        '<a class="sc-mnav-a next" href="#overview">' +
          '<span class="sc-mnav-k">Back to ' + icon('arrow-right') + '</span>' +
          '<span class="sc-mnav-t">Course overview</span></a>' +
      '</div></div>';
  }

  /* Router state (one paged course per page — matches the embed model). */
  var state = null;
  var hashBound = false;

  function currentView(c) {
    var h = String(global.location && global.location.hash || '').replace(/^#/, '');
    var m = h.match(/^module-(\d+)$/);
    var total = (c.modules || []).length;
    if (m) {
      var n = parseInt(m[1], 10);
      if (n >= 1 && n <= total) return { view: 'module', index: n - 1 };
    }
    if (h === 'finish' && c.finish) return { view: 'finish' };
    return { view: 'overview' };
  }

  function renderView(doScroll) {
    if (!state) return;
    var c = state.data, root = state.root;
    var v = currentView(c);
    if (v.view === 'module') root.innerHTML = renderModuleView(c, v.index);
    else if (v.view === 'finish') root.innerHTML = renderFinishView(c);
    else root.innerHTML = renderOverview(c);
    runIcons();
    if (doScroll) {
      try { root.scrollIntoView({ block: 'start' }); }
      catch (e) { global.scrollTo(0, 0); }
    }
  }

  function onHashChange() { renderView(true); }

  function runIcons() {
    if (global.lucide && typeof global.lucide.createIcons === 'function') {
      global.lucide.createIcons();
    }
  }

  /* ---------- public API ---------- */

  function render(data, mount, opts) {
    opts = opts || {};
    var root = typeof mount === 'string' ? document.querySelector(mount) : mount;
    if (!root) { console.error('[STRIVECourse] mount not found'); return; }
    root.id = root.id || 'strive-course';
    if (root.id !== 'strive-course') {
      // Engine styles are scoped to #strive-course; enforce it.
      root.setAttribute('data-sc-warn', 'mount id should be "strive-course"');
    }
    if (!data) { root.innerHTML = '<div class="sc-error">No course data.</div>'; return; }

    // Paged by default when the course has 2+ modules; opt out with paged:false.
    var paged = (opts.paged !== undefined)
      ? !!opts.paged
      : !!(data.modules && data.modules.length > 1);
    PAGED = paged;

    if (!paged) {
      state = null;
      root.innerHTML =
        renderHero(data) +
        renderCreators(data) +
        renderOutcomes(data) +
        renderSetup(data) +
        renderModules(data) +
        renderFinish(data);
      runIcons();
      return root;
    }

    state = { data: data, root: root };
    if (!hashBound && global.addEventListener) {
      global.addEventListener('hashchange', onHashChange);
      hashBound = true;
    }
    renderView(false); // honors a deep link like #module-3 on first paint
    return root;
  }

  function load(opts) {
    opts = opts || {};
    var mount = opts.mount || '#strive-course';
    var root = typeof mount === 'string' ? document.querySelector(mount) : mount;
    if (root) root.id = 'strive-course';

    if (opts.data) return Promise.resolve(render(opts.data, mount, opts));

    if (!opts.url) { console.error('[STRIVECourse] load() needs data or url'); return; }
    if (root) root.innerHTML = '<div class="sc-loading">Loading course…</div>';

    var headers = opts.headers || {};
    return fetch(opts.url, { headers: headers })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (payload) {
        // Xano may return the record directly, or wrapped. Accept either
        // the course object, or { course_json: {...} }, or an array [record].
        var data = payload;
        if (Array.isArray(payload)) data = payload[0] || {};
        if (data && data.course_json) data = data.course_json;
        // course_json may be a JSON string in Xano — parse if so.
        if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) {} }
        return render(data, mount, opts);
      })
      .catch(function (err) {
        console.error('[STRIVECourse] load failed', err);
        if (root) root.innerHTML = '<div class="sc-error">Couldn’t load this course. Please refresh.</div>';
      });
  }

  global.STRIVECourse = { render: render, load: load, version: '1.1.0' };
})(typeof window !== 'undefined' ? window : this);
