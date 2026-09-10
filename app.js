(()=>{
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
})();

// Interactive settings atlas. Notes and numbered pins are two handles for the same place.
document.addEventListener('click', event => {
  const target = event.target.closest('[data-settings-note]');
  if (!target) return;
  const atlas = target.closest('[data-settings-atlas]');
  if (!atlas) return;
  const key = target.dataset.settingsNote;
  const y = Number(target.dataset.settingsY || 0);
  atlas.querySelectorAll('[data-settings-note]').forEach(node => node.classList.toggle('is-active', node.dataset.settingsNote === key));
  const scroll = atlas.querySelector('[data-settings-scroll]');
  const stage = atlas.querySelector('.settings-atlas-stage');
  const noteNode = document.getElementById('setting-note-' + key);
  if (scroll && stage && Number.isFinite(y)) {
    const wanted = stage.scrollHeight * (y / 100) - scroll.clientHeight * .44;
    scroll.scrollTo({ top: Math.max(0, wanted), behavior: 'smooth' });
  }
  if (target.classList.contains('setting-marker') && noteNode) noteNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

document.addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.classList?.contains('setting-note')) {
    event.preventDefault();
    event.target.click();
  }
});
