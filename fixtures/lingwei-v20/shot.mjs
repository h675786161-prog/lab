import fs from 'node:fs/promises'; import path from 'node:path';
const {chromium}=await import(process.env.PW_ENTRY); const css=await fs.readFile('/tmp/lingwei-v20.css','utf8'); const evidence=process.env.EVIDENCE; const pageErrors=[],consoleErrors=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});

async function prepare(page){
  page.on('pageerror',e=>pageErrors.push(String(e?.stack||e))); page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  const response=await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded',timeout:60000}); await page.waitForTimeout(2200); await page.addStyleTag({content:css}); await page.waitForTimeout(500);
  await page.evaluate(()=>{
    for(const el of document.querySelectorAll('.popup,.popup-container,.welcomePanel,#dialogue_popup,#dialogue_popup_holder,.modal,.modal-backdrop')) if(el instanceof HTMLElement) el.style.setProperty('display','none','important');
    const chat=document.querySelector('#chat'); if(!chat)return; chat.innerHTML='';
    const make=({user,name,time,text})=>{const row=document.createElement('div');row.className='mes last_mes';row.setAttribute('is_user',user?'true':'false');row.setAttribute('is_system','false');const bg=user?'radial-gradient(circle at 37% 27%,#fff9f2 0 8%,#edcddb 31%,#c4b9dc 67%,#9a8bb6 100%)':'radial-gradient(circle at 35% 24%,#fffaf1 0 8%,#e5c8dc 28%,#b9b5dc 66%,#7e719d 100%)';row.innerHTML=`<div class="mesAvatarWrapper"><div class="avatar"><div style="width:100%;height:100%;background:${bg}"></div></div></div><div class="mes_block"><div class="ch_name"><span class="name_text">${name}</span><span class="timestamp">${time}</span></div>${user?'':'<div class="mes_reasoning_details"><div class="mes_reasoning_header">thought trace</div><div class="mes_reasoning">A quiet reasoning layer stays subordinate to the reply.</div></div>'}<div class="mes_text">${text}</div><div class="mes_buttons"></div></div>`;return row};
    chat.append(make({user:false,name:'玲味',time:'19:20',text:'这轮重点不再是假装有侧栏，而是把 SillyTavern 自己的抽屉真正纳入界面。中央继续留白，密度交给工具翼。'}));
    chat.append(make({user:true,name:'你',time:'19:21',text:'那侧栏就别像弹窗，得像本来就长在这套主题里。'}));
    chat.append(make({user:false,name:'玲味',time:'19:24',text:'输入框、分组标题、按钮和滚动区域都统一成深灰紫工具柜语言。后续消息继续退居次级。'}));
    chat.append(make({user:true,name:'你',time:'19:25',text:'这样才像施工稿落到真酒馆。'})); chat.scrollTop=0;
  }); await page.waitForTimeout(650);
  return {status:response?.status()??null,title:await page.title(),nodes:{chat:!!await page.$('#chat'),send:!!await page.$('#send_but'),stop:!!await page.$('#mes_stop'),cont:!!await page.$('#mes_continue')}};
}

async function inspectDrawers(page){
  return await page.evaluate(()=>[...document.querySelectorAll('.drawer-content')].map((e,i)=>({i,id:e.id||'',cls:e.className||'',text:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,160),childCount:e.children.length})));
}

async function forceRealDrawer(page,index,side,file){
  const info=await page.evaluate(({index,side})=>{
    const all=[...document.querySelectorAll('.drawer-content')]; const e=all[index]; if(!e)return null;
    e.dataset.lwProbe='open'; e.dataset.lwSide=side; e.style.setProperty('display','block','important'); e.style.setProperty('visibility','visible','important'); e.style.setProperty('opacity','1','important');
    const r=e.getBoundingClientRect(); return {id:e.id||'',cls:e.className||'',text:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,180),rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
  },{index,side});
  await page.waitForTimeout(300); if(info) await page.screenshot({path:path.join(evidence,file)}); return info;
}
async function clearProbe(page){await page.evaluate(()=>{for(const e of document.querySelectorAll('.drawer-content[data-lw-probe]')){delete e.dataset.lwProbe;delete e.dataset.lwSide;e.style.removeProperty('display');e.style.removeProperty('visibility');e.style.removeProperty('opacity')}})}

const d=await browser.newPage({viewport:{width:1480,height:1027}}); const dr=await prepare(d); await d.screenshot({path:path.join(evidence,'lingwei-v20-desktop.png')});
const drawerInventory=await inspectDrawers(d);
const candidates=drawerInventory.filter(x=>x.childCount>0&&x.text.length>8).slice(0,4);
let leftProbe=null,rightProbe=null;
if(candidates[0]){leftProbe=await forceRealDrawer(d,candidates[0].i,'left','lingwei-v20-drawer-left.png');await clearProbe(d)}
if(candidates[1]){rightProbe=await forceRealDrawer(d,candidates[1].i,'right','lingwei-v20-drawer-right.png');await clearProbe(d)}
const dm=await d.evaluate(()=>({innerWidth,scrollWidth:document.documentElement.scrollWidth,horizontalOverflow:document.documentElement.scrollWidth-innerWidth,topDrawers:document.querySelectorAll('#top-settings-holder .drawer-toggle').length,drawerCount:document.querySelectorAll('.drawer-content').length}));

const m=await browser.newPage({viewport:{width:430,height:844}}); const mr=await prepare(m); const mm=await m.evaluate(()=>({innerWidth,scrollWidth:document.documentElement.scrollWidth,horizontalOverflow:document.documentElement.scrollWidth-innerWidth})); await m.screenshot({path:path.join(evidence,'lingwei-v20-mobile.png')});
await fs.writeFile(path.join(evidence,'report.json'),JSON.stringify({desktop:dr,mobile:mr,desktopMetrics:dm,mobileMetrics:mm,drawerInventory,leftProbe,rightProbe,pageErrors,consoleErrors},null,2)); await browser.close();
