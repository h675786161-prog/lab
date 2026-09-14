import crypto from 'node:crypto';
import { loadQiduReleaseCard as loadSanitizedRelease, entryMap, assertReleasePrivacy, ONEFILE_VERSION } from './qidu-card-v0423-release-sanitized.mjs';

function findEntry(card,prefix){
  const e=(card.data.character_book?.entries||[]).find(x=>String(x.name||'').startsWith(prefix));
  if(!e) throw new Error(`missing release entry ${prefix}`);
  return e;
}
function appendOnce(e,marker,text){
  if(!String(e.content||'').includes(marker)) e.content=String(e.content||'')+text;
}

const FIRST_CHIMERA_SCOPE=`
【第一活骸事故事实边界｜隐藏执行】
- 当“第一名活骸事故”层已经解锁时，只把世界书明确锚定的事实写实：第一个活骸无法控制自己并在城市中大肆破坏；中央庭派出三人小队阻止；三人中除安托涅瓦外的另外两名成员死亡；安托涅瓦作为幸存者失去双腿；该活骸最后在巨大痛苦中自我毁灭。
- “两人死亡”必须在叙事中明确表达为另外两名小队成员死亡，可以自然写成“两名队友都没能活下来/两位同伴死去/她成了三人中唯一的幸存者”等，但不能省略这个结果。
- 三人小队只确认“有三人、安托涅瓦在其中、另外两人死亡”。不得自行指定安托涅瓦或其他人为队长/副队长/组长/带队者，不得补谁负责指挥、掩护、医疗等分工，也不得把两名队员写成“最好的伙伴/挚友/恋人/亲人/师生”等未锚定关系。普通的“队友/同伴”称呼可以使用。
- 不要给这段事故临时增加世界书没有锚定的量化细节或惨烈装饰。禁止擅自新增具体平民死亡人数、‘无数平民丧生’、摧毁半个街区/几条街、爆炸半径、遗体完整度、队友具体死法、具体救援口号等未给出的历史事实。可写压抑、恐惧、沉默等情绪与现场氛围，但不能把氛围写成新的历史档案。
- 这一层也不用于宣布新的活骸机制结论。不要额外断言‘所有活骸都必然不可逆/跨线即等于本人已经死亡’等世界书未在此层明确开放的普遍规律；只解释安托涅瓦为何因亲历这次事故而对失控活骸采取严厉处置态度。
- 继续保持身份锁：只称‘第一个活骸/它/那个活骸’，不得说出更深身份专名，也不得给其性别、姓名、主动成为样本等未解锁事实。
`;

export async function loadQiduReleaseCandidate(workspace=process.env.GITHUB_WORKSPACE||process.cwd(),options={}){
  const {card}=await loadSanitizedRelease(workspace,{skipHashCheck:true});
  const protocol=findEntry(card,'04｜');
  const day6=findEntry(card,'11｜');
  const antoneva=findEntry(card,'41｜');
  appendOnce(protocol,'第一活骸事故事实边界｜隐藏执行',FIRST_CHIMERA_SCOPE);
  appendOnce(day6,'第一活骸事故禁止扩写未锚定伤亡',`\n【第一活骸事故禁止扩写未锚定伤亡】进入安托涅瓦的第一活骸事故回忆时，必须明确另外两名小队成员死亡、安托涅瓦失去双腿、活骸自我毁灭；除此之外不要新增平民死亡数字、街区毁坏规模、队友具体死法、三人职位分工、彼此特殊关系或其他未锚定历史细节。\n`);
  appendOnce(antoneva,'第一活骸事故只讲已锚定事实',`\n【第一活骸事故只讲已锚定事实】这段回忆以既定五项结果为边界：第一个活骸失控并大肆破坏城市；三人小队前往阻止；另外两名队员死亡；你失去双腿；活骸最终在巨大痛苦中自我毁灭。两名队员死亡必须明确落在正文里，但不要自行补平民伤亡数、半个街区被毁、爆炸范围、遗体状况、具体死亡方式或其他档案中没有的惨烈细节。三人小队没有额外公开职位与关系信息，不要说“我是队长/我带队”，不要给另外两人安排分工，也不要称他们为挚友、最好的伙伴、亲人等特殊关系，只需写“队友/同伴”。你的严厉立场来自这次亲历，不要顺带把个人经验扩写成尚未解锁的普遍机制定律。\n`);
  assertReleasePrivacy(card);
  const raw=Buffer.from(JSON.stringify(card),'utf8');
  const compactSha256=crypto.createHash('sha256').update(raw).digest('hex');
  return {card,raw,compactSha256};
}

export const loadQiduReleaseCard=loadQiduReleaseCandidate;
export const loadQiduOneFileCard=loadQiduReleaseCandidate;
export {entryMap,assertReleasePrivacy,ONEFILE_VERSION};
