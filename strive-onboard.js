(function(){
'use strict';
var API='https://x8ki-letl-twmt.n7.xano.io/api:m2bNDxnv';
var LOGO='https://s3.amazonaws.com/webflow-prod-assets/6a1704050c9a272f02d13182/6a170557e26efe4dcc460946_Strive%20Logo%20Torquise_Burnt%20Orange%20Gradient-p-500.png';
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
  eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'
};

var DISC=['Architecture','Engineering','Construction','Operations & FM','Client/Owner','Other'];
var GOALS=['Level up in my current role','Step up to the next role','Move into BIM/digital','Keep my team current'];
var DISC_ICON={'Architecture':P.bldg,'Engineering':P.layers,'Construction':P.crane,'Operations & FM':P.wrench,'Client/Owner':P.briefcase,'Other':P.compass};
var GOAL_ICON={'Level up in my current role':P.trendUp,'Step up to the next role':P.arrowUpRight,'Move into BIM/digital':P.monitor,'Keep my team current':P.users};
var ARCH_ICON={Explorer:P.compass,Builder:P.box,Orchestrator:P.target,Strategist:P.route,Visionary:P.eye};

var STEPS=['About you','Assessment','Your level','Sign up'];
var st={token:null,q:null,qNum:0,disc:null,goal:null};

function el(tag,cls,html){var e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e}

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

function show(fn,stepIdx){
  if(stepIdx!=null)setStep(stepIdx);
  root.innerHTML='';
  var w=el('div','onb-card');
  fn(w);
  root.appendChild(w);
  root.scrollIntoView({behavior:'smooth',block:'start'});
}

function apiCall(method,path,body){
  var url=API+path;
  var opts={method:method,headers:{'Content-Type':'application/json'}};
  if(method==='GET'&&body){url+='?'+new URLSearchParams(body).toString()}
  else if(body){opts.body=JSON.stringify(body)}
  return fetch(url,opts).then(function(r){
    if(!r.ok)throw new Error('API error '+r.status);
    return r.json();
  });
}

function saveToken(t){try{localStorage.setItem('strive_onboard_token',t)}catch(e){}}

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
    nav.innerHTML=
      '<a href="/" class="onb-logo"><img src="'+LOGO+'" alt="STRIVE"></a>'+
      '<nav class="onb-rail" aria-label="Onboarding steps">'+railHtml+'</nav>'+
      '<span class="onb-login"><span>Already a member? </span><a href="/login">Log in</a></span>';
    var lg=nav.querySelector('img');
    lg.onerror=function(){var s=document.createElement('span');s.className='onb-footer-logo';s.style.margin='0';s.textContent='STRIVE';lg.replaceWith(s)};
    body.insertBefore(nav,body.firstChild);
  }

  if(!document.querySelector('.onb-glow-a')){
    section.insertBefore(el('div','onb-glow-b'),section.firstChild);
    section.insertBefore(el('div','onb-glow-a'),section.firstChild);
  }

  if(!document.querySelector('.onb-hero')){
    var hero=el('div','onb-hero');
    hero.innerHTML=
      '<p class="onb-eyebrow">'+ic(P.compass,15)+' No account needed to start</p>'+
      '<h1 class="onb-hero-title">Find your <span class="onb-grad-text">starting point</span></h1>'+
      '<p class="onb-hero-sub">Answer a few quick questions and we’ll map your BIM proficiency level, match you to a career archetype, and build a personalized learning path — free, in about six minutes.</p>'+
      '<div class="onb-hero-feats">'+
        [[P.bldg,'Pick your discipline'],[P.clipboard,'Answer quick questions'],[P.target,'Get your level & path']].map(function(f){
          return '<div class="onb-feat"><span class="onb-feat-ico">'+ic(f[0],17)+'</span><span>'+f[1]+'</span></div>';
        }).join('')+
      '</div>';
    section.insertBefore(hero,root);
  }

  if(!document.querySelector('.onb-footer')){
    var ft=el('footer','onb-footer');
    ft.innerHTML=
      '<div class="onb-footer-inner">'+
        '<div class="onb-footer-about">'+
          '<a href="/" class="onb-footer-logo">STRIVE</a>'+
          '<p>Pushing digitalization forward in buildings &amp; infrastructure — through free learning, verified skills, and community.</p>'+
        '</div>'+
        '<div class="onb-footer-col"><h4>Learn</h4><a href="/catalog">Courses</a><a href="/career-paths">Career paths</a><a href="/assessment">Skill assessments</a><a href="/teams">For teams</a></div>'+
        '<div class="onb-footer-col"><h4>Community</h4><a href="/forum">Forum</a><a href="/events">Events</a><a href="/mentorship">Mentorship</a></div>'+
        '<div class="onb-footer-col"><h4>Company</h4><a href="/about">About</a><a href="/careers">Careers</a><a href="/contact">Contact</a></div>'+
      '</div>'+
      '<div class="onb-footer-bottom">'+
        '<span>© 2026 STRIVE Community</span>'+
        '<span><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></span>'+
      '</div>';
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
      locked.appendChild(el('h3','onb-lock-title','Your personalized learning path is ready'));
      locked.appendChild(el('p','onb-lock-text','Create a free account to unlock your full track, curated lessons, and career roadmap.'));
      var cta=el('a','onb-btn onb-btn--lg onb-btn--cta','Create free account '+ic(P.arrowRight,19));
      cta.href='/signup';
      cta.onclick=function(){setStep(3)};
      locked.appendChild(cta);
      w.appendChild(locked);
      var rst=el('button','onb-restart','Start over');
      rst.onclick=function(){
        st={token:null,q:null,qNum:0,disc:null,goal:null};
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

injectScaffold();
showDiscipline();
})();
