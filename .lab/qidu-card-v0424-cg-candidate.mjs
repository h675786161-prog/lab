import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { loadQiduReleaseCandidate as loadBaseCandidate, assertReleasePrivacy, entryMap } from './qidu-card-v0423-release-candidate.mjs';

export const ONEFILE_VERSION='0.4.24';

function findEntry(card,prefix){
  const e=(card.data.character_book?.entries||[]).find(x=>String(x.name||'').startsWith(prefix));
  if(!e) throw new Error(`missing entry ${prefix}`);
  return e;
}
function appendOnce(entry,marker,text){
  if(!String(entry.content||'').includes(marker)) entry.content=String(entry.content||'')+text;
}
function normalizeInitialState(card){
  const src=String(card.data.first_mes||'');
  const m=src.match(/<f7d_state>([\s\S]*?)<\/f7d_state>/i);
  if(!m) throw new Error('initial state missing');
  const s=JSON.parse(m[1]);
  s.player_profile={...(s.player_profile||{}),gender:s.player_profile?.gender||'unknown'};
  s.cg_system={
    enabled:true,
    mode:'direct_only',
    album_enabled:false,
    responsive_enabled:true,
    shown:{
      ann_first_meet:false,
      antoneva_first_meet:false,
      ending_journey:false,
      ending_eternal_end:false,
      ending_sacrifice_male:false,
      ending_sacrifice_female:false,
      ending_final_male:false,
      ending_final_female:false,
      ending_box_male:false,
      ending_box_female:false,
      ...(s.cg_system?.shown||{})
    }
  };
  card.data.first_mes=src.replace(m[0],`<f7d_state>${JSON.stringify(s)}</f7d_state>`);
  card.first_mes=card.data.first_mes;
}
function cgRule(){
  return `
【CG触发与展示系统｜隐藏执行】
- 当前版本只启用 direct_only：CG命中剧情节点时直接展示；不接入小手机，不进入相册，不做永久留存，不提供回看列表。
- 玩家性别只读取 f7d_state.player_profile.gender，允许 male/female/unknown。没有明确性别时不得猜测；男女差分CG必须等待性别已确认。
- cg_system={enabled:true,mode:"direct_only",album_enabled:false,responsive_enabled:true,shown:{...}}。shown只防止本轮重复触发，不代表收藏。
- CG不消耗行动节点。每个key同一轮回只触发一次。
- 病房第一次正式见到安：cg_ann_first_meet。
- 第一次正式见到安托涅瓦：cg_antoneva_first_meet。
- 《两个人的旅途》：cg_ending_journey。
- 《永恒的终焉》：cg_ending_eternal_end。
- 《牺牲的意义》：male→cg_ending_sacrifice_male；female→cg_ending_sacrifice_female。
- 《终结》：male→cg_ending_final_male；female→cg_ending_final_female。
- 《箱庭风景》：male→cg_ending_box_male；female→cg_ending_box_female。
- 命中CG时，在剧情情绪落点后、终端前输出：<f7d_cg key="对应key"></f7d_cg>。
- 当前版本禁止输出“已加入相册/已保存到终端/已同步到小手机”等留存提示。
- CG展示必须手机/电脑自适应：保持原图比例、object-fit:contain，不裁主体，不强制拉伸。
`;
}
function addCgRegex(card,key,title,dataUri){
  const scripts=card.data.extensions.regex_scripts ||= [];
  const id=`f7d-cg-${key}-v001`;
  if(scripts.some(x=>x?.id===id)) return;
  scripts.push({
    id,
    scriptName:`七都｜CG｜${title}`,
    findRegex:`/<\\s*f7d_cg\\s+key=["']${key}["']\\s*>\\s*<\\s*\\/\\s*f7d_cg\\s*>/gi`,
    replaceString:`<figure data-f7d-cg="1" data-f7d-cg-key="${key}" style="box-sizing:border-box;width:100%;max-width:min(100%,980px);margin:.85em auto;padding:.55em;border:1px solid rgba(214,191,255,.42);border-radius:14px;background:linear-gradient(145deg,rgba(18,16,28,.96),rgba(31,24,48,.94));box-shadow:0 10px 28px rgba(0,0,0,.24);overflow:hidden"><img data-f7d-cg-image="1" alt="${title}" src="${dataUri}" style="display:block;width:100%;max-width:100%;height:auto;max-height:min(78vh,900px);object-fit:contain;object-position:center;border-radius:10px"><figcaption style="padding:.5em .35em .15em;color:#ece4ff;font:600 12px/1.5 system-ui,-apple-system,'Microsoft YaHei',sans-serif;text-align:center;overflow-wrap:anywhere">${title}</figcaption></figure>`,
    trimStrings:[],
    placement:[2],
    markdownOnly:true,
    promptOnly:false,
    runOnEdit:true,
    substituteRegex:0,
    disabled:false,
    minDepth:null,
    maxDepth:null
  });
}

export async function loadQiduCgCandidate(workspace=process.env.GITHUB_WORKSPACE||process.cwd()){
  const {card}=await loadBaseCandidate(workspace,{skipHashCheck:true});
  card.data.character_version=ONEFILE_VERSION;
  const notes='作者：叶罹。相关卡：《永远的7日之都》七日轮回文本互动。原作向文本互动角色卡，以七日轮回为核心，包含区域巡查、角色剧情、战术终端、状态记录、多结局分支与CG触发。';
  card.data.creator='叶罹';
  card.data.creator_notes=notes;
  card.creatorcomment=notes;
  if(card.data.character_book?.extensions){
    card.data.character_book.extensions.creator='叶罹';
    card.data.character_book.extensions.version=ONEFILE_VERSION;
  }

  normalizeInitialState(card);

  const e03=findEntry(card,'03｜');
  const e04=findEntry(card,'04｜');
  const e10=findEntry(card,'10｜');
  const e17=findEntry(card,'17｜');
  const e18=findEntry(card,'18｜');
  const e91=findEntry(card,'91｜');

  appendOnce(e03,'相册/小手机联动尚未启用',`
【当前CG与相册边界】相册/小手机联动尚未启用。CG当前只在剧情节点 direct_only 展示，不写入相册或小手机，不生成收藏记录。
`);
  appendOnce(e04,'CG触发与展示系统｜隐藏执行',cgRule());
  appendOnce(e10,'安初见CG',`
【安初见CG】首轮病房中第一次完成“玩家正式见到安、安确认玩家状态并自我介绍”的初见段落后，若cg_system.shown.ann_first_meet=false，则本轮把它更新为true，并在正文情绪落点后输出<f7d_cg key="cg_ann_first_meet"></f7d_cg>。CG播放0节点。
`);
  appendOnce(e17,'普通线结局CG',`
【普通线结局CG】进入《终结》《牺牲的意义》《箱庭风景》并完成结局正文情绪落点后，根据player_profile.gender输出对应CG key；只展示、不留存、不扣节点。若gender仍为unknown，不得擅自选男女图。
`);
  appendOnce(e18,'安线结局CG',`
【安线结局CG】进入《两个人的旅途》后触发cg_ending_journey；进入《永恒的终焉》后触发cg_ending_eternal_end。只展示、不留存、不扣节点。
`);
  appendOnce(e91,'cg_system字段',`
【player_profile与cg_system字段】player_profile至少含gender；gender仅male/female/unknown。cg_system至少含enabled/mode/album_enabled/responsive_enabled/shown；当前mode固定direct_only、album_enabled=false、responsive_enabled=true。shown至少包含ann_first_meet、antoneva_first_meet、ending_journey、ending_eternal_end、ending_sacrifice_male、ending_sacrifice_female、ending_final_male、ending_final_female、ending_box_male、ending_box_female。
`);

  const annBytes=await fs.readFile(new URL('./qidu-cg-assets-v0424/cg_ann_first_meet.webp',import.meta.url));
  const annData=`data:image/webp;base64,${annBytes.toString('base64')}`;
  addCgRegex(card,'cg_ann_first_meet','安·初见',annData);

  card.data.extensions.qidu_frontend={
    ...(card.data.extensions.qidu_frontend||{}),
    cg_mode:'direct_only',
    cg_album:false,
    cg_responsive:true,
    cg_embedded_assets:true
  };

  assertReleasePrivacy(card);
  const raw=Buffer.from(JSON.stringify(card),'utf8');
  const compactSha256=crypto.createHash('sha256').update(raw).digest('hex');
  return {card,raw,compactSha256};
}

export const loadQiduReleaseCandidate=loadQiduCgCandidate;
export const loadQiduReleaseCard=loadQiduCgCandidate;
export { assertReleasePrivacy, entryMap };
