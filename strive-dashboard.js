/* ============================================================
   STRIVE Dashboard engine — strive-dashboard.js
   Renders the member dashboard (/dashboard) from one
   GET {platform}/dashboard call. Standalone: own namespace,
   no shared code. Scoped under #strive-dashboard .dsh-*.

   window.STRIVEDashboard.init({
     mount: '#strive-dashboard',
     platform: 'https://…/api:fykJB1SM',
     authToken: '<xano bearer token>',   // from POST /memberstack_auth
     msToken: '<memberstack cookie>',    // for POST /profile_photo
     mock: false,                        // true → serve docs/fixtures/dashboard_get.json
     fixture: 'docs/fixtures/dashboard_get.json',
     links: { lesson:'/lesson?slug=', course:'/course?slug=', roadmap:'/welcome-onboard#roadmap',
              goals:'/welcome-onboard#goals', onboard:'/welcome-onboard', assess:'/get-started' }
   });
   window.STRIVEDashboard.renderLogin({ mount, href }) — logged-out card.
   ============================================================ */
(function(){
'use strict';

var DEFAULT_PLATFORM='https://x8ki-letl-twmt.n7.xano.io/api:fykJB1SM';
var DEFAULT_LINKS={lesson:'/lesson?slug=',course:'/course?slug=',roadmap:'/welcome-onboard#roadmap',goals:'/welcome-onboard#goals',onboard:'/welcome-onboard',assess:'/get-started',signup:'/signup'};
var PHASE_LABELS={1:'Student',2:'Modeler',3:'Coordinator',4:'Project BIM Manager',5:'Director'};
var DOMAIN_SHORT={1:'Technical',2:'Information',3:'Process',4:'Strategy',5:'People'};

/* ---- Lucide-style inline SVG icons (no emoji) ---- */
function ic(d,s){s=s||18;return '<svg xmlns="http://www.w3.org/2000/svg" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>'}
var P={
  arrowRight:'<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  checkCircle:'<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  circle:'<circle cx="12" cy="12" r="10"/>',
  chevron:'<path d="m6 9 6 6 6-6"/>',
  clock:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  book:'<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  layers:'<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  play:'<polygon points="6 3 20 12 6 21 6 3"/>',
  target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  flag:'<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  route:'<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  compass:'<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  box:'<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  pencil:'<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  mapPin:'<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  briefcase:'<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  refresh:'<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  alert:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  sparkles:'<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  trophy:'<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  zap:'<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  camera:'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  logIn:'<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>',
  award:'<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
  history:'<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>'
};
var ARCH_ICON={Explorer:P.compass,Builder:P.box,Orchestrator:P.target,Strategist:P.route,Visionary:P.eye};

/* ---- tiny helpers ---- */
function esc(s){return s==null?'':String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function attr(s){return esc(s)}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function pct(done,total){return total?clamp(Math.round(done/total*100),0,100):0}
function fmtMin(m){m=Math.round(m||0);if(m<60)return m+' min';var h=Math.floor(m/60),r=m%60;return r?h+'h '+r+'m':h+'h'}
function initials(u){var a=(u.first_name||'').trim(),b=(u.last_name||'').trim();var s=(a?a[0]:'')+(b?b[0]:'');if(!s&&u.email)s=u.email[0];return (s||'?').toUpperCase()}
function photoUrl(p){if(!p)return null;if(typeof p==='string')return p;return p.url||p.path||null}
function pluralize(n,one,many){return n+' '+(n===1?one:(many||one+'s'))}

function today(){var d=new Date();d.setHours(0,0,0,0);return d}
function parseDate(s){
  if(!s)return null;
  if(typeof s==='number')return new Date(s);
  var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if(m)return new Date(+m[1],+m[2]-1,+m[3]);
  var d=new Date(s);return isNaN(d)?null:d;
}
function daysBetween(a,b){return Math.round((b-a)/86400000)}
var MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(d){return MONTHS[d.getMonth()]+' '+d.getDate()+(d.getFullYear()!==today().getFullYear()?' '+d.getFullYear():'')}
function dueInfo(goal){
  var d=parseDate(goal.due_date);
  if(!d)return {label:'No due date',state:'none',days:null};
  var days=daysBetween(today(),d);
  if(goal.status==='done')return {label:'Done'+(goal.completed_at?' '+fmtDate(parseDate(goal.completed_at)):''),state:'done',days:days};
  if(days<0)return {label:'Overdue by '+pluralize(-days,'day'),state:'overdue',days:days};
  if(days===0)return {label:'Due today',state:'soon',days:days};
  if(days===1)return {label:'Due tomorrow',state:'soon',days:days};
  if(days<=3)return {label:'Due in '+days+' days',state:'soon',days:days};
  return {label:'Due '+fmtDate(d),state:'ok',days:days};
}
function relTime(iso){
  var d=parseDate(iso);if(!d)return '';
  var mins=Math.round((Date.now()-d)/60000);
  if(mins<60)return 'just now';
  var h=Math.round(mins/60);if(h<24)return h+'h ago';
  var days=daysBetween(new Date(d.getFullYear(),d.getMonth(),d.getDate()),today());
  if(days<=0)return 'today';if(days===1)return 'yesterday';if(days<7)return days+' days ago';
  return fmtDate(d);
}
function startOfWeek(){var d=today();var day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return d}
function greeting(){var h=new Date().getHours();return h<5?'Still up':h<12?'Good morning':h<17?'Good afternoon':'Good evening'}

/* ============================================================
   init
   ============================================================ */
function init(opts){
  opts=opts||{};
  var root=typeof opts.mount==='string'?document.querySelector(opts.mount||'#strive-dashboard'):(opts.mount||document.getElementById('strive-dashboard'));
  if(!root){console.warn('[STRIVEDashboard] mount not found');return null}
  if(!root.id)root.id='strive-dashboard';

  var mock=opts.mock;
  if(mock==null){try{mock=/[?&]mock=1/.test(location.search)}catch(e){mock=false}}
  var links={};for(var k in DEFAULT_LINKS)links[k]=DEFAULT_LINKS[k];if(opts.links)for(var k2 in opts.links)links[k2]=opts.links[k2];

  var cfg={
    platform:(opts.platform||DEFAULT_PLATFORM).replace(/\/$/,''),
    authToken:opts.authToken||null,
    msToken:opts.msToken||null,
    mock:!!mock,
    fixture:opts.fixture||'docs/fixtures/dashboard_get.json',
    links:links
  };

  var st={data:null,loading:true,error:null,open:{},editing:false,saving:false,saveError:null,dropdowns:null,photoFile:null,photoPreview:null,busyGoal:{},toast:null};

  /* ---------- HTTP (retry + backoff on 429/5xx) ---------- */
  function request(method,path,body,extra){
    extra=extra||{};
    if(cfg.mock)return mockRequest(method,path,body,extra);
    var url=cfg.platform+path;
    var headers={};
    if(cfg.authToken)headers['Authorization']='Bearer '+cfg.authToken;
    var o={method:method,headers:headers};
    if(body instanceof FormData){o.body=body}
    else if(body!=null){headers['Content-Type']='application/json';o.body=JSON.stringify(body)}
    var tries=extra.tries||4;
    var attempt=0;
    function go(){
      return fetch(url,o).then(function(r){
        if((r.status===429||r.status>=500)&&attempt<tries-1){
          attempt++;return sleep(500*Math.pow(2,attempt-1)+Math.random()*250).then(go);
        }
        return r.text().then(function(t){
          var j=null;try{j=t?JSON.parse(t):null}catch(e){}
          if(!r.ok){var err=new Error((j&&(j.message||j.error))||('Request failed ('+r.status+')'));err.status=r.status;err.body=j;throw err}
          return j;
        });
      },function(e){
        if(attempt<tries-1){attempt++;return sleep(500*Math.pow(2,attempt-1)).then(go)}
        var err=new Error('Network error');err.status=0;throw err;
      });
    }
    return go();
  }
  function mockRequest(method,path,body){
    if(method==='GET'&&path==='/dashboard'){
      console.info('[STRIVEDashboard mock] GET /dashboard ← '+cfg.fixture);
      return fetch(cfg.fixture).then(function(r){if(!r.ok)throw new Error('Fixture not found: '+cfg.fixture);return r.json()});
    }
    if(method==='GET'&&path==='/profile_dropdown_options'){
      console.info('[STRIVEDashboard mock] GET /profile_dropdown_options');
      return sleep(200).then(function(){return {industries:[{id:1,label:'Architecture'},{id:2,label:'Engineering'},{id:3,label:'Construction'},{id:4,label:'Operations & FM'},{id:5,label:'Client / Owner'},{id:6,label:'Software / Technology'},{id:7,label:'Other'}],experience_levels:[{id:1,label:'Student'},{id:2,label:'0–2 years'},{id:3,label:'3–5 years'},{id:4,label:'6–10 years'},{id:5,label:'10+ years'}]}});
    }
    var logBody=body instanceof FormData?fdToObj(body):body;
    console.info('[STRIVEDashboard mock] '+method+' '+path+' (would send)',logBody);
    return sleep(450).then(function(){
      if(path==='/goal')return {goal:Object.assign({},body,{completed_at:new Date().toISOString()})};
      if(path==='/profile')return {ok:true,user:body};
      if(path==='/profile_photo')return {ok:true,profile_photo:st.photoPreview};
      return {ok:true};
    });
  }
  function fdToObj(fd){var o={};fd.forEach(function(v,k){o[k]=(v&&v.name)?'[File '+v.name+', '+v.size+' bytes]':v});return o}

  /* ---------- load ---------- */
  function pendingOnboardToken(){
    try{var t=localStorage.getItem('strive_onboard_token');if(t)return t}catch(e){}
    var m=document.cookie.match(/(?:^|;\s*)strive_onb=([^;]+)/);
    return m?decodeURIComponent(m[1]):null;
  }
  function load(){
    st.loading=true;st.error=null;render();
    request('GET','/dashboard').then(function(d){
      st.data=normalize(d||{});
      st.loading=false;
      /* A finished assessment is claimed on /welcome-onboard. Memberstack's post-login
         redirect lands here instead, so hand off when there is no roadmap yet but a
         pending assessment token (localStorage / cookie) from the quiz. */
      if(!st.data.roadmap_summary&&pendingOnboardToken()&&!((cfg&&cfg.mock)||(st&&st.mock))){location.replace((cfg&&cfg.claimHref)||'/welcome-onboard');return}
      var next=st.data.next_item;
      st.open={};
      if(next&&next.milestone_id)st.open[next.milestone_id]=true;
      else{var ms=milestones();for(var i=0;i<ms.length;i++){if(ms[i].items_done<ms[i].items_total){st.open[ms[i].id]=true;break}}}
      render();
    }).catch(function(e){
      st.loading=false;st.error=e;render();
    });
  }
  function normalize(d){
    d.user=d.user||{};
    d.goals=Array.isArray(d.goals)?d.goals:[];
    d.recent_completions=Array.isArray(d.recent_completions)?d.recent_completions:[];
    d.stats=d.stats||{};
    var rs=d.roadmap_summary||d.roadmap||null;
    if(rs&&!Array.isArray(rs.milestones))rs.milestones=[];
    if(rs){
      rs.milestones.forEach(function(m){
        m.items=Array.isArray(m.items)?m.items:[];
        if(m.items_total==null)m.items_total=m.items.length;
        if(m.items_done==null)m.items_done=m.items.filter(function(i){return i.done}).length;
        if(m.minutes==null)m.minutes=m.items.reduce(function(a,i){return a+(+i.minutes||0)},0);
      });
      rs.totals=rs.totals||{};
      if(rs.totals.items==null)rs.totals.items=rs.milestones.reduce(function(a,m){return a+m.items_total},0);
      if(rs.totals.done==null)rs.totals.done=rs.milestones.reduce(function(a,m){return a+m.items_done},0);
      if(rs.totals.minutes==null)rs.totals.minutes=rs.milestones.reduce(function(a,m){return a+(m.minutes||0)},0);
      if(rs.totals.minutes_done==null)rs.totals.minutes_done=rs.milestones.reduce(function(a,m){return a+m.items.filter(function(i){return i.done}).reduce(function(b,i){return b+(+i.minutes||0)},0)},0);
      rs.phase_labels=rs.phase_labels||PHASE_LABELS;
    }
    d.roadmap_summary=rs;
    if(d.next_item&&!d.next_item.milestone_title&&rs){
      rs.milestones.forEach(function(m){if(m.id===d.next_item.milestone_id)d.next_item.milestone_title=m.title;
        else if(!d.next_item.milestone_id)m.items.forEach(function(i){if(i.slug===d.next_item.slug){d.next_item.milestone_id=m.id;d.next_item.milestone_title=m.title}})});
    }
    d.goals.forEach(function(g){
      g.metric=g.metric||(g.metric_json||{});
      if(!g.metric.type)g.metric.type=Array.isArray(g.metric.slugs)?'lessons':'manual';
      // Server progress is {done,target,percent}; the renderer reads {done,total,pct} — alias both ways.
      if(g.progress){
        var p=g.progress;
        if(p.total==null)p.total=p.target!=null?+p.target:(g.target_count||0);
        if(p.pct==null)p.pct=p.percent!=null?+p.percent:pct(p.done||0,p.total);
      }
      if(g.metric.type==='lessons'&&!g.progress){
        var slugs=g.metric.slugs||[];var total=g.metric.count||g.target_count||slugs.length;
        var doneSet={};if(rs)rs.milestones.forEach(function(m){m.items.forEach(function(i){if(i.done)doneSet[i.slug]=1})});
        d.recent_completions.forEach(function(c){doneSet[c.slug]=1});
        var done=slugs.filter(function(s){return doneSet[s]}).length;
        g.progress={done:Math.min(done,total),total:total,pct:pct(done,total)};
      }
    });
    return d;
  }
  function milestones(){return (st.data&&st.data.roadmap_summary&&st.data.roadmap_summary.milestones)||[]}
  function hasRoadmap(){return milestones().length>0}
  function itemHref(it){return (it.type==='course'?cfg.links.course:cfg.links.lesson)+encodeURIComponent(it.slug||'')}

  /* ---------- nudge ---------- */
  function lessonsThisWeek(){
    var s=st.data.stats;
    if(s.lessons_this_week!=null)return +s.lessons_this_week;
    var sow=startOfWeek();
    return st.data.recent_completions.filter(function(c){var d=parseDate(c.completed_at);return d&&d>=sow}).length;
  }
  function nudge(){
    var d=st.data,goals=d.goals.filter(function(g){return g.status!=='done'&&g.status!=='dropped'});
    var overdue=goals.map(function(g){return {g:g,i:dueInfo(g)}}).filter(function(x){return x.i.state==='overdue'}).sort(function(a,b){return a.i.days-b.i.days})[0];
    if(overdue)return {tone:'warn',text:'“'+overdue.g.title+'” slipped past its date. A small step today puts it back on track.'};
    var soon=goals.map(function(g){return {g:g,i:dueInfo(g)}}).filter(function(x){return x.i.state==='soon'}).sort(function(a,b){return a.i.days-b.i.days})[0];
    if(soon){var left=soon.g.progress?Math.max(soon.g.progress.total-soon.g.progress.done,0):null;
      return {tone:'soon',text:'“'+soon.g.title+'” is '+soon.i.label.toLowerCase()+(left?' — '+pluralize(left,'lesson')+' to go. Totally doable.':'. You’ve got this.')}}
    var wk=lessonsThisWeek();
    if(wk>0)return {tone:'good',text:pluralize(wk,'lesson')+' done this week. Keep the momentum going.'};
    if(d.next_item)return {tone:'good',text:'Your next lesson takes about '+fmtMin(d.next_item.minutes)+'. Perfect for a coffee break.'};
    if(!hasRoadmap())return {tone:'good',text:'Let’s build your roadmap — it takes about a minute.'};
    return {tone:'good',text:'Nice work. Pick anything from your roadmap to keep going.'};
  }

  /* ---------- render ---------- */
  function render(){
    if(st.loading){root.innerHTML=skeleton();return}
    if(st.error){root.innerHTML=errorCard(st.error);return}
    var d=st.data;
    var first=!st.painted;st.painted=true;
    root.innerHTML=
      '<div class="dsh-wrap'+(first?' dsh-wrap--in':'')+'">'+
        renderHeader(d)+
        (st.editing?renderEditPanel(d.user):'')+
        '<div class="dsh-grid">'+
          '<div class="dsh-main">'+renderNextUp(d)+renderRoadmap(d)+'</div>'+
          '<aside class="dsh-side">'+renderStats(d)+renderGoals(d)+renderRecent(d)+'</aside>'+
        '</div>'+
        (st.toast?'<div class="dsh-toast dsh-toast--'+st.toast.tone+'" role="status">'+ic(st.toast.tone==='error'?P.alert:P.checkCircle,16)+'<span>'+esc(st.toast.text)+'</span></div>':'')+
      '</div>';
    if(st.editing&&st.focusField){var f=root.querySelector('[name="'+st.focusField+'"]');if(f)f.focus();st.focusField=null}
  }

  function skeleton(){
    return '<div class="dsh-wrap dsh-loading" aria-busy="true">'+
      '<div class="dsh-skel dsh-skel--head"></div>'+
      '<div class="dsh-grid"><div class="dsh-main"><div class="dsh-skel dsh-skel--hero"></div><div class="dsh-skel dsh-skel--block"></div></div>'+
      '<div class="dsh-side"><div class="dsh-skel dsh-skel--stats"></div><div class="dsh-skel dsh-skel--block"></div></div></div></div>';
  }
  function errorCard(e){
    var busy=e&&(e.status===429||e.status>=500);
    var unauth=e&&(e.status===401||e.status===403);
    return '<div class="dsh-wrap"><div class="dsh-card dsh-error">'+
      '<div class="dsh-error-ico">'+ic(P.alert,26)+'</div>'+
      '<p class="dsh-kicker">'+(busy?'Server busy':unauth?'Signed out':'Something went wrong')+'</p>'+
      '<h2 class="dsh-h2">'+(busy?'Your dashboard is taking a moment':unauth?'Please log in again':'We couldn’t load your dashboard')+'</h2>'+
      '<p class="dsh-muted">'+esc(busy?'The learning server hit its rate limit. Give it a few seconds, then try again.':unauth?'Your session looks expired. Log in and we’ll bring you right back.':(e&&e.message)||'Unknown error')+'</p>'+
      (unauth?'<a class="dsh-btn" href="/signup#/ms/login" data-ms-modal="login">'+ic(P.logIn,16)+' Log in</a>':'<button class="dsh-btn" data-action="retry">'+ic(P.refresh,16)+' Retry</button>')+
      '</div></div>';
  }

  /* --- 1. profile header --- */
  function renderHeader(d){
    var u=d.user,photo=photoUrl(u.profile_photo);
    var name=[u.first_name,u.last_name].filter(Boolean).join(' ')||u.email||'Member';
    var roleLine=[u.current_role,u.company].filter(Boolean).join(' · ');
    var phaseLabel=u.phase_label||(u.placement_phase&&PHASE_LABELS[u.placement_phase])||'';
    var n=nudge();
    return '<header class="dsh-top">'+
      '<div class="dsh-greet"><h1 class="dsh-h1">'+esc(greeting())+', '+esc(u.first_name||'there')+'.</h1>'+
        '<p class="dsh-nudge dsh-nudge--'+n.tone+'">'+ic(n.tone==='warn'?P.alert:n.tone==='soon'?P.clock:P.sparkles,16)+'<span>'+esc(n.text)+'</span></p></div>'+
      '<div class="dsh-card dsh-profile">'+
        '<div class="dsh-avatar">'+(photo?'<img src="'+attr(photo)+'" alt="">':'<span>'+esc(initials(u))+'</span>')+'</div>'+
        '<div class="dsh-profile-body">'+
          '<div class="dsh-profile-name">'+esc(name)+'</div>'+
          (roleLine?'<div class="dsh-profile-role">'+ic(P.briefcase,14)+'<span>'+esc(roleLine)+'</span></div>':'')+
          (u.location?'<div class="dsh-profile-loc">'+ic(P.mapPin,14)+'<span>'+esc(u.location)+'</span></div>':'')+
          '<div class="dsh-badges">'+
            (u.archetype?'<span class="dsh-badge dsh-badge--arch">'+ic(ARCH_ICON[u.archetype]||P.target,13)+esc(u.archetype)+'</span>':'')+
            (phaseLabel?'<span class="dsh-badge dsh-badge--phase">'+ic(P.layers,13)+esc(phaseLabel)+(u.placement_phase?' <em>· Phase '+esc(u.placement_phase)+'</em>':'')+'</span>':'')+
            (u.desired_role?'<span class="dsh-badge dsh-badge--goal">'+ic(P.flag,13)+'Heading for '+esc(u.desired_role)+'</span>':'')+
          '</div>'+
        '</div>'+
        '<button class="dsh-btn dsh-btn--ghost dsh-profile-edit" data-action="edit-profile" aria-expanded="'+(st.editing?'true':'false')+'">'+ic(st.editing?P.x:P.pencil,15)+' '+(st.editing?'Close':'Edit profile')+'</button>'+
      '</div>'+
    '</header>';
  }

  function industryFieldHtml(cur){
    var dd=st.dropdowns,industries=dd&&dd.industries||null;cur=cur||'';
    if(!industries||!industries.length)return '<label class="dsh-field"><span>Industry</span><input name="user_current_industry" type="text" value="'+attr(cur)+'" placeholder="e.g. Architecture"'+(st.saving?' disabled':'')+'></label>';
    var found=false;
    var options=industries.map(function(o){var sel=(o.label===cur||String(o.id)===String(cur));if(sel)found=true;return '<option value="'+attr(o.label)+'"'+(sel?' selected':'')+'>'+esc(o.label)+'</option>'}).join('');
    if(cur&&!found)options='<option value="'+attr(cur)+'" selected>'+esc(cur)+'</option>'+options;
    return '<label class="dsh-field"><span>Industry</span><select name="user_current_industry"'+(st.saving?' disabled':'')+'><option value="">Choose…</option>'+options+'</select></label>';
  }
  function renderEditPanel(u){
    var dd=st.dropdowns;
    var industries=dd&&dd.industries||null;
    function field(label,name,val,type,ph){return '<label class="dsh-field"><span>'+esc(label)+'</span><input name="'+name+'" type="'+(type||'text')+'" value="'+attr(val||'')+'" placeholder="'+attr(ph||'')+'"'+(st.saving?' disabled':'')+'></label>'}
    var industryField=industryFieldHtml(u.industry);
    var preview=st.photoPreview||photoUrl(u.profile_photo);
    return '<form class="dsh-card dsh-edit" data-action="save-profile" novalidate>'+
      '<div class="dsh-edit-head"><h2 class="dsh-h2">Edit profile</h2><p class="dsh-muted">Keep it short and current — this is what shows on your dashboard.</p></div>'+
      '<div class="dsh-edit-photo">'+
        '<div class="dsh-avatar dsh-avatar--lg">'+(preview?'<img src="'+attr(preview)+'" alt="">':'<span>'+esc(initials(u))+'</span>')+'</div>'+
        '<label class="dsh-btn dsh-btn--ghost dsh-btn--sm">'+ic(P.camera,15)+' '+(preview?'Change photo':'Add photo')+'<input type="file" name="photo" accept="image/*" hidden'+(st.saving?' disabled':'')+'></label>'+
        (st.photoFile?'<span class="dsh-muted dsh-small">'+esc(st.photoFile.name)+'</span>':'<span class="dsh-muted dsh-small">JPG or PNG, up to 5 MB</span>')+
      '</div>'+
      '<div class="dsh-edit-grid">'+
        field('First name','user_first_name',u.first_name)+
        field('Last name','user_last_name',u.last_name)+
        field('Current role','user_current_role',u.current_role,'text','e.g. BIM Modeler')+
        field('Company','user_current_company',u.company,'text','Where you work')+
        industryField+
        field('Location','user_location',u.location,'text','City, region')+
        field('Where you’re headed','user_desired_role',u.desired_role,'text','e.g. BIM Coordinator')+
        '<label class="dsh-field dsh-field--wide"><span>Short bio</span><textarea name="user_bio" rows="3" placeholder="One or two lines about what you do."'+(st.saving?' disabled':'')+'>'+esc(u.bio||'')+'</textarea></label>'+
      '</div>'+
      (st.saveError?'<p class="dsh-form-error">'+ic(P.alert,15)+esc(st.saveError)+'</p>':'')+
      '<div class="dsh-edit-actions">'+
        '<button type="button" class="dsh-btn dsh-btn--ghost" data-action="cancel-edit"'+(st.saving?' disabled':'')+'>Cancel</button>'+
        '<button type="submit" class="dsh-btn"'+(st.saving?' disabled':'')+'>'+(st.saving?'<span class="dsh-spin"></span> Saving…':ic(P.check,16)+' Save changes')+'</button>'+
      '</div>'+
    '</form>';
  }

  /* --- 2. next up --- */
  function renderNextUp(d){
    var rs=d.roadmap_summary;
    if(!hasRoadmap()){
      return '<section class="dsh-card dsh-hero dsh-hero--cta">'+
        '<p class="dsh-kicker dsh-kicker--light">'+ic(P.route,14)+' No roadmap yet</p>'+
        '<h2 class="dsh-hero-title">Build your roadmap</h2>'+
        '<p class="dsh-hero-sub">Answer a few questions and we’ll turn your level and goal into a plan of short lessons — about a minute to set up.</p>'+
        '<a class="dsh-btn dsh-btn--cta dsh-btn--lg" href="'+attr(cfg.links.onboard)+'">Build my roadmap '+ic(P.arrowRight,18)+'</a>'+
      '</section>';
    }
    var it=d.next_item;
    if(!it){
      var t=rs.totals||{};
      return '<section class="dsh-card dsh-hero dsh-hero--done">'+
        '<p class="dsh-kicker dsh-kicker--light">'+ic(P.trophy,14)+' Roadmap complete</p>'+
        '<h2 class="dsh-hero-title">You finished every item. Seriously impressive.</h2>'+
        '<p class="dsh-hero-sub">'+esc(pluralize(t.done||0,'lesson'))+' and about '+esc(fmtMin(t.minutes_done||t.minutes||0))+' of focused learning. Ready for the next level?</p>'+
        '<div class="dsh-hero-actions"><a class="dsh-btn dsh-btn--cta" href="'+attr(cfg.links.assess)+'">Retake assessment '+ic(P.arrowRight,16)+'</a><a class="dsh-btn dsh-btn--ghost dsh-btn--onDark" href="'+attr(cfg.links.roadmap)+'">Edit roadmap</a></div>'+
      '</section>';
    }
    var isCourse=it.type==='course';
    return '<section class="dsh-card dsh-hero">'+
      '<p class="dsh-kicker dsh-kicker--light">'+ic(P.zap,14)+'<span class="dsh-nowrap">Next up</span>'+(it.milestone_title?'<span class="dsh-kicker-sep">·</span><span>'+esc(it.milestone_title)+'</span>':'')+'</p>'+
      '<h2 class="dsh-hero-title">'+esc(it.title||it.slug)+'</h2>'+
      '<div class="dsh-hero-meta">'+
        '<span class="dsh-chip">'+ic(isCourse?P.layers:P.book,13)+(isCourse?'Course':'Lesson')+'</span>'+
        (it.minutes?'<span class="dsh-chip">'+ic(P.clock,13)+esc(fmtMin(it.minutes))+'</span>':'')+
        (it.competency?'<span class="dsh-chip">'+ic(P.target,13)+esc(it.competency)+'</span>':'')+
        (it.level?'<span class="dsh-chip">'+ic(P.award,13)+esc(it.level)+'</span>':'')+
      '</div>'+
      '<div class="dsh-hero-actions"><a class="dsh-btn dsh-btn--cta dsh-btn--lg" href="'+attr(itemHref(it))+'">'+ic(P.play,16)+' Start '+(isCourse?'course':'lesson')+'</a>'+
      '<span class="dsh-hero-hint">'+esc(isCourse?'Work through it at your own pace.':'Short, focused, and it counts toward your goals.')+'</span></div>'+
    '</section>';
  }

  /* --- 3. roadmap --- */
  function renderRoadmap(d){
    var rs=d.roadmap_summary;
    var head='<div class="dsh-sec-head"><div><p class="dsh-kicker">'+ic(P.route,14)+' Your roadmap</p>';
    if(!hasRoadmap()){
      return '<section class="dsh-card dsh-roadmap">'+head+'<h2 class="dsh-h2">Nothing here yet</h2></div></div>'+
        '<p class="dsh-muted">Your roadmap shows up here once it’s built. Already took the assessment? <a href="'+attr(cfg.links.onboard)+'">Pick up where you left off</a>.</p>'+
        '<div class="dsh-links"><a href="'+attr(cfg.links.assess)+'">'+ic(P.refresh,14)+' Take the assessment</a></div></section>';
    }
    var t=rs.totals,labels=rs.phase_labels||PHASE_LABELS;
    var from=labels[rs.placement_phase]||d.user.phase_label||'',to=labels[rs.target_phase]||'';
    var left=Math.max((t.minutes||0)-(t.minutes_done||0),0);
    var pc=pct(t.done,t.items);
    var html='<section class="dsh-card dsh-roadmap">'+head+
      '<h2 class="dsh-h2">'+(from&&to?esc(from)+' <span class="dsh-arrow">'+ic(P.arrowRight,16)+'</span> '+esc(to):'Your plan')+'</h2></div>'+
      '<div class="dsh-links"><a href="'+attr(cfg.links.roadmap)+'">'+ic(P.pencil,14)+' Edit roadmap</a><a href="'+attr(cfg.links.assess)+'">'+ic(P.refresh,14)+' Retake assessment</a></div></div>'+
      '<div class="dsh-overall"><div class="dsh-overall-row"><span><strong>'+esc(t.done)+' of '+esc(t.items)+'</strong> done</span><span class="dsh-mono">'+esc(pc)+'% · '+esc(fmtMin(left))+' left</span></div>'+
      '<div class="dsh-bar" role="progressbar" aria-valuenow="'+pc+'" aria-valuemin="0" aria-valuemax="100"><div class="dsh-bar-fill" style="width:'+pc+'%"></div></div></div>'+
      '<ol class="dsh-ms-list">';
    rs.milestones.forEach(function(m,idx){
      var open=!!st.open[m.id];
      var mp=pct(m.items_done,m.items_total);
      var complete=m.items_total>0&&m.items_done>=m.items_total;
      var phaseLabel=labels[m.phase]||'';
      html+='<li class="dsh-ms'+(open?' is-open':'')+(complete?' is-complete':'')+(m.deferred?' is-deferred':'')+'">'+
        '<button class="dsh-ms-head" data-action="toggle-ms" data-id="'+attr(m.id)+'" aria-expanded="'+(open?'true':'false')+'">'+
          '<span class="dsh-ms-num">'+(complete?ic(P.check,13):(idx+1))+'</span>'+
          '<span class="dsh-ms-body"><span class="dsh-ms-title">'+esc(m.title)+'</span>'+
            '<span class="dsh-ms-meta">'+(phaseLabel?'<span class="dsh-tag">'+esc(phaseLabel)+'</span>':'')+(m.domain?'<span class="dsh-tag dsh-tag--soft">'+esc(DOMAIN_SHORT[m.domain]||('Domain '+m.domain))+'</span>':'')+(m.deferred?'<span class="dsh-tag dsh-tag--later">Later</span>':'')+
            '<span class="dsh-mono">'+esc(m.items_done)+'/'+esc(m.items_total)+' · '+esc(fmtMin(m.minutes))+'</span></span>'+
            '<span class="dsh-bar dsh-bar--thin"><span class="dsh-bar-fill" style="width:'+mp+'%"></span></span>'+
          '</span>'+
          '<span class="dsh-ms-chev">'+ic(P.chevron,18)+'</span>'+
        '</button>'+
        '<div class="dsh-ms-items"'+(open?'':' hidden')+'>'+
          (m.why?'<p class="dsh-ms-why">'+esc(m.why)+'</p>':'')+
          '<ul class="dsh-items">'+m.items.map(function(it){
            var isNext=d.next_item&&d.next_item.slug===it.slug&&d.next_item.type===it.type;
            return '<li class="dsh-item'+(it.done?' is-done':'')+(isNext?' is-next':'')+'">'+
              '<a href="'+attr(itemHref(it))+'">'+
                '<span class="dsh-item-ico">'+ic(it.done?P.checkCircle:(it.type==='course'?P.layers:P.book),17)+'</span>'+
                '<span class="dsh-item-body"><span class="dsh-item-title">'+esc(it.title||it.slug)+'</span>'+
                  '<span class="dsh-item-meta">'+(it.type==='course'?'Course · ':'')+(it.minutes?esc(fmtMin(it.minutes)):'')+(it.competency?' · '+esc(it.competency):'')+(it.level?' · '+esc(it.level):'')+'</span></span>'+
                (isNext?'<span class="dsh-item-next">Next</span>':'<span class="dsh-item-go">'+ic(P.arrowRight,15)+'</span>')+
              '</a></li>'}).join('')+
          '</ul>'+
        '</div>'+
      '</li>';
    });
    html+='</ol></section>';
    return html;
  }

  /* --- 4. goals --- */
  function renderGoals(d){
    var active=d.goals.filter(function(g){return g.status!=='dropped'});
    active.sort(function(a,b){var ad=a.status==='done',bd=b.status==='done';if(ad!==bd)return ad?1:-1;var x=parseDate(a.due_date),y=parseDate(b.due_date);return (x?x:Infinity)-(y?y:Infinity)});
    var html='<section class="dsh-card dsh-goals"><div class="dsh-sec-head"><div><p class="dsh-kicker">'+ic(P.flag,14)+' Goals</p><h2 class="dsh-h2">What you’re aiming for</h2></div>'+
      '<a class="dsh-btn dsh-btn--ghost dsh-btn--sm" href="'+attr(cfg.links.goals)+'">'+ic(P.plus,14)+' Add goal</a></div>';
    if(!active.length){
      html+='<p class="dsh-muted">No goals yet. A deadline does wonders for momentum — <a href="'+attr(cfg.links.goals)+'">add one</a>.</p>';
    }else{
      html+='<ul class="dsh-goal-list">'+active.map(function(g){
        var info=dueInfo(g),done=g.status==='done',manual=g.metric.type==='manual',pr=g.progress;
        var busy=!!st.busyGoal[g.id];
        var cls='dsh-goal'+(done?' is-done':'')+(info.state==='overdue'&&!done?' is-overdue':'')+(info.state==='soon'&&!done?' is-soon':'');
        return '<li class="'+cls+'">'+
          '<div class="dsh-goal-top"><span class="dsh-goal-ico">'+ic(done?P.checkCircle:manual?P.flag:P.book,17)+'</span>'+
            '<div class="dsh-goal-body"><div class="dsh-goal-title">'+esc(g.title)+'</div>'+
              (g.description?'<div class="dsh-goal-desc">'+esc(g.description)+'</div>':'')+
              '<div class="dsh-goal-due dsh-goal-due--'+info.state+'">'+ic(info.state==='overdue'?P.alert:info.state==='done'?P.check:P.clock,13)+esc(info.label)+'</div>'+
            '</div></div>'+
          (pr&&!manual?'<div class="dsh-goal-prog"><div class="dsh-bar dsh-bar--thin"><div class="dsh-bar-fill" style="width:'+(done?100:pr.pct)+'%"></div></div><span class="dsh-mono">'+(done?pr.total+' of '+pr.total:pr.done+' of '+pr.total)+' lessons</span></div>':'')+
          (manual&&!done?'<div class="dsh-goal-actions"><button class="dsh-btn dsh-btn--sm" data-action="goal-done" data-id="'+attr(g.id)+'"'+(busy?' disabled':'')+'>'+(busy?'<span class="dsh-spin"></span> Saving…':ic(P.check,14)+' Mark done')+'</button><span class="dsh-muted dsh-small">You’re the judge on this one.</span></div>':'')+
          (manual&&done?'<div class="dsh-goal-actions"><span class="dsh-goal-donetag">'+ic(P.trophy,14)+' Done — nice one.</span></div>':'')+
        '</li>'}).join('')+'</ul>';
    }
    html+='</section>';
    return html;
  }

  /* --- 5. stats + recent --- */
  function renderStats(d){
    var s=d.stats,rs=d.roadmap_summary||{},t=rs.totals||{};
    var lessons=s.lessons_done!=null?s.lessons_done:(t.done||d.recent_completions.length);
    var minutes=s.minutes_learned!=null?s.minutes_learned:(t.minutes_done||0);
    var goalsDone=s.goals_done!=null?s.goals_done:d.goals.filter(function(g){return g.status==='done'}).length;
    function tile(icon,val,label){return '<div class="dsh-stat"><span class="dsh-stat-ico">'+ic(icon,16)+'</span><span class="dsh-stat-val">'+esc(val)+'</span><span class="dsh-stat-label">'+esc(label)+'</span></div>'}
    return '<div class="dsh-stats">'+tile(P.checkCircle,lessons,'lessons done')+tile(P.clock,fmtMin(minutes),'learned')+tile(P.trophy,goalsDone,goalsDone===1?'goal done':'goals done')+'</div>';
  }
  function renderRecent(d){
    var list=d.recent_completions.slice(0,5);
    var html='<section class="dsh-card dsh-recent"><div class="dsh-sec-head"><div><p class="dsh-kicker">'+ic(P.history,14)+' Recent</p><h2 class="dsh-h2">Just completed</h2></div></div>';
    if(!list.length)html+='<p class="dsh-muted">Nothing finished yet — your first lesson will show up here.</p>';
    else html+='<ul class="dsh-recent-list">'+list.map(function(c){
      return '<li><a href="'+attr((c.type==='course'?cfg.links.course:cfg.links.lesson)+encodeURIComponent(c.slug||''))+'"><span class="dsh-recent-ico">'+ic(P.check,13)+'</span><span class="dsh-recent-body"><span class="dsh-recent-title">'+esc(c.title||c.slug)+'</span><span class="dsh-recent-meta">'+esc(relTime(c.completed_at))+(c.minutes?' · '+esc(fmtMin(c.minutes)):'')+'</span></span></a></li>'}).join('')+'</ul>';
    return html+'</section>';
  }

  /* ---------- actions ---------- */
  function toast(tone,text){st.toast={tone:tone,text:text};render();clearTimeout(st.toastT);st.toastT=setTimeout(function(){st.toast=null;var t=root.querySelector('.dsh-toast');if(t)t.parentNode.removeChild(t)},3500)}

  function openEdit(){
    st.editing=true;st.saveError=null;st.photoFile=null;st.photoPreview=null;st.focusField='user_first_name';render();
    if(!st.dropdowns){
      request('GET','/profile_dropdown_options',null,{tries:2}).then(function(o){
        st.dropdowns=o||{};
        // Swap only the industry field so focus + anything already typed survive.
        var cur=root.querySelector('.dsh-edit [name="user_current_industry"]');
        if(st.editing&&cur&&cur.tagName!=='SELECT'){var lab=cur.closest('.dsh-field');if(lab)lab.outerHTML=industryFieldHtml(cur.value)}
      }).catch(function(){st.dropdowns={}});
    }
    var panel=root.querySelector('.dsh-edit');if(panel&&panel.scrollIntoView)panel.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function closeEdit(){st.editing=false;st.saveError=null;st.photoFile=null;st.photoPreview=null;render()}

  function saveProfile(form){
    if(st.saving)return;
    var fd=new FormData(form);
    var keys=['user_first_name','user_last_name','user_current_role','user_current_company','user_current_industry','user_location','user_bio','user_desired_role'];
    var body={};keys.forEach(function(k){body[k]=String(fd.get(k)||'').trim()});
    if(!body.user_first_name){st.saveError='First name is required.';st.focusField='user_first_name';render();return}
    var u=st.data.user,prev={};for(var k in u)prev[k]=u[k];
    // optimistic update
    u.first_name=body.user_first_name;u.last_name=body.user_last_name;u.current_role=body.user_current_role;u.company=body.user_current_company;
    u.industry=body.user_current_industry;u.location=body.user_location;u.bio=body.user_bio;u.desired_role=body.user_desired_role;
    var photoFile=st.photoFile,photoPrev=st.photoPreview;
    if(photoPrev)u.profile_photo=photoPrev;
    st.saving=true;st.saveError=null;render();
    /* Legacy profile endpoint identifies the member by Memberstack token (ms_token input). */
    if(cfg.msToken)body.ms_token=cfg.msToken;
    request('PATCH','/profile',body).then(function(){
      if(!photoFile)return null;
      var pf=new FormData();pf.append('ms_token',cfg.msToken||'');pf.append('photo',photoFile,photoFile.name);
      return request('POST','/profile_photo',pf,{tries:2}).then(function(r){
        var url=r&&(photoUrl(r.profile_photo)||photoUrl(r.photo)||(r.user&&photoUrl(r.user.profile_photo)));
        if(url)u.profile_photo=url;
      });
    }).then(function(){
      st.saving=false;st.editing=false;st.photoFile=null;st.photoPreview=null;
      toast('ok','Profile saved.');
    }).catch(function(e){
      for(var k in prev)u[k]=prev[k];
      st.saving=false;st.saveError=(e&&e.message)||'Couldn’t save. Please try again.';render();
    });
  }

  function pickPhoto(input){
    var f=input.files&&input.files[0];if(!f)return;
    if(f.size>5*1024*1024){st.saveError='That photo is over 5 MB — try a smaller one.';render();return}
    st.photoFile=f;st.saveError=null;
    try{var rd=new FileReader();rd.onload=function(){st.photoPreview=rd.result;render()};rd.readAsDataURL(f)}catch(e){render()}
  }

  function markGoalDone(id){
    var g=null;st.data.goals.forEach(function(x){if(String(x.id)===String(id))g=x});
    if(!g||st.busyGoal[id])return;
    var prevStatus=g.status,prevAt=g.completed_at;
    st.busyGoal[id]=true;render();
    request('PATCH','/goal',{id:g.id,status:'done'}).then(function(r){
      g.status='done';g.completed_at=(r&&r.goal&&r.goal.completed_at)||new Date().toISOString();
      if(st.data.stats.goals_done!=null)st.data.stats.goals_done=+st.data.stats.goals_done+1;
      delete st.busyGoal[id];
      toast('ok','Goal done. That’s the good stuff.');
    }).catch(function(e){
      g.status=prevStatus;g.completed_at=prevAt;delete st.busyGoal[id];
      toast('error',(e&&e.message)||'Couldn’t update the goal. Try again.');
    });
  }

  root.addEventListener('click',function(ev){
    var t=ev.target.closest('[data-action]');if(!t||!root.contains(t))return;
    var a=t.getAttribute('data-action');
    if(a==='retry'){load()}
    else if(a==='edit-profile'){st.editing?closeEdit():openEdit()}
    else if(a==='cancel-edit'){closeEdit()}
    else if(a==='toggle-ms'){var id=t.getAttribute('data-id');st.open[id]=!st.open[id];
      var li=t.closest('.dsh-ms'),box=li&&li.querySelector('.dsh-ms-items');
      if(box){box.hidden=!st.open[id];li.classList.toggle('is-open',!!st.open[id]);t.setAttribute('aria-expanded',st.open[id]?'true':'false')}}
    else if(a==='goal-done'){markGoalDone(t.getAttribute('data-id'))}
  });
  root.addEventListener('submit',function(ev){
    var f=ev.target.closest('[data-action="save-profile"]');if(!f)return;
    ev.preventDefault();saveProfile(f);
  });
  root.addEventListener('change',function(ev){
    if(ev.target&&ev.target.name==='photo')pickPhoto(ev.target);
  });
  root.addEventListener('keydown',function(ev){
    if(ev.key==='Escape'&&st.editing&&!st.saving){closeEdit();return}
    if(ev.key==='Enter'&&st.editing&&ev.target&&ev.target.tagName==='INPUT'&&ev.target.type!=='file'){
      var f=ev.target.closest('[data-action="save-profile"]');if(f){ev.preventDefault();saveProfile(f)}
    }
  });

  load();
  return {reload:load,getState:function(){return st}};
}

/* ---------- logged-out card (used by the Webflow embed) ---------- */
function renderLogin(opts){
  opts=opts||{};
  var root=typeof opts.mount==='string'?document.querySelector(opts.mount):(opts.mount||document.getElementById('strive-dashboard'));
  if(!root)return;
  if(!root.id)root.id='strive-dashboard';
  /* No /login page exists: login is the Memberstack modal; /signup#/ms/login is the fallback. */
  var href=opts.href||'/signup',login=opts.loginHref||'/signup#/ms/login';
  root.innerHTML='<div class="dsh-wrap"><div class="dsh-card dsh-error dsh-login">'+
    '<div class="dsh-error-ico">'+ic(P.logIn,26)+'</div>'+
    '<p class="dsh-kicker">Members only</p>'+
    '<h2 class="dsh-h2">Log in to see your dashboard</h2>'+
    '<p class="dsh-muted">Your roadmap, goals and progress live here. New to STRIVE? Create an account to get started.</p>'+
    '<div class="dsh-hero-actions dsh-hero-actions--center"><a class="dsh-btn" href="'+attr(login)+'" data-ms-modal="login">'+ic(P.logIn,16)+' Log in</a><a class="dsh-btn dsh-btn--ghost" href="'+attr(href)+'">Create account '+ic(P.arrowRight,16)+'</a></div>'+
  '</div></div>';
}

window.STRIVEDashboard={init:init,renderLogin:renderLogin,version:'1.0.0'};
})();
