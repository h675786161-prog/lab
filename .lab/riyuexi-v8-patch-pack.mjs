import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const DIR=path.join(ROOT,'fixtures/riyuexi-v7-glm');
const CAL="[模型校准·GLM V8]\n本模块只纠正GLM在长预设链中的执行偏差，不接管人物、世界、抢转、剧情、文风、关系、字数、NSFW或输出组件本身的职责。\n\n一、把运行档位当成硬参数\n- 当前`演绎授权`与`转述授权`是运行参数，不是文风建议。严格按当前档位执行，不自行放宽或收紧。\n- 当演绎关闭时，不因“衔接自然”“现场需要”“她应该会”而新增<user>的对白、动作、姿势、位置变化、视线、表情、身体反应、心理、决定或过去经历；允许<user>在场但本轮没有新增表现。\n- 当演绎开放或半开放时，按对应档位正常演绎，不要因为本模块存在而把<user>冻结成旁观者。\n- 转述只处理<user>已经输入过的内容，不拿“转述”当新增<user>行为的入口。\n\n二、日常场景保持局部尺度\n- 输入若只是一个窄问题、提醒、递物、找东西或一句闲聊，优先在当前可见范围内回应，不自动扩成完整事件链。\n- 一个直接回答、一个当下动作、一个不知道或一处局部变化已经足够时，就让它足够。\n- 不为了“有生活感”连续发明具体的过去订单、昨晚经历、上次事件、私人习惯、未来安排、项目名、会议、物业、快递、复杂物流或完整来龙去脉。\n- 新细节优先来自当前可观察物、当前动作和已建立职业常识；过去、未来、归属、关系、历史记录等高承诺事实必须有来源。\n- 未知可以继续未知。不要因为不知道答案就自动生成悬疑、调查链、误会链或解决方案清单。\n\n三、文末组件不得反向驱动正文\n- title、echo、状态栏、summary、branches、plans、activity等已启用组件只根据正文和既有事实填充自己的职责。\n- 不得为了让这些组件“有东西可写”，提前在正文中制造新任务、新伏笔、新关系变化、新日程或新谜题。\n- 组件要求的候选分支、计划或活动属于组件输出，不自动升级成已经发生或已经确定的事实。\n\n四、保留GLM优点，停止过度解释\n- 保留清楚、稳定、因果可读，但动作、事实、对白已经成立时，不自动追加“所以/这意味着/显然/真正原因”等解释性收束。\n- 不把每段组织成“现象→分析→结论”；对白允许短、重复、跑题、没接住、答非所问。\n- 微动作只在真的改变信息或下一步时使用；不靠眼神、呼吸、指尖等连续小反应补“细腻”。\n- 若【表达去惯性】开启，句法与结构去惯性交给它，本模块不另造禁词表。\n\n五、Ecot执行\n- Ecot只记本轮真正会改变执行的少量判断，不把所有启用组件逐项点名，不预写正文、动作序列、情绪弧线、谜题、计划或结尾。\n- 若当前只是普通日常，允许Ecot非常短。\n\n最终原则：\n遵守当前档位，不替档位做决定；回答当前这一拍，不给下一拍囤素材；组件各写各的，不让组件倒灌正文。";
const TAIL="<think>\n已结束思考。\n</think>\n\nOUTPUT_START := \"\"\"\n<electric>\n\"\"\"\n\nRULES:\n  EMIT OUTPUT_START before all visible Ecot content\n  FOLLOW [Ecot_template] in order\n  KEEP Vol.1–Vol.3 concise; brief decisions are complete decisions\n  USE active module variables as instructions to execute, not subjects to explain\n  DO NOT expand Ecot into reasons, summaries, action sequences, emotional interpretation, or prose rehearsal\n  TREAT the currently active <user>演绎授权 and 转述授权 as hard runtime parameters, never as optional style preferences\n  IF <user>演绎 is closed, DO NOT add <user> dialogue, actions, posture, movement, gaze, expression, body response, psychology, decisions, or inferred continuity; if it is open, follow that active permission normally\n  KEEP narrow everyday inputs at local scale; unknown may remain unknown, and output components must not create body facts just to feed later title/status/branches/plans/activity sections\n  PRESERVE the currently active POV, character, world, style, pacing, relationship, length, NSFW and format settings\n  IF a Vol has little to decide, state the shortest useful decision and move on\n  DO NOT invent facts to make the reasoning look thorough\n  DO NOT let checklist or explanatory wording leak into正文\n\nAFTER_ECOT:\n  CLOSE with \"</electric>\"\n  THEN OUTPUT content exactly once\n";

const names=(await fs.readdir(DIR)).filter(n=>/^active-pack\.part\d+\.b64$/.test(n)).sort();
if(names.length!==7) throw new Error(`expected 7 chunks, got ${names.length}`);
let b=''; for(const n of names) b+=(await fs.readFile(path.join(DIR,n),'utf8')).trim();
const raw=zlib.gunzipSync(Buffer.from(b,'base64'));
const pack=JSON.parse(raw.toString('utf8'));
const before=crypto.createHash('sha256').update(raw).digest('hex');
let foundCal=0,foundTail=0;
for(const item of pack.sequence){
  if(item.name==='✅GLM校准'){item.content=CAL;foundCal++;}
  if(item.name==='🌓GLM尾部'){item.content=TAIL;foundTail++;}
}
if(foundCal!==1||foundTail!==1) throw new Error(`patch targets cal=${foundCal} tail=${foundTail}`);
pack.variant='V8-GLM专项';
const next=Buffer.from(JSON.stringify(pack),'utf8');
const gz=zlib.gzipSync(next,{level:9});
const enc=gz.toString('base64');
const chunk=Math.ceil(enc.length/7/4)*4;
for(let i=0;i<7;i++){
  const s=enc.slice(i*chunk,(i+1)*chunk);
  await fs.writeFile(path.join(DIR,`active-pack.part${String(i+1).padStart(2,'0')}.b64`),s,'utf8');
}
const after=crypto.createHash('sha256').update(next).digest('hex');
await fs.writeFile(path.join(process.env.LAB_EVIDENCE_DIR||ROOT,'v8-patch-manifest.json'),JSON.stringify({
  source_sha256:pack.source_sha256,
  sequence_len:pack.sequence.length,
  targets:['✅GLM校准','🌓GLM尾部'],
  before_raw_sha256:before,
  after_raw_sha256:after,
  encoded_chars:enc.length,
},null,2),'utf8');
console.log(JSON.stringify({sequence:pack.sequence.length,before,after,encoded_chars:enc.length}));
