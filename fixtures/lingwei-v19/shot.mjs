import fs from 'node:fs/promises'; import path from 'node:path';
const {chromium}=await import(process.env.PW_ENTRY); const css=await fs.readFile('/tmp/lingwei-v19.css','utf8'); const evidence=process.env.EVIDENCE; const pageErrors=[],consoleErrors=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
async function prepare(page){
  page.on('pageerror',e=>pageErrors.push(String(e?.stack||e))); page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  const response=await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded',timeout:60000}); await page.waitForTimeout(2200); await page.addStyleTag({content:css}); await page.waitForTimeout(500);
  await page.evaluate(()=>{
    for(const el of document.querySelectorAll('.popup,.popup-container,.welcomePanel,#dialogue_popup,#dialogue_popup_holder,.modal,.modal-backdrop')) if(el instanceof HTMLElement) el.style.setProperty('display','none','important');
    const chat=document.querySelector('#chat'); if(!chat)return; chat.innerHTML='';
    const make=({user,name,time,text})=>{const row=document.createElement('div');row.className='mes last_mes';row.setAttribute('is_user',user?'true':'false');row.setAttribute('is_system','false');const bg=user?'radial-gradient(circle at 37% 27%,#fff9f2 0 8%,#edcddb 31%,#c4b9dc 67%,#9a8bb6 100%)':'radial-gradient(circle at 35% 24%,#fffaf1 0 8%,#e5c8dc 28%,#b9b5dc 66%,#7e719d 100%)';row.innerHTML=`<div class="mesAvatarWrapper"><div class="avatar"><div style="width:100%;height:100%;background:${bg}"></div></div></div><div class="mes_block"><div class="ch_name"><span class="name_text">${name}</span><span class="timestamp">${time}</span></div>${user?'':'<div class="mes_reasoning_details"><div class="mes_reasoning_header">thought trace</div><div class="mes_reasoning">A quiet reasoning layer stays subordinate to the reply.</div></div>'}<div class="mes_text">${text}</div><div class="mes_buttons"></div></div>`;return row};
    chat.append(make({user:false,name:'玲味',time:'18:20',text:'侧翼不该只是两块深色背景。打开真实功能面板时，它们也应该像这套主题本来就有的结构。'}));
    chat.append(make({user:true,name:'你',time:'18:21',text:'中央留白一点，功能密度放到两边。聊天仍然是第一视线。'}));
    chat.append(make({user:false,name:'玲味',time:'18:24',text:'后续消息就轻一点。首条负责氛围，侧翼负责工具，输入栏负责安静地待在底部。'}));
    chat.append(make({user:true,name:'你',time:'18:25',text:'这才像完整前端，不是装饰品开会。'})); chat.scrollTop=0;
  }); await page.waitForTimeout(700);
  return {status:response?.status()??null,title:await page.title(),nodes:{chat:!!await page.$('#chat'),send:!!await page.$('#send_but'),stop:!!await page.$('#mes_stop'),cont:!!await page.$('#mes_continue')}};
}
async function probeDrawers(page){
  const out=[]; const toggles=page.locator('#top-settings-holder .drawer-toggle'); const n=await toggles.count(); let shot=0;
  for(let i=0;i<n;i++){
    try{
      await toggles.nth(i).click({force:true,timeout:2500}); await page.waitForTimeout(220);
      const opened=await page.evaluate(()=>[...document.querySelectorAll('.drawer-content')].filter(e=>{const s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&e.getBoundingClientRect().width>20}).map(e=>({id:e.id,cls:e.className,rect:(()=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,top:r.top,bottom:r.bottom}})()})));
      if(opened.length){out.push({toggle:i,opened}); if(shot<2){await page.screenshot({path:path.join(evidence,`lingwei-v19-drawer-${shot+1}.png`)}); shot++;}}
      await toggles.nth(i).click({force:true,timeout:2500}); await page.waitForTimeout(120);
    }catch{}
  }
  return out;
}
const d=await browser.newPage({viewport:{width:1480,height:1027}}); const dr=await prepare(d); await d.screenshot({path:path.join(evidence,'lingwei-v19-desktop.png')}); const drawerProbe=await probeDrawers(d);
const dm=await d.evaluate(()=>({innerWidth,scrollWidth:document.documentElement.scrollWidth,horizontalOverflow:document.documentElement.scrollWidth-innerWidth,topDrawers:document.querySelectorAll('#top-settings-holder .drawer-toggle').length}));
const m=await browser.newPage({viewport:{width:430,height:844}}); const mr=await prepare(m); const mm=await m.evaluate(()=>({innerWidth,scrollWidth:document.documentElement.scrollWidth,horizontalOverflow:document.documentElement.scrollWidth-innerWidth})); await m.screenshot({path:path.join(evidence,'lingwei-v19-mobile.png')});
await fs.writeFile(path.join(evidence,'report.json'),JSON.stringify({desktop:dr,mobile:mr,desktopMetrics:dm,mobileMetrics:mm,drawerProbe,pageErrors,consoleErrors},null,2)); await browser.close();
