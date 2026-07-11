/* ============================================================
   STRIVE Lesson Engine — renderer
   v1.0 · Renders a lesson from a data object into #strive-lesson.

   Usage (on a Webflow lesson template page):
     <div id="strive-lesson"></div>
     <script src=".../strive-lesson.js"></script>
     <script>STRIVE.renderLesson(LESSON_DATA);</script>

   LESSON_DATA shape is documented in lesson.schema.json.
   Each "section" has a type; each section may contain "blocks".
   Block + widget types are registered below and easy to extend.
   ============================================================ */
(function (global) {
  "use strict";

  /* ---------- tiny DOM helpers ---------- */
  const esc = (s) => String(s == null ? "" : s);
  // NOTE: lesson copy may legitimately contain <b>, <i>, <br> etc.
  // Content is authored by STRIVE (trusted), so inline HTML is allowed.
  const h = (html) => html;

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* ---------- BLOCK RENDERERS ----------
     Each takes a block object, returns an HTMLElement (or string of HTML).
     Add a new key here to support a new block type in content. */
  const BLOCKS = {
    paragraph: (b) => `<p class="sl-${b.lead ? "lead" : "body"}">${h(b.text)}</p>`,

    note: (b) =>
      `<div class="sl-note ${b.tone === "warn" ? "sl-warn" : ""}">
         <span class="sl-note__i">${esc(b.label || "Key")}</span>
         <span class="sl-note__t">${h(b.text)}</span>
       </div>`,

    terms: (b) =>
      `<div class="sl-terms">${b.items
        .map(
          (t) =>
            `<div class="sl-card sl-tcard">
               <div class="sl-tcard__w"><span class="sl-ic ${t.accent === "orange" ? "sl-o" : ""}"></span>${esc(t.term)}</div>
               <div class="sl-tcard__d">${h(t.def)}</div>
             </div>`
        )
        .join("")}</div>`,

    flow: (b) =>
      `<div class="sl-flow">${b.steps
        .map(
          (s, i) =>
            `<div class="sl-card sl-fstep ${i >= (b.warmFrom ?? 99) ? "sl-warm" : ""}">
               <div class="sl-fstep__n">${i + 1}</div>
               <div><div class="sl-fstep__t">${esc(s.title)}</div>
               <div class="sl-fstep__d">${h(s.text)}</div></div>
             </div>`
        )
        .join("")}</div>`,

    split: (b) =>
      `<div class="sl-split">
         <div class="sl-card sl-panel"><h3><span class="sl-tag" style="background:${b.left.tagColor || "#7c8d95"}">${esc(b.left.tag)}</span> ${esc(b.left.title)}</h3>
           <div class="sl-code">${h(b.left.body)}</div></div>
         <div class="sl-card sl-panel"><h3><span class="sl-tag" style="background:var(--sl-cyan)">${esc(b.right.tag)}</span> ${esc(b.right.title)}</h3>
           ${b.right.nodes
             .map(
               (n, i) =>
                 `<div class="sl-vnode"><span class="sl-pin ${n.accent === "orange" ? "sl-o" : ""}"></span> ${esc(n.label)}${n.sub ? `<small>${esc(n.sub)}</small>` : ""}</div>${i < b.right.nodes.length - 1 ? '<div class="sl-vconn"></div>' : ""}`
             )
             .join("")}</div>
       </div>`,

    hint: (b) => `<p class="sl-nudge" style="text-align:left;margin-top:18px">${h(b.text)}</p>`,
  };

  /* ---------- WIDGET RENDERERS ----------
     Interactive modules. Each returns {html, mount(rootEl)} where mount
     wires up behaviour after the HTML is in the DOM. */
  const WIDGETS = {
    /* ----- tappable case cards (judgement exercise) ----- */
    caseCards(w) {
      const html = `
        <div class="sl-cases">
          ${w.cases
            .map(
              (c, i) =>
                `<div class="sl-card sl-case" data-good="${c.good ? 1 : 0}" data-i="${i}">
                   <span class="sl-case__verdict"></span>
                   <span class="sl-case__i">${esc(c.icon || "•")}</span>
                   <div class="sl-case__t">${esc(c.title)}</div>
                   <div class="sl-case__d">${h(c.desc)}</div>
                   <div class="sl-case__why">${h(c.why)}</div>
                 </div>`
            )
            .join("")}
        </div>
        <div class="sl-scorestrip"><span data-hint>${esc(w.hintStart || "Tap the cards.")}</span></div>`;
      return {
        html,
        mount(root) {
          const goodTotal = w.cases.filter((c) => c.good).length;
          let picked = 0;
          const hint = root.querySelector("[data-hint]");
          root.querySelectorAll(".sl-case").forEach((card) => {
            card.addEventListener("click", () => {
              if (card.classList.contains("is-good") || card.classList.contains("is-bad")) return;
              const good = card.dataset.good === "1";
              card.classList.add(good ? "is-good" : "is-bad");
              card.querySelector(".sl-case__verdict").textContent = good ? (w.goodLabel || "GOOD FIT ✓") : (w.badLabel || "NOT THE TOOL");
              if (good) picked++;
              if (picked === goodTotal && hint) hint.innerHTML = w.hintDone || "✓ All good fits found.";
              else if (hint) hint.innerHTML = `Found <b>${picked} / ${goodTotal}</b> — keep going.`;
            });
          });
        },
      };
    },

    /* ----- weighted maturity matrix (sliders → score) ----- */
    maturityMatrix(w) {
      const levels = w.levels; // [{name,color}]
      const rows = w.rows; // [{name,weight}]
      const html = `
        <div class="sl-card sl-matrix">
          <div class="sl-firm">${esc(w.subject || "")}</div>
          <div class="sl-mtitle">${esc(w.title || "Capability assessment")}</div>
          <div data-rows></div>
          <div class="sl-scorebar">
            <div><div class="sl-score-num" data-score>—</div><div class="sl-score-lab">${esc(w.scoreLabel || "weighted score")}</div></div>
            <div class="sl-verdict" data-verdict>${esc(w.verdictStart || "Set a level on each row.")}</div>
          </div>
        </div>
        <p class="sl-hint" data-hint></p>`;
      return {
        html,
        mount(root) {
          const state = rows.map(() => null);
          const rowsEl = root.querySelector("[data-rows]");
          rows.forEach((r, ri) => {
            const row = el("div", "sl-row");
            row.innerHTML = `<div class="sl-row__head"><span class="sl-row__name">${esc(r.name)}</span>
              <span class="sl-row__val" data-val="${ri}">×${r.weight} weight</span></div>
              <div class="sl-track" data-track="${ri}" style="grid-template-columns:repeat(${levels.length},1fr)"></div>`;
            rowsEl.appendChild(row);
            const track = row.querySelector(`[data-track="${ri}"]`);
            levels.forEach((lv, li) => {
              const cell = el("div", "sl-cell", "L" + li);
              cell.addEventListener("click", () => setLevel(ri, li));
              track.appendChild(cell);
            });
          });
          function setLevel(ri, li) {
            state[ri] = li;
            const cells = root.querySelectorAll(`[data-track="${ri}"] .sl-cell`);
            cells.forEach((c, ci) => {
              const on = ci <= li;
              c.classList.toggle("is-on", on);
              c.style.background = on ? levels[li].color : "";
            });
            const v = root.querySelector(`[data-val="${ri}"]`);
            v.textContent = `L${li} · ${levels[li].name}`;
            v.style.background = levels[li].color;
            compute();
          }
          function compute() {
            const hint = root.querySelector("[data-hint]");
            if (state.includes(null)) {
              if (hint) hint.textContent = `${state.filter((s) => s !== null).length}/${rows.length} scored…`;
              return;
            }
            let totW = 0, acc = 0;
            rows.forEach((r, i) => { totW += r.weight; acc += state[i] * r.weight; });
            const score = acc / totW;
            const num = root.querySelector("[data-score]");
            num.textContent = score.toFixed(1);
            num.style.color = levels[Math.round(score)].color;
            const band = w.verdicts.find((b) => score < b.below) || w.verdicts[w.verdicts.length - 1];
            root.querySelector("[data-verdict]").innerHTML = band.text;
            if (hint) hint.innerHTML = w.hintDone || "✓ Benchmark complete.";
          }
        },
      };
    },

    /* ----- parametric node graph (sliders → generated geometry) ----- */
    nodeGraph(w) {
      const html = `
        <div class="sl-card sl-lab">
          <div class="sl-lab__head">
            <div class="sl-lab__title"><span class="sl-dotg"></span>${esc(w.fileName || "graph.gh — live")}</div>
            <button class="sl-btn sl-ghost" style="margin:0;padding:8px 14px" data-rand>⚡ ${esc(w.randomLabel || "Randomize")}</button>
          </div>
          <div class="sl-lab__body">
            <div class="sl-graph" data-graph>
              <svg class="sl-wires" data-wires><path class="sl-wire" data-w1></path><path class="sl-wire" data-w2></path></svg>
              <div class="sl-gnode" data-node="rad" style="left:18px;top:34px">
                <div class="sl-gnode__h" style="background:var(--sl-cyan)">◆ ${esc(w.inputs[0].label)}</div>
                <div class="sl-gnode__b"><output data-out="rad">${w.inputs[0].value}</output>
                  <input type="range" data-in="rad" min="${w.inputs[0].min}" max="${w.inputs[0].max}" step="${w.inputs[0].step}" value="${w.inputs[0].value}"></div>
                <span class="sl-gport is-lit" data-port="radout"></span>
              </div>
              <div class="sl-gnode" data-node="cnt" style="left:18px;top:200px">
                <div class="sl-gnode__h" style="background:var(--sl-cyan)">◆ ${esc(w.inputs[1].label)}</div>
                <div class="sl-gnode__b"><output data-out="cnt">${w.inputs[1].value}</output>
                  <input type="range" data-in="cnt" min="${w.inputs[1].min}" max="${w.inputs[1].max}" step="${w.inputs[1].step}" value="${w.inputs[1].value}"></div>
                <span class="sl-gport is-lit" data-port="cntout"></span>
              </div>
              <div class="sl-gnode" data-node="build" style="left:212px;top:116px;width:162px">
                <div class="sl-gnode__h" style="background:var(--sl-orange)">⬢ ${esc(w.buildLabel || "Build")}</div>
                <div class="sl-gnode__b"><label>${esc(w.inputs[2].label)}</label><output data-out="twist" style="font-size:13px">${w.inputs[2].value}°</output>
                  <input type="range" data-in="twist" min="${w.inputs[2].min}" max="${w.inputs[2].max}" step="${w.inputs[2].step}" value="${w.inputs[2].value}"></div>
                <span class="sl-gport sl-in is-lit" data-port="in1" style="top:34%"></span>
                <span class="sl-gport sl-in is-lit" data-port="in2" style="top:66%"></span>
              </div>
            </div>
            <div class="sl-preview">
              <h4>${esc(w.previewTitle || "Geometry preview")}</h4>
              <div class="sl-stage"><svg data-stage viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet"></svg></div>
              <div class="sl-readout" data-readout></div>
              <div class="sl-trace" data-trace></div>
              <div class="sl-nudge" data-nudge>${esc(w.nudge || "↑ try dragging an input")}</div>
            </div>
          </div>
        </div>`;
      return {
        html,
        mount(root) {
          const graph = root.querySelector("[data-graph]");
          const sRad = root.querySelector('[data-in="rad"]');
          const sCnt = root.querySelector('[data-in="cnt"]');
          const sTwist = root.querySelector('[data-in="twist"]');
          let interacted = false;
          function drawWires() {
            const g = graph.getBoundingClientRect();
            const pt = (sel) => { const r = root.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2 - g.left, y: r.top + r.height / 2 - g.top }; };
            const set = (sel, a, b) => { const dx = (b.x - a.x) * .5; root.querySelector(sel).setAttribute("d", `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`); };
            set("[data-w1]", pt('[data-port="radout"]'), pt('[data-port="in1"]'));
            set("[data-w2]", pt('[data-port="cntout"]'), pt('[data-port="in2"]'));
          }
          function render() {
            const radius = parseFloat(sRad.value), sides = parseInt(sCnt.value), twist = parseInt(sTwist.value);
            root.querySelector('[data-out="rad"]').textContent = radius.toFixed(1);
            root.querySelector('[data-out="cnt"]').textContent = sides;
            root.querySelector('[data-out="twist"]').textContent = twist + "°";
            const floors = 6, cx = 100, cyTop = 24, cyBot = 176, R = radius * 7;
            const ring = (level) => {
              const cy = cyBot + (cyTop - cyBot) * (level / (floors - 1));
              const scale = 1 - level * 0.07, rot = (twist * Math.PI / 180) * (level / (floors - 1));
              const pts = [];
              for (let i = 0; i < sides; i++) { const a = rot + i * 2 * Math.PI / sides - Math.PI / 2; pts.push([cx + Math.cos(a) * R * scale, cy + Math.sin(a) * R * scale * 0.5]); }
              return pts;
            };
            let svg = ""; const rings = []; for (let l = 0; l < floors; l++) rings.push(ring(l));
            for (let i = 0; i < sides; i++) { let d = "M"; for (let l = 0; l < floors; l++) { d += `${rings[l][i][0].toFixed(1)},${rings[l][i][1].toFixed(1)} ` + (l < floors - 1 ? "L" : ""); } svg += `<path d="${d}" fill="none" stroke="rgba(22,196,246,0.35)" stroke-width="1"/>`; }
            rings.forEach((r, l) => { let d = "M" + r.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L") + " Z"; const top = l === floors - 1; svg += `<path d="${d}" fill="${top ? "rgba(252,130,4,0.12)" : "rgba(22,196,246,0.06)"}" stroke="${top ? "#fc8204" : "#05a9d8"}" stroke-width="${top ? 2 : 1.4}"/>`; });
            root.querySelector("[data-stage]").innerHTML = svg;
            root.querySelector("[data-readout]").innerHTML = `radius <b>${radius.toFixed(1)}m</b> · sides <b>${sides}</b> · twist <b>${twist}°</b><br>→ <b>${sides * floors}</b> vertices, <b>${sides}</b> vertical edges.`;
            root.querySelector("[data-trace]").innerHTML =
              `<span class="sl-arrow">▸</span> Number(radius=${radius.toFixed(1)}) ready<br>` +
              `<span class="sl-arrow">▸</span> Number(sides=${sides}) ready<br>` +
              `<span class="sl-arrow">▸</span> Loft computes → ${sides * floors} pts<br>` +
              `<span class="sl-arrow">▸</span> Preview updated ✓`;
            if (interacted) root.querySelector("[data-nudge]").style.display = "none";
            drawWires();
          }
          [sRad, sCnt, sTwist].forEach((s) => s.addEventListener("input", () => { interacted = true; render(); }));
          root.querySelector("[data-rand]").addEventListener("click", () => {
            interacted = true;
            sRad.value = (Math.random() * 7 + 2).toFixed(1);
            sCnt.value = Math.floor(Math.random() * 13 + 3);
            sTwist.value = Math.floor(Math.random() * 13) * 5;
            render();
          });
          global.addEventListener("resize", drawWires);
          setTimeout(render, 60); setTimeout(drawWires, 300);
          // re-measure when scrolled into view (layout may have been 0-width before)
          new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { render(); drawWires(); } }), { threshold: .25 }).observe(graph);
        },
      };
    },
  };

  /* ---------- COMPLETION ----------
     Posts a lesson completion to Xano when the quiz is passed all-correct.
     No-op unless ctx has completeUrl + authToken + slug (i.e. a logged-in
     member on a wired lesson page). The server re-grades `answers` against
     the lesson's stored quiz — the client result is never trusted. */
  function postCompletion(ctx, selections, score, total) {
    if (!ctx || !ctx.completeUrl || !ctx.authToken || !ctx.slug) return;
    try {
      fetch(ctx.completeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + ctx.authToken },
        body: JSON.stringify({ slug: ctx.slug, answers: selections, score: score, total: total }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => { if (res && res.passed && typeof ctx.onComplete === "function") { try { ctx.onComplete(res); } catch (e) {} } })
        .catch(() => {});
    } catch (e) {}
  }

  /* ---------- QUIZ (one per lesson, multi-question) ----------
     Completion rule: EVERY question must be answered correctly. A wrong
     answer still reveals the correct one (learning), but blocks completion
     and offers a retry. Completion fires once, on the final question. */
  function buildQuiz(quiz, ctx) {
    const wrap = el("div", "sl-card sl-quiz");
    wrap.innerHTML = `<div class="sl-qmeta" data-qmeta></div><div class="sl-q" data-qtext></div>
      <div class="sl-opts" data-opts></div><div class="sl-fb" data-fb></div>
      <div class="sl-qnav" data-qnav></div>`;
    const total = quiz.questions.length;
    const selections = new Array(total).fill(null);
    const correctFlags = new Array(total).fill(false);
    let qi = 0, answered = false, done = false;
    if (ctx && ctx.completed) wrap.classList.add("is-complete");

    function finish() {
      if (done) return; done = true;
      const score = correctFlags.filter(Boolean).length;
      const nav = wrap.querySelector("[data-qnav]");
      if (score === total) {
        wrap.classList.add("is-complete");
        nav.innerHTML = `<span class="sl-quiz__done" style="color:var(--sl-cyan-deep)">✓ ${esc(quiz.doneText || "Lesson complete — all answers correct.")}</span>`;
        postCompletion(ctx, selections, score, total);
      } else {
        nav.innerHTML = `<span class="sl-quiz__retry" style="color:#e28001">${score} / ${total} correct — every answer must be correct to complete this lesson. <button data-retry style="margin-left:8px;padding:6px 12px;border:0;border-radius:8px;background:var(--sl-cyan-deep,#006879);color:#fff;font:inherit;cursor:pointer">Try again ↺</button></span>`;
        nav.querySelector("[data-retry]").addEventListener("click", () => {
          qi = 0; done = false; answered = false; selections.fill(null); correctFlags.fill(false); load();
        });
      }
      nav.classList.add("is-show");
    }

    function load() {
      answered = false;
      const Q = quiz.questions[qi];
      wrap.querySelector("[data-qmeta]").textContent = `Question ${qi + 1} of ${total}`;
      wrap.querySelector("[data-qtext]").innerHTML = h(Q.q);
      const fb = wrap.querySelector("[data-fb]"); fb.classList.remove("is-show"); fb.innerHTML = "";
      const nav = wrap.querySelector("[data-qnav]");
      nav.classList.remove("is-show");
      nav.innerHTML = qi < total - 1 ? `<button data-next>Next question →</button>` : "";
      if (qi < total - 1) nav.querySelector("[data-next]").addEventListener("click", () => { qi++; load(); });
      const opts = wrap.querySelector("[data-opts]"); opts.innerHTML = "";
      Q.options.forEach((o, idx) => {
        const b = el("button", "sl-opt", `<span class="sl-key">${String.fromCharCode(65 + idx)}</span> ${esc(o.text)}`);
        b.addEventListener("click", () => {
          if (answered) return; answered = true;
          selections[qi] = idx;
          const correct = !!o.correct; correctFlags[qi] = correct;
          b.classList.add(correct ? "is-correct" : "is-wrong");
          if (!correct) { const ci = Q.options.findIndex((x) => x.correct); opts.children[ci].classList.add("is-correct"); }
          fb.innerHTML = correct ? h(Q.okFeedback) : h(Q.noFeedback);
          fb.classList.add("is-show");
          if (qi < total - 1) nav.classList.add("is-show");
          else finish();
        });
        opts.appendChild(b);
      });
    }
    load();
    return wrap;
  }

  /* ---------- SECTION assembly ---------- */
  function buildSection(sec, idx, lesson, ctx) {
    const s = el("section", "sl-section" + (sec.hero ? " sl-hero" : ""));
    s.id = "sl-s" + idx;
    const wrap = el("div", "sl-wrap");

    if (sec.eyebrow) wrap.appendChild(el("div", "sl-eyebrow", esc(sec.eyebrow)));
    if (sec.hero) {
      wrap.appendChild(el("h1", "sl-h1", h(sec.h1)));
    } else if (sec.h2) {
      wrap.appendChild(el("h2", "sl-h2", h(sec.h2)));
    }

    (sec.blocks || []).forEach((b) => {
      if (b.type === "widget") {
        const factory = WIDGETS[b.widget];
        if (factory) {
          const inst = factory(b.config || {});
          const holder = el("div");
          holder.innerHTML = inst.html;
          // move children out of holder into wrap, then mount against wrap
          while (holder.firstChild) wrap.appendChild(holder.firstChild);
          // defer mount until in DOM
          s._mounts = s._mounts || [];
          s._mounts.push(inst.mount);
        }
      } else if (b.type === "quiz") {
        wrap.appendChild(buildQuiz(b.config, ctx));
      } else if (b.type === "recap") {
        const r = el("div", "sl-recap");
        r.innerHTML = b.items.map((t, i) => `<div class="sl-card sl-rc"><span class="sl-rc__i">${String(i + 1).padStart(2, "0")}</span><span class="sl-rc__t">${h(t)}</span></div>`).join("");
        wrap.appendChild(r);
        if (b.badge) wrap.appendChild(el("div", "sl-badge", `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg> ${esc(b.badge)}`));
        if (b.next) wrap.appendChild(el("p", "sl-next", h(b.next)));
      } else {
        const fn = BLOCKS[b.type];
        if (fn) { const node = el("div"); node.innerHTML = fn(b); while (node.firstChild) wrap.appendChild(node.firstChild); }
      }
    });

    if (sec.hero) {
      if (lesson.meta) {
        const m = el("div", "sl-meta");
        m.innerHTML = lesson.meta.map((p) => `<span class="sl-pill">${h(p)}</span>`).join("");
        wrap.appendChild(m);
      }
      const btn = el("button", "sl-btn", `${esc(lesson.startLabel || "Start lesson")} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`);
      btn.addEventListener("click", () => document.getElementById("sl-s1")?.scrollIntoView());
      wrap.appendChild(btn);
      if (lesson.readingNote) wrap.appendChild(el("div", "sl-reading", esc(lesson.readingNote)));
    }

    s.appendChild(wrap);
    return s;
  }

  /* ---------- PUBLIC: render a whole lesson ----------
     opts (all optional; omit for a public preview with no completion):
       slug        — mini_lesson slug for the completion payload (falls back to lesson.slug)
       completeUrl — POST endpoint that records completion (Xano)
       authToken   — Xano auth token for the current member (Bearer)
       completed   — true to render the quiz already marked complete
       onComplete  — callback(result) fired after a successful POST */
  function renderLesson(lesson, mountId, opts) {
    opts = opts || {};
    const ctx = {
      slug: opts.slug || lesson.slug || null,
      completeUrl: opts.completeUrl || null,
      authToken: opts.authToken || null,
      completed: !!opts.completed,
      onComplete: typeof opts.onComplete === "function" ? opts.onComplete : null,
    };
    const root = document.getElementById(mountId || "strive-lesson");
    if (!root) { console.error("STRIVE: mount #strive-lesson not found"); return; }
    root.innerHTML = "";
    root.appendChild(el("div", "sl-bg"));
    root.appendChild(el("div", "sl-glow"));

    const rail = el("div", "sl-rail"); rail.appendChild(el("div", "sl-rail__fill"));
    root.appendChild(rail);
    const dots = el("div", "sl-dots"); root.appendChild(dots);

    const sectionEls = [];
    lesson.sections.forEach((sec, i) => {
      const s = buildSection(sec, i, lesson, ctx);
      root.appendChild(s);
      sectionEls.push(s);
      const d = el("div", "sl-dot"); d.title = "Section " + (i + 1);
      d.addEventListener("click", () => s.scrollIntoView());
      dots.appendChild(d);
    });

    if (lesson.footer) root.appendChild(el("div", "sl-foot", h(lesson.footer)));

    // mount widgets now that everything is in the DOM
    sectionEls.forEach((s) => (s._mounts || []).forEach((fn) => { try { fn(s.querySelector(".sl-wrap")); } catch (e) { console.error("STRIVE widget mount error", e); } }));

    // reveal + progress
    const dotEls = [...dots.children];
    sectionEls.forEach((s) => new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) e.target.classList.add("is-in"); }), { threshold: .15 }).observe(s));
    const fill = rail.querySelector(".sl-rail__fill");
    function onScroll() {
      const docH = document.documentElement.scrollHeight - global.innerHeight;
      fill.style.width = (global.scrollY / docH * 100) + "%";
      let cur = 0;
      sectionEls.forEach((s, i) => { if (s.getBoundingClientRect().top < global.innerHeight * .5) cur = i; });
      dotEls.forEach((d, i) => { d.classList.toggle("is-active", i === cur); d.classList.toggle("is-done", i < cur); });
      if (typeof lesson.onProgress === "function") lesson.onProgress(cur, sectionEls.length);
    }
    global.addEventListener("scroll", onScroll); onScroll();
  }

  global.STRIVE = { renderLesson, BLOCKS, WIDGETS };
})(window);
