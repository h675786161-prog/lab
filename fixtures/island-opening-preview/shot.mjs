import fs from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PW_ENTRY);
const evidence = process.env.EVIDENCE;
const root = process.cwd();

const b64 = async name => (await fs.readFile(path.join(root,'fixtures/island-opening-preview',name))).toString('base64');
const closed = `data:image/webp;base64,${await b64('closed.webp')}`;
const opened = `data:image/webp;base64,${await b64('open.webp')}`;
const paper = `data:image/webp;base64,${await b64('paper.webp')}`;

function srcdoc(){
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;background:transparent;color:#ddd6cc;font-family:Georgia,'Noto Serif SC','Songti SC',serif}button,textarea{font:inherit}
#root{min-height:590px;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:8px}
.env{position:relative;width:min(690px,94%);transition:.8s cubic-bezier(.18,.76,.16,1);filter:drop-shadow(0 18px 22px rgba(0,0,0,.34))}.env img{width:100%;display:block}.open{position:absolute;inset:0;opacity:0;transition:.45s}.hit{position:absolute;left:50%;top:54%;width:17%;aspect-ratio:1;transform:translate(-50%,-50%);border:0;border-radius:50%;background:transparent;cursor:pointer}.hint{position:absolute;left:0;right:0;bottom:-2px;text-align:center;color:#756d69;font-size:11px;letter-spacing:.22em}
.letter{position:absolute;left:50%;top:50%;width:min(470px,75%);aspect-ratio:300/400;transform:translate(-50%,2%) scale(.5);opacity:0;pointer-events:none;transition:1s cubic-bezier(.14,.82,.14,1);filter:drop-shadow(0 24px 30px rgba(0,0,0,.45))}.letter>img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}.content{position:absolute;inset:0;opacity:0;transition:.5s .45s}.q{position:absolute;top:17%;left:12%;right:12%;text-align:center;font-size:clamp(17px,3vw,24px);line-height:1.8;color:#ddd4c8;text-shadow:0 1px 2px #000}.q strong{display:block;font-weight:500;color:#f1e8dc}.wish{position:absolute;left:14%;right:14%;bottom:15%}.wish textarea{width:100%;min-height:88px;resize:none;border:0;border-bottom:1px solid rgba(138,42,53,.55);background:rgba(0,0,0,.12);color:#e9e0d5;padding:10px;outline:none;font-size:16px}.wish button{float:right;margin-top:10px;border:0;border-bottom:1px solid #76202a;background:transparent;color:#c5b9ad;padding:8px 10px;letter-spacing:.18em}.opened .closed{opacity:0}.opened .open{opacity:1}.opened .hint{opacity:0}.opened .hit{pointer-events:none}.raised .env{transform:translateY(33%) scale(.87);filter:brightness(.58)}.raised .letter{opacity:1;transform:translate(-50%,-48%) scale(1);pointer-events:auto}.raised .content{opacity:1}
@media(max-width:520px){#root{min-height:520px;padding:0}.env{width:98%}.letter{width:84%}.q{font-size:16px}.raised .env{transform:translateY(35%) scale(.88)}}
</style></head><body><main id="root"><div class="env"><img class="closed" src="${closed}"><img class="open" src="${opened}"><button class="hit" aria-label="拆开火漆"></button><div class="hint">点击火漆</div></div><div class="letter"><img src="${paper}"><div class="content"><div class="q">你是否有一个，<strong>无论如何也想实现的愿望？</strong></div><div class="wish"><textarea placeholder="写下你的愿望……"></textarea><button>封存</button></div></div></div></main><script>const r=document.querySelector('#root');document.querySelector('.hit').addEventListener('click',()=>{r.classList.add('opened');setTimeout(()=>r.classList.add('raised'),520)});</script></body></html>`;
}

const pageErrors=[]; const consoleErrors=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});

async function prepare(page){
  page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
  page.on('console',m=>{if(m.type()==='error') consoleErrors.push(m.text())});
  const res=await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(2500);
  await page.evaluate(html=>{
    for(const el of document.querySelectorAll('.popup,.popup-container,.welcomePanel,#dialogue_popup,#dialogue_popup_holder,.modal,.modal-backdrop')) if(el instanceof HTMLElement) el.style.setProperty('display','none','important');
    const chat=document.querySelector('#chat'); if(!chat) throw new Error('missing #chat'); chat.innerHTML='';
    const row=document.createElement('div'); row.className='mes last_mes'; row.setAttribute('is_user','false'); row.setAttribute('is_system','false');
    row.innerHTML='<div class="mesAvatarWrapper"><div class="avatar"><div style="width:100%;height:100%;background:#0d0d0f"></div></div></div><div class="mes_block"><div class="ch_name"><span class="name_text">岛</span><span class="timestamp">00:00</span></div><div class="mes_text"><iframe id="island-preview" style="width:100%;height:620px;border:0;background:transparent;display:block" title="《岛》开场"></iframe></div><div class="mes_buttons"></div></div>';
    chat.appendChild(row); document.querySelector('#island-preview').srcdoc=html; chat.scrollTop=0;
  },srcdoc());
  await page.waitForTimeout(700);
  return res?.status()??null;
}

async function shot(viewport,prefix){
  const p=await browser.newPage({viewport});
  const status=await prepare(p);
  await p.screenshot({path:path.join(evidence,`${prefix}-closed.png`),fullPage:true});
  const frame=p.frames().find(f=>f.parentFrame() && f.url()==='about:srcdoc');
  if(!frame) throw new Error('preview iframe missing');
  await frame.waitForSelector('.hit',{timeout:5000});
  await frame.locator('.hit').click();
  await frame.waitForFunction(()=>document.querySelector('#root')?.classList.contains('raised'),null,{timeout:5000});
  await p.waitForTimeout(650);
  await p.screenshot({path:path.join(evidence,`${prefix}-letter.png`),fullPage:true});
  const metrics=await p.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth-innerWidth}));
  await p.close(); return {status,metrics};
}

const desktop=await shot({width:1440,height:1050},'island-desktop');
const mobile=await shot({width:430,height:880},'island-mobile');
await fs.writeFile(path.join(evidence,'report.json'),JSON.stringify({desktop,mobile,pageErrors,consoleErrors},null,2));
await browser.close();
