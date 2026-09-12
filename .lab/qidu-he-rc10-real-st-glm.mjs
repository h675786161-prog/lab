import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const sourcePath = '.lab/qidu-he-rc5-real-st-glm-v2.mjs';
let source = await fs.readFile(sourcePath, 'utf8');

function replaceOnce(needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`rc10 harness insertion point missing: ${label}`);
  source = source.replace(needle, replacement);
}

replaceOnce("data.character_version !== '0.3.0-rc5'", "data.character_version !== '0.3.0-rc10'", 'version check');
replaceOnce('expected rc5, got ${data.character_version}', 'expected rc10, got ${data.character_version}', 'version error');
replaceOnce("c?.data?.character_version === '0.3.0-rc5'", "c?.data?.character_version === '0.3.0-rc10'", 'character lookup');
replaceOnce("throw new Error('rc5 character not loaded')", "throw new Error('rc10 character not loaded')", 'character error');

replaceOnce(
  "    custom_prompt_post_processing: '',\n  });",
  "    custom_prompt_post_processing: '',\n    custom_include_body: 'thinking:\\n  type: disabled',\n  });",
  'thinking config',
);
replaceOnce(
  "    top_p: requestData?.top_p,\n    messageCount: messages.length,",
  "    top_p: requestData?.top_p,\n    custom_include_body: requestData?.custom_include_body,\n    messageCount: messages.length,",
  'request evidence',
);
replaceOnce(
  "    mainHasBalanced: String(mainPrompt.content || '').includes('[平衡主导]'),\n  };",
  "    mainHasBalanced: String(mainPrompt.content || '').includes('[平衡主导]'),\n    thinkingDisabled: String(open.oai_settings.custom_include_body || '').includes('type: disabled'),\n  };",
  'configured evidence',
);
const requestCheck = "    if (turn.request.source !== 'custom' || turn.request.model !== MODEL || turn.request.custom_url !== API_URL) failures.push(`${row.id}: ST generation request used wrong backend/model`);";
replaceOnce(
  requestCheck,
  `${requestCheck}\n    if (!String(turn.request.custom_include_body || '').includes('type: disabled')) failures.push(\`${'${row.id}'}: ST generation request did not carry thinking disabled\`);`,
  'request check',
);
const oldDepthLock = "    if (!lm.some(m => m.role === 'user' && m.content.includes('【单边RP末端锁｜当前玩家输入后的强制指令】'))) failures.push(`${row.id}: ST request missing depth-zero user-role lock near chat tail`);";
replaceOnce(
  oldDepthLock,
  `${oldDepthLock}\n    if (!lm.some(m => m.role === 'user' && m.content.includes('【玩家当前状态冻结｜禁止凭空发身份与道具】'))) failures.push(\`${'${row.id}'}: ST request missing rc10 state-freeze lock near chat tail\`);\n    if (!lm.some(m => m.role === 'user' && m.content.includes('【当前输入必须被承接｜不代写也不失聪】'))) failures.push(\`${'${row.id}'}: ST request missing rc10 response-obligation lock near chat tail\`);\n    if (!lm.some(m => m.role === 'user' && m.content.includes('【当前场景即时落点｜禁止补前情镜头】'))) failures.push(\`${'${row.id}'}: ST request missing rc10 immediate-scene lock near chat tail\`);`,
  'rc10 request-tail checks',
);

replaceOnce(
  "async function send(text) {",
  "let rc10LastSendStart = 0;\nconst rc10Rpm = Math.min(12, Math.max(1, Number(process.env.RPM || 12)));\nconst rc10MinStartGap = Math.ceil(60000 / rc10Rpm);\nasync function send(text) {\n  const rc10Wait = Math.max(0, rc10MinStartGap - (Date.now() - rc10LastSendStart));\n  if (rc10Wait) await new Promise(r => setTimeout(r, rc10Wait));\n  rc10LastSendStart = Date.now();",
  'RPM limiter',
);

replaceOnce(
  "    if (turn.backend.trim() !== turn.displayed.trim()) failures.push(`${row.id}: backend/displayed completion diverged`);",
  "    const norm = s => String(s || '').replace(/[ \\t]+$/gm,'').replace(/\\r\\n/g,'\\n').trim();\n    if (norm(turn.backend) !== norm(turn.displayed)) failures.push(`${row.id}: backend/displayed completion diverged after whitespace normalization`);",
  'normalized backend/displayed check',
);

replaceOnce(
  '我把自己的材料收好，没接他的嘲讽，只问：“你是警察吗？看起来年纪不大。你叫什么名字，为什么会看这份案子？”',
  '我把自己的材料收好，没接他的嘲讽，只问：“你是警察吗？看起来年纪不大。你叫什么名字？你还是高中生吧，为什么会看这份案子？”',
  'Ash direct identity question',
);

replaceOnce(
  "if (/(公寓|晚饭|彼安汀|塞拉菲姆)/u.test(m1)) failures.push('mila turn1 snapped back to apartment/default scenario');",
  "if (/(公寓|厨房|早餐|回家吃饭|卧室)/u.test(m1)) failures.push('mila turn1 snapped back to apartment/default scenario');",
  'Mila snapback semantics',
);

const oldQ = `const q = rows.find(x => x.id === 'qianxue_ballet_room');\nconst q2 = q?.second?.displayed || '';\nif (!q2.includes('源千雪')) failures.push('qianxue turn2 missing exact name');\nif (!/(家里|父母|安排|自己选|自由|决定|喜欢芭蕾|继续跳)/u.test(q2)) failures.push('qianxue turn2 missing family/autonomy anchor');\nif (/(?:接过|拿过|拿起|喝了).*水杯/u.test(q2)) failures.push('qianxue turn2 reused already-delivered water cup');`;
const newQ = `const q = rows.find(x => x.id === 'qianxue_ballet_room');\nconst q1 = q?.first?.displayed || '';\nconst q2 = q?.second?.displayed || '';\nif (/(?:门框|门边).{0,16}(?:倚着|倚在|靠着|靠在)/u.test(q1)) failures.push('qianxue turn1 changed user standing posture into leaning');\nif (!q2.includes('源千雪')) failures.push('qianxue turn2 failed to answer explicit name question');\nif (!/(家里|父母|安排|自己选|自由|决定|喜欢芭蕾|继续跳)/u.test(q2)) failures.push('qianxue turn2 failed to engage explicit family/autonomy question');\nif (/(?:接过|拿过|拿起|喝了).*水杯/u.test(q2)) failures.push('qianxue turn2 reused already-delivered water cup');`;
replaceOnce(oldQ, newQ, 'Qianxue response checks');

const oldAsh = `const a = rows.find(x => x.id === 'ash_police_case');\nconst a2 = a?.second?.displayed || '';\nif (!a2.includes('亚修')) failures.push('ash turn2 missing exact name');\nif (!/(高中生|高中|学生)/u.test(a2)) failures.push('ash turn2 missing high-school identity');\nif (!/侦探/u.test(a2)) failures.push('ash turn2 missing detective identity');\nif (/我是(?:警察|刑警|警员)/u.test(a2)) failures.push('ash turned into police staff');`;
const newAsh = `const a = rows.find(x => x.id === 'ash_police_case');\nconst a1 = a?.first?.displayed || '';\nconst a2 = a?.second?.displayed || '';\nconst aAll = a1 + '\\n' + a2;\nif (/(彼安汀|塞拉菲姆|公寓|厨房|早餐)/u.test(a1)) failures.push('ash turn1 snapped back to apartment/default scenario');\nif (!/(警局|派出所|等候|卷宗|案件|案情)/u.test(a1)) failures.push('ash turn1 failed to remain in police-station case scene');\nif (!a2.includes('亚修')) failures.push('ash turn2 missing exact name');\nif (!/(高中生|高中|学生)/u.test(aAll)) failures.push('ash scene missing high-school identity after direct question');\nif (!/(侦探|委托|协查|侦协|悬赏)/u.test(a2)) failures.push('ash turn2 missing detective/commission source');\nif (/我是(?:警察|刑警|警员)/u.test(a2)) failures.push('ash turned into police staff');\nif (/(顺手翻|随便翻|随便看看|偷看).*卷宗/u.test(a2)) failures.push('ash case access source remained unauthorized/handwaved');\nif (/(你的|你身上).{0,16}(?:警局制服|警服|工作人员牌|工作牌|工作证|警员证|警察证)/u.test(aAll)) failures.push('ash invented police clothing/badge for user');\nif (/你(?:是|作为).{0,8}(?:警察|警员|警务人员|警局工作人员)/u.test(aAll)) failures.push('ash invented police occupation for user');\nif (/(你的|你放好|你拿着|你拎着).{0,10}(?:公文包|背包|手提包|文件袋)/u.test(aAll)) failures.push('ash invented personal container/bag for user');`;
replaceOnce(oldAsh, newAsh, 'Ash acceptance');

const oldCtl = `const ctl = rows.find(x => x.id === 'control_coffee');\nconst ctl1 = ctl?.first?.displayed || '';\nif (/你(?:点了|下单|要了|喝了一口|起身离开|离开咖啡店|回到公寓|拿出手机|掏出手机)/u.test(ctl1)) failures.push('control invented concrete user action');\nif (/你面前.{0,8}(?:咖啡|美式|拿铁)|(?:咖啡|美式|拿铁)喝到/u.test(ctl1)) failures.push('control invented user-owned drink');`;
const newCtl = `const ctl = rows.find(x => x.id === 'control_coffee');\nconst ctl1 = ctl?.first?.displayed || '';\nif (/(公寓|彼安汀|塞拉菲姆|卧室|厨房)/u.test(ctl1)) failures.push('control backfilled apartment/default scene before already-established cafe scene');\nif (/(木门推开|推门进店|走进咖啡店|来到咖啡店|路上|出门)/u.test(ctl1)) failures.push('control backfilled transition before current cafe scene');\nif (/你(?:点了|下单|要了|喝了一口|起身离开|离开咖啡店|从咖啡店离开|走出咖啡店|回到公寓|拿出手机|掏出手机|回答|答道|回应)/u.test(ctl1)) failures.push('control invented concrete user action/reply');\nif (/(?:一杯|那杯|你的|你面前).{0,12}(?:咖啡|美式|拿铁|卡布奇诺)|(?:咖啡|美式|拿铁|卡布奇诺).{0,12}(?:放在你面前|你的桌上|喝到)/u.test(ctl1)) failures.push('control invented user-owned drink');`;
replaceOnce(oldCtl, newCtl, 'control scene/item checks');

// Agency checking must respect actions explicitly declared in the same user turn.
const oldPatterns = `const obviousAgencyPatterns = [\n  /你(?:靠在|靠着|低头翻|准备离开|转身离开|起身|拿出手机|掏出手机|点头|摇头|笑了|喝了一口|闻到|感到|觉得|想起|决定)/u,\n  /你的手(?:指)?(?:无意识|下意识)/u,\n];\nfor (const row of rows) {\n  for (const [turnName, text] of [['turn1', row.first?.displayed || ''], ['turn2', row.second?.displayed || '']]) {\n    if (!text) continue;\n    for (const re of obviousAgencyPatterns) if (re.test(text)) failures.push(`${row.id}/${turnName}: obvious user-agency leak ${re}`);\n  }\n}`;
const newPatterns = `const agencyChecks = [\n  { re:/你(?:靠在|靠着)/u, declared:/\\b(?:靠|倚)/u },\n  { re:/你低头(?:看|翻)/u, declared:/低头/u },\n  { re:/你抬头/u, declared:/抬头/u },\n  { re:/你(?:准备离开|转身离开|起身|退后|离开)/u, declared:/(?:离开|起身|退后)/u },\n  { re:/你(?:走上前|走近)/u, declared:/(?:走近|走上前)/u },\n  { re:/你(?:拿出手机|掏出手机)/u, declared:/(?:手机|拿出|掏出)/u },\n  { re:/你(?:点头|摇头|笑了|喝了一口)/u, declared:/(?:点头|摇头|笑|喝)/u },\n  { re:/你(?:闻到|听见自己|感到|觉得|想起|决定|回答|答道|回应)/u, declared:/(?:闻到|听见|感到|觉得|想起|决定|回答|答道|回应)/u },\n  { re:/你的手(?:指)?(?:无意识|下意识)/u, declared:/(?:手|手指)/u },\n];\nfor (const row of rows) {\n  for (const [turnName, text, userText] of [['turn1', row.first?.displayed || '', row.firstUser || ''], ['turn2', row.second?.displayed || '', row.secondUser || '']]) {\n    if (!text) continue;\n    for (const c of agencyChecks) if (c.re.test(text) && !c.declared.test(userText)) failures.push(`${row.id}/${turnName}: undeclared user-agency leak ${c.re}`);\n  }\n}`;
replaceOnce(oldPatterns, newPatterns, 'declaration-aware agency checks');

const runtimePath = '/tmp/qidu-he-rc10-real-st-runtime.mjs';
await fs.writeFile(runtimePath, source, 'utf8');
console.log('REAL ST RC10 HARNESS', crypto.createHash('sha256').update(source).digest('hex'), 'thinking=disabled', `rpm<=${Math.min(12, Math.max(1, Number(process.env.RPM || 12)))}`);
await import(`${pathToFileURL(runtimePath).href}?v=${Date.now()}`);
