import fs from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PW_ENTRY);
const css = await fs.readFile('/tmp/lingwei-v14.css','utf8');
const evidence = process.env.EVIDENCE;
const pageErrors=[]; const consoleErrors=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});

async function prepare(page){
  page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
  page.on('console',m=>{if(m.type()==='error') consoleErrors.push(m.text())});
  const response=await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(2300);
  await page.addStyleTag({content:css});
  await page.waitForTimeout(650);
  await page.evaluate(()=>{
    for(const el of document.querySelectorAll('.popup,.popup-container,.welcomePanel,#dialogue_popup,#dialogue_popup_holder,.modal,.modal-backdrop')) if(el instanceof HTMLElement) el.style.setProperty('display','none','important');
    const chat=document.querySelector('#chat'); if(!chat) return; chat.innerHTML='';
    const make=({user,name,time,text})=>{
      const row=document.createElement('div'); row.className='mes last_mes'; row.setAttribute('is_user',user?'true':'false'); row.setAttribute('is_system','false');
      const avatarBg=user
        ? 'radial-gradient(circle at 37% 27%,#fff9f2 0 8%,#edcddb 31%,#c4b9dc 67%,#9a8bb6 100%)'
        : 'radial-gradient(circle at 35% 24%,#fffaf1 0 8%,#e5c8dc 28%,#b9b5dc 66%,#7e719d 100%)';
      row.innerHTML=`<div class="mesAvatarWrapper"><div class="avatar"><div style="width:100%;height:100%;background:${avatarBg};"></div></div></div><div class="mes_block"><div class="ch_name"><span class="name_text">${name}</span><span class="timestamp">${time}</span></div>${user?'':'<div class="mes_reasoning_details"><div class="mes_reasoning_header">thought trace</div><div class="mes_reasoning">A quiet reasoning layer stays subordinate to the reply.</div></div>'}<div class="mes_text">${text}</div><div class="mes_buttons"></div></div>`;
      return row;
    };
    chat.appendChild(make({user:false,name:'Elaine',time:'04:31',text:'The light outside the window has turned pale violet. I left the notes beside the glass, where the little stars catch the last warm reflection.'}));
    chat.appendChild(make({user:true,name:'Ling',time:'04:32',text:'Then keep the window open a little longer. I want the room to feel airy, soft, and lived in, with the jewelry actually belonging to the room instead of floating over it.'}));
    chat.appendChild(make({user:false,name:'Elaine',time:'04:33',text:'Good. The frame can overlap the message, the bottle can disappear behind the silk edge, and the controls can keep working underneath the ornament.'}));
    chat.scrollTop=0;
  });
  await page.waitForTimeout(750);
  return {status:response?.status()??null,title:await page.title(),nodes:{chat:!!await page.$('#chat'),send:!!await page.$('#send_but'),stop:!!await page.$('#mes_stop'),cont:!!await page.$('#mes_continue')}};
}

const rectCode=`sel=>{const e=document.querySelector(sel);if(!e)return null;const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,center:r.left+r.width/2}}`;
const d=await browser.newPage({viewport:{width:1480,height:1027}});
const dr=await prepare(d);
const desktopMetrics=await d.evaluate(()=>{
  const rect=sel=>{const e=document.querySelector(sel);if(!e)return null;const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,center:r.left+r.width/2}};
  const cs=getComputedStyle(document.documentElement);
  return {innerWidth,scrollWidth:document.documentElement.scrollWidth,horizontalOverflow:document.documentElement.scrollWidth-innerWidth,top:rect('#top-bar'),holder:rect('#top-settings-holder'),shell:rect('#sheld'),form:rect('#form_sheld'),frameAsset:cs.getPropertyValue('--lw-frame').slice(0,35),bottleAsset:cs.getPropertyValue('--lw-bottle').slice(0,35),starsAsset:cs.getPropertyValue('--lw-stars').slice(0,35),decoAsset:cs.getPropertyValue('--lw-deco').slice(0,35)};
});
await d.screenshot({path:path.join(evidence,'lingwei-v14-desktop.png')});

const m=await browser.newPage({viewport:{width:430,height:844}});
const mr=await prepare(m);
const mobileMetrics=await m.evaluate(()=>({innerWidth,scrollWidth:document.documentElement.scrollWidth,horizontalOverflow:document.documentElement.scrollWidth-innerWidth}));
await m.screenshot({path:path.join(evidence,'lingwei-v14-mobile.png')});
await fs.writeFile(path.join(evidence,'report.json'),JSON.stringify({desktop:dr,mobile:mr,desktopMetrics,mobileMetrics,pageErrors,consoleErrors},null,2));
await browser.close();
