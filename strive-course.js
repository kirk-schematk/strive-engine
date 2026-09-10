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
           // checks: {          → knowledge-check tracking (optional)
           //   completeUrl: XANO + '/course/check_complete',
           //   authToken:   <member token from /memberstack_auth>,
           //   completions: <items from GET /course/check_completions>
           // }
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
        wfBlock + prBlock + renderCheck(m, i) + lmBlock +
      '</div>' +
    '</article>';
  }

  /* ---------- KNOWLEDGE CHECKS ----------
     A module may carry:
       check: { eyebrow, intro, doneText, questions: [
         { q, options:[{text,correct}], okFeedback, noFeedback,
           miniLesson:{ eyebrow,title,body,points[],note{label,text},
                        rewatch{label,start} } } ] }
     One question at a time. A WRONG answer reveals the correct option and
     expands a mini-lesson (mini-lesson engine styling) that re-teaches the
     concept, then asks the same question again. Purely additive — a module
     with no `check` renders exactly as it did before.

     Only the shell is emitted here; wireChecks() builds the questions after
     paint (the engine renders through innerHTML, so behaviour binds later). */

  /* Completion context, set by render() from opts.checks:
       { completeUrl, authToken, completions:[rows from GET /course/check_completions],
         onCheckPass }
     With a token, a passed check is POSTed to Xano and RE-GRADED there — the
     client's verdict is never trusted. Without one (signed out, or a page that
     doesn't wire auth) the check still works and remembers itself locally. */
  var CTX = { courseId: null, completeUrl: null, authToken: null, completions: {}, onCheckPass: null };

  function setCheckContext(opts, data) {
    var k = (opts && opts.checks) || {};
    var courseId = k.courseId || (data && data.courseId) || null;
    var map = {};
    (k.completions || []).forEach(function (row) {
      if (!row) return;
      var idx = (row.module_index != null) ? row.module_index : row.moduleIndex;
      if (idx == null) return;
      if (courseId && row.course_id && row.course_id !== courseId) return;
      map[idx] = { passed: !!row.passed, total: row.total, helped: row.helped || 0, server: true };
    });
    CTX = {
      courseId: courseId,
      completeUrl: k.completeUrl || null,
      authToken: k.authToken || null,
      completions: map,
      onCheckPass: (typeof k.onCheckPass === 'function') ? k.onCheckPass : null
    };
  }

  /* Fire-and-forget: the UI has already congratulated them, so a failed save
     must not undo that. The local copy keeps the state until the next load. */
  function postCheck(c, i, answers, helped, onSaved) {
    if (!CTX.completeUrl || !CTX.authToken) return;
    try {
      fetch(CTX.completeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CTX.authToken },
        body: JSON.stringify({
          course_id: c.courseId || CTX.courseId,
          module_index: i,
          answers: answers,
          helped: helped
        })
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (res) {
          if (!res || !res.passed) return;
          CTX.completions[i] = { passed: true, total: res.total, helped: helped, server: true };
          if (onSaved) { try { onSaved(res); } catch (e) {} }
          if (CTX.onCheckPass) { try { CTX.onCheckPass(res); } catch (e) {} }
        })
        .catch(function () {});
    } catch (e) {}
  }

  function checkKey(courseId, i) { return 'strive_check_' + (courseId || 'course') + '_m' + (i + 1); }

  function readCheckState(courseId, i) {
    try { var raw = global.localStorage.getItem(checkKey(courseId, i)); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function writeCheckState(courseId, i, val) {
    try { global.localStorage.setItem(checkKey(courseId, i), JSON.stringify(val)); } catch (e) {}
  }
  /* A check counts as passed if Xano says so, else if this browser remembers it. */
  function checkState(c, i) {
    var srv = CTX.completions[i];
    if (srv && srv.passed) return srv;
    return readCheckState(c && c.courseId, i);
  }
  function checkPassed(c, i) { var st = checkState(c, i); return !!(st && st.passed); }

  function renderCheck(m, i) {
    var k = m.check;
    if (!k || !k.questions || !k.questions.length) return '';
    return '<section class="sc-check" data-check="' + i + '">' +
      '<div class="sc-check-head">' +
        '<span class="sc-check-eyebrow">' + icon('target') + ' ' + esc(k.eyebrow || 'Knowledge check') + '</span>' +
        '<span class="sc-check-count" data-count></span>' +
      '</div>' +
      (k.intro ? '<p class="sc-check-intro">' + rich(k.intro) + '</p>' : '') +
      '<div class="sc-check-body" data-body></div>' +
    '</section>';
  }

  /* The reinforcement card shown after a wrong answer. */
  function miniLessonHTML(ml) {
    if (!ml) return '';
    var points = (ml.points || []).map(function (p) {
      return '<li><span class="sc-ml-pin"></span><span>' + rich(p) + '</span></li>';
    }).join('');
    var note = ml.note
      ? '<div class="sc-ml-note"><span class="sc-ml-note-l">' + esc(ml.note.label || 'Remember') + '</span>' +
        '<span class="sc-ml-note-t">' + rich(ml.note.text) + '</span></div>'
      : '';
    var rw = ml.rewatch
      ? '<button class="sc-ml-rewatch" type="button" data-rewatch="' + esc(ml.rewatch.start == null ? '' : ml.rewatch.start) + '">' +
        icon('rotate-ccw') + ' <span>' + esc(ml.rewatch.label || 'Rewatch this part') + '</span></button>'
      : '';
    return '<div class="sc-mini">' +
      '<span class="sc-mini-eyebrow">' + icon('lightbulb') + ' ' + esc(ml.eyebrow || 'Mini-lesson') + '</span>' +
      (ml.title ? '<h4 class="sc-mini-title">' + rich(ml.title) + '</h4>' : '') +
      (ml.body ? '<p class="sc-mini-body">' + rich(ml.body) + '</p>' : '') +
      (points ? '<ul class="sc-ml-points">' + points + '</ul>' : '') +
      note + rw +
    '</div>';
  }

  /* Send the module video back to the timestamp a mini-lesson points at. */
  function rewatch(section, start) {
    var art = section.closest ? section.closest('.sc-module') : null;
    var frame = art && art.querySelector('.sc-video iframe');
    if (!frame) return;
    if (start !== '' && start != null && !isNaN(parseInt(start, 10))) {
      var base = String(frame.src).split('?')[0];
      frame.src = base + '?start=' + parseInt(start, 10) + '&autoplay=1';
    }
    try { frame.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
  }

  /* Mark a passed module in the paged-mode stepper without a re-render. */
  function markStepDone(root, i) {
    var steps = root.querySelectorAll('.sc-stepnum');
    if (steps && steps[i]) steps[i].classList.add('is-done');
  }

  function wireCheck(section, c, root) {
    var i = parseInt(section.getAttribute('data-check'), 10);
    var m = (c.modules || [])[i];
    if (!m || !m.check) return;
    var qs = m.check.questions, total = qs.length;
    var body = section.querySelector('[data-body]');
    var countEl = section.querySelector('[data-count]');
    var helped = 0, qi = 0, answered = false;
    var selections = new Array(total).fill(-1);

    /* submit=true only when they just finished it — never on a restore. */
    function done(stored, submit) {
      section.classList.add('is-complete');
      countEl.innerHTML = total + ' / ' + total + ' ' + icon('badge-check');
      var h = (stored && stored.helped) || helped;
      body.innerHTML = '<div class="sc-check-done">' +
        '<div class="sc-check-done-t">' + icon('badge-check') + ' ' +
          esc(m.check.doneText || 'Check passed — you can explain every idea in this module.') + '</div>' +
        (h ? '<p class="sc-check-done-s">You worked through ' + h + ' mini-lesson' + (h > 1 ? 's' : '') +
             ' on the way. That is the part that sticks.</p>' : '') +
        '<button class="sc-check-retake" type="button" data-retake>Retake the check \u21ba</button>' +
      '</div>';
      writeCheckState(c.courseId, i, { passed: true, total: total, helped: h, at: Date.now() });
      markStepDone(root, i);
      runIcons();
      if (submit) {
        postCheck(c, i, selections, helped, function () {
          var d = body.querySelector('.sc-check-done');
          if (d && !d.querySelector('.sc-check-sync')) {
            var p = document.createElement('p');
            p.className = 'sc-check-sync';
            p.textContent = 'Saved to your STRIVE profile.';
            d.appendChild(p);
          }
        });
      } else if (stored && stored.server) {
        var d0 = body.querySelector('.sc-check-done');
        if (d0) {
          var p0 = document.createElement('p');
          p0.className = 'sc-check-sync';
          p0.textContent = 'Passed on your STRIVE profile.';
          d0.appendChild(p0);
        }
      }
      body.querySelector('[data-retake]').addEventListener('click', function () {
        section.classList.remove('is-complete');
        helped = 0; qi = 0; selections = new Array(total).fill(-1); load();
      });
    }

    function load() {
      answered = false;
      var Q = qs[qi];
      countEl.textContent = 'Question ' + (qi + 1) + ' of ' + total;
      var opts = Q.options.map(function (o, n) {
        return '<button class="sc-opt" type="button" data-opt="' + n + '">' +
          '<span class="sc-key">' + String.fromCharCode(65 + n) + '</span>' +
          '<span>' + rich(o.text) + '</span></button>';
      }).join('');
      body.innerHTML = '<div class="sc-q">' + rich(Q.q) + '</div>' +
        '<div class="sc-opts">' + opts + '</div>' +
        '<div class="sc-fb" data-fb></div>' +
        '<div class="sc-qnav" data-qnav></div>';
      runIcons();

      var fb = body.querySelector('[data-fb]');
      var nav = body.querySelector('[data-qnav]');

      Array.prototype.forEach.call(body.querySelectorAll('[data-opt]'), function (btn) {
        btn.addEventListener('click', function () {
          if (answered) return;
          answered = true;
          var all = body.querySelectorAll('[data-opt]');
          var n = parseInt(btn.getAttribute('data-opt'), 10);
          var ok = !!Q.options[n].correct;
          selections[qi] = n;
          Array.prototype.forEach.call(all, function (b) { b.classList.add('is-locked'); });
          btn.classList.add(ok ? 'is-correct' : 'is-wrong');
          if (!ok) {
            var ci = -1;
            Q.options.forEach(function (o, x) { if (o.correct && ci < 0) ci = x; });
            if (ci >= 0) all[ci].classList.add('is-correct');
          }

          if (ok) {
            fb.className = 'sc-fb is-show is-ok';
            fb.innerHTML = icon('badge-check') + '<span>' + rich(Q.okFeedback || 'Correct.') + '</span>';
            nav.innerHTML = '<button class="sc-nextq" type="button" data-next>' +
              (qi < total - 1 ? 'Next question \u2192' : 'Finish the check \u2192') + '</button>';
            nav.className = 'sc-qnav is-show';
            runIcons();
            nav.querySelector('[data-next]').addEventListener('click', function () {
              if (qi < total - 1) { qi++; load(); } else { done(null, true); }
            });
          } else {
            helped++;
            fb.className = 'sc-fb is-show is-wrong';
            fb.innerHTML = icon('circle-alert') + '<span>' +
              rich(Q.noFeedback || 'Not quite — here is the idea again.') + '</span>' +
              miniLessonHTML(Q.miniLesson);
            nav.innerHTML = '<button class="sc-nextq" type="button" data-retry>Try this question again \u21ba</button>';
            nav.className = 'sc-qnav is-show';
            runIcons();
            var rw = fb.querySelector('[data-rewatch]');
            if (rw) rw.addEventListener('click', function () { rewatch(section, rw.getAttribute('data-rewatch')); });
            nav.querySelector('[data-retry]').addEventListener('click', function () { load(); });
          }
        });
      });
    }

    var stored = checkState(c, i);
    if (stored && stored.passed) done(stored, false);
    else load();
  }

  function wireChecks(root, c) {
    if (!root || !c) return;
    Array.prototype.forEach.call(root.querySelectorAll('.sc-check'), function (sec) {
      wireCheck(sec, c, root);
    });
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
      var cls = 'sc-stepnum' + (i === current ? ' is-current' : '') + (checkPassed(c, i) ? ' is-done' : '');
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
    wireChecks(root, c);
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

    setCheckContext(opts, data);

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
      wireChecks(root, data);
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

  global.STRIVECourse = { render: render, load: load, version: '1.3.0' };
})(typeof window !== 'undefined' ? window : this);
