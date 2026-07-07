/* ============================================================
   STRIVE Library Engine — strive-library.js
   Renders the course library: a unified, filterable catalog of
   full courses + mini-lessons, fetched from the Xano list endpoints.
   Parallel to and independent of the course / lesson engines
   (different namespace, no shared code). Scoped under #strive-library.

   Usage (Webflow page):
     - Link the stylesheet:   strive-library.css
     - Add an empty mount:    div#strive-library
     - Add a script tag:      strive-library.js
     - Then call:
         STRIVELibrary.load({
           mount: '#strive-library',
           coursesUrl: XANO_BASE + '/courses',
           lessonsUrl: XANO_BASE + '/lessons',
           // optional — where a card links to (defaults shown):
           courseHref: function (it) { return '/course?course_id=' + encodeURIComponent(it.slug); },
           lessonHref: function (it) { return '/mini-lesson?slug=' + encodeURIComponent(it.slug); }
         });
     See webflow-library-embed.html for the exact markup.

   Data contract (per item):
     /courses  -> { title, slug, category, level, duration, is_premium,
                    status, competency_id, _competency:{ name, slug,
                    _domain:{ name, slug } } }
     /lessons  -> { title, slug, skill_id, status, competency_id,
                    _competency:{ name, slug, _domain:{ name, slug } } }

   Requires Lucide (unpkg) for icons; calls lucide.createIcons() after render.
   ============================================================ */
(function (global) {
  'use strict';

  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var icon = function (name) { return name ? '<i data-lucide="' + esc(name) + '"></i>' : ''; };
  var isPub = function (x) { return String(x && x.status || '').toLowerCase() === 'published' || !(x && x.status); };
  var compName = function (x) { return (x._competency && x._competency.name) || x.competency || ''; };
  var domainShort = function (name) { return String(name == null ? '' : name).replace(/^Domain\s*\d+:\s*/, ''); };
  var domName = function (x) { return domainShort(x._competency && x._competency._domain && x._competency._domain.name); };

  /* sample lengths + completion until those data paths exist (see STRIVE Tasks) */
  var LESSON_MIN = [6, 7, 5, 8, 6, 5, 7, 9, 6, 5, 8, 7, 9, 6, 5, 7, 8, 9];

  function normalize(courses, lessons, opts) {
    // Default to the Webflow CMS detail pages (slugs mirror Xano 1:1):
    //   courses -> /courses-catalog/<slug>   lessons -> /lessons/<slug>
    var courseHref = opts.courseHref || function (it) { return '/courses-catalog/' + encodeURIComponent(it.slug); };
    var lessonHref = opts.lessonHref || function (it) { return '/lessons/' + encodeURIComponent(it.slug); };
    var out = [];
    (courses || []).filter(isPub).forEach(function (c) {
      var it = {
        type: 'course', label: 'Course', grad: 'var(--slib-grad-soft)', image: c.image || null,
        title: c.title, slug: c.slug, competency: compName(c), domain: domName(c) || c.category || 'General',
        length: c.duration || '', done: false
      };
      it.href = courseHref(it);
      it.search = [c.title, c.category, it.competency, it.domain, c.level].join(' ').toLowerCase();
      out.push(it);
    });
    (lessons || []).filter(isPub).forEach(function (l, i) {
      var it = {
        type: 'lesson', label: 'Mini-lesson', grad: 'var(--slib-grad-deep)', image: l.image || null,
        title: l.title, slug: l.slug, competency: compName(l), domain: domName(l),
        length: '~' + LESSON_MIN[i % LESSON_MIN.length] + ' min', done: false
      };
      it.href = lessonHref(it);
      it.search = [l.title, it.competency, it.domain].join(' ').toLowerCase();
      out.push(it);
    });
    return out;
  }

  function cardHTML(it) {
    var bg = it.image ? "center/cover url('" + esc(it.image) + "')" : it.grad;
    var done = it.done
      ? '<span class="slib-done" title="Completed">' + icon('check') + '</span>'
      : '<span class="slib-done is-todo" title="Not started">' + icon('circle') + '</span>';
    return '<article class="slib-card is-' + it.type + '" role="link" tabindex="0" data-href="' + esc(it.href) + '">' +
      '<div class="slib-band" style="background:' + bg + '">' +
        '<div class="slib-brow">' +
          '<span class="slib-chip">' + icon(it.type === 'course' ? 'graduation-cap' : 'zap') + esc(it.label) + '</span>' +
          done +
        '</div>' +
        '<h3>' + esc(it.title) + '</h3>' +
      '</div>' +
      '<div class="slib-body">' +
        '<div class="slib-domain">' + icon('layers') + esc(it.domain) + '</div>' +
        (it.competency ? '<span class="slib-comp">' + icon('badge-check') + esc(it.competency) + '</span>' : '') +
        '<div class="slib-foot">' +
          '<span class="slib-length">' + icon('clock') + esc(it.length || '—') + '</span>' +
          '<span class="slib-go">' + (it.done ? 'Review' : 'Start') + ' ' + icon('arrow-right') + '</span>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function mountEl(mount) {
    var root = typeof mount === 'string' ? document.querySelector(mount) : mount;
    if (root) root.id = 'strive-library';
    return root;
  }

  /* render a normalized item list into the mount, wiring filter + search */
  function render(items, mount) {
    var root = mountEl(mount || '#strive-library');
    if (!root) { console.error('[STRIVELibrary] mount not found'); return; }
    var state = { k: 'all', q: '' };

    root.innerHTML =
      '<div class="slib-wrap">' +
        '<span class="slib-eyebrow">Course library</span>' +
        '<h1 class="slib-title">Browse the library</h1>' +
        '<p class="slib-lede">Curated, free learning for every stage of your digital delivery journey — full courses to build a skill end-to-end, and mini-lessons to master one thing fast.</p>' +
        '<div class="slib-controls">' +
          '<div class="slib-search">' + icon('search') + '<input type="text" placeholder="Search courses, lessons, tools, topics"></div>' +
          '<span class="slib-count"></span>' +
        '</div>' +
        '<div class="slib-segment">' +
          '<button data-k="all" class="is-active">All</button>' +
          '<button data-k="course"><span class="slib-dot"></span>Courses</button>' +
          '<button data-k="lesson"><span class="slib-dot"></span>Mini-lessons</button>' +
        '</div>' +
        '<div class="slib-grid"></div>' +
      '</div>';

    var grid = root.querySelector('.slib-grid');
    var count = root.querySelector('.slib-count');
    var input = root.querySelector('.slib-search input');
    var seg = root.querySelector('.slib-segment');

    function draw() {
      var list = items.filter(function (i) { return state.k === 'all' || i.type === state.k; });
      if (state.q) list = list.filter(function (i) { return i.search.indexOf(state.q) !== -1; });
      var nc = items.filter(function (i) { return i.type === 'course'; }).length;
      var nl = items.filter(function (i) { return i.type === 'lesson'; }).length;
      count.textContent = nc + ' course' + (nc !== 1 ? 's' : '') + ' · ' + nl + ' mini-lesson' + (nl !== 1 ? 's' : '');
      if (!list.length) {
        grid.innerHTML = '<div class="slib-empty">' + icon('search-x') + '<p>Nothing matches that</p><span>Try a different search or filter.</span></div>';
      } else {
        grid.innerHTML = list.map(cardHTML).join('');
        [].forEach.call(grid.querySelectorAll('.slib-card'), function (elm) {
          var go = function () { var h = elm.getAttribute('data-href'); if (h) global.location.href = h; };
          elm.addEventListener('click', go);
          elm.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
        });
      }
      if (global.lucide && typeof global.lucide.createIcons === 'function') global.lucide.createIcons();
    }

    seg.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.k = b.getAttribute('data-k');
      [].forEach.call(seg.querySelectorAll('button'), function (x) { x.classList.toggle('is-active', x === b); });
      draw();
    });
    input.addEventListener('input', function (e) { state.q = e.target.value.trim().toLowerCase(); draw(); });

    draw();
    return root;
  }

  /* fetch both endpoints, normalize, render */
  function load(opts) {
    opts = opts || {};
    var mount = opts.mount || '#strive-library';
    var root = mountEl(mount);

    if (opts.courses || opts.lessons) {
      return Promise.resolve(render(normalize(opts.courses || [], opts.lessons || [], opts), mount));
    }
    if (!opts.coursesUrl && !opts.lessonsUrl) { console.error('[STRIVELibrary] load() needs coursesUrl/lessonsUrl or courses/lessons data'); return; }
    if (root) root.innerHTML = '<div class="slib-wrap"><div class="slib-grid"><div class="slib-skel"></div><div class="slib-skel"></div><div class="slib-skel"></div></div></div>';

    var headers = opts.headers || {};
    var getJSON = function (url) {
      if (!url) return Promise.resolve([]);
      return fetch(url, { headers: headers }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    };
    return Promise.all([getJSON(opts.coursesUrl), getJSON(opts.lessonsUrl)])
      .then(function (res) {
        var courses = Array.isArray(res[0]) ? res[0] : (res[0] && res[0].items) || [];
        var lessons = Array.isArray(res[1]) ? res[1] : (res[1] && res[1].items) || [];
        return render(normalize(courses, lessons, opts), mount);
      })
      .catch(function (err) {
        console.error('[STRIVELibrary] load failed', err);
        if (root) root.innerHTML = '<div class="slib-wrap"><div class="slib-error">Couldn’t load the library. Please refresh.</div></div>';
      });
  }

  global.STRIVELibrary = { render: render, load: load, normalize: normalize, version: '1.0.0' };
})(typeof window !== 'undefined' ? window : this);
