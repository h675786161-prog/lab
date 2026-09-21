import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { loadQiduReleaseCandidate as loadBaseCandidate, entryMap } from './qidu-card-v0423-release-candidate.mjs';

export const ONEFILE_VERSION='0.4.24';
const CREATOR_NOTES='作者：叶罹。相关卡：《永远的7日之都》七日轮回文本互动。原作向文本互动角色卡，以七日轮回为核心，包含区域巡查、角色剧情、战术终端、状态记录、多结局分支与CG触发。';

export const CG_KEYS=[
  'cg_ann_first_meet',
  'cg_antoneva_first_meet',
  'cg_ending_journey',
  'cg_ending_eternal_end',
  'cg_ending_sacrifice_male',
  'cg_ending_sacrifice_female',
  'cg_ending_final_male',
  'cg_ending_final_female',
  'cg_ending_box_male',
  'cg_ending_box_female'
];

export function resolveEndingCg(ending,gender='unknown'){
  const fixed={
    '两个人的旅途':'cg_ending_journey',
    '永恒的终焉':'cg_ending_eternal_end'
  };
  if(fixed[ending]) return fixed[ending];
  if(gender!=='male'&&gender!=='female') return null;
  const routed={
    '牺牲的意义':{male:'cg_ending_sacrifice_male',female:'cg_ending_sacrifice_female'},
    '终结':{male:'cg_ending_final_male',female:'cg_ending_final_female'},
    '箱庭风景':{male:'cg_ending_box_male',female:'cg_ending_box_female'}
  };
  return routed[ending]?.[gender]||null;
}

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
- CG展示必须手机/电脑自适应：保持原图比例，不裁主体，不强制拉伸；横图按宽度缩放，竖图同时受视口高度约束。
`;
}
function addCgSpriteRegex(card,dataUri){
  const scripts=card.data.extensions.regex_scripts ||= [];
  const id='f7d-cg-sprite-v0424';
  if(scripts.some(x=>x?.id===id)) return;
  const keyAlternation=CG_KEYS.join('|');
  const css=`
<style data-f7d-cg-style="1">
.f7d-cg-frame{display:block;margin:0 auto;background-image:url("${dataUri}");background-repeat:no-repeat;background-size:100% auto;background-color:#0b0d13;border-radius:10px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.04)}
.f7d-cg-cg_ann_first_meet,.f7d-cg-cg_antoneva_first_meet,.f7d-cg-cg_ending_journey,.f7d-cg-cg_ending_eternal_end,.f7d-cg-cg_ending_sacrifice_male,.f7d-cg-cg_ending_sacrifice_female{width:min(100%,980px);aspect-ratio:16/9}
.f7d-cg-cg_ending_final_male,.f7d-cg-cg_ending_final_female{width:min(100%,62.4vh);aspect-ratio:4/5}
.f7d-cg-cg_ending_box_male,.f7d-cg-cg_ending_box_female{width:min(100%,58.6vh);aspect-ratio:640/853}
.f7d-cg-cg_ann_first_meet{background-position:center 0%}
.f7d-cg-cg_antoneva_first_meet{background-position:center 7.050529%}
.f7d-cg-cg_ending_journey{background-position:center 14.101058%}
.f7d-cg-cg_ending_eternal_end{background-position:center 21.151586%}
.f7d-cg-cg_ending_sacrifice_male{background-position:center 28.202115%}
.f7d-cg-cg_ending_sacrifice_female{background-position:center 35.252644%}
.f7d-cg-cg_ending_final_male{background-position:center 46.292327%}
.f7d-cg-cg_ending_final_female{background-position:center 63.437634%}
.f7d-cg-cg_ending_box_male{background-position:center 81.508780%}
.f7d-cg-cg_ending_box_female{background-position:center 100%}
</style>`.replace(/\n/g,'');
  scripts.push({
    id,
    scriptName:'七都｜CG资源与响应式显示',
    findRegex:`/<\\s*f7d_cg\\s+key=["'](${keyAlternation})["']\\s*>\\s*<\\s*\\/\\s*f7d_cg\\s*>/gi`,
    replaceString:`${css}<figure data-f7d-cg="1" data-f7d-cg-key="$1" style="box-sizing:border-box;width:100%;max-width:100%;margin:.85em auto;padding:.55em;border:1px solid rgba(214,191,255,.42);border-radius:14px;background:linear-gradient(145deg,rgba(18,16,28,.96),rgba(31,24,48,.94));box-shadow:0 10px 28px rgba(0,0,0,.24);overflow:hidden"><div data-f7d-cg-image="1" class="f7d-cg-frame f7d-cg-$1" role="img" aria-label="$1"></div></figure>`,
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
function hasPrivateMetadata(obj){
  const bad=new Set(['repo','repository','git','branch','commit','source_url','homepage','author_url','creator_url']);
  const stack=[obj];
  while(stack.length){
    const cur=stack.pop();
    if(!cur||typeof cur!=='object') continue;
    for(const [k,v] of Object.entries(cur)){
      if(bad.has(String(k).toLowerCase())) return true;
      if(v&&typeof v==='object') stack.push(v);
    }
  }
  return false;
}
export function assertReleasePrivacy(card){
  if(card.data?.creator!=='叶罹') throw new Error('creator mismatch');
  if(card.data?.creator_notes!==CREATOR_NOTES) throw new Error('creator notes mismatch');
  if(card.creatorcomment!==CREATOR_NOTES) throw new Error('creator comment mismatch');
  if(card.data?.character_version!==ONEFILE_VERSION) throw new Error('version mismatch');
  if(card.data?.character_book?.extensions?.creator!=='叶罹') throw new Error('worldbook creator mismatch');
  if(card.data?.character_book?.extensions?.version!==ONEFILE_VERSION) throw new Error('worldbook version mismatch');
  if(Object.prototype.hasOwnProperty.call(card,'create_date')||Object.prototype.hasOwnProperty.call(card.data||{},'create_date')) throw new Error('creation timestamp remains');
  if(hasPrivateMetadata(card)) throw new Error('private development metadata remains');
  const txt=JSON.stringify(card);
  if(/(?:玲|h675786161|github\.com|raw\.githubusercontent\.com|api\.github\.com|实验酒馆|world-backstage|(?:\bLAB\b|[-_]lab\b|\blab[-_])|feature\/qidu-card|gmail\.com)/i.test(txt)) throw new Error('private development provenance remains');
  return true;
}

export async function loadQiduCgCandidate(workspace=process.env.GITHUB_WORKSPACE||process.cwd()){
  const {card}=await loadBaseCandidate(workspace,{skipHashCheck:true});
  card.data.character_version=ONEFILE_VERSION;
  card.data.creator='叶罹';
  card.data.creator_notes=CREATOR_NOTES;
  card.creatorcomment=CREATOR_NOTES;
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
  appendOnce(e10,'安托涅瓦初见CG',`
【安托涅瓦初见CG】首轮开场中第一次完成“玩家被带去中央庭并与安托涅瓦正式会面”的段落后，若cg_system.shown.antoneva_first_meet=false，则本轮把它更新为true，并在正文情绪落点后输出<f7d_cg key="cg_antoneva_first_meet"></f7d_cg>。仅听到名字、看见远处身影或尚未正式会面时不得提前触发。CG播放0节点。
`);
  appendOnce(e17,'普通线结局CG',`
【普通线结局CG】进入《终结》《牺牲的意义》《箱庭风景》并完成结局正文情绪落点后，根据player_profile.gender输出对应CG key；只展示、不留存、不扣节点。male与female必须严格对应各自版本；若gender仍为unknown，不得擅自选图，也不得从文风、称谓或行为推测性别。
`);
  appendOnce(e18,'安线结局CG',`
【安线结局CG】进入《两个人的旅途》后触发cg_ending_journey；进入《永恒的终焉》后触发cg_ending_eternal_end。只展示、不留存、不扣节点。
`);
  appendOnce(e91,'cg_system字段',`
【player_profile与cg_system字段】player_profile至少含gender；gender仅male/female/unknown。cg_system至少含enabled/mode/album_enabled/responsive_enabled/shown；当前mode固定direct_only、album_enabled=false、responsive_enabled=true。shown至少包含ann_first_meet、antoneva_first_meet、ending_journey、ending_eternal_end、ending_sacrifice_male、ending_sacrifice_female、ending_final_male、ending_final_female、ending_box_male、ending_box_female。
`);

  const spriteBytes=await fs.readFile(new URL('./qidu-cg-assets-v0424/cg_sprite.webp',import.meta.url));
  const spriteData=`data:image/webp;base64,${spriteBytes.toString('base64')}`;
  addCgSpriteRegex(card,spriteData);

  card.data.extensions.qidu_frontend={
    ...(card.data.extensions.qidu_frontend||{}),
    cg_mode:'direct_only',
    cg_album:false,
    cg_responsive:true,
    cg_embedded_assets:true,
    cg_asset_mode:'embedded-sprite'
  };

  assertReleasePrivacy(card);
  const raw=Buffer.from(JSON.stringify(card),'utf8');
  const compactSha256=crypto.createHash('sha256').update(raw).digest('hex');
  return {card,raw,compactSha256};
}

export const loadQiduReleaseCandidate=loadQiduCgCandidate;
export const loadQiduReleaseCard=loadQiduCgCandidate;
export { entryMap };
