import fs from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PW_ENTRY);
const css = await fs.readFile('/tmp/lingwei-v3.css','utf8');
const evidence = process.env.EVIDENCE;
const errors = { page: [], console: [] };
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});

const svgAvatar=(label,a,b)=>`data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="120" height="120" rx="60" fill="url(#g)"/><circle cx="60" cy="46" r="23" fill="rgba(255,255,255,.38)"/><path d="M24 108c5-29 20-43 36-43s31 14 36 43" fill="rgba(255,255,255,.25)"/><text x="60" y="114" text-anchor="middle" font-size="11" font-family="sans-serif" fill="white">${label}</text></svg>`)}`;

async function prepare(page,desktop){
  page.on('pageerror',e=>errors.page.push(String(e?.stack||e)));
  page.on('console',m=>{if(m.type()==='error')errors.console.push(m.text())});
  const response=await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(2400); await page.addStyleTag({content:css});
  const avatars={ai:svgAvatar('AI','#7d7f9e','#c7bfd9'),user:svgAvatar('USER','#9188aa','#d2c9df')};
  await page.evaluate(({desktop,avatars})=>{
    for(const el of document.querySelectorAll('.popup,.popup-container,.welcomePanel,#dialogue_popup,#dialogue_popup_holder,.modal,.modal-backdrop')) if(el instanceof HTMLElement) el.style.setProperty('display','none','important');
    if(desktop){document.querySelector('#right-nav-panel')?.setAttribute('data-lw-qa-open','1');document.querySelector('#left-nav-panel')?.setAttribute('data-lw-qa-open','1');}
    const ta=document.querySelector('#send_textarea'); if(ta) ta.setAttribute('placeholder','输入消息… 梦幻暮色主题真实输入栏');
    const chat=document.querySelector('#chat'); if(!chat)return; chat.innerHTML='';
    const make=({user=false,name,time,cls,html})=>{const row=document.createElement('div');row.className=`mes last_mes ${cls}`;row.setAttribute('is_user',user?'true':'false');row.setAttribute('is_system','false');row.innerHTML=`<div class="mesAvatarWrapper"><div class="avatar"><img alt="${name}" src="${user?avatars.user:avatars.ai}"></div></div><div class="mes_block"><div class="ch_name"><span class="name_text">${name}</span><span class="timestamp">${time}</span><div class="mes_buttons"><span class="mes_button fa-solid fa-pencil"></span><span class="mes_button fa-solid fa-ellipsis"></span></div></div><div class="mes_text">${html}</div></div>`;return row};
    chat.appendChild(make({name:'聆梦',time:'04:31',cls:'lw-test-short-ai',html:'<p>单行短消息。头像、消息纸张和正文属于真实消息组件。</p>'}));
    const d=document.createElement('div');d.className='lw-date-divider';d.innerHTML='<span>9 月 14 日 · 暮色</span>';chat.appendChild(d);
    chat.appendChild(make({user:true,name:'玲',time:'04:32',cls:'lw-test-normal-user',html:'<p>这是普通用户消息的四行压力测试。<br>右侧头像保持正常尺寸。<br>纸张只扩展中央内容区。<br>正文与操作区仍然可读。</p>'}));
    const long=Array.from({length:16},(_,i)=>`第 ${i+1} 行：长消息只允许中央纸张向下增长，四角、金边和头像框不能被纵向拉变形。`).join('<br>');
    chat.appendChild(make({name:'聆梦',time:'04:33',cls:'lw-test-long-ai',html:`<p>${long}</p>`}));
    const continuous='超长连续文本用于验证overflowwrapanywhere不会把中央聊天区域顶出横向滚动条'.repeat(18);
    chat.appendChild(make({user:true,name:'玲',time:'04:34',cls:'lw-test-continuous-user',html:`<p>${continuous}</p>`}));
    chat.appendChild(make({name:'聆梦',time:'04:35',cls:'lw-test-tail-ai',html:'<p>尾部普通消息用于确认长内容之后头像、滚动和操作区恢复正常。</p>'}));
    chat.scrollTop=0;
  },{desktop,avatars});
  await page.waitForTimeout(800); return {status:response?.status()??null,title:await page.title()};
}

async function report(page){return await page.evaluate(()=>{
  const rect=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height),right:Math.round(r.right),bottom:Math.round(r.bottom)}};
  const metric=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return{width:Math.round(r.width),height:Math.round(r.height),scrollWidth:Math.round(e.scrollWidth),clientWidth:Math.round(e.clientWidth),scrollHeight:Math.round(e.scrollHeight),clientHeight:Math.round(e.clientHeight)}};
  const has=(s,p,f,pseudo=null)=>{const e=document.querySelector(s);return !!e&&(getComputedStyle(e,pseudo).getPropertyValue(p)||'').includes(f)};
  const root=document.documentElement,chat=document.querySelector('#chat');
  return{viewport:{width:innerWidth,height:innerHeight},overflowX:Math.max(0,Math.round(root.scrollWidth-innerWidth)),chatOverflowX:chat?Math.max(0,chat.scrollWidth-chat.clientWidth):null,messageCount:document.querySelectorAll('#chat .mes').length,sheld:rect('#sheld'),top:rect('#top-bar'),chat:rect('#chat'),characterRail:rect('#right-nav-panel'),settingsRail:rect('#left-nav-panel'),input:rect('#send_form'),textarea:rect('#send_textarea'),shortAI:rect('.lw-test-short-ai .mes_block'),normalUser:rect('.lw-test-normal-user .mes_block'),longAI:rect('.lw-test-long-ai .mes_block'),continuousUser:metric('.lw-test-continuous-user .mes_text'),aiAvatar:rect('.lw-test-short-ai .mesAvatarWrapper'),userAvatar:rect('.lw-test-normal-user .mesAvatarWrapper'),dateDivider:rect('.lw-date-divider'),nodes:{chat:!!document.querySelector('#chat'),sendForm:!!document.querySelector('#send_form'),textarea:!!document.querySelector('#send_textarea'),send:!!document.querySelector('#send_but'),stop:!!document.querySelector('#mes_stop'),continue:!!document.querySelector('#mes_continue'),characterPanel:!!document.querySelector('#right-nav-panel'),settingsPanel:!!document.querySelector('#left-nav-panel')},assets:{chatShell:has('#sheld','border-image-source','chat-shell-frame.png'),topNav:has('#top-bar','border-image-source','top-nav-base.png'),leftDrawer:has('#right-nav-panel','border-image-source','left-drawer-base.png'),rightDrawer:has('#left-nav-panel','border-image-source','right-drawer-base.png'),input:has('#send_form','border-image-source','input-bar-base.png'),aiPaper:has('.lw-test-short-ai .mes_block','border-image-source','message-ai-paper.png'),userPaper:has('.lw-test-normal-user .mes_block','border-image-source','message-user-paper.png'),botFrame:has('.lw-test-short-ai .mesAvatarWrapper','background-image','avatar-frame-bot.png','::before'),userFrame:has('.lw-test-normal-user .mesAvatarWrapper','background-image','avatar-frame-user.png','::before'),divider:has('.lw-date-divider','border-image-source','date-divider.png')}};
})}

function checkDesktop(r){const fail=m=>{throw new Error(m)};if(r.overflowX)fail(`desktop page overflowX=${r.overflowX}`);if(r.chatOverflowX)fail(`desktop chat overflowX=${r.chatOverflowX}`);if(!Object.values(r.nodes).every(Boolean))fail(`missing native nodes ${JSON.stringify(r.nodes)}`);if(!Object.values(r.assets).every(Boolean))fail(`missing assets ${JSON.stringify(r.assets)}`);if(!r.sheld||r.sheld.width<760)fail(`shell ${JSON.stringify(r.sheld)}`);if(!r.characterRail||r.characterRail.width<240||r.characterRail.height<600)fail(`left drawer ${JSON.stringify(r.characterRail)}`);if(!r.settingsRail||r.settingsRail.width<260||r.settingsRail.height<600)fail(`right drawer ${JSON.stringify(r.settingsRail)}`);if(!r.input||r.input.width<500||r.input.height<54)fail(`input ${JSON.stringify(r.input)}`);if(r.shortAI.height<86)fail('short AI');if(r.normalUser.height<54)fail('normal user');if(r.longAI.height<=r.shortAI.height+180)fail('long AI did not expand');if(r.continuousUser.scrollWidth>r.continuousUser.clientWidth)fail('continuous overflow');for(const k of['aiAvatar','userAvatar']){const a=r[k];if(!a||a.width<80||a.width>84||a.height<88||a.height>92)fail(`${k} ${JSON.stringify(a)}`)}}
function checkMobile(r){const fail=m=>{throw new Error(m)};if(r.overflowX)fail(`mobile page overflowX=${r.overflowX}`);if(r.chatOverflowX)fail(`mobile chat overflowX=${r.chatOverflowX}`);if(!r.sheld||r.sheld.width<390||r.sheld.right>r.viewport.width+2)fail(`mobile shell ${JSON.stringify(r.sheld)}`);if(!r.input||r.input.width<330||r.input.right>r.viewport.width+2)fail(`mobile input ${JSON.stringify(r.input)}`)}

const d=await browser.newPage({viewport:{width:1480,height:1027}});const dm=await prepare(d,true);const dr=await report(d);checkDesktop(dr);await d.screenshot({path:path.join(evidence,'desktop-full.png')});await d.locator('#right-nav-panel').screenshot({path:path.join(evidence,'detail-left-character-list.png')});await d.locator('#chat').screenshot({path:path.join(evidence,'detail-center-chat-short.png')});await d.locator('#left-nav-panel').screenshot({path:path.join(evidence,'detail-right-settings.png')});await d.locator('#send_textarea').fill('输入栏实机检查：原生输入节点仍可编辑。');await d.locator('#send_form').screenshot({path:path.join(evidence,'detail-input-bar.png')});await d.locator('.lw-test-long-ai').scrollIntoViewIfNeeded();await d.waitForTimeout(250);await d.screenshot({path:path.join(evidence,'desktop-long.png')});await d.locator('#chat').screenshot({path:path.join(evidence,'detail-center-chat-long.png')});
const m=await browser.newPage({viewport:{width:430,height:844}});const mm=await prepare(m,false);const mr=await report(m);checkMobile(mr);await m.screenshot({path:path.join(evidence,'mobile-full.png')});
await fs.writeFile(path.join(evidence,'report.json'),JSON.stringify({desktop:dm,mobile:mm,desktopReport:dr,mobileReport:mr,errors},null,2));await browser.close();
