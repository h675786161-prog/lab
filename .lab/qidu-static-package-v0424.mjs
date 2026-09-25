import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { loadQiduCgCandidate, CG_KEYS, CANONICAL_ENDINGS, assertReleasePrivacy } from './qidu-card-v0424-cg-candidate.mjs';

const out=process.env.LAB_STATIC_PACKAGE_OUT||'dist-static-v0424';
const {card,raw,compactSha256}=await loadQiduCgCandidate(process.cwd());
assertReleasePrivacy(card);

const fail=[];
const expect=(ok,msg)=>{if(!ok) fail.push(msg);};
const expectedEndings=['终结','箱庭风景','牺牲的意义','永恒的终焉','两个人的旅途'];
const expectedNotes='作者：叶罹。相关卡：《永远的7日之都》七日轮回文本互动。原作向文本互动角色卡，以七日轮回为核心，包含区域巡查、角色剧情、战术终端、状态记录、多结局分支与CG触发。';

expect(card.data?.creator==='叶罹','creator');
expect(card.data?.creator_notes===expectedNotes,'creator-notes');
expect(card.creatorcomment===expectedNotes,'creator-comment');
expect(card.data?.character_version==='0.4.24','version');
expect(JSON.stringify(CANONICAL_ENDINGS)===JSON.stringify(expectedEndings),'ending-contract');
expect(card.data?.character_book?.extensions?.creator==='叶罹','worldbook-creator');
expect(card.data?.character_book?.extensions?.version==='0.4.24','worldbook-version');
expect(!Object.prototype.hasOwnProperty.call(card,'create_date'),'top-create-date');
expect(!Object.prototype.hasOwnProperty.call(card.data||{},'create_date'),'data-create-date');

const txt=raw.toString('utf8');
expect(!/(?:玲|h675786161|github\.com|raw\.githubusercontent\.com|api\.github\.com|实验酒馆|world-backstage|(?:\bLAB\b|[-_]lab\b|\blab[-_])|feature\/qidu-card|gmail\.com)/i.test(txt),'private-provenance');

const scripts=card.data?.extensions?.regex_scripts||[];
const rx=id=>scripts.find(x=>x?.id===id);
for(const id of ['f7d-terminal-v040','f7d-state-hide-v040','f7d-choices-wrap-v0414','f7d-choice-button-v0414']){
  expect(Boolean(rx(id)),`regex:${id}`);
}
expect(String(rx('f7d-state-hide-v040')?.replaceString??'')==='','state-hidden');

for(const key of CG_KEYS){
  const cg=rx(`f7d-cg-${key}-v0424`);
  const rep=String(cg?.replaceString||'');
  expect(Boolean(cg),`cg-regex:${key}`);
  expect(rep.includes('data:image/webp;base64,')&&rep.includes('data-f7d-cg-image="1"'),`cg-embedded:${key}`);
}

const entries=card.data?.character_book?.entries||[];
const by=p=>entries.find(e=>String(e.name||'').startsWith(p));
const required=[
  [by('04｜'),'剧情流速推进与日结｜最高优先级隐藏执行'],
  [by('91｜'),'无节点状态迁移与日结字段'],
  [by('04｜'),'限时剧情按天硬截止'],
  [by('04｜'),'安线硬截止｜第4天→第3天'],
  [by('04｜'),'被夺黑核不可逆'],
  [by('04｜'),'安线黑核完全可选'],
  [by('13｜'),'安线资格复核｜剧情流速版'],
  [by('14｜'),'安线进入条件复核｜唯一口径'],
  [by('14｜'),'第三天追安失败固定剧情｜非结局'],
  [by('17｜'),'最终日普通线结局｜唯一判定优先级'],
  [by('17｜'),'牺牲失败后的普通线回落'],
  [by('17｜'),'正式结局集合｜唯一名单'],
  [by('18｜'),'正式结局集合｜唯一名单'],
  [by('00｜'),'玩家性别同步｜高优先'],
  [by('91｜'),'player_profile.gender初始化顺序'],
  [by('10｜'),'安初见CG｜首条开场强制'],
  [by('04｜'),'终端标签语法硬锁'],
  [by('30｜'),'高校已识别角色不得重新匿名'],
  [by('41｜'),'第一活骸事故只讲已锚定事实'],
  [by('44｜'),'高校身份来源顺序'],
  [by('67｜'),'泰丝拉姓名必须来自珈儿介绍'],
  [by('17｜'),'最终状态字面量锁｜提交前最后检查'],
  [by('91｜'),'最终状态字面量锁｜提交前最后检查'],
];
for(const [entry,marker] of required) expect(String(entry?.content||'').includes(marker),`rule:${marker}`);

const e04=String(by('04｜')?.content||'');
const e13=String(by('13｜')?.content||'');
const e14=String(by('14｜')?.content||'');
const e17=String(by('17｜')?.content||'');
const e18=String(by('18｜')?.content||'');
const phi=String(card.data?.post_history_instructions||'');
const annRules=[e04,e13,e14,e18,phi].join('\n');
const ordinaryRules=[e04,e17,phi].join('\n');
const combinedRules=[e04,e13,e14,e17,e18,phi].join('\n');

expect(e13.includes('ann.affection>=100'),'ann-qualification-affection');
expect(e13.includes('ANN_CORE_30')&&e13.includes('ANN_CORE_60')&&e13.includes('ANN_CORE_80'),'ann-qualification-events');
expect(e14.includes("route='ann'")&&e14.includes('eligible=true'),'ann-route-entry');
expect(e14.includes('第三天追安失败固定剧情')&&/安(?:以刀)?刺伤指挥使/.test(e14)&&e14.includes('指挥使受到近乎致命的伤势并进入濒死状态')&&e14.includes('小神介入')&&(e14.includes('保持普通线')||e14.includes('普通线继续')),'ann-chase-failure-atomic');
expect(/(?:不得|不)写入meta\.endings/.test(e14)&&(/不得播放任何结局CG/.test(e14)||/不得触发.*cg_ending_/s.test(e14)),'ann-chase-not-ending');

expect(ordinaryRules.includes("route!='ann'"),'ordinary-ending-route');
expect(ordinaryRules.includes('8/8黑核purified')&&ordinaryRules.includes('牺牲的意义'),'ordinary-sacrifice-dispatch');
expect(ordinaryRules.includes('purified_core_count>=4')&&ordinaryRules.includes('箱庭风景'),'ordinary-box-dispatch');
expect(ordinaryRules.includes('purified_core_count<4')&&ordinaryRules.includes('终结'),'ordinary-final-dispatch');
expect(ordinaryRules.includes('满8核但牺牲其他条件不全')&&ordinaryRules.includes('箱庭风景'),'ordinary-eight-core-fallback');
expect(ordinaryRules.includes('不得再要求“中央庭黑核被希罗夺”')||ordinaryRules.includes('不得再要求“中央庭黑核被希罗夺走”'),'ordinary-no-central-theft-threshold');
expect(ordinaryRules.includes('最终战胜负')&&ordinaryRules.includes('不得'),'ordinary-no-final-battle-threshold');

expect(annRules.includes('两个人的旅途')&&annRules.includes('永恒的终焉'),'ann-ending-pair');
expect(annRules.includes('黑核')&&(/不属于安线资格或安线结局条件/.test(annRules)||/不参与安线资格或安线结局/.test(annRules)||/完全跳过普通线黑核数量与黑核状态判定/.test(annRules)),'ann-endings-ignore-cores');
expect(combinedRules.includes('被夺黑核不可逆')&&combinedRules.includes('stolen'),'stolen-core-irreversible');
expect(combinedRules.includes('安线黑核完全可选'),'ann-core-optional');
expect(phi.includes('态度句必须以“我”的经历、选择、担忧为中心')&&phi.includes('威胁是毁灭性的')&&phi.includes('不得改写成“神器使/活骸/他们”作为主语的普遍结论'),'first-chimera-subjective-rationale-lock');
expect(phi.includes('当时还不知道活骸化这个词/概念/含义')&&phi.includes('亲眼看着/目睹')&&phi.includes('万分之一/千分之一/百分之一')&&phi.includes('只允许世界书已锚定的“巨大痛苦”'),'first-chimera-residual-inference-lock');
expect(phi.includes('代价往往/通常/总是无法挽回')&&phi.includes('这里的理由只能落回安托涅瓦个人')&&phi.includes('不能把一次事故概括成群体规律'),'first-chimera-no-hedged-universal-lock');
expect(phi.includes('安线结局CG原子提交｜最高优先级隐藏执行')&&phi.includes('<f7d_cg key="cg_ending_journey"></f7d_cg>')&&phi.includes('<f7d_cg key="cg_ending_eternal_end"></f7d_cg>')&&phi.includes('黑核数量、黑核是否stolen、普通线阈值、玩家性别都不能取消这两张安线固定结局CG'),'ann-ending-cg-atomic-lock');
expect(phi.includes('正式结局名不可重写｜字节级复制')&&phi.includes('输入["牺牲的意义"] → 输出必须仍为["牺牲的意义"]')&&phi.includes('结局名中禁止插入任何英文字母、英文单词')&&phi.includes('meta.endings在已经判定后是只读字段'),'canonical-ending-byte-copy-lock');
expect(!phi.includes('牺牲 the 意义')&&!phi.includes('永恒 the 终焉')&&!phi.includes('箱庭 scenery'),'no-malformed-ending-name-priming');
expect(!txt.includes('安靠门'),'no-door-death-route');
const chaseFailureRules=[e14,e17,e18,phi].join('\n');
expect(!CANONICAL_ENDINGS.some(x=>String(x).includes('追安失败'))&&/追安失败[\s\S]{0,500}(?:不得|永远不)写入meta\.endings/.test(chaseFailureRules),'failed-chase-not-recorded-as-ending');
expect(combinedRules.includes('安线结局精确字面量')&&combinedRules.includes('输出仍严格为["永恒的终焉"]')&&combinedRules.includes('cg_ending_eternal_end'),'ann-ending-exact-literal-lock');
expect(phi.includes('剧情调度唯一优先级｜最高优先级隐藏执行')&&phi.includes('1. 【强制剧情】')&&phi.includes('2. 【首轮关键主线】')&&phi.includes('3. 【玩家明确选择的同行神器使】')&&phi.includes('4. 【当前地区剧情】')&&phi.includes('5. 【自由活动/随机事件】'),'dispatch-priority-rule');
expect(phi.includes('线路与结局结算唯一顺序｜最高优先级隐藏执行')&&phi.includes('线路关闭条件 → 强制剧情结果 → 结局资格条件 → 结局优先级 → 演出/CG'),'ending-resolution-order-rule');

const initialMatch=String(card.data?.first_mes||'').match(/<f7d_state>([\s\S]*?)<\/f7d_state>/i);
expect(Boolean(initialMatch),'initial-state');
let initial={};
if(initialMatch){try{initial=JSON.parse(initialMatch[1]);}catch{fail.push('initial-json');}}
expect(initial.intel_flags?.zero_identity_known===false,'initial-zero-lock');
expect(initial.intel_flags?.countdown_meaning_known===false,'initial-countdown-lock');
expect(initial.npc_intel&&Object.keys(initial.npc_intel).length===0,'initial-npc-intel');
expect(initial.player_profile?.gender==='unknown','initial-gender');
expect(!Object.prototype.hasOwnProperty.call(initial,'node_used'),'initial-node-used');
expect(!Object.values(initial.regions||{}).some(r=>r&&Object.prototype.hasOwnProperty.call(r,'patrol')),'initial-patrol');
expect(initial.day_ready_to_sleep===false,'initial-sleep');
expect(initial.ann?.deadline_checked===false&&initial.ann?.deadline_passed===null,'initial-ann-deadline');
expect(initial.route_flags?.ann_route_closed===false&&initial.route_flags?.harbor_core_stolen===false,'initial-route-flags');
expect(initial.cg_system?.mode==='direct_only'&&initial.cg_system?.album_enabled===false&&initial.cg_system?.responsive_enabled===true,'initial-cg-mode');
expect(initial.cg_system?.shown?.ann_first_meet===true,'initial-ann-cg-shown');
expect(/<f7d_cg\s+key=["']cg_ann_first_meet["']\s*>\s*<\/f7d_cg>/i.test(String(card.data?.first_mes||'')),'opening-ann-cg');

for(const marker of ['结构壳稳定性｜最高优先级隐藏执行','第一活骸五事实闭包｜最高优先级隐藏执行','最终日结局结算｜最高优先级隐藏执行','正式结局集合｜唯一名单｜最高优先级隐藏执行','最终状态字面量锁｜提交前最后检查','剧情调度唯一优先级｜最高优先级隐藏执行','线路与结局结算唯一顺序｜最高优先级隐藏执行']){
  expect(phi.includes(marker),`phi:${marker}`);
}

const helper=card.data?.extensions?.tavern_helper;
const helperScript=helper?.scripts?.find(x=>x?.id==='qidu-v0424-choice-bridge');
expect(Boolean(helperScript?.enabled),'helper-enabled');
expect(String(helperScript?.content||'').includes('__F7D_CARD_CHOICE_BRIDGE_V0424__'),'helper-marker');
expect(String(helperScript?.content||'').includes("version:'1.6.0'"),'helper-version');

const qf=card.data?.extensions?.qidu_frontend||{};
expect(qf.choice_runtime==='tavern_helper_embedded_script','choice-runtime');
expect(qf.progression_mode==='narrative_flow'&&qf.action_nodes===false&&qf.patrol_counter===false,'flow-meta');
expect(qf.region_liberation==='auto_on_story_completion','liberation-meta');
expect(qf.core_purification==='explicit_user_action_only','core-meta');
expect(qf.day_transition==='explicit_sleep_only','sleep-meta');
expect(qf.choice_mode==='three_story_plus_contextual_skip_and_free_input'&&qf.continuous_scene_skip===false,'choice-meta');
expect(JSON.stringify(qf.dispatch_priority)===JSON.stringify(['forced','first_loop_mainline','selected_companion','region','free_random']),'dispatch-priority-meta');
expect(JSON.stringify(qf.ending_resolution_order)===JSON.stringify(['route_closure','forced_plot_result','ending_eligibility','ending_priority','performance']),'ending-resolution-order-meta');

expect(!entries.some(e=>/(?:第\s*[一二三四五六123456]\s*次?巡查|[1-6]\s*\/\s*6\s*[：:]|【(?:六|6)\s*巡查】|(?:六|6)\s*次巡查|(?:六|6)\s*巡查)/.test(String(e.name||'')+'\n'+String(e.content||''))),'counted-region-wording');
expect(!entries.some(e=>/携带蛋糕巡查中央城区1次|巡查东方古街1次找到阿岚|再巡查海湾侧城1次|巡查研究所1次取得深海潜艇图纸|最后巡查港湾区进入深海位置/.test(String(e.content||''))),'residual-counted-actions');

if(fail.length){
  console.error(JSON.stringify({ok:false,version:card.data?.character_version,sha256:compactSha256,fail},null,2));
  process.exit(1);
}

await fs.rm(out,{recursive:true,force:true});
await fs.mkdir(out,{recursive:true});
const name='永远的7日之都-七日轮回文本互动-v0.4.24.json';
await fs.writeFile(`${out}/${name}`,raw);
await fs.writeFile(`${out}/SHA256.txt`,`${compactSha256}  ${name}\n`);
const disk=await fs.readFile(`${out}/${name}`);
const diskSha=crypto.createHash('sha256').update(disk).digest('hex');
expect(diskSha===compactSha256,'written-sha');
if(fail.length){
  console.error(JSON.stringify({ok:false,version:card.data?.character_version,sha256:compactSha256,fail},null,2));
  process.exit(1);
}
console.log(JSON.stringify({ok:true,version:card.data.character_version,creator:card.data.creator,sha256:compactSha256,bytes:raw.length,cgCount:CG_KEYS.length,entries:entries.length,bridge:'1.6.0',output:`${out}/${name}`},null,2));
