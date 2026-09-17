(function(){
'use strict';
var API='https://x8ki-letl-twmt.n7.xano.io/api:m2bNDxnv';
var PLATFORM='https://x8ki-letl-twmt.n7.xano.io/api:fykJB1SM';
var CDN='https://strive-engine.kirk-458.workers.dev/';
/* ?mock=1 → fixtures only, no Xano (add &stretch=1 to force the "stretch" lesson pick). */
var MOCK=/[?&]mock=1(?:&|$)/.test(location.search);
var MOCK_STRETCH=/[?&]stretch=1(?:&|$)/.test(location.search);
var SCRIPT_BASE=(function(){try{var s=document.currentScript&&document.currentScript.src;return s?s.replace(/[^\/]*$/,''):''}catch(e){return ''}})();
var FIXTURES=(SCRIPT_BASE||'./')+'docs/fixtures/';
var root=document.getElementById('strive-onboard');
if(!root)return;

/* ---- LUCIDE-STYLE SVG ICONS (no emoji, per DS) ---- */
function ic(d,s){s=s||20;return '<svg xmlns="http://www.w3.org/2000/svg" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>'}
var P={
  arrowRight:'<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  arrowLeft:'<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  checkCircle:'<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  xCircle:'<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  compass:'<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  clipboard:'<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  book:'<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  lock:'<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  layers:'<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  bldg:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M9 7h.01"/><path d="M15 7h.01"/><path d="M9 11h.01"/><path d="M15 11h.01"/><path d="M9 15h.01"/><path d="M15 15h.01"/>',
  crane:'<path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z"/><path d="M10 15V6a2 2 0 0 1 4 0v9"/><path d="M4 15v-3a8 8 0 0 1 16 0v3"/>',
  wrench:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  briefcase:'<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  trendUp:'<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  arrowUpRight:'<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>',
  monitor:'<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  box:'<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  route:'<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  clock:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  zap:'<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  playCircle:'<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>'
};

var DISC=['Architecture','Engineering','Construction','Operations & FM','Client/Owner','Other'];
var GOALS=['Level up in my current role','Step up to the next role','Move into BIM/digital','Keep my team current'];
var DISC_ICON={'Architecture':P.bldg,'Engineering':P.layers,'Construction':P.crane,'Operations & FM':P.wrench,'Client/Owner':P.briefcase,'Other':P.compass};
var GOAL_ICON={'Level up in my current role':P.trendUp,'Step up to the next role':P.arrowUpRight,'Move into BIM/digital':P.monitor,'Keep my team current':P.users};
var ARCH_ICON={Explorer:P.compass,Builder:P.box,Orchestrator:P.target,Strategist:P.route,Visionary:P.eye};

var STEPS=['About you','Assessment','Your level','Sign up'];
var st={token:null,q:null,qNum:0,disc:null,goal:null,pick:null,lessonEl:null,lessonDone:false};
var enginePromise=null;

function el(tag,cls,html){var e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}

function setStep(idx){
  var rail=document.querySelector('.onb-rail');
  if(!rail)return;
  rail.querySelectorAll('.onb-rail-step').forEach(function(s,i){
    s.classList.toggle('is-active',i===idx);
    s.classList.toggle('is-done',i<idx);
    var num=s.querySelector('.onb-rail-num');
    num.innerHTML=i<idx?ic(P.check,12):String(i+1);
  });
  rail.querySelectorAll('.onb-rail-line').forEach(function(l,i){
    l.classList.toggle('is-done',i<idx);
  });
}

/* Scroll guard: never scroll on the initial render (it jumped the page on
   load), and only once the visitor has actually interacted with the page. */
var shown=0,interacted=false;
function markInteracted(){interacted=true}
['pointerdown','keydown','touchstart'].forEach(function(ev){
  document.addEventListener(ev,markInteracted,{once:true,passive:true});
});

function show(fn,stepIdx){
  if(stepIdx!=null)setStep(stepIdx);
  root.innerHTML='';
  var w=el('div','onb-card');
  fn(w);
  root.appendChild(w);
  shown++;
  if(shown>1&&interacted)root.scrollIntoView({behavior:'smooth',block:'start'});
}

function apiCall(method,path,body){
  if(MOCK)return mockCall(path,body);
  var url=API+path;
  var opts={method:method,headers:{'Content-Type':'application/json'}};
  if(method==='GET'&&body){url+='?'+new URLSearchParams(body).toString()}
  else if(body){opts.body=JSON.stringify(body)}
  return fetch(url,opts).then(function(r){
    if(!r.ok)throw new Error('API error '+r.status);
    return r.json();
  });
}

/* Fetch JSON with retry + exponential backoff on 429 (Xano rate limit) / 5xx / network
   errors — same pattern as webflow-lesson-embed.html. Rejects after `tries`. */
function getJSONRetry(url,opts,tries){
  tries=tries||4;
  function attempt(i){
    return fetch(url,opts||{}).then(function(r){
      if(r.status===429||r.status>=500){
        if(i+1>=tries)throw new Error('API error '+r.status);
        return sleep(500*Math.pow(2,i)+Math.random()*250).then(function(){return attempt(i+1)});
      }
      if(!r.ok)throw new Error('API error '+r.status);
      return r.json();
    },function(e){
      if(i+1>=tries)throw e;
      return sleep(500*Math.pow(2,i)).then(function(){return attempt(i+1)});
    });
  }
  return attempt(0);
}

/* Session token lives in localStorage (primary) + a cookie (fallback for
   /welcome-onboard, per docs/onboarding-roadmap-spec.md) + ?onb= on the signup link. */
function saveToken(t){
  try{localStorage.setItem('strive_onboard_token',t)}catch(e){}
  try{document.cookie='strive_onb='+encodeURIComponent(t)+'; path=/; max-age=2592000; SameSite=Lax'}catch(e){}
}
function signupHref(){return '/signup'+(st.token?'?onb='+encodeURIComponent(st.token):'')}

/* ---- MOCK MODE (?mock=1) — fixtures only, nothing hits Xano ----
   onboarding_start / _answer / _teaser use the small bank below;
   onboarding_lesson_pick + mini_lesson read docs/fixtures/*.json. */
var MOCK_QS=[
  {question_id:101,stem:'A concept-stage design review needs a wall element. Which level of geometric detail is appropriate?',
   options:['Fabrication-level detail so nothing is missed later','Enough to show intent and arrangement for the decision at hand','No geometry — a placeholder note is fine','Whatever the template defaults to'],correct:1,
   ok:'Right — Level of Information Need means modelling to what the milestone needs, no more.',no:'Not quite. At concept stage the milestone only needs intent and arrangement; anything more is over-modelling.'},
  {question_id:102,stem:'Which document sets out how information will be produced and managed on a project?',
   options:['The clash report','The BIM Execution Plan (BEP)','The IFC export log','The federated model'],correct:1,
   ok:'Correct — the BEP is the how-we-work agreement for information delivery.',no:'The BEP is the document that sets out how information is produced, shared and managed.'},
  {question_id:103,stem:'A federated model is best described as…',
   options:['A single-author model with every discipline inside it','Separate discipline models linked together for coordination','A model exported to IFC','A 2D drawing set generated from a model'],correct:1,
   ok:'Yes — discipline models stay separate and are linked for coordination.',no:'Federation keeps discipline models separate and links them for coordination.'}
];
var mockState={i:0,asked:0,correct:0};
function mockQ(q){return {question_id:q.question_id,stem:q.stem,options:q.options}}
function mockCall(path,body){
  function delay(v){return sleep(350).then(function(){return v})}
  body=body||{};
  if(path==='/onboarding_start'){
    mockState={i:0,asked:0,correct:0};
    return delay({session_token:'mock-'+Date.now().toString(36),question:mockQ(MOCK_QS[0]),
      concept_card:{title:'Level of Information Need',body:'<p>Before we start: BIM is not about modelling everything. Each deliverable has a <b>Level of Information Need</b> — the geometry, data and documentation a milestone actually requires. Keep that in mind for the questions ahead.</p>'}});
  }
  if(path==='/onboarding_answer'){
    var q=MOCK_QS[mockState.i]||MOCK_QS[0];
    var ok=body.answer_index===q.correct;
    mockState.asked++;if(ok)mockState.correct++;mockState.i++;
    var done=mockState.i>=MOCK_QS.length;
    return delay({correct:ok,feedback:ok?q.ok:q.no,done:done,next_question:done?null:mockQ(MOCK_QS[mockState.i])});
  }
  if(path==='/onboarding_teaser'){
    var acc=Math.round(mockState.correct/Math.max(1,mockState.asked)*100);
    return delay({archetype:'Builder',phase_label:'Phase 2 · BIM Modeler',accuracy:acc,
      headline:'You build reliably inside the model and follow the standards you are given. The next step is owning the information — not just the geometry.'});
  }
  if(path==='/onboarding_lesson_pick'){
    return fetch(FIXTURES+'lesson_pick.json').then(function(r){return r.json()}).then(function(p){
      if(MOCK_STRETCH||(mockState.asked>0&&mockState.correct===mockState.asked)){
        p.reason='stretch';p.question_stem=null;p.phase=5;
        p.message='No gaps to close, so here is a lesson from a domain we did not test you on.';
      }
      return delay(p);
    });
  }
  if(path==='/onboarding_lesson_done')return delay({ok:true});
  return Promise.reject(new Error('No mock for '+path));
}

/* ---- PAGE SCAFFOLDING (DS onboarding chrome) ---- */
function injectScaffold(){
  var section=root.closest('section')||root.parentElement;
  var body=document.body;
  section.classList.add('onb-page');

  if(!document.querySelector('.onb-header')){
    var nav=el('header','onb-header');
    var railHtml=STEPS.map(function(s,i){
      return '<span class="onb-rail-step'+(i===0?' is-active':'')+'"><span class="onb-rail-num">'+(i+1)+'</span><span class="onb-rail-label">'+s+'</span></span>'+
        (i<STEPS.length-1?'<span class="onb-rail-line"></span>':'');
    }).join('');
    /* Progress rail only: the page already has the site navbar (logo + log in). */
    nav.innerHTML='<nav class="onb-rail" aria-label="Onboarding steps">'+railHtml+'</nav>';
    section.insertBefore(nav,section.firstChild);
  }

  if(!document.querySelector('.onb-glow-a')){
    section.insertBefore(el('div','onb-glow-b'),section.firstChild);
    section.insertBefore(el('div','onb-glow-a'),section.firstChild);
  }

  /* One short line under the header; the pitch itself lives on the home page. */
  if(!document.querySelector('.onb-hero')){
    var hero=el('div','onb-hero');
    hero.innerHTML=
      '<p class="onb-eyebrow">Your assessment</p>'+
      '<p class="onb-hero-sub">Six to eight questions. About five minutes. Your roadmap at the end.</p>';
    section.insertBefore(hero,root);
  }

  if(!document.querySelector('.onb-footer')){
    var ft=el('footer','onb-footer');
    ft.innerHTML=
      '<div class="onb-footer-inner">'+
        '<div class="onb-footer-about">'+
          '<a href="/" class="onb-footer-logo"><img src="https://cdn.prod.website-files.com/6a1704050c9a272f02d13182/6aab434f4aef72c2e3f14f5f_strive-logo-white.png" alt="STRIVE" height="22"></a>'+
          '<p>Pushing digitalization forward in buildings &amp; infrastructure — through hands-on learning, verified skills, and community.</p>'+
        '</div>'+
        '<div class="onb-footer-col"><h4>Learn</h4><a href="/catalog">Courses</a><a href="/career-paths">Career paths</a><a href="/get-started">Skill assessments</a><a href="/teams">For teams</a></div>'+
        '<div class="onb-footer-col"><h4>Community</h4><a href="/forum">Forum</a><a href="/events">Events</a><a href="/mentorship">Mentorship</a></div>'+
        '<div class="onb-footer-col"><h4>Company</h4><a href="/about">About</a><a href="/careers">Careers</a><a href="/contact">Contact</a></div>'+
      '</div>'+
      '<div class="onb-footer-bottom">'+
        '<span>© 2026 STRIVE Community</span>'+
        '<span><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></span>'+
      '</div>';
    var fl=ft.querySelector('.onb-footer-logo img');
    fl.onerror=function(){fl.parentNode.textContent='STRIVE'};
    body.appendChild(ft);
  }
}

/* ---- SCREENS ---- */
function showDiscipline(){
  show(function(w){
    w.appendChild(el('p','onb-step-eyebrow','Step 1 of 2'));
    w.appendChild(el('h2','onb-title','What’s your discipline?'));
    w.appendChild(el('p','onb-sub','Pick the area closest to your work.'));
    var g=el('div','onb-grid');
    DISC.forEach(function(d){
      var b=el('button','onb-choice','<span class="onb-choice-ico">'+ic(DISC_ICON[d]||'',19)+'</span><span>'+d+'</span>');
      b.onclick=function(){st.disc=d;showGoal()};
      g.appendChild(b);
    });
    w.appendChild(g);
  },0);
}

function showGoal(){
  show(function(w){
    w.appendChild(el('p','onb-step-eyebrow','Step 2 of 2'));
    w.appendChild(el('h2','onb-title','What’s your goal?'));
    w.appendChild(el('p','onb-sub','Choose what drives you.'));
    var g=el('div','onb-grid onb-grid--goals');
    GOALS.forEach(function(goal){
      var b=el('button','onb-choice','<span class="onb-choice-ico">'+ic(GOAL_ICON[goal]||'',19)+'</span><span>'+goal+'</span>');
      b.onclick=function(){st.goal=goal;doStart()};
      g.appendChild(b);
    });
    w.appendChild(g);
    var bk=el('button','onb-back',ic(P.arrowLeft,16)+' Back');
    bk.onclick=showDiscipline;
    w.appendChild(bk);
  },0);
}

function doStart(){
  show(function(w){
    w.appendChild(el('div','onb-spinner'));
    w.appendChild(el('p','onb-loading','Building your assessment…'));
  },1);
  apiCall('POST','/onboarding_start',{discipline:st.disc,goal:st.goal})
  .then(function(data){
    st.token=data.session_token;
    saveToken(st.token);
    st.q=data.question||data.first_question||data.next_question;
    st.qNum=1;
    if(data.concept_card&&data.concept_card.title){showCard(data.concept_card)}
    else{showIntro()}
  })
  .catch(function(e){
    show(function(w){
      w.appendChild(el('h2','onb-title','Something went wrong'));
      w.appendChild(el('p','onb-sub',e.message));
      var b=el('button','onb-btn','Try again');
      b.onclick=doStart;
      w.appendChild(b);
    },1);
  });
}

function showIntro(){
  show(function(w){
    w.appendChild(el('div','onb-choice-ico',ic(P.clipboard,26))).style.cssText='width:52px;height:52px;margin-bottom:14px';
    w.appendChild(el('h2','onb-title','Your assessment is ready'));
    var art=st.disc==='Other'?'a professional':
      st.disc==='Operations & FM'?'an Ops & FM professional':
      (/^[AEIOU]/i.test(st.disc)?'an ':'a ')+st.disc+' professional';
    w.appendChild(el('p','onb-sub','We’ll ask 6–8 quick questions to find your BIM proficiency level as '+art+'.'));
    w.appendChild(el('p','onb-sub onb-sub--light','You’ll get feedback on each answer.'));
    var b=el('button','onb-btn onb-btn--lg','Start assessment '+ic(P.arrowRight,19));
    b.onclick=showQuestion;
    w.appendChild(b);
  },1);
}

function showCard(card){
  show(function(w){
    w.appendChild(el('div','onb-choice-ico',ic(P.book,26))).style.cssText='width:52px;height:52px;margin-bottom:14px';
    w.appendChild(el('h2','onb-title',card.title));
    var bd=el('div','onb-fb-text',card.body||card.content||'');
    bd.style.cssText='text-align:left;margin-bottom:8px';
    w.appendChild(bd);
    var b=el('button','onb-btn onb-btn--lg','Continue to assessment '+ic(P.arrowRight,19));
    b.onclick=showQuestion;
    w.appendChild(b);
  },1);
}

function showQuestion(){
  if(!st.q){doTeaser();return}
  show(function(w){
    var prog=el('div','onb-progress');
    var fill=el('div','onb-progress-fill');
    fill.style.width=((st.qNum-1)/8*100)+'%';
    prog.appendChild(fill);
    w.appendChild(prog);
    w.appendChild(el('p','onb-qnum','Question '+st.qNum+' of up to 8'));
    w.appendChild(el('h3','onb-qtxt',st.q.stem||st.q.text||st.q.question_text||''));
    var opts=el('div','onb-options');
    (st.q.options||[]).forEach(function(opt,i){
      var txt=typeof opt==='string'?opt:(opt.text||opt.label||'');
      var b=el('button','onb-option','<span class="onb-option-key">'+String.fromCharCode(65+i)+'</span><span>'+txt+'</span>');
      b.onclick=function(){submitAnswer(i,opts)};
      opts.appendChild(b);
    });
    w.appendChild(opts);
  },1);
}

function submitAnswer(idx,optsEl){
  var btns=optsEl.querySelectorAll('.onb-option');
  btns.forEach(function(b,i){
    b.disabled=true;
    if(i===idx)b.classList.add('is-selected');
  });
  apiCall('POST','/onboarding_answer',{
    session_token:st.token,
    question_id:st.q.question_id||st.q.id,
    answer_index:idx
  })
  .then(function(data){
    btns.forEach(function(b,i){
      if(i===idx){b.classList.remove('is-selected');b.classList.add(data.correct?'is-correct':'is-wrong')}
    });
    var wrap=optsEl.closest('.onb-card');
    var fb=el('div','onb-feedback '+(data.correct?'onb-feedback--correct':'onb-feedback--wrong'));
    fb.appendChild(el('p','onb-fb-label',ic(data.correct?P.checkCircle:P.xCircle,17)+(data.correct?' Correct':' Not quite')));
    fb.appendChild(el('p','onb-fb-text',data.feedback||data.selected_feedback||''));
    if(data.done){
      st.q=null;
      var b=el('button','onb-btn','See your results '+ic(P.arrowRight,17));
      b.onclick=doTeaser;
      fb.appendChild(b);
    }else{
      st.q=data.next_question||data.question;
      st.qNum++;
      var b2=el('button','onb-btn','Next question '+ic(P.arrowRight,17));
      b2.onclick=showQuestion;
      fb.appendChild(b2);
    }
    wrap.appendChild(fb);
    fb.scrollIntoView({behavior:'smooth',block:'nearest'});
  })
  .catch(function(e){
    var wrap=optsEl.closest('.onb-card');
    wrap.appendChild(el('p','onb-error','Error: '+e.message));
  });
}

function doTeaser(){
  show(function(w){
    w.appendChild(el('div','onb-spinner'));
    w.appendChild(el('p','onb-loading','Calculating your results…'));
  },2);
  apiCall('GET','/onboarding_teaser',{session_token:st.token})
  .then(function(data){
    show(function(w){
      var badge=el('div','onb-badge');
      var arch=data.archetype||'';
      badge.appendChild(el('div','onb-badge-ico',ic(ARCH_ICON[arch]||P.target,26)));
      badge.appendChild(el('h2','onb-badge-arch',arch));
      badge.appendChild(el('p','onb-badge-phase',data.phase_label||''));
      if(data.accuracy!=null)badge.appendChild(el('p','onb-badge-acc',data.accuracy+'% ACCURACY'));
      w.appendChild(badge);
      if(data.headline)w.appendChild(el('p','onb-headline',data.headline));
      var locked=el('div','onb-locked');
      locked.appendChild(el('div','onb-lock-ico',ic(P.lock,30)));
      locked.appendChild(el('h3','onb-lock-title','Your personalized roadmap is ready'));
      locked.appendChild(el('p','onb-lock-text','Create an account to unlock your full track, curated lessons, and career roadmap.'));
      var cta=el('a','onb-btn onb-btn--lg onb-btn--cta','Create account '+ic(P.arrowRight,19));
      cta.href=signupHref();
      cta.onclick=function(){setStep(3)};
      locked.appendChild(cta);
      /* Existing members: open the Memberstack login modal; after login Memberstack lands on
         /dashboard, which hands off to /welcome-onboard to claim this session. */
      var lg=el('p','onb-sub onb-sub--light onb-lock-login','Already a member? <a href="/signup#/ms/login" data-ms-modal="login">Log in to save your results</a>');
      locked.appendChild(lg);
      w.appendChild(locked);
      showLessonPick(w);
      var rst=el('button','onb-restart','Start over');
      rst.onclick=function(){
        removeLesson();
        st={token:null,q:null,qNum:0,disc:null,goal:null,pick:null,lessonEl:null,lessonDone:false};
        showDiscipline();
      };
      w.appendChild(rst);
    },2);
  })
  .catch(function(e){
    show(function(w){
      w.appendChild(el('h2','onb-title','Something went wrong'));
      w.appendChild(el('p','onb-sub',e.message));
      var b=el('button','onb-btn','Try again');
      b.onclick=doTeaser;
      w.appendChild(b);
    },2);
  });
}

/* ---- REMEDIATION LESSON (spec §1 step 1) ----
   onboarding_lesson_pick → card under the results → lesson engine mounted
   inline (full-width section under the results card, since #strive-onboard
   is a 640px column) → onboarding_lesson_done when the quiz is passed. */
function showLessonPick(w){
  var card=el('div','onb-pick');
  card.hidden=true;
  w.appendChild(card);
  apiCall('POST','/onboarding_lesson_pick',{session_token:st.token})
  .then(function(p){
    if(!p||!p.slug){card.remove();return}
    st.pick=p;
    renderPick(card,p);
    card.hidden=false;
  })
  .catch(function(){card.remove()});
}

function pickMins(p){return p.est_minutes||6}
function startLabel(p){return 'Start the lesson (~'+pickMins(p)+' min) '+ic(P.arrowRight,17)}

function renderPick(card,p){
  var stretch=p.reason==='stretch';
  card.className='onb-pick'+(stretch?' onb-pick--stretch':'');
  card.innerHTML=
    '<p class="onb-pick-eyebrow">'+ic(stretch?P.zap:P.target,14)+' '+(stretch?'Stretch yourself':'Fix your weakest answer')+'</p>'+
    '<h3 class="onb-pick-title">'+(p.title||'')+'</h3>'+
    '<div class="onb-pick-meta">'+
      '<span class="onb-pill">'+ic(P.clock,13)+' ~'+pickMins(p)+' min</span>'+
      (p.competency?'<span class="onb-pill">'+ic(P.layers,13)+' '+p.competency+'</span>':'')+
    '</div>'+
    (stretch
      ?'<p class="onb-pick-lead">You aced it. Try something at the next level.</p>'
      :(p.question_stem?'<blockquote class="onb-pick-q"><span>The question you missed</span>'+p.question_stem+'</blockquote>':''))+
    (p.message?'<p class="onb-pick-msg">'+p.message+'</p>':'')+
    '<button class="onb-btn onb-btn--block" data-start>'+startLabel(p)+'</button>'+
    '<p class="onb-error" data-err hidden></p>';
  card.querySelector('[data-start]').onclick=function(){startLesson(card,p)};
}

function startLesson(card,p){
  if(st.lessonEl){st.lessonEl.scrollIntoView({behavior:'smooth',block:'start'});return}
  var btn=card.querySelector('[data-start]');
  var err=card.querySelector('[data-err]');
  btn.disabled=true;
  btn.innerHTML='<span class="onb-spinner onb-spinner--sm"></span> Loading lesson…';
  err.hidden=true;
  Promise.all([ensureLessonEngine(),fetchLesson(p.slug)])
  .then(function(r){
    mountLesson(r[1],p);
    btn.disabled=false;
    btn.innerHTML='Continue the lesson '+ic(P.arrowRight,17);
  })
  .catch(function(e){
    btn.disabled=false;
    btn.innerHTML=startLabel(p);
    err.textContent='Couldn’t load the lesson right now — please try again.';
    err.hidden=false;
  });
}

/* Load strive-lesson.css/js from the CDN on demand (skipped when the page already has them). */
function ensureLessonEngine(){
  if(window.STRIVE&&typeof window.STRIVE.renderLesson==='function')return Promise.resolve();
  if(enginePromise)return enginePromise;
  if(!document.querySelector('link[href*="strive-lesson.css"]')){
    var l=document.createElement('link');l.rel='stylesheet';l.href=CDN+'strive-lesson.css';
    document.head.appendChild(l);
  }
  enginePromise=new Promise(function(res,rej){
    var s=document.createElement('script');
    s.src=CDN+'strive-lesson.js';s.async=true;
    s.onload=function(){if(window.STRIVE)res();else rej(new Error('Lesson engine failed to initialise'))};
    s.onerror=function(){enginePromise=null;rej(new Error('Lesson engine failed to load'))};
    document.head.appendChild(s);
  });
  return enginePromise;
}

function fetchLesson(slug){
  if(MOCK)return fetch(FIXTURES+'mini_lesson_sample.json').then(function(r){return r.json()});
  return getJSONRetry(PLATFORM+'/mini_lesson?slug='+encodeURIComponent(slug),{},5)
  .then(function(d){
    if(!d||!Array.isArray(d.sections))throw new Error('Invalid lesson payload');
    return d;
  });
}

function removeLesson(){
  if(st.lessonEl&&st.lessonEl.parentNode)st.lessonEl.parentNode.removeChild(st.lessonEl);
  st.lessonEl=null;
}

function mountLesson(lesson,p){
  removeLesson();
  var wrap=el('section','onb-lesson');
  var bar=el('div','onb-lesson-bar');
  var back=el('button','onb-back',ic(P.arrowLeft,16)+' Back to results');
  back.onclick=function(){removeLesson();root.scrollIntoView({behavior:'smooth',block:'start'})};
  var skip=el('a','onb-lesson-skip','Skip to sign up '+ic(P.arrowRight,15));
  skip.href=signupHref();
  skip.onclick=function(){setStep(3)};
  bar.appendChild(back);bar.appendChild(skip);
  wrap.appendChild(bar);
  var frame=el('div','onb-lesson-frame');
  var mount=el('div');mount.id='strive-lesson';
  frame.appendChild(mount);
  wrap.appendChild(frame);
  root.parentNode.insertBefore(wrap,root.nextSibling);
  st.lessonEl=wrap;
  st.lessonDone=false;
  window.STRIVE.renderLesson(lesson,'strive-lesson',{
    slug:p.slug,
    onQuizPass:function(score,total){onLessonPassed(wrap,p,score,total)}
  });
  wrap.scrollIntoView({behavior:'smooth',block:'start'});
}

function onLessonPassed(wrap,p,score,total){
  if(st.lessonDone)return;
  st.lessonDone=true;
  apiCall('POST','/onboarding_lesson_done',{session_token:st.token,slug:p.slug}).catch(function(){});
  var done=el('div','onb-lesson-done');
  done.appendChild(el('div','onb-lesson-done-ico',ic(P.checkCircle,28)));
  done.appendChild(el('h3','onb-lock-title','Nice — that one’s now in your roadmap'));
  done.appendChild(el('p','onb-lock-text',score+' of '+total+' correct. Create an account to save your results, keep this lesson ticked off, and unlock the rest of your roadmap.'));
  var cta=el('a','onb-btn onb-btn--lg onb-btn--cta onb-btn--glow','Create account '+ic(P.arrowRight,19));
  cta.href=signupHref();
  cta.onclick=function(){setStep(3)};
  done.appendChild(cta);
  done.appendChild(el('p','onb-sub onb-sub--light onb-lock-login','Already a member? <a href="/signup#/ms/login" data-ms-modal="login">Log in to save your results</a>'));
  var back=el('button','onb-restart','Back to results');
  back.onclick=function(){root.scrollIntoView({behavior:'smooth',block:'start'})};
  done.appendChild(back);
  wrap.appendChild(done);
  done.scrollIntoView({behavior:'smooth',block:'center'});
  var card=root.querySelector('.onb-pick');
  if(card){
    card.classList.add('is-done');
    var b=card.querySelector('[data-start]');
    if(b){b.disabled=true;b.innerHTML=ic(P.check,17)+' Lesson complete — in your roadmap'}
  }
}

injectScaffold();
/* Hand-off from the home page: /get-started?discipline=…&goal=… (already chosen
   there, no API call made yet) skips both chooser screens and starts the
   assessment straight away. Unknown or missing values fall back to the choosers. */
(function(){
  var qs=new URLSearchParams(location.search);
  var d=qs.get('discipline'),g=qs.get('goal');
  if(d&&g&&DISC.indexOf(d)>=0&&GOALS.indexOf(g)>=0){
    st.disc=d;st.goal=g;
    /* Hand-off: hide the intro line so the concept card / first question is first on screen. */
    root.classList.add('is-handoff');
    var sec=root.closest('.onb-page');if(sec)sec.classList.add('is-handoff');
    var intro=document.querySelector('.onb-hero');if(intro)intro.classList.add('is-handoff');
    doStart();return;
  }
  showDiscipline();
})();
})();
