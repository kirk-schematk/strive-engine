/* ============================================================
   STRIVE roadmap engine — /welcome-onboard
   Results → Roadmap → Goals → Profile (post-signup).
   window.STRIVERoadmap.init({
     mount:'#strive-roadmap',
     platform:'https://x8ki-letl-twmt.n7.xano.io/api:fykJB1SM',
     onboarding:'https://x8ki-letl-twmt.n7.xano.io/api:m2bNDxnv',
     afterProfileHref:'/dashboard',
     authToken:'<xano bearer>', msToken:'<memberstack token>',
     onboardToken:'<strive_onboard_token>' (optional — read from
       localStorage / cookie / ?onb= when omitted),
     prefill:{first_name,last_name,location,company,industry,current_role},
     lessonHref:'/lesson?slug=', courseHref:'/course?slug=',
     assessmentHref:'/get-started', loginHref:'/signup#/ms/login',
     mock:false   // true or ?mock=1 → docs/fixtures/*.json, nothing hits Xano
   })
   Mock paths: ?path=noroadmap → no onboard token + GET /roadmap empty
   (quick-start card); ?path=roadmap → GET /roadmap has a plan.
   Deep link: #roadmap opens directly at the Roadmap step.
   Scoped: #strive-roadmap .rm-*  ·  no deps beyond page fonts.
   ============================================================ */
(function(){
'use strict';
var DEF_PLATFORM='https://x8ki-letl-twmt.n7.xano.io/api:fykJB1SM';
var DEF_ONBOARD='https://x8ki-letl-twmt.n7.xano.io/api:m2bNDxnv';
var SCRIPT_BASE=(function(){try{var s=document.currentScript&&document.currentScript.src;return s?s.replace(/[^\/]*$/,''):''}catch(e){return ''}})();
var FIXTURES=(SCRIPT_BASE||'./')+'docs/fixtures/';
var STEPS=['Results','Roadmap','Goals','Profile'];

/* ---- Lucide-style inline SVG icons ---- */
function ic(d,s){s=s||18;return '<svg xmlns="http://www.w3.org/2000/svg" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>'}
var P={
  arrowRight:'<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  arrowLeft:'<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  arrowUp:'<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  arrowDown:'<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  checkCircle:'<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  xCircle:'<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
  chevronDown:'<path d="m6 9 6 6 6-6"/>',
  chevronUp:'<path d="m18 15-6-6-6 6"/>',
  compass:'<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  box:'<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  route:'<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  map:'<path d="M14.1 6 8 3 2 6v15l6-3 6.1 3L20 18V3z"/><path d="M8 3v15"/><path d="M14 6v15"/>',
  flag:'<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  clock:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  book:'<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  layers:'<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  cpu:'<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
  database:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  gitMerge:'<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>',
  briefcase:'<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user:'<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  camera:'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  sparkles:'<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/>',
  refresh:'<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  alert:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  lock:'<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  clipboard:'<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  edit:'<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  bldg:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M9 7h.01"/><path d="M15 7h.01"/><path d="M9 11h.01"/><path d="M15 11h.01"/>',
  crane:'<path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z"/><path d="M10 15V6a2 2 0 0 1 4 0v9"/><path d="M4 15v-3a8 8 0 0 1 16 0v3"/>',
  wrench:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  trendUp:'<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  arrowUpRight:'<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>',
  monitor:'<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  gradCap:'<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  undo:'<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  externalLink:'<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
};
var ARCH_ICON={Explorer:P.compass,Builder:P.box,Orchestrator:P.target,Strategist:P.route,Visionary:P.eye};
var ARCHS=['Explorer','Builder','Orchestrator','Strategist','Visionary'];
function archMeter(arch,phase){
  var i=ARCHS.indexOf(arch);if(i<0)i=clamp((+phase||1)-1,0,4);
  var segs='';for(var k=0;k<ARCHS.length;k++)segs+='<span class="rm-seg'+(k<=i?' is-on':'')+'" title="'+ARCHS[k]+'"></span>';
  var next=i<ARCHS.length-1?'Next on the ladder: <b>'+ARCHS[i+1]+'</b>':'The top of the ladder';
  return '<div class="rm-meter" role="img" aria-label="'+esc(ARCHS[i])+', step '+(i+1)+' of '+ARCHS.length+'">'+segs+'</div><p class="rm-meter-next">'+next+'</p>';
}
var DEFAULT_LABELS={'1':'Student','2':'Modeler','3':'Coordinator','4':'Project BIM Manager','5':'Director'};
var PHASE_HINT={'1':'Learning the tools','2':'Producing models day to day','3':'Coordinating across disciplines','4':'Running BIM on projects','5':'Setting digital strategy'};
var DOMAINS=[
  {id:1,name:'Technical & Computational Proficiency',short:'Technical',icon:P.cpu},
  {id:2,name:'Information Management & Open Standards',short:'Information',icon:P.database},
  {id:3,name:'Process Execution & Coordination',short:'Process',icon:P.gitMerge},
  {id:4,name:'Strategy, Policy, & Management',short:'Strategy',icon:P.briefcase},
  {id:5,name:'Interpersonal & Supportive Competencies',short:'People',icon:P.users}
];
var DISC=['Architecture','Engineering','Construction','Operations & FM','Client/Owner','Other'];
var DISC_ICON={'Architecture':P.bldg,'Engineering':P.layers,'Construction':P.crane,'Operations & FM':P.wrench,'Client/Owner':P.briefcase,'Other':P.compass};
var GOALS=['Level up in my current role','Step up to the next role','Move into BIM/digital','Keep my team current'];
var GOAL_ICON={'Level up in my current role':P.trendUp,'Step up to the next role':P.arrowUpRight,'Move into BIM/digital':P.monitor,'Keep my team current':P.users};
var WEEKLY=[30,60,120,240];

/* ---- state ---- */
var st={opts:null,root:null,body:null,step:0,mock:false,mockPath:null,deepLink:false,
  authToken:null,msToken:null,onboardToken:null,
  results:null,roadmap:null,goalsSuggested:[],existingGoals:[],inputs:null,
  goalsDraft:null,profile:{},dropdowns:null,skippedResults:false,lastRemoved:null,regenTimer:null};

/* ---- helpers ---- */
function el(tag,cls,html){var e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function qs(k){try{return new URLSearchParams(location.search).get(k)}catch(e){return null}}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function labels(){return (st.roadmap&&st.roadmap.phase_labels)||DEFAULT_LABELS}
function label(p){return labels()[String(p)]||('Phase '+p)}
function domainName(id){var d=DOMAINS.filter(function(x){return x.id===id})[0];return d?d.name:('Domain '+id)}
function fmtMin(m){m=Math.round(m||0);if(m<60)return m+' min';var h=Math.floor(m/60),r=m%60;return r?h+'h '+r+'m':h+'h'}
function weeksFor(min,weekly){return Math.max(1,Math.ceil((min||0)/(weekly||60)))}
function isoDate(d){return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
function addDays(n){var d=new Date();d.setDate(d.getDate()+n);return isoDate(d)}
function fmtDate(s){if(!s)return '';var d=new Date(s+'T00:00:00');if(isNaN(d))return s;return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})}
function log(){if(window.console&&console.log)console.log.apply(console,['[STRIVERoadmap]'].concat([].slice.call(arguments)))}
function readCookie(n){var m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):null}
function readOnboardToken(){
  var t=null;
  try{t=localStorage.getItem('strive_onboard_token')}catch(e){}
  if(!t)t=readCookie('strive_onb');
  if(!t)t=qs('onb');
  return t||null;
}
function clearOnboardToken(){
  try{localStorage.removeItem('strive_onboard_token')}catch(e){}
  document.cookie='strive_onb=; path=/; max-age=0; SameSite=Lax';
}
function lessonHref(item){
  var base=item.type==='course'?st.opts.courseHref:st.opts.lessonHref;
  return base+encodeURIComponent(item.slug||'');
}
function itemMinutes(rm){var t=0;(rm.milestones||[]).forEach(function(m){if(m.deferred)return;(m.items||[]).forEach(function(i){t+=i.minutes||0})});return t}
function recomputeTotals(rm){
  var items=0,minutes=0,done=0;
  (rm.milestones||[]).forEach(function(m){(m.items||[]).forEach(function(i){items++;minutes+=i.minutes||0;if(i.done)done++})});
  rm.totals={items:items,minutes:minutes,done:done};
}

/* ---- API: retry + backoff on 429/5xx, friendly errors ---- */
function request(method,path,body,o){
  o=o||{};
  if(st.mock)return mockCall(method,path,body,o);
  var base=o.base==='onboarding'?st.opts.onboarding:st.opts.platform;
  var url=base+path;
  var init={method:method,headers:{}};
  if(o.form){init.body=o.form}
  else if(method==='GET'){if(body)url+='?'+new URLSearchParams(body).toString()}
  else{init.headers['Content-Type']='application/json';init.body=JSON.stringify(body||{})}
  if(o.auth!==false&&st.authToken)init.headers['Authorization']='Bearer '+st.authToken;
  var tries=o.tries||4;
  function attempt(i){
    return fetch(url,init).then(function(r){
      if((r.status===429||r.status>=500)&&i<tries-1){
        return sleep(500*Math.pow(2,i)+Math.random()*250).then(function(){return attempt(i+1)});
      }
      if(!r.ok){
        return r.text().then(function(t){
          var msg='';try{var j=JSON.parse(t);msg=j.message||j.error||''}catch(e){msg=t}
          var err=new Error(msg||('Request failed ('+r.status+')'));err.status=r.status;throw err;
        });
      }
      return r.text().then(function(t){try{return t?JSON.parse(t):{}}catch(e){return {}}});
    },function(e){
      if(i<tries-1)return sleep(500*Math.pow(2,i)).then(function(){return attempt(i+1)});
      var err=new Error('Network error — check your connection.');err.status=0;throw err;
    });
  }
  return attempt(0);
}

/* ---- MOCK: fixtures only, logs every would-be request ---- */
function fixture(name){return fetch(FIXTURES+name).then(function(r){if(!r.ok)throw new Error('Fixture '+name+' '+r.status);return r.json()})}
function delay(v,ms){return sleep(ms||(450+Math.random()*350)).then(function(){return v})}
function mockCall(method,path,body,o){
  log('mock '+method+' '+path,o&&o.form?'(multipart: '+[].slice.call(o.form.keys()).join(', ')+')':(body||''));
  if(path==='/onboarding_claim')return fixture('claim_response.json').then(delay);
  if(path==='/roadmap'&&method==='GET'){
    if(st.mockPath==='noroadmap')return delay({roadmap:null,goals:[],next_item:null,stats:{}});
    return fixture('roadmap_get.json').then(delay);
  }
  if(path==='/roadmap_generate')return fixture('claim_response.json').then(function(fx){return delay(mockRegenerate(fx.roadmap,fx.goals_suggested,body||{}),700)});
  if(path==='/roadmap'&&method==='PATCH'){
    var rm=JSON.parse(JSON.stringify(st.roadmap||{}));
    if(body.status)rm.status=body.status;
    if(body.milestones)rm.milestones=body.milestones;
    if(body.inputs)rm.inputs=body.inputs;
    if(rm.status==='confirmed')rm.confirmed_at=new Date().toISOString();
    recomputeTotals(rm);
    return delay({roadmap:rm,goals:st.existingGoals||[],next_item:null,stats:{items_total:rm.totals.items,items_done:rm.totals.done}});
  }
  if(path==='/goals')return delay({goals:(body.goals||[]).map(function(g,i){return Object.assign({id:100+i,status:'active',progress:0},g)})});
  if(path==='/profile_dropdown_options')return fixture('profile_dropdown_options.json').then(delay);
  if(path==='/profile')return delay(Object.assign({ok:true},body));
  if(path==='/profile_photo')return delay({ok:true,profile_photo:{url:'(mock upload)'}});
  return Promise.reject(new Error('No mock for '+method+' '+path));
}
function mockRegenerate(rm,goals,body){
  rm=JSON.parse(JSON.stringify(rm));
  var L=rm.phase_labels||DEFAULT_LABELS;
  var basePhase=body.placement_phase||rm.placement_phase;
  var P=clamp(body.placement_override||basePhase,1,5);
  var delta=P-rm.placement_phase;
  var self=body.source==='self';
  if(self){
    rm.source='self';rm.archetype=null;rm.weak_domains=[];
    if(body.goal)rm.goal=body.goal;if(body.discipline)rm.discipline=body.discipline;
    rm.milestones=rm.milestones.filter(function(m){return m.id!=='m1'});
    goals=goals.filter(function(g){return !/assessment gaps/i.test(g.title)});
  }
  rm.placement_phase=P;rm.placement_override=body.placement_override||null;
  rm.target_phase=clamp(rm.target_phase+delta,1,5);
  var focus=body.focus_domains||rm.inputs.focus_domains||[1,2,3,4,5];
  rm.milestones.forEach(function(m){
    var oldP=m.phase;m.phase=clamp(m.phase+delta,1,5);
    if(m.domain!=null)m.title=L[String(m.phase)]+': '+domainName(m.domain);
    else if(oldP!==m.phase)m.title=m.title;
    m.items.forEach(function(i){i.phase=clamp((i.phase||oldP)+delta,1,5)});
    m.deferred=m.domain!=null&&focus.indexOf(m.domain)<0;
  });
  rm.inputs=Object.assign({},rm.inputs,{
    current_role:body.current_role!=null?body.current_role:rm.inputs.current_role,
    target_role:body.target_role!=null?body.target_role:rm.inputs.target_role,
    weekly_minutes:body.weekly_minutes||rm.inputs.weekly_minutes,
    focus_domains:focus
  });
  recomputeTotals(rm);
  var weekly=rm.inputs.weekly_minutes;
  var active=rm.milestones.filter(function(m){return !m.deferred});
  var gaps=(rm.milestones.filter(function(m){return m.id==='m1'})[0]||{items:[]}).items.length;
  var doms=[];active.forEach(function(m){if(m.domain!=null&&doms.indexOf(domainName(m.domain))<0)doms.push(domainName(m.domain))});
  var min=itemMinutes(rm);
  rm.summary='You placed at '+L[String(P)]+(rm.archetype?' ('+rm.archetype+')':'')+". Your goal is '"+rm.goal+"', so this plan takes you to "+L[String(rm.target_phase)]+'. '+
    (gaps?'It starts by closing '+gaps+' gaps from your assessment, then works through ':'It works through ')+
    (doms.length?doms.slice(0,-1).join(', ')+(doms.length>1?' and ':'')+doms.slice(-1)[0]:'your focus areas')+
    ' at '+L[String(P)]+(rm.target_phase!==P?' and '+L[String(rm.target_phase)]:'')+' level. About '+Math.max(1,Math.round(min/60))+'h of lessons at '+weekly+' min/week — roughly '+weeksFor(min,weekly)+' weeks.';
  rm.generated_at=new Date().toISOString();rm.version=(rm.version||1)+1;rm.status='proposed';
  goals=JSON.parse(JSON.stringify(goals));
  goals.forEach(function(g,i){
    if(/^Reach /.test(g.title)){g.title='Reach '+L[String(rm.target_phase)]+' level';g.due_date=addDays(7*weeksFor(min,weekly))}
    else if(/^Finish /.test(g.title)){var m=active.filter(function(x){return x.id!=='m1'})[0];if(m){g.title='Finish '+m.title;g.metric={type:'lessons',slugs:m.items.filter(function(x){return x.type==='lesson'}).map(function(x){return x.slug})};g.target_count=g.metric.slugs.length;var mm=0;m.items.forEach(function(x){mm+=x.minutes||0});g.due_date=addDays(7*Math.max(2,Math.ceil(mm/weekly)))}}
  });
  return {roadmap:rm,goals_suggested:goals};
}

/* ---- scaffold + rail ---- */
function scaffold(){
  st.root.classList.add('rm');
  st.root.innerHTML=
    '<div class="rm-glow" aria-hidden="true"></div>'+
    '<header class="rm-top">'+
      '<p class="rm-eyebrow">'+ic(P.sparkles,14)+' Welcome to STRIVE</p>'+
      '<nav class="rm-rail" aria-label="Setup steps">'+STEPS.map(function(s,i){
        return '<span class="rm-rail-step" data-i="'+i+'"><span class="rm-rail-num">'+(i+1)+'</span><span class="rm-rail-label">'+s+'</span></span>'+(i<STEPS.length-1?'<span class="rm-rail-line"></span>':'');
      }).join('')+'</nav>'+
    '</header>'+
    '<div class="rm-body"></div>'+
    '<div class="rm-toast" hidden></div>';
  st.body=st.root.querySelector('.rm-body');
}
function setStep(idx){
  st.step=idx;
  st.root.querySelectorAll('.rm-rail-step').forEach(function(s,i){
    s.classList.toggle('is-active',i===idx);
    s.classList.toggle('is-done',i<idx);
    s.classList.toggle('is-skipped',i<idx&&i===0&&st.skippedResults);
    s.querySelector('.rm-rail-num').innerHTML=i<idx?ic(P.check,12):String(i+1);
  });
  st.root.querySelectorAll('.rm-rail-line').forEach(function(l,i){l.classList.toggle('is-done',i<idx)});
}
/* Scroll guard: never scroll on the initial render (it jumped the page on load),
   and only once the visitor has actually interacted with the page. */
var shown=0,interacted=false;
['pointerdown','keydown','touchstart'].forEach(function(ev){document.addEventListener(ev,function(){interacted=true},{once:true,passive:true})});
function navBlend(){
  var n=document.querySelector('.nav-ds');if(!n||n._rmBlend)return;n._rmBlend=true;
  function f(){n.classList.toggle('is-top',(window.pageYOffset||document.documentElement.scrollTop||0)<24)}
  f();window.addEventListener('scroll',f,{passive:true});
}
function show(fn,stepIdx,cls){
  if(stepIdx!=null)setStep(stepIdx);
  st.body.innerHTML='';
  var w=el('div','rm-card'+(cls?' '+cls:''));
  st.body.appendChild(w); // attach first so screen builders can query st.body
  fn(w);
  shown++;
  reveal();
  return w;
}
/* The page stays put unless the new step would open out of view (the previous
   step's button sits at the bottom of a long card). Never on the first render,
   never before the visitor has interacted. */
function reveal(){
  if(shown<2||!interacted)return;
  var top=st.root.querySelector('.rm-top')||st.body;
  var r=top.getBoundingClientRect(),vh=window.innerHeight||document.documentElement.clientHeight;
  if(!vh||(r.top>=0&&r.top<vh*0.6))return;
  var y=Math.max(0,(window.pageYOffset||0)+r.top-88);
  try{window.scrollTo({top:y,behavior:'smooth'})}catch(e){window.scrollTo(0,y)}
}
function toast(msg,actionLabel,action){
  var t=st.root.querySelector('.rm-toast');
  t.innerHTML='<span>'+esc(msg)+'</span>'+(actionLabel?'<button type="button" class="rm-toast-btn">'+ic(P.undo,14)+' '+esc(actionLabel)+'</button>':'');
  t.hidden=false;
  clearTimeout(t._tm);
  if(actionLabel)t.querySelector('.rm-toast-btn').onclick=function(){t.hidden=true;action&&action()};
  t._tm=setTimeout(function(){t.hidden=true},4500);
}
function btn(label,cls,iconAfter){return '<button type="button" class="rm-btn '+(cls||'')+'">'+esc(label)+(iconAfter?' '+ic(iconAfter,17):'')+'</button>'}
function busy(b,on,txt){if(!b)return;b.disabled=!!on;if(on){b.dataset.label=b.innerHTML;b.innerHTML='<span class="rm-spin rm-spin--sm"></span> '+esc(txt||'Saving…')}else if(b.dataset.label){b.innerHTML=b.dataset.label}}

/* ---- generic screens ---- */
function showLoading(stepIdx,msg){
  show(function(w){
    w.className+=' rm-card--center';
    w.innerHTML='<div class="rm-spin"></div><p class="rm-loading">'+esc(msg||'Loading…')+'</p>';
  },stepIdx);
}
function showError(err,retry,stepIdx){
  var status=err&&err.status;
  show(function(w){
    w.className+=' rm-card--center';
    var title=status===401||status===403?'We need to check who you are':status===0?'You look offline':'That didn’t work';
    var hint=status===401||status===403?'Your session may have expired. Log in again and we’ll pick up where you left off.':
      status===429||status>=500?'The learning server is busy. Give it a moment, then retry.':(err&&err.message)||'Something went wrong on our side.';
    w.innerHTML='<div class="rm-err-ico">'+ic(P.alert,28)+'</div><h2 class="rm-title">'+esc(title)+'</h2><p class="rm-sub">'+esc(hint)+'</p>'+
      '<div class="rm-actions rm-actions--center">'+(status===401||status===403?'<a class="rm-btn" href="'+esc(st.opts.loginHref)+'" data-ms-modal="login">Log in</a>':'')+
      '<button type="button" class="rm-btn '+(status===401||status===403?'rm-btn--ghost':'')+'">'+ic(P.refresh,16)+' Retry</button></div>';
    w.querySelector('button').onclick=retry;
  },stepIdx!=null?stepIdx:st.step);
}
function showAuthNeeded(){
  show(function(w){
    w.className+=' rm-card--center';
    w.innerHTML='<div class="rm-err-ico">'+ic(P.lock,28)+'</div><h2 class="rm-title">Log in to see your roadmap</h2><p class="rm-sub">Your results and learning plan are tied to your STRIVE account.</p>'+
      '<div class="rm-actions rm-actions--center"><a class="rm-btn" href="'+esc(st.opts.loginHref)+'">Log in '+ic(P.arrowRight,16)+'</a></div>';
  },0);
}

/* ---- boot ---- */
function boot(){
  if(!st.mock&&!st.authToken){showAuthNeeded();return}
  if(st.deepLink){loadRoadmap(true);return}
  if(st.onboardToken&&st.mockPath!=='noroadmap'&&st.mockPath!=='roadmap'){doClaim();return}
  loadRoadmap(false);
}
function initInputs(){
  var i=(st.roadmap&&st.roadmap.inputs)||{};
  st.inputs={
    current_role:i.current_role||'',
    target_role:i.target_role||'',
    weekly_minutes:i.weekly_minutes||60,
    focus_domains:(i.focus_domains&&i.focus_domains.length)?i.focus_domains.slice():[1,2,3,4,5]
  };
  st.goalsDraft=null;
}
function doClaim(){
  showLoading(0,'Linking your assessment to your account…');
  /* onboarding_claim lives on the Onboarding API group (same Bearer token). */
  request('POST','/onboarding_claim',{session_token:st.onboardToken},{base:'onboarding'})
  .then(function(d){
    st.results=d.results||null;st.roadmap=d.roadmap||null;st.goalsSuggested=d.goals_suggested||[];
    /* Claimed: drop the stored token so the dashboard stops handing off here. */
    clearOnboardToken();
    initInputs();
    if(st.results)showResults();else if(st.roadmap)showRoadmap();else showQuickStart();
  })
  .catch(function(e){
    /* 404 unknown token, 403 claimed by someone else, 400 session never finished:
       the token is useless — drop it and fall back to whatever roadmap exists. */
    if(e.status===404||e.status===403||e.status===400){clearOnboardToken();st.onboardToken=null;loadRoadmap(false);return}
    showError(e,doClaim,0);
  });
}
function loadRoadmap(deep){
  showLoading(deep?1:0,deep?'Opening your roadmap…':'Checking for an existing roadmap…');
  request('GET','/roadmap')
  .then(function(d){
    if(d&&d.roadmap){
      st.roadmap=d.roadmap;st.existingGoals=d.goals||[];st.goalsSuggested=d.goals_suggested||st.goalsSuggested||[];
      st.skippedResults=true;initInputs();showRoadmap();
    }else{showQuickStart()}
  })
  .catch(function(e){showError(e,function(){loadRoadmap(deep)},deep?1:0)});
}

/* ---- QUICK START (no assessment) ---- */
function showQuickStart(){
  var pick={disc:null,goal:null,phase:null};
  show(function(w){
    w.innerHTML=
      '<p class="rm-step-eyebrow">Let’s get you a plan</p>'+
      '<h2 class="rm-title">Where should we start?</h2>'+
      '<p class="rm-sub">Two ways to build your roadmap. The assessment is more accurate; the quick version takes 30 seconds.</p>'+
      '<div class="rm-qs">'+
        '<a class="rm-qs-opt" href="'+esc(st.opts.assessmentHref)+'"><span class="rm-qs-ico">'+ic(P.clipboard,22)+'</span><span><strong>Take the 6-minute assessment</strong><small>8 quick questions, instant feedback, precise placement.</small></span>'+ic(P.arrowRight,18)+'</a>'+
        '<button type="button" class="rm-qs-opt" data-self><span class="rm-qs-ico rm-qs-ico--alt">'+ic(P.edit,22)+'</span><span><strong>Build from my answers</strong><small>Tell us your discipline, goal and level. You can refine later.</small></span>'+ic(P.chevronDown,18)+'</button>'+
      '</div>'+
      '<div class="rm-self" hidden>'+
        '<h3 class="rm-h3">Your discipline</h3><div class="rm-chips" data-k="disc">'+DISC.map(function(d){return '<button type="button" class="rm-chip" data-v="'+esc(d)+'">'+ic(DISC_ICON[d],15)+' '+esc(d)+'</button>'}).join('')+'</div>'+
        '<h3 class="rm-h3">Your goal</h3><div class="rm-chips" data-k="goal">'+GOALS.map(function(g){return '<button type="button" class="rm-chip" data-v="'+esc(g)+'">'+ic(GOAL_ICON[g],15)+' '+esc(g)+'</button>'}).join('')+'</div>'+
        '<h3 class="rm-h3">Where are you today?</h3><div class="rm-phases" data-k="phase">'+[1,2,3,4,5].map(function(p){return '<button type="button" class="rm-phase" data-v="'+p+'"><span class="rm-phase-num">'+p+'</span><span><strong>'+esc(DEFAULT_LABELS[p])+'</strong><small>'+esc(PHASE_HINT[p])+'</small></span></button>'}).join('')+'</div>'+
        '<div class="rm-actions"><button type="button" class="rm-btn rm-btn--lg" disabled data-build>Build my roadmap '+ic(P.arrowRight,18)+'</button></div>'+
      '</div>';
    var self=w.querySelector('.rm-self'),build=w.querySelector('[data-build]');
    w.querySelector('[data-self]').onclick=function(){self.hidden=!self.hidden;this.classList.toggle('is-open',!self.hidden)};
    function check(){build.disabled=!(pick.disc&&pick.goal&&pick.phase)}
    w.querySelectorAll('[data-k]').forEach(function(g){
      var k=g.dataset.k;
      g.querySelectorAll('button').forEach(function(b){
        b.onclick=function(){
          g.querySelectorAll('button').forEach(function(x){x.classList.remove('is-on')});
          b.classList.add('is-on');pick[k]=k==='phase'?parseInt(b.dataset.v,10):b.dataset.v;check();
        };
      });
    });
    build.onclick=function(){
      var body={source:'self',discipline:pick.disc,goal:pick.goal,placement_phase:pick.phase,weekly_minutes:60,focus_domains:[1,2,3,4,5]};
      st.selfBase=body;
      showLoading(1,'Building your roadmap…');
      request('POST','/roadmap_generate',body).then(function(d){
        st.roadmap=d.roadmap;st.goalsSuggested=d.goals_suggested||[];st.skippedResults=true;initInputs();showRoadmap();
      }).catch(function(e){showError(e,function(){build.onclick()},1)});
    };
  },0);
}

/* ---- RESULTS ---- */
function showResults(){
  var r=st.results;
  show(function(w){
    var arch=r.archetype||'';
    var html=
      '<div class="rm-badge">'+
        '<div class="rm-badge-ico">'+ic(ARCH_ICON[arch]||P.target,28)+'</div>'+
        '<p class="rm-badge-kicker">Your archetype</p>'+
        '<h2 class="rm-badge-arch">'+esc(arch||'Learner')+'</h2>'+
        '<div class="rm-ladder">'+archMeter(arch,r.placement_phase)+'</div>'+
        '<div class="rm-stats">'+
          '<span class="rm-stat"><strong>'+esc(r.accuracy!=null?r.accuracy+'%':'—')+'</strong>accuracy</span>'+
          '<span class="rm-stat"><strong>'+esc(r.questions_correct)+'/'+esc(r.questions_answered)+'</strong>correct</span>'+
          '<span class="rm-stat"><strong>'+esc(r.discipline||'')+'</strong>discipline</span>'+
        '</div>'+
      '</div>'+
      (r.headline?'<p class="rm-headline">'+esc(r.headline)+'</p>':'')+
      '<h3 class="rm-h3">'+ic(P.layers,16)+' How you did by domain</h3>'+
      '<div class="rm-domains">'+(r.domains||[]).map(function(d){
        var pct=d.asked?Math.round(d.correct/d.asked*100):0;
        var tone=!d.asked?'none':pct===100?'good':pct>=50?'mid':'low';
        return '<div class="rm-dom rm-dom--'+tone+'"><div class="rm-dom-row"><span class="rm-dom-name">'+esc(d.name||domainName(d.domain))+'</span><span class="rm-dom-score">'+(d.asked?d.correct+' of '+d.asked:'not asked')+'</span></div><div class="rm-bar"><div class="rm-bar-fill" style="width:'+pct+'%"></div></div></div>';
      }).join('')+'</div>'+
      '<h3 class="rm-h3">'+ic(P.clipboard,16)+' Question review <span class="rm-h3-sub">'+(r.review||[]).length+' questions</span></h3>'+
      '<div class="rm-review">'+(r.review||[]).map(function(q,i){
        var opts=q.options||[];
        var mine=opts[q.answer_index],right=opts[q.correct_index];
        return '<details class="rm-q '+(q.correct?'is-correct':'is-wrong')+'"'+(q.correct?'':' open')+'>'+
          '<summary><span class="rm-q-mark">'+ic(q.correct?P.checkCircle:P.xCircle,18)+'</span><span class="rm-q-stem"><span class="rm-q-num">Q'+(i+1)+'</span>'+esc(q.stem)+'</span><span class="rm-q-chev">'+ic(P.chevronDown,16)+'</span></summary>'+
          '<div class="rm-q-body">'+
            '<p class="rm-q-line"><span class="rm-q-k">Your answer</span><span class="'+(q.correct?'rm-q-good':'rm-q-bad')+'">'+esc(mine)+'</span></p>'+
            (q.correct?'':'<p class="rm-q-line"><span class="rm-q-k">Correct</span><span class="rm-q-good">'+esc(right)+'</span></p>')+
            (q.feedback?'<p class="rm-q-fb">'+esc(q.feedback)+'</p>':'')+
            (q.lesson_slug?'<a class="rm-q-lesson" href="'+esc(st.opts.lessonHref+encodeURIComponent(q.lesson_slug))+'" target="_blank" rel="noopener">'+ic(P.book,14)+' '+(q.correct?'Go deeper: ':'Fix it: ')+esc(q.lesson_title||q.lesson_slug)+' '+ic(P.externalLink,12)+'</a>':'')+
          '</div></details>';
      }).join('')+'</div>'+
      '<div class="rm-actions rm-actions--end"><button type="button" class="rm-btn rm-btn--lg rm-btn--cta">Build my roadmap '+ic(P.arrowRight,18)+'</button></div>';
    w.innerHTML=html;
    w.querySelector('.rm-btn--cta').onclick=function(){showRoadmap()};
  },0);
}

/* ---- ROADMAP REVIEW ---- */
function showRoadmap(){
  var rm=st.roadmap;
  if(!rm){showQuickStart();return}
  var P0=rm.placement_phase,L=labels();
  var basePhase=rm.placement_override?(rm.placement_phase):P0; // server returns effective placement
  show(function(w){
    w.className+=' rm-card--wide';
    var phaseNow=rm.placement_phase;
    w.innerHTML=
      '<p class="rm-step-eyebrow">'+(st.deepLink?'Edit your roadmap':'Your roadmap')+'</p>'+
      '<h2 class="rm-title">'+esc(L[String(rm.placement_phase)])+' '+ic(P.arrowRight,20)+' '+esc(L[String(rm.target_phase)])+'</h2>'+
      '<p class="rm-sub">'+esc(rm.goal||'')+(rm.discipline?' <span class="rm-dot">·</span> '+esc(rm.discipline):'')+'. Answer four quick prompts and we’ll tune the plan as you go.</p>'+
      /* 1. phase check */
      '<section class="rm-prompt" data-p="1"><div class="rm-prompt-num">1</div><div class="rm-prompt-body">'+
        '<h3 class="rm-prompt-q">Does <em data-phase-label>'+esc(L[String(phaseNow)])+'</em> feel right?</h3>'+
        '<p class="rm-prompt-hint" data-phase-hint>'+esc(PHASE_HINT[String(phaseNow)]||'')+'</p>'+
        '<div class="rm-seg" data-phase-seg>'+
          '<button type="button" class="rm-seg-btn" data-dir="-1">'+ic(P.arrowLeft,14)+' I’m earlier</button>'+
          '<button type="button" class="rm-seg-btn is-on" data-dir="0">'+ic(P.check,14)+' Yes, that’s me</button>'+
          '<button type="button" class="rm-seg-btn" data-dir="1">I’m further along '+ic(P.arrowRight,14)+'</button>'+
        '</div></div></section>'+
      /* 2. roles */
      '<section class="rm-prompt" data-p="2"><div class="rm-prompt-num">2</div><div class="rm-prompt-body">'+
        '<h3 class="rm-prompt-q">Where are you now, and where are you headed?</h3>'+
        '<div class="rm-roles">'+
          '<label class="rm-field"><span>Current role</span><input type="text" data-role="current_role" placeholder="e.g. BIM Modeler" value="'+esc(st.inputs.current_role)+'"></label>'+
          '<label class="rm-field"><span>Target role</span><input type="text" data-role="target_role" placeholder="e.g. BIM Coordinator" value="'+esc(st.inputs.target_role)+'"></label>'+
        '</div>'+
        '<div class="rm-chips rm-chips--sm" data-role-chips>'+[1,2,3,4,5].map(function(p){return '<button type="button" class="rm-chip" data-v="'+esc(L[String(p)])+'">'+esc(L[String(p)])+'</button>'}).join('')+'</div>'+
        '<p class="rm-prompt-hint">Tap a chip to fill whichever box you edited last.</p>'+
      '</div></section>'+
      /* 3. weekly minutes */
      '<section class="rm-prompt" data-p="3"><div class="rm-prompt-num">3</div><div class="rm-prompt-body">'+
        '<h3 class="rm-prompt-q">How much time per week?</h3>'+
        '<div class="rm-seg" data-weekly>'+WEEKLY.map(function(m){return '<button type="button" class="rm-seg-btn'+(m===st.inputs.weekly_minutes?' is-on':'')+'" data-v="'+m+'">'+(m<60?m+' min':(m/60)+'h')+'</button>'}).join('')+'</div>'+
        '<p class="rm-prompt-hint" data-weekly-hint></p>'+
      '</div></section>'+
      /* 4. focus */
      '<section class="rm-prompt" data-p="4"><div class="rm-prompt-num">4</div><div class="rm-prompt-body">'+
        '<h3 class="rm-prompt-q">Focus areas</h3>'+
        '<p class="rm-prompt-hint">All five are on. Switch one off and we’ll park those milestones for later.</p>'+
        '<div class="rm-focus" data-focus>'+DOMAINS.map(function(d){return '<button type="button" class="rm-focus-btn'+(st.inputs.focus_domains.indexOf(d.id)>=0?' is-on':'')+'" data-v="'+d.id+'" aria-pressed="'+(st.inputs.focus_domains.indexOf(d.id)>=0)+'"><span class="rm-focus-ico">'+ic(d.icon,16)+'</span><span class="rm-focus-name">'+esc(d.short)+'</span><span class="rm-focus-check">'+ic(P.check,12)+'</span></button>'}).join('')+'</div>'+
      '</div></section>'+
      /* 5. the plan */
      '<section class="rm-prompt rm-prompt--plan" data-p="5"><div class="rm-prompt-num">5</div><div class="rm-prompt-body">'+
        '<h3 class="rm-prompt-q">Your plan</h3>'+
        '<div class="rm-plan" data-plan></div>'+
      '</div></section>'+
      '<div class="rm-actions rm-actions--split">'+
        (st.results?'<button type="button" class="rm-btn rm-btn--ghost" data-back>'+ic(P.arrowLeft,16)+' Back to results</button>':'<span></span>')+
        '<button type="button" class="rm-btn rm-btn--lg rm-btn--cta" data-confirm>'+ic(P.check,18)+' Looks good</button>'+
      '</div>';

    /* prompt 1 */
    var seg=w.querySelector('[data-phase-seg]');
    function refreshPhaseSeg(){
      var eff=st.roadmap.placement_phase;
      seg.querySelector('[data-dir="-1"]').disabled=eff<=1;
      seg.querySelector('[data-dir="1"]').disabled=eff>=5;
      w.querySelector('[data-phase-label]').textContent=labels()[String(eff)];
      w.querySelector('[data-phase-hint]').textContent=PHASE_HINT[String(eff)]||'';
    }
    seg.querySelectorAll('button').forEach(function(b){
      b.onclick=function(){
        var dir=parseInt(b.dataset.dir,10);
        var eff=st.roadmap.placement_phase;
        var next=dir===0?null:clamp(eff+dir,1,5);
        seg.querySelectorAll('button').forEach(function(x){x.classList.toggle('is-on',x===b)});
        st.placementOverride=next;
        regenerate({reason:dir===0?'Locking in '+labels()[String(eff)]+'…':'Re-planning for '+labels()[String(next)]+'…'});
      };
    });
    refreshPhaseSeg();

    /* prompt 2 */
    var lastRole=w.querySelector('[data-role="current_role"]');
    w.querySelectorAll('[data-role]').forEach(function(inp){
      inp.oninput=function(){st.inputs[inp.dataset.role]=inp.value;lastRole=inp};
      inp.onfocus=function(){lastRole=inp};
    });
    w.querySelectorAll('[data-role-chips] .rm-chip').forEach(function(c){
      c.onclick=function(){lastRole.value=c.dataset.v;st.inputs[lastRole.dataset.role]=c.dataset.v;lastRole.focus()};
    });

    /* prompt 3 */
    var wk=w.querySelector('[data-weekly]');
    function weeklyHint(){
      var min=itemMinutes(st.roadmap);
      w.querySelector('[data-weekly-hint]').textContent='About '+fmtMin(min)+' of lessons → roughly '+weeksFor(min,st.inputs.weekly_minutes)+' weeks at '+st.inputs.weekly_minutes+' min/week.';
    }
    wk.querySelectorAll('button').forEach(function(b){
      b.onclick=function(){
        wk.querySelectorAll('button').forEach(function(x){x.classList.toggle('is-on',x===b)});
        st.inputs.weekly_minutes=parseInt(b.dataset.v,10);weeklyHint();
        clearTimeout(st.regenTimer);st.regenTimer=setTimeout(function(){regenerate({reason:'Re-pacing your plan…'})},350);
      };
    });
    weeklyHint();

    /* prompt 4 */
    w.querySelectorAll('[data-focus] button').forEach(function(b){
      b.onclick=function(){
        var id=parseInt(b.dataset.v,10);var on=b.classList.contains('is-on');
        if(on&&st.inputs.focus_domains.length===1){toast('Keep at least one focus area on.');return}
        b.classList.toggle('is-on',!on);b.setAttribute('aria-pressed',String(!on));
        st.inputs.focus_domains=DOMAINS.map(function(d){return d.id}).filter(function(d){return d===id?!on:st.inputs.focus_domains.indexOf(d)>=0});
        regenerate({reason:'Refocusing your plan…'});
      };
    });

    /* actions */
    var back=w.querySelector('[data-back]');if(back)back.onclick=showResults;
    w.querySelector('[data-confirm]').onclick=confirmRoadmap;

    w._refreshPhaseSeg=refreshPhaseSeg;w._weeklyHint=weeklyHint;
    renderPlan();
  },1);
}
function regenerate(o){
  o=o||{};
  var w=st.body.querySelector('.rm-card'),plan=w&&w.querySelector('[data-plan]');
  if(!plan)return;
  var rm=st.roadmap;
  var body={
    source:rm.source||'assessment',
    placement_override:st.placementOverride!=null?st.placementOverride:null,
    current_role:st.inputs.current_role,
    target_role:st.inputs.target_role,
    weekly_minutes:st.inputs.weekly_minutes,
    focus_domains:st.inputs.focus_domains.slice()
  };
  if(rm.source==='self'){body.goal=rm.goal;body.discipline=rm.discipline;body.placement_phase=(st.selfBase&&st.selfBase.placement_phase)||rm.placement_phase}
  plan.innerHTML=skeleton(o.reason||'Rebuilding your plan…');
  w.querySelector('[data-confirm]').disabled=true;
  var token=++st.regenToken;
  request('POST','/roadmap_generate',body).then(function(d){
    if(token!==st.regenToken)return;
    st.roadmap=d.roadmap||st.roadmap;st.goalsSuggested=d.goals_suggested||st.goalsSuggested;
    if(st.roadmap.inputs){st.inputs.weekly_minutes=st.roadmap.inputs.weekly_minutes||st.inputs.weekly_minutes}
    st.goalsDraft=null;
    var h2=w.querySelector('.rm-title');if(h2)h2.innerHTML=esc(label(st.roadmap.placement_phase))+' '+ic(P.arrowRight,20)+' '+esc(label(st.roadmap.target_phase));
    w._refreshPhaseSeg&&w._refreshPhaseSeg();w._weeklyHint&&w._weeklyHint();
    w.querySelector('[data-confirm]').disabled=false;
    renderPlan(true);
  }).catch(function(e){
    if(token!==st.regenToken)return;
    w.querySelector('[data-confirm]').disabled=false;
    plan.innerHTML='<div class="rm-inline-err">'+ic(P.alert,18)+'<div><strong>Couldn’t rebuild the plan.</strong><span>'+esc(e.message||'')+'</span></div><button type="button" class="rm-btn rm-btn--sm">'+ic(P.refresh,14)+' Retry</button></div>';
    plan.querySelector('button').onclick=function(){regenerate(o)};
  });
}
st.regenToken=0;
function skeleton(msg){
  return '<div class="rm-skel"><p class="rm-skel-msg"><span class="rm-spin rm-spin--sm"></span> '+esc(msg)+'</p>'+
    '<div class="rm-skel-summary"><span></span><span></span><span style="width:70%"></span></div>'+
    [0,1,2].map(function(){return '<div class="rm-skel-ms"><span class="rm-skel-t"></span><span></span><span></span></div>'}).join('')+'</div>';
}
function renderPlan(fresh){
  var w=st.body.querySelector('.rm-card'),plan=w&&w.querySelector('[data-plan]');
  if(!plan)return;
  var rm=st.roadmap;recomputeTotals(rm);
  var active=rm.milestones.filter(function(m){return !m.deferred}),later=rm.milestones.filter(function(m){return m.deferred});
  var min=itemMinutes(rm),weekly=st.inputs.weekly_minutes;
  var html=
    '<div class="rm-summary'+(fresh?' is-fresh':'')+'"><p class="rm-summary-k">'+ic(P.map,15)+' How you’ll get there</p><p class="rm-summary-txt">'+esc(rm.summary||'')+'</p>'+
      '<div class="rm-summary-stats">'+
        '<span>'+ic(P.book,14)+' <strong>'+rm.totals.items+'</strong> items</span>'+
        '<span>'+ic(P.clock,14)+' <strong>'+fmtMin(min)+'</strong></span>'+
        '<span>'+ic(P.flag,14)+' <strong>~'+weeksFor(min,weekly)+'</strong> weeks</span>'+
        (rm.totals.done?'<span>'+ic(P.checkCircle,14)+' <strong>'+rm.totals.done+'</strong> done</span>':'')+
      '</div></div>'+
    '<div class="rm-ms-list">'+rm.milestones.map(function(m,mi){return milestoneHtml(m,mi,rm.milestones.length)}).join('')+'</div>'+
    (later.length?'<p class="rm-plan-note">'+ic(P.clock,13)+' '+later.length+' milestone'+(later.length>1?'s':'')+' parked for later — switch the focus area back on to include '+(later.length>1?'them':'it')+'.</p>':'');
  plan.innerHTML=html;
  plan.querySelectorAll('[data-rm-item]').forEach(function(b){
    b.onclick=function(){var mi=+b.dataset.mi,ii=+b.dataset.ii;removeItem(mi,ii)};
  });
  plan.querySelectorAll('[data-move]').forEach(function(b){
    b.onclick=function(){moveMilestone(+b.dataset.mi,+b.dataset.move)};
  });
}
function milestoneHtml(m,mi,n){
  var items=m.items||[],mins=0,done=0;items.forEach(function(i){mins+=i.minutes||0;if(i.done)done++});
  var phaseCls=m.id==='m1'?'rm-ms--gap':'';
  return '<details class="rm-ms '+phaseCls+(m.deferred?' rm-ms--later':'')+'"'+(mi===0&&!m.deferred?' open':'')+'>'+
    '<summary class="rm-ms-head">'+
      '<span class="rm-ms-idx">'+(m.id==='m1'?ic(P.target,15):(mi+1))+'</span>'+
      '<span class="rm-ms-titles"><span class="rm-ms-title">'+esc(m.title)+'</span>'+
        '<span class="rm-ms-meta"><span class="rm-tag rm-tag--phase">'+esc(label(m.phase))+'</span>'+(m.domain!=null?'<span class="rm-tag">'+esc(DOMAINS[m.domain-1]?DOMAINS[m.domain-1].short:'')+'</span>':'')+(m.deferred?'<span class="rm-tag rm-tag--later">Later</span>':'')+'<span class="rm-ms-count">'+items.length+' items · '+fmtMin(mins)+(done?' · '+done+' done':'')+'</span></span>'+
      '</span>'+
      '<span class="rm-ms-tools">'+
        '<button type="button" class="rm-icon-btn" data-move="-1" data-mi="'+mi+'" title="Move up" aria-label="Move milestone up"'+(mi===0?' disabled':'')+'>'+ic(P.arrowUp,14)+'</button>'+
        '<button type="button" class="rm-icon-btn" data-move="1" data-mi="'+mi+'" title="Move down" aria-label="Move milestone down"'+(mi===n-1?' disabled':'')+'>'+ic(P.arrowDown,14)+'</button>'+
        '<span class="rm-ms-chev">'+ic(P.chevronDown,16)+'</span>'+
      '</span>'+
    '</summary>'+
    (m.why?'<p class="rm-ms-why">'+esc(m.why)+'</p>':'')+
    '<ul class="rm-items">'+items.map(function(it,ii){
      return '<li class="rm-item'+(it.done?' is-done':'')+(it.type==='course'?' rm-item--course':'')+'">'+
        '<span class="rm-item-ico">'+ic(it.done?P.checkCircle:(it.type==='course'?P.gradCap:P.book),15)+'</span>'+
        '<span class="rm-item-main"><a class="rm-item-title" href="'+esc(lessonHref(it))+'" target="_blank" rel="noopener">'+esc(it.title)+'</a>'+
          '<span class="rm-item-meta">'+(it.type==='course'?'<span class="rm-tag rm-tag--course">Course'+(it.level?' · '+esc(it.level):'')+'</span>':'')+(it.competency?'<span>'+esc(it.competency)+'</span>':'')+'<span>'+fmtMin(it.minutes)+'</span></span>'+
        '</span>'+
        '<button type="button" class="rm-icon-btn rm-icon-btn--x" data-rm-item data-mi="'+mi+'" data-ii="'+ii+'" title="Remove from plan" aria-label="Remove '+esc(it.title)+'">'+ic(P.x,14)+'</button>'+
      '</li>';
    }).join('')+(items.length?'':'<li class="rm-item rm-item--empty">Nothing left here — it’ll be skipped.</li>')+'</ul>'+
  '</details>';
}
function removeItem(mi,ii){
  var m=st.roadmap.milestones[mi];if(!m)return;
  var it=m.items.splice(ii,1)[0];
  st.goalsDraft=null;
  renderPlan();
  toast('Removed "'+it.title+'"','Undo',function(){m.items.splice(ii,0,it);renderPlan()});
}
function moveMilestone(mi,dir){
  var ms=st.roadmap.milestones,j=mi+dir;if(j<0||j>=ms.length)return;
  var t=ms[mi];ms[mi]=ms[j];ms[j]=t;
  renderPlan();
  var d=st.body.querySelectorAll('.rm-ms')[j];if(d){d.classList.add('is-moved');setTimeout(function(){d.classList.remove('is-moved')},600)}
}
function confirmRoadmap(){
  var w=st.body.querySelector('.rm-card'),b=w.querySelector('[data-confirm]');
  busy(b,true,'Saving your roadmap…');
  var body={status:'confirmed',milestones:st.roadmap.milestones,inputs:{
    current_role:st.inputs.current_role,target_role:st.inputs.target_role,
    weekly_minutes:st.inputs.weekly_minutes,focus_domains:st.inputs.focus_domains.slice()}};
  request('PATCH','/roadmap',body).then(function(d){
    if(d&&d.roadmap)st.roadmap=d.roadmap;
    if(d&&d.goals)st.existingGoals=d.goals;
    if(st.deepLink){showDone('Roadmap updated','Taking you back to your dashboard…');return}
    showGoals();
  }).catch(function(e){busy(b,false);showError(e,confirmRoadmap,1)});
}

/* ---- GOALS ---- */
function buildGoalsDraft(){
  return (st.goalsSuggested||[]).map(function(g){
    return {keep:true,title:g.title||'',description:g.description||'',due_date:g.due_date||addDays(14),
      metric:g.metric||{type:'manual'},target_count:g.target_count||((g.metric&&g.metric.slugs)?g.metric.slugs.length:1),suggested:true};
  });
}
function metricLabel(g){
  var m=g.metric||{};
  if(m.type==='lessons'){var n=(m.slugs||[]).length;return (m.count?m.count+' of '+n:n)+' lesson'+(n===1?'':'s')}
  return 'I’ll tick it off myself';
}
function showGoals(){
  if(!st.goalsDraft)st.goalsDraft=buildGoalsDraft();
  show(function(w){
    w.innerHTML=
      '<p class="rm-step-eyebrow">Almost there</p>'+
      '<h2 class="rm-title">Set a couple of goals</h2>'+
      '<p class="rm-sub">We’ve suggested three from your plan. Keep what motivates you, rename anything, or add your own. Progress shows on your dashboard.</p>'+
      '<div class="rm-goals" data-goals></div>'+
      '<div class="rm-add-goal" data-add-wrap><button type="button" class="rm-btn rm-btn--ghost rm-btn--dashed" data-add>'+ic(P.plus,16)+' Add a custom goal</button></div>'+
      '<div class="rm-actions rm-actions--split"><button type="button" class="rm-link" data-skip>Skip for now</button><button type="button" class="rm-btn rm-btn--lg rm-btn--cta" data-save>Save goals '+ic(P.arrowRight,18)+'</button></div>';
    renderGoals();
    w.querySelector('[data-add]').onclick=function(){openCustomGoal(w)};
    w.querySelector('[data-skip]').onclick=function(){showProfile()};
    w.querySelector('[data-save]').onclick=saveGoals;
  },2);
}
function renderGoals(){
  var box=st.body.querySelector('[data-goals]');if(!box)return;
  box.innerHTML=st.goalsDraft.map(function(g,i){
    return '<div class="rm-goal'+(g.keep?'':' is-off')+'" data-gi="'+i+'">'+
      '<button type="button" class="rm-switch" role="switch" aria-checked="'+g.keep+'" data-toggle title="'+(g.keep?'Keep':'Skip')+'"><span></span></button>'+
      '<div class="rm-goal-body">'+
        '<input class="rm-goal-title" type="text" value="'+esc(g.title)+'" data-title aria-label="Goal title">'+
        (g.description?'<p class="rm-goal-desc">'+esc(g.description)+'</p>':'')+
        '<div class="rm-goal-row"><span class="rm-tag">'+ic(g.metric&&g.metric.type==='lessons'?P.book:P.check,12)+' '+esc(metricLabel(g))+'</span>'+
          '<label class="rm-goal-due">'+ic(P.flag,12)+' Due <input type="date" value="'+esc(g.due_date)+'" data-due></label>'+
          (g.suggested?'':'<button type="button" class="rm-icon-btn rm-icon-btn--x" data-del title="Remove goal">'+ic(P.x,13)+'</button>')+
        '</div>'+
      '</div></div>';
  }).join('')+(st.goalsDraft.length?'':'<p class="rm-empty">No goals yet — add one below, or skip for now.</p>');
  box.querySelectorAll('.rm-goal').forEach(function(card){
    var i=+card.dataset.gi,g=st.goalsDraft[i];
    card.querySelector('[data-toggle]').onclick=function(){g.keep=!g.keep;card.classList.toggle('is-off',!g.keep);this.setAttribute('aria-checked',String(g.keep));this.title=g.keep?'Keep':'Skip'};
    card.querySelector('[data-title]').oninput=function(){g.title=this.value};
    card.querySelector('[data-due]').onchange=function(){g.due_date=this.value};
    var del=card.querySelector('[data-del]');if(del)del.onclick=function(){st.goalsDraft.splice(i,1);renderGoals()};
  });
}
function openCustomGoal(w){
  var wrap=w.querySelector('[data-add-wrap]');
  var rm=st.roadmap;
  var f=el('div','rm-custom');
  f.innerHTML=
    '<h3 class="rm-h3">'+ic(P.edit,15)+' New goal</h3>'+
    '<label class="rm-field"><span>Title</span><input type="text" data-c-title placeholder="e.g. Run my first clash review solo"></label>'+
    '<label class="rm-field rm-field--short"><span>Due date</span><input type="date" data-c-due value="'+addDays(28)+'"></label>'+
    '<div class="rm-radio-row">'+
      '<label class="rm-radio"><input type="radio" name="rm-metric" value="lessons" checked><span>Pick lessons from my roadmap</span></label>'+
      '<label class="rm-radio"><input type="radio" name="rm-metric" value="manual"><span>I’ll tick this off myself</span></label>'+
    '</div>'+
    '<div class="rm-picker" data-picker>'+rm.milestones.map(function(m){
      if(!m.items.length)return '';
      return '<div class="rm-picker-ms"><p class="rm-picker-t">'+esc(m.title)+'</p>'+m.items.map(function(it){
        return '<label class="rm-pick"><input type="checkbox" value="'+esc(it.slug)+'"'+(it.type==='course'?' data-course':'')+'><span>'+esc(it.title)+'</span><small>'+fmtMin(it.minutes)+'</small></label>';
      }).join('')+'</div>';
    }).join('')+'</div>'+
    '<div class="rm-actions rm-actions--split"><button type="button" class="rm-link" data-c-cancel>Cancel</button><button type="button" class="rm-btn" data-c-add>'+ic(P.plus,15)+' Add goal</button></div>';
  wrap.innerHTML='';wrap.appendChild(f);
  var picker=f.querySelector('[data-picker]');
  f.querySelectorAll('input[name="rm-metric"]').forEach(function(r){r.onchange=function(){picker.hidden=r.value==='manual'&&r.checked;if(r.value==='lessons'&&r.checked)picker.hidden=false}});
  f.querySelector('[data-c-cancel]').onclick=function(){wrap.innerHTML='<button type="button" class="rm-btn rm-btn--ghost rm-btn--dashed" data-add>'+ic(P.plus,16)+' Add a custom goal</button>';wrap.querySelector('[data-add]').onclick=function(){openCustomGoal(w)}};
  f.querySelector('[data-c-add]').onclick=function(){
    var title=f.querySelector('[data-c-title]').value.trim();
    if(!title){f.querySelector('[data-c-title]').focus();toast('Give your goal a title.');return}
    var mode=f.querySelector('input[name="rm-metric"]:checked').value;
    var slugs=[].slice.call(picker.querySelectorAll('input:checked')).map(function(c){return c.value});
    if(mode==='lessons'&&!slugs.length){toast('Pick at least one lesson, or choose “tick it off myself”.');return}
    st.goalsDraft.push({keep:true,title:title,description:'',due_date:f.querySelector('[data-c-due]').value||addDays(28),
      metric:mode==='lessons'?{type:'lessons',slugs:slugs}:{type:'manual'},target_count:mode==='lessons'?slugs.length:1,suggested:false});
    renderGoals();
    f.querySelector('[data-c-cancel]').onclick();
  };
  f.querySelector('[data-c-title]').focus();
}
function saveGoals(){
  var w=st.body.querySelector('.rm-card'),b=w.querySelector('[data-save]');
  var goals=st.goalsDraft.filter(function(g){return g.keep&&g.title.trim()}).map(function(g){
    return {title:g.title.trim(),description:g.description||'',metric:g.metric,target_count:g.target_count,due_date:g.due_date};
  });
  busy(b,true,'Saving goals…');
  request('POST','/goals',{goals:goals}).then(function(d){
    st.existingGoals=(d&&d.goals)||goals;
    toast(goals.length?goals.length+' goal'+(goals.length>1?'s':'')+' saved':'No goals set — you can add them any time');
    showProfile();
  }).catch(function(e){busy(b,false);showError(e,saveGoals,2)});
}

/* ---- PROFILE ---- */
function showProfile(){
  var pre=Object.assign({},st.opts.prefill||{},st.profile||{});
  if(!pre.current_role)pre.current_role=st.inputs&&st.inputs.current_role||'';
  var photoFile=null;
  show(function(w){
    w.innerHTML=
      '<p class="rm-step-eyebrow">Last step</p>'+
      '<h2 class="rm-title">Tell us a little about you</h2>'+
      '<p class="rm-sub">This shows on your dashboard and helps us tailor what we recommend. All optional.</p>'+
      '<div class="rm-photo"><div class="rm-avatar" data-avatar>'+ic(P.user,30)+'</div>'+
        '<label class="rm-btn rm-btn--ghost rm-btn--sm rm-file">'+ic(P.camera,15)+' <span data-photo-label>Add a photo</span><input type="file" accept="image/*" data-photo hidden></label>'+
        '<button type="button" class="rm-link" data-photo-clear hidden>Remove</button></div>'+
      '<div class="rm-form">'+
        '<label class="rm-field"><span>First name</span><input type="text" data-f="user_first_name" autocomplete="given-name" value="'+esc(pre.first_name||'')+'"></label>'+
        '<label class="rm-field"><span>Last name</span><input type="text" data-f="user_last_name" autocomplete="family-name" value="'+esc(pre.last_name||'')+'"></label>'+
        '<label class="rm-field"><span>Location</span><input type="text" data-f="user_location" placeholder="City, country" autocomplete="address-level2" value="'+esc(pre.location||'')+'"></label>'+
        '<label class="rm-field"><span>Company</span><input type="text" data-f="user_current_company" autocomplete="organization" value="'+esc(pre.company||'')+'"></label>'+
        '<label class="rm-field"><span>Industry</span><select data-f="user_current_industry"><option value="">Loading…</option></select></label>'+
        '<label class="rm-field"><span>Current role</span><input type="text" data-f="user_current_role" autocomplete="organization-title" value="'+esc(pre.current_role||'')+'"></label>'+
      '</div>'+
      '<div class="rm-actions rm-actions--split"><button type="button" class="rm-link" data-skip>Skip — go to my dashboard</button><button type="button" class="rm-btn rm-btn--lg rm-btn--cta" data-save>Save &amp; continue '+ic(P.arrowRight,18)+'</button></div>';
    var sel=w.querySelector('[data-f="user_current_industry"]');
    function fillIndustries(d){
      st.dropdowns=d;
      var inds=(d&&d.industries)||[];
      /* Value is the label (not the id): user.industry is a text column and the
         dashboard displays/edits it as text — same convention as strive-dashboard.js. */
      sel.innerHTML='<option value="">Select…</option>'+inds.map(function(i){var on=String(pre.industry)===String(i.id)||pre.industry===i.label;return '<option value="'+esc(i.label)+'"'+(on?' selected':'')+'>'+esc(i.label)+'</option>'}).join('');
    }
    if(st.dropdowns)fillIndustries(st.dropdowns);
    else request('GET','/profile_dropdown_options',null,{auth:false,tries:2}).then(fillIndustries).catch(function(){sel.innerHTML='<option value="">Unavailable right now</option>'});

    var av=w.querySelector('[data-avatar]'),inp=w.querySelector('[data-photo]'),clr=w.querySelector('[data-photo-clear]');
    inp.onchange=function(){
      var f=inp.files&&inp.files[0];if(!f)return;
      if(f.size>6*1024*1024){toast('Photo is over 6 MB — try a smaller one.');inp.value='';return}
      photoFile=f;var rd=new FileReader();
      rd.onload=function(){av.innerHTML='<img src="'+rd.result+'" alt="Your photo">';av.classList.add('has-img');clr.hidden=false;w.querySelector('[data-photo-label]').textContent='Change photo'};
      rd.readAsDataURL(f);
    };
    clr.onclick=function(){photoFile=null;inp.value='';av.innerHTML=ic(P.user,30);av.classList.remove('has-img');clr.hidden=true;w.querySelector('[data-photo-label]').textContent='Add a photo'};
    w.querySelector('[data-skip]').onclick=function(){showDone('You’re all set','Taking you to your dashboard…')};
    w.querySelector('[data-save]').onclick=function(){
      var b=this;busy(b,true,'Saving profile…');
      var body={};
      w.querySelectorAll('[data-f]').forEach(function(f){body[f.dataset.f]=f.value});
      if(body.user_current_industry==='')delete body.user_current_industry;
      if(st.inputs&&st.inputs.target_role)body.user_desired_role=st.inputs.target_role;
      /* Legacy profile endpoint identifies the member by Memberstack token (ms_token input). */
      if(st.msToken)body.ms_token=st.msToken;
      request('PATCH','/profile',body).then(function(){
        if(!photoFile)return null;
        var fd=new FormData();fd.append('ms_token',st.msToken||'');fd.append('photo',photoFile,photoFile.name);
        return request('POST','/profile_photo',null,{form:fd,tries:2}).catch(function(e){toast('Profile saved, but the photo didn’t upload. You can add it from your dashboard.');});
      }).then(function(){showDone('You’re all set','Taking you to your dashboard…')})
      .catch(function(e){busy(b,false);showError(e,function(){showProfile()},3)});
    };
  },3);
}
function showDone(title,sub){
  show(function(w){
    w.className+=' rm-card--center';
    w.innerHTML='<div class="rm-done-ico">'+ic(P.check,30)+'</div><h2 class="rm-title">'+esc(title)+'</h2><p class="rm-sub">'+esc(sub)+'</p><a class="rm-btn" href="'+esc(st.opts.afterProfileHref)+'">Open dashboard '+ic(P.arrowRight,16)+'</a>';
  },4);
  setStep(4);
  if(st.mock){log('mock: would redirect to '+st.opts.afterProfileHref);return}
  setTimeout(function(){location.href=st.opts.afterProfileHref},900);
}

/* ---- public ---- */
function init(opts){
  opts=opts||{};
  st.opts={
    mount:opts.mount||'#strive-roadmap',
    platform:opts.platform||DEF_PLATFORM,
    onboarding:opts.onboarding||DEF_ONBOARD,
    afterProfileHref:opts.afterProfileHref||'/dashboard',
    lessonHref:opts.lessonHref||'/lesson?slug=',
    courseHref:opts.courseHref||'/course?slug=',
    assessmentHref:opts.assessmentHref||'/get-started',
    /* No /login page exists: login is the Memberstack modal (data-ms-modal="login");
       /signup#/ms/login opens it on the signup page as a fallback. */
    loginHref:opts.loginHref||'/signup#/ms/login',
    prefill:opts.prefill||null
  };
  st.root=typeof st.opts.mount==='string'?document.querySelector(st.opts.mount):st.opts.mount;
  if(!st.root){log('mount not found:',st.opts.mount);return}
  st.mock=!!opts.mock||/[?&]mock=1(?:&|$)/.test(location.search);
  st.mockPath=qs('path');
  st.authToken=opts.authToken||null;
  st.msToken=opts.msToken||null;
  st.onboardToken=opts.onboardToken||readOnboardToken();
  st.deepLink=location.hash==='#roadmap';
  st.results=null;st.roadmap=null;st.goalsSuggested=[];st.existingGoals=[];st.inputs=null;st.goalsDraft=null;st.skippedResults=false;st.placementOverride=null;
  if(st.mock)log('mock mode on — fixtures from '+FIXTURES+(st.mockPath?' · path='+st.mockPath:''));
  scaffold();
  navBlend();
  boot();
}
window.STRIVERoadmap={init:init,_state:st};
})();
