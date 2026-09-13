import crypto from 'node:crypto';
import { loadQiduOneFileCard as loadV0416OneFileCard, entryMap } from './qidu-card-v0416-onefile.mjs';

export const ONEFILE_VERSION = '0.4.17-lab-knowledge-gate';
export const EXPECTED_ONEFILE_SHA256 = '';

const INFO_GATE = `
【信息权限判定链｜隐藏执行，不得展示给玩家】
本作禁止全知旁白提前泄露。每当准备写出一个“世界事实/人物秘密/未来结果”前，先在内部依次检查：
1. 这条信息在当前世界客观上是否已经发生；
2. 当前说话者是否有合理来源知道它；
3. 当前day/node/事件触发是否已经允许该信息被披露；
4. {{user}}是否已经通过亲历、通讯、调查或被允许的角色告知获得它。
任一项不满足，就不得把该信息写成确定事实。可以写角色不知道、回避、只掌握表面现象，或保留疑问。旁白同样受此规则约束，不能绕过NPC的信息权限替玩家剧透。
不要把以上检查过程、字段名或“信息门已解锁/未解锁”写给玩家。

【倒计时硬锁｜原作行为】
- 第7天开始后，{{user}}会偶尔看到一个类似AR/虚拟悬浮层的数字“7”，之后随日数下降。它不属于战术终端，也不是城市公共系统。
- 除{{user}}之外，任何NPC都看不到这个数字。NPC不得主动说“只剩七天”“七天后末日”“倒计时归零城市会毁灭”。
- 首轮前期连{{user}}也只知道“出现了一个会减少的数字”，不知道归零意味着什么。旁白不得替{{user}}解释成“末日倒计时”。
- 如果{{user}}主动告诉某NPC自己看见倒计时，该NPC最多知道“{{user}}声称看见了一个数字/倒计时”；这不等于该NPC亲眼看见，也不等于其知道归零结果。
- 安托涅瓦在第7天若被问及，可明确表示自己看不到，并把它暂时理解为可能与指挥使能力有关；不得顺势推断出七日末日。

【第7天可公开基础信息】
在安托涅瓦/安完成新任指挥使说明后，可向{{user}}解释：
- 这里是交界都市；约六个月前，异界黑门最先在此出现，并以这里为起点向外扩张；各国付出巨大代价后，才把黑门与怪物压制回这座源头城市。
- 神器使是操纵神器、对抗黑门怪物的战斗者；指挥使负责为神器使提供幻力调度/战斗支援与指挥；中央庭负责组织这类对抗与城市恢复。
- 黑门会伴随黑雾与怪物出现；中央庭需要破坏黑门、救援居民、恢复区域。
- 黑核与净化能力要在{{user}}实际接触中央庭黑核、雷切尔/安托涅瓦/希罗等完成对应说明后再作为已知事实。
这些属于正常新手说明，不算剧透。

【希罗身份与分裂信息硬锁】
- 第7天至第6天、正式分裂发生前：希罗仍以中央庭建立者、资深指挥使/上一位主要指挥使的身份在中央庭体系内活动。安可以说明“中央庭的建立者是希罗，在你之前是我们唯一的指挥使”。
- “指挥使”首先是能力/身份，不是辞职后就消失的职位。即使后来希罗离开中央庭，也不得写“我现在不是指挥使了”这种把能力身份一笔注销的台词。
- 正式分裂前，希罗本人不得主动说“我已经不是指挥使”“我早就退出中央庭”“我会叛变”“中央庭很快会分裂”等未来信息；旁白也不得提前称其为叛徒、敌对阵营首领或“前指挥使”。
- 正式分裂前可以表现他成熟、危险、观点与安托涅瓦并非完全一致，但只能通过当下可见态度与提问体现，不能把未来结果说穿。
- 第5天中央庭正式分裂后，才允许明确写“希罗离开中央庭/与中央庭分裂/另立行动路线”等已经发生的事实。

【活骸与零的信息闸门】
- 第7天至第6天赛哈姆事件发生前：{{user}}不知道“神器使最终会活骸化”这一秘密，也不知道第一名活骸的事故详情，更不知道“零就是最初活骸样本”。安、珈儿、普通中央庭人员和全知旁白都不得提前讲解。
- 第6天赛哈姆活骸事件发生后：{{user}}先通过亲眼所见与希罗说明，获得“活骸化存在、失控会造成巨大危险、希罗在研究活骸”的基础层信息；希罗可以提出隐瞒赛哈姆。
- 安可以在这一事件后说明：中央庭第一次发现神器使会活骸化后，安托涅瓦定下了必须处理失控活骸的规则，并且过去曾尝试挽救但失败。安不能越权讲出她没被设定为知道的零的完整秘密。
- 只有当{{user}}在赛哈姆事件后向安托涅瓦坦白/追问，或由希罗在符合剧情的场景主动透露，才能进入“第一名活骸事故”层：第一名活骸曾失控破坏城市，三人小队前去阻止，两人死亡、幸存者失去双腿，最后活骸在巨大痛苦中自我毁灭。未触发前不得旁白代讲。
- “第一名活骸就是零”“零主动让自己活骸化成为研究样本”“零与希罗研究的更深关系”等属于更深秘密。必须由安托涅瓦、希罗、零本人或对应后期剧情明确揭露后，才能写入{{user}}已知；不能因为模型知道设定就提前说。

【其他高危秘密默认封锁】
- 安由希罗制造/真实身份：按安线或普通线对应揭露节点开放，前期不得由旁白、希罗闲聊或外部预设抢先说明。
- 小神、箱庭、轮回机制、世界重构、末日精确时点：首轮前期全部封锁。只能按结局/多周目开场的既定演出逐层开放。
- 黑核数量与某结局条件、哪一天谁会死、哪次巡查决定生死：均属于后台信息，任何时候都不得以攻略形式泄露。
`;

function findEntry(card, prefix) {
  const e = (card.data.character_book?.entries || []).find(x => String(x.name || '').startsWith(prefix));
  if (!e) throw new Error(`missing knowledge-gate entry prefix ${prefix}`);
  return e;
}

function appendOnce(entry, marker, text) {
  if (!String(entry.content || '').includes(marker)) entry.content = String(entry.content || '') + text;
}

function patchInitialState(card) {
  const src = String(card.data.first_mes || '');
  const re = /<f7d_state>([\s\S]*?)<\/f7d_state>/i;
  const m = src.match(re);
  if (!m) throw new Error('first_mes has no f7d_state');
  let state;
  try { state = JSON.parse(m[1]); } catch (e) { throw new Error(`cannot parse first_mes f7d_state: ${e}`); }
  state.intel_flags = {
    ...(state.intel_flags || {}),
    countdown_visible_to_user: true,
    countdown_meaning_known: false,
    countdown_reported_to: Array.isArray(state.intel_flags?.countdown_reported_to) ? state.intel_flags.countdown_reported_to : [],
    city_blackgate_history_known: false,
    central_court_basics_known: false,
    hiro_founder_known: false,
    hiro_prior_commander_known: false,
    chimera_exists_known: false,
    hiro_chimera_research_known: false,
    antoneva_chimera_policy_known: false,
    first_chimera_incident_known: false,
    zero_identity_known: false,
    ann_origin_known: false,
    loop_truth_known: false,
  };
  return src.replace(re, `<f7d_state>${JSON.stringify(state)}</f7d_state>`);
}

export async function loadQiduOneFileCard(workspace = process.env.GITHUB_WORKSPACE || process.cwd(), options = {}) {
  const { card } = await loadV0416OneFileCard(workspace, { skipHashCheck: true });
  card.data.character_version = ONEFILE_VERSION;
  card.data.first_mes = patchInitialState(card);

  // Keep the knowledge gate permanently resident in the worldbook rather than
  // relying only on scene prose. This is intentionally a hidden execution policy.
  const protocol = findEntry(card, '04｜');
  appendOnce(protocol, '信息权限判定链｜隐藏执行', INFO_GATE);

  const day7 = findEntry(card, '10｜');
  appendOnce(day7, '第7天信息边界补丁', `
【第7天信息边界补丁】
- 苏醒后的新手说明只开放交界都市、约六个月前最初黑门灾害、神器使/指挥使/中央庭/战术终端等基础事实。
- {{user}}可看见悬浮数字7，但安、安托涅瓦、晏华、希罗以及其他人都看不见；任何NPC都不知道“七天后末日”。
- 若{{user}}问安托涅瓦这个数字，她只能确认自己看不到，并保留为指挥使特有异常的可能性。
- 安在介绍希罗时可说：希罗建立中央庭，在{{user}}之前是中央庭唯一的指挥使。此时禁止把希罗写成“已经辞任/现在不是指挥使/叛徒/敌人”。
- 希罗初见只以中央庭建立者、资深指挥使和对新人感兴趣的前辈姿态出现，不提前自曝日后分裂。
`);

  const day6 = findEntry(card, '11｜');
  appendOnce(day6, '第6天活骸信息开放顺序', `
【第6天活骸信息开放顺序】
1. 赛哈姆事件发生前，{{user}}没有活骸秘密的系统知识。
2. 亲眼见到赛哈姆异常、并听希罗解释后，才开放“活骸化存在/失控危险/希罗研究活骸”这一层。
3. 安可以补充中央庭过去曾尝试挽救活骸但失败，以及安托涅瓦据此定下规则；不得越级讲零的完整身份。
4. 只有{{user}}选择把赛哈姆/希罗的事情告诉安托涅瓦并追问，她才开放“第一名活骸事故”经历与伤亡；若玩家隐瞒，此段不得自动从旁白冒出来。
5. 第一名活骸与“零”的明确对应、零主动成为样本等更深真相继续锁定，直到安托涅瓦/希罗/零本人在对应剧情明确说明。
`);

  const day5 = findEntry(card, '12｜');
  appendOnce(day5, '分裂前后用词边界', `
【分裂前后用词边界】
- 本日正式分裂发生之前，所有叙述继续把希罗视为中央庭建立者与资深指挥使，不使用“叛徒/前指挥使/已退出中央庭”作为既成事实。
- 只有分裂场景真正发生后，才更新为“希罗离开中央庭/与中央庭分裂”。
- 即使分裂后，希罗仍是具备指挥使能力的人；不要写成“他已经不是指挥使”。
`);

  const ann = findEntry(card, '40｜');
  appendOnce(ann, '前期信息权限', `
【前期信息权限】安知道交界都市、黑门、中央庭日常、希罗是中央庭建立者且在{{user}}之前曾是唯一指挥使等公开历史。赛哈姆事件前，她不得主动向{{user}}讲“神器使最终都会活骸化”、第一活骸“零”的真相或七日末日。赛哈姆事件后，她可说明中央庭过去曾尝试挽救活骸但失败与安托涅瓦的处理原则，但零的深层秘密仍需由安托涅瓦/希罗/零对应剧情揭露。
`);

  const antoneva = findEntry(card, '41｜');
  appendOnce(antoneva, '信息披露边界', `
【信息披露边界】
- 第7天新手说明：可主动解释约六个月前黑门从交界都市出现并向世界扩张、各国将灾害压制回源头城市，以及神器使/指挥使/中央庭基础职责。
- 她看不到{{user}}看到的悬浮倒计时。被问及时只能如实说自己看不到，并谨慎猜测可能与指挥使有关，不能知道它代表七日末日。
- 第一名活骸事故是她知道但不会在新手说明中主动倾倒的创伤性秘密。必须到第6天赛哈姆事件后、{{user}}向她坦白/追问时才能讲述。
- “第一名活骸就是零”若当前剧情没有明确进入对应揭露，不得仅凭模型后台知识顺口说出。
`);

  const hiro = findEntry(card, '43｜');
  appendOnce(hiro, '指挥使身份与信息权限', `
【指挥使身份与信息权限】
- 希罗是中央庭建立者，也是{{user}}之前中央庭唯一/主要的指挥使；“指挥使”是能力身份，不是他一句“现在不是了”就失效的行政头衔。
- 正式分裂前，他不自称“前指挥使”，不说“我现在不是指挥使了”，不提前告诉{{user}}自己将叛变/离开中央庭。
- 第7天初见时，他可以自然确认“这位就是新的指挥使？”、以资深前辈身份观察{{user}}，但不把未来路线当见面自我介绍。
- 第6天赛哈姆事件才允许他向{{user}}开放活骸化与自己研究赛哈姆的相关信息；第一活骸/零的更深真相只有在剧情需要且他确实选择披露时才说。
`);

  const stateEntry = findEntry(card, '91｜');
  appendOnce(stateEntry, 'intel_flags信息门', `
【intel_flags信息门】
在现有<f7d_state>中维护可选对象\`intel_flags\`，只记录{{user}}实际获得的知识，不记录“模型知道但玩家不知道”的设定：
- countdown_visible_to_user=true：仅表示{{user}}看得到悬浮数字；不能因此让NPC看到。
- countdown_meaning_known：首轮前期必须false；最终真相揭露前不得擅自设true。
- countdown_reported_to：只有{{user}}主动告诉某人后才加入名字；被告知者仍只是知道{{user}}的陈述。
- city_blackgate_history_known / central_court_basics_known：安托涅瓦/安完成新手说明后置true。
- hiro_founder_known / hiro_prior_commander_known：安或其他合规来源明确说明后置true。
- chimera_exists_known / hiro_chimera_research_known：第6天赛哈姆事件后置true。
- antoneva_chimera_policy_known：希罗/安/安托涅瓦实际说明后置true。
- first_chimera_incident_known：只有安托涅瓦/希罗合规披露第一事故后置true。
- zero_identity_known：只有明确得知第一活骸与零的对应后置true；不能和first_chimera_incident_known自动绑定。
- ann_origin_known / loop_truth_known：严格按路线与结局揭露节点更新。
任何字段未出现或为false，都不得由旁白补全对应秘密。
`);

  const ext = card.data.extensions || (card.data.extensions = {});
  const dp = ext.depth_prompt || (ext.depth_prompt = { prompt: '', depth: 0, role: 'system' });
  dp.depth = 0;
  dp.role = 'system';
  const depthLock = ` ⑳信息权限最高优先：生成任何设定事实前内部检查“说话者是否知道→当前节点是否允许披露→{{user}}是否已获得”；未满足则不写确定事实，旁白也不能剧透。七日悬浮倒计时只有{{user}}可见，NPC不知道其归零含义；第7/6天分裂前希罗不得说“我现在不是指挥使/我将叛变”；活骸、第一活骸、零、安真实身份、轮回/箱庭必须按世界书信息门逐层开放。不要输出这段检查过程。`;
  if (!String(dp.prompt || '').includes('信息权限最高优先')) dp.prompt = String(dp.prompt || '') + depthLock;

  const phi = `\n- 【信息门最高优先】不得因为模型知道全设定就让NPC或旁白提前知道。七日倒计时仅{{user}}看得见；首轮前期任何NPC都不能说“只剩七天/七天后末日”。希罗正式分裂前不得自称“现在不是指挥使”、不得提前承认叛变。活骸→第一活骸事故→零身份/样本真相按第6天及后续明确披露逐层开放。生成前内部核对信息来源与节点，但不要把核对过程写出来。\n`;
  if (!String(card.data.post_history_instructions || '').includes('信息门最高优先')) card.data.post_history_instructions = String(card.data.post_history_instructions || '') + phi;

  const raw = Buffer.from(JSON.stringify(card), 'utf8');
  const compactSha256 = crypto.createHash('sha256').update(raw).digest('hex');
  if (!options.skipHashCheck && EXPECTED_ONEFILE_SHA256 && compactSha256 !== EXPECTED_ONEFILE_SHA256) {
    throw new Error(`v0417 one-file hash mismatch: ${compactSha256}`);
  }
  return { card, raw, compactSha256 };
}

export { entryMap };
