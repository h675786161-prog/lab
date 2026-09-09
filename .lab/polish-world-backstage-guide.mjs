import fs from 'node:fs/promises';
import path from 'node:path';

const out = process.env.GUIDE_SITE_DIR || '/tmp/world-backstage-guide-site';
const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
const heroSource = path.join(workspace, '.lab', 'assets', 'world-backstage-guide-hero.webp');
const heroTarget = path.join(out, 'assets', 'hero.webp');
await fs.copyFile(heroSource, heroTarget);

const imageSizes = {
  'assets/entry.png': [2000,1375],
  'assets/now.png': [1475,950],
  'assets/people.png': [1475,950],
  'assets/detail.png': [588,805],
  'assets/memory.png': [1475,950],
  'assets/settings.png': [488,838],
};

for (const name of ['index.html','start.html','now.html','people.html','memory.html','settings.html','help.html']) {
  const file = path.join(out, name);
  let html = await fs.readFile(file, 'utf8');
  html = html.replace('<head>', '<head><meta name="theme-color" content="#fff8fb">');
  for (const [src,[width,height]] of Object.entries(imageSizes)) {
    const re = new RegExp(`<img src="${src.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}"([^>]*)>`, 'g');
    html = html.replace(re, (_,attrs) => `<img src="${src}" width="${width}" height="${height}" ${name === 'index.html' ? '' : 'loading="lazy" decoding="async"'}${attrs}>`);
  }
  html = html.replace('</head>', '<meta name="view-transition" content="same-origin"></head>');
  await fs.writeFile(file, html);
}

const cssFile = path.join(out,'styles.css');
let css = await fs.readFile(cssFile,'utf8');
css += String.raw`

/* ===== 2026-09 tutorial polish ===== */
@view-transition{navigation:auto}
::view-transition-old(root){animation:wb-page-out .14s ease both}
::view-transition-new(root){animation:wb-page-in .24s cubic-bezier(.2,.7,.2,1) both}
@keyframes wb-page-out{to{opacity:.3;transform:translateY(-3px)}}
@keyframes wb-page-in{from{opacity:.15;transform:translateY(5px)}}
body{overflow-x:hidden}
.top{transition:min-height .22s ease,padding .22s ease,box-shadow .22s ease,background .22s ease}
.top.is-scrolled{min-height:58px;padding-top:6px;padding-bottom:6px;background:rgba(255,250,252,.96);box-shadow:0 8px 28px rgba(55,39,67,.08)}
.top nav a,.brand,.route,.pager a,.btn,.hotspot,.tip-close{transition:transform .17s ease,box-shadow .2s ease,background .2s ease,color .2s ease,border-color .2s ease,opacity .2s ease}
.top nav a:active,.route:active,.pager a:active,.btn:active{transform:translateY(1px) scale(.985)}
.top nav a.is-active{background:linear-gradient(135deg,#fff,#f8eef6);box-shadow:0 5px 16px rgba(194,82,136,.09);color:#cf4e88}
.top nav a:focus-visible,.route:focus-visible,.pager a:focus-visible,.btn:focus-visible,.hotspot:focus-visible,.tip-close:focus-visible{outline:3px solid rgba(225,93,151,.24);outline-offset:3px}
.hero{min-height:min(780px,calc(100svh - 58px));grid-template-columns:minmax(0,.98fr) minmax(320px,1.02fr);align-items:center;padding:clamp(64px,7vw,100px) clamp(28px,7vw,112px);background-image:linear-gradient(90deg,rgba(255,250,252,.97) 0%,rgba(255,250,252,.9) 30%,rgba(255,250,252,.48) 49%,rgba(255,250,252,.05) 69%),linear-gradient(0deg,rgba(39,38,72,.38) 0%,rgba(39,38,72,0) 42%),url('assets/hero.webp');background-size:cover;background-position:center center;background-repeat:no-repeat;isolation:isolate}
.hero:before{right:13%;top:16%;filter:drop-shadow(0 2px 8px rgba(88,58,100,.15))}
.hero:after{right:34%;bottom:12%}
.hero-copy{max-width:570px;text-shadow:0 1px 0 rgba(255,255,255,.65)}
.hero h1{font-size:clamp(56px,7vw,90px)}
.hero h2{font-size:clamp(24px,2.7vw,37px)}
.hero-card{align-self:end;justify-self:start;width:min(350px,82%);margin:0 0 clamp(10px,2vw,28px) clamp(-30px,-2vw,-8px);padding:18px 19px;border-radius:22px;background:rgba(39,39,72,.78);backdrop-filter:blur(12px);box-shadow:0 18px 45px rgba(35,27,55,.2)}
.hero-card>span{font-size:12px}.hero-card p{padding:8px 10px;margin-top:7px;font-size:11px}.hero-card small{margin-top:9px;font-size:10px}
.actions .btn:hover{transform:translateY(-2px);box-shadow:0 14px 30px rgba(111,72,127,.16)}
.route:hover,.pager a:hover{transform:translateY(-3px);border-color:rgba(211,82,140,.2);box-shadow:0 18px 42px rgba(67,47,81,.1)}
.route i{transition:transform .2s ease}.route:hover i{transform:translateX(4px)}
.shot-frame{overflow:visible}.shot-frame img{aspect-ratio:var(--shot-ratio,auto);object-fit:contain;background:#e9e7e8}.explorer{contain:layout style}
.hotspot{animation:wb-hotspot-breathe 2.5s ease-in-out infinite}
.hotspot:hover,.hotspot.is-active{transform:translate(-50%,-50%) scale(1.14);box-shadow:0 8px 24px rgba(64,41,76,.3),0 0 0 10px rgba(238,91,158,.15)}
@keyframes wb-hotspot-breathe{0%,100%{box-shadow:0 7px 20px rgba(64,41,76,.24),0 0 0 5px rgba(238,91,158,.1)}50%{box-shadow:0 8px 24px rgba(64,41,76,.3),0 0 0 9px rgba(238,91,158,.16)}}
.tip{opacity:1;transform:translateY(0) scale(1);transform-origin:top left;animation:wb-tip-in .17s cubic-bezier(.2,.8,.2,1)}
@keyframes wb-tip-in{from{opacity:0;transform:translateY(5px) scale(.975)}}
.tip:after{content:'';position:absolute;width:10px;height:10px;background:inherit;border-left:1px solid var(--line);border-top:1px solid var(--line);transform:rotate(45deg);left:var(--tip-arrow-x,22px);top:-6px}.tip.is-above:after{top:auto;bottom:-6px;transform:rotate(225deg)}
.shot-hint i{animation:wb-hint-pulse 2.2s infinite}@keyframes wb-hint-pulse{70%{box-shadow:0 0 0 9px rgba(230,95,155,0)}0%{box-shadow:0 0 0 0 rgba(230,95,155,.28)}}
.detail img{width:100%;height:auto}
@media(max-width:900px){.top nav{opacity:0;transform:translateY(-8px) scale(.99);pointer-events:none;display:flex;visibility:hidden;transition:opacity .16s ease,transform .18s ease,visibility .18s ease}.top nav.open{opacity:1;transform:none;pointer-events:auto;visibility:visible}.menu{display:grid;place-items:center;width:40px;height:40px;border-radius:13px;cursor:pointer}.menu:hover{background:#f4edf5}.hero{grid-template-columns:1fr;min-height:760px;background-position:62% center;padding-bottom:42px}.hero-copy{max-width:590px}.hero-card{justify-self:start;align-self:auto;width:min(340px,82%);margin:28px 0 0}}
@media(max-width:620px){.hero{min-height:720px;padding:64px 20px 38px;background-image:linear-gradient(90deg,rgba(255,250,252,.94),rgba(255,250,252,.71) 67%,rgba(255,250,252,.3)),linear-gradient(0deg,rgba(41,39,73,.35),transparent 45%),url('assets/hero.webp');background-position:60% center}.hero-card{width:88%;padding:15px;margin-top:22px}.hero-card p{font-size:10px}.tip{left:10px!important;right:10px!important;top:auto!important;bottom:10px!important;width:auto;max-height:58%;overflow:auto;transform-origin:bottom center}.tip:after{display:none}}
@media(prefers-reduced-motion:reduce){@view-transition{navigation:auto}::view-transition-old(root),::view-transition-new(root){animation:none}.hotspot,.shot-hint i{animation:none!important}*{scroll-behavior:auto!important}}
`;
await fs.writeFile(cssFile,css);

const js = String.raw`(()=>{
  const top=document.querySelector('.top'),menu=document.querySelector('.menu'),nav=top?.querySelector('nav');
  const setMenu=open=>{nav?.classList.toggle('open',open);menu?.setAttribute('aria-expanded',open?'true':'false');menu?.setAttribute('aria-label',open?'关闭导航':'打开导航')};
  menu?.setAttribute('aria-expanded','false'); menu?.addEventListener('click',e=>{e.stopPropagation();setMenu(!nav?.classList.contains('open'))});
  document.addEventListener('click',e=>{if(nav?.classList.contains('open')&&!e.target.closest('.top'))setMenu(false)});
  addEventListener('scroll',()=>top?.classList.toggle('is-scrolled',scrollY>16),{passive:true}); top?.classList.toggle('is-scrolled',scrollY>16);
  const prefetched=new Set();
  const prefetch=a=>{const href=a?.getAttribute('href')||'';if(!href||href.startsWith('#')||href.startsWith('http')||!href.endsWith('.html')||prefetched.has(href))return;prefetched.add(href);const l=document.createElement('link');l.rel='prefetch';l.href=href;document.head.appendChild(l)};
  document.querySelectorAll('a[href$=".html"]').forEach(a=>{a.addEventListener('pointerenter',()=>prefetch(a),{once:true});a.addEventListener('focus',()=>prefetch(a),{once:true});a.addEventListener('touchstart',()=>prefetch(a),{once:true,passive:true});a.addEventListener('click',()=>setMenu(false))});
  const close=frame=>{const p=frame?.querySelector('.tip');if(p)p.hidden=true;frame?.querySelectorAll('.hotspot').forEach(x=>x.classList.remove('is-active'))};
  const position=(frame,hot,pop)=>{if(matchMedia('(max-width:620px)').matches){pop.classList.remove('is-above');return}const fr=frame.getBoundingClientRect(),hr=hot.getBoundingClientRect();const w=Math.min(330,Math.max(250,fr.width-24));const h=Math.min(230,Math.max(150,pop.scrollHeight||180));const cx=hr.left-fr.left+hr.width/2,cy=hr.top-fr.top+hr.height/2;let above=false,left=cx+25,top=cy-24;if(left+w>fr.width-12)left=cx-w-25;left=Math.max(12,Math.min(left,fr.width-w-12));if(top+h>fr.height-12){top=cy-h-26;above=true}top=Math.max(12,top);pop.style.left=left+'px';pop.style.top=top+'px';pop.style.right='auto';pop.style.bottom='auto';pop.classList.toggle('is-above',above);const arrow=Math.max(18,Math.min(w-24,cx-left));pop.style.setProperty('--tip-arrow-x',arrow+'px')};
  document.querySelectorAll('.shot-frame').forEach(frame=>{const pop=frame.querySelector('.tip');if(!pop)return;const title=pop.querySelector('strong'),body=pop.querySelector('p');frame.querySelectorAll('.hotspot').forEach(hot=>hot.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();frame.querySelectorAll('.hotspot').forEach(x=>x.classList.toggle('is-active',x===hot));title.textContent=hot.dataset.title||'';body.textContent=hot.dataset.body||'';pop.hidden=false;requestAnimationFrame(()=>position(frame,hot,pop))}));pop.querySelector('.tip-close')?.addEventListener('click',e=>{e.stopPropagation();close(frame)});frame.addEventListener('click',e=>{if(!e.target.closest('.tip')&&!e.target.closest('.hotspot'))close(frame)})});
  addEventListener('resize',()=>document.querySelectorAll('.shot-frame').forEach(close),{passive:true});
  addEventListener('keydown',e=>{if(e.key==='Escape'){setMenu(false);document.querySelectorAll('.shot-frame').forEach(close)}});
})();`;
await fs.writeFile(path.join(out,'app.js'),js);
console.log('tutorial polish applied');
