import fs from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PW_ENTRY);
const css = await fs.readFile('/tmp/window-study-v23.css','utf8');
const evidence = process.env.EVIDENCE;
const pageErrors=[]; const consoleErrors=[];
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_BIN, args:['--no-sandbox','--disable-dev-shm-usage']});
const avatar = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e9dbea"/><stop offset="1" stop-color="#9ca9b6"/></linearGradient></defs><rect width="256" height="256" fill="url(#g)"/><circle cx="128" cy="94" r="48" fill="#f7ece8"/><path d="M54 232c12-58 45-83 74-83s62 25 74 83" fill="#c6b7d1"/><path d="M79 93c4-56 93-70 104 3-10-27-30-42-54-42-21 0-39 13-50 39z" fill="#705c77"/></svg>`);
function msgText(i,user){
 if(i===2) return '这一条是长文本压力测试。装饰应该只挂在聊天框边缘，不应该让正文为了花枝和丝带腾出一整块空白。'.repeat(8)+' 正文从头到尾都保持连续的矩形阅读区。';
 if(i===3) return '用户消息也走同一套正文逻辑。装饰可以镜像、越界、压住边缘，但不要把文字挤成杂志环绕排版。'.repeat(4);
 return user ? '这里是用户消息。现在检查紫色框中的内容关系、留白和对角装饰。' : '这里是助手消息。左上和右下装饰应当独立悬挂，正文正常铺开。';
}
async function prepare(page){
 page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
 page.on('console',m=>{ if(m.type()==='error') consoleErrors.push(m.text()); });
 const response=await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForTimeout(2200);
 await page.addStyleTag({content:css});
 await page.waitForTimeout(400);
 await page.evaluate(({avatar})=>{
  for(const el of document.querySelectorAll('.popup,.popup-container,.welcomePanel,#dialogue_popup,#dialogue_popup_holder,.modal,.modal-backdrop')) if(el instanceof HTMLElement) el.style.setProperty('display','none','important');
  const chat=document.querySelector('#chat'); if(!chat) return;
  chat.innerHTML='';
  window.__wsMake=(i,user,text)=>{
   const row=document.createElement('div'); row.className='mes last_mes'; row.setAttribute('is_user',user?'true':'false'); row.setAttribute('is_system','false');
   row.innerHTML=`<div class="mesAvatarWrapper"><div class="avatar"><img src="${avatar}" alt=""></div><span class="mesIDDisplay">#${i+1}</span><span class="mes_timer">1.${i}s</span><span class="tokenCounterDisplay">${120+i*31}t</span></div><div class="mes_block"><div class="ch_name"><span class="name_text">${user?'玲':'七'}</span><span class="timestamp">03:${String(18+i).padStart(2,'0')}</span><div class="mes_buttons"><span class="mes_button">⋯</span><span class="mes_button">✎</span></div></div><div class="mes_text">${text}</div><div class="mes_edit_buttons"></div></div>`;
   return row;
  };
 },{avatar});
 const payload=[]; for(let i=0;i<6;i++) payload.push({i,user:i%2===1,text:msgText(i,i%2===1)});
 await page.evaluate(payload=>{const c=document.querySelector('#chat');for(const m of payload)c.appendChild(window.__wsMake(m.i,m.user,m.text)); c.scrollTop=0;},payload);
 await page.waitForTimeout(800);
 return {status:response?.status()??null,title:await page.title()};
}
async function metrics(page){ return await page.evaluate(()=>{
 const row=document.querySelector('#chat .mes:not([is_system="true"])'); const block=row?.querySelector('.mes_block'); const text=row?.querySelector('.mes_text'); const av=row?.querySelector('.mesAvatarWrapper');
 const cs=block?getComputedStyle(block):null;
 return {innerWidth,scrollWidth:document.documentElement.scrollWidth,overflowX:document.documentElement.scrollWidth-innerWidth,messageCount:document.querySelectorAll('#chat .mes').length,blockPadding:cs?{top:cs.paddingTop,right:cs.paddingRight,bottom:cs.paddingBottom,left:cs.paddingLeft}:null,textWidth:text?.getBoundingClientRect().width??null,beforeOpacity:block?getComputedStyle(block,'::before').opacity:null,afterOpacity:row?getComputedStyle(row,'::after').opacity:null,headerOpacity:av?getComputedStyle(av,'::after').opacity:null};
 }); }
async function shot(width,height,prefix){
 const p=await browser.newPage({viewport:{width,height}}); const info=await prepare(p); const met=await metrics(p); await p.screenshot({path:path.join(evidence,`${prefix}.png`),fullPage:false}); await p.close(); return {info,metrics:met};
}
const desktop=await shot(1480,1027,'window-study-v23-desktop');
const mobile=await shot(430,844,'window-study-v23-mobile');
await fs.writeFile(path.join(evidence,'report.json'),JSON.stringify({desktop,mobile,pageErrors,consoleErrors,sourceChecks:{floatRule:/\bfloat\s*:/i.test(css),shapeOutside:/shape-outside/i.test(css)}},null,2));
await browser.close();
